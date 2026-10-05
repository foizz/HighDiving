/**
 * The rules assistant.
 *
 * Runs server-side because the OpenAI key must never reach the browser. The caller's
 * Supabase JWT is required and is reused for every database read, so the assistant can
 * only ever see what that user could see for themselves.
 *
 * Two deliberate choices:
 *
 *  - Both rule books go into the system prompt whole (~32k tokens) behind a cache
 *    breakpoint, rather than through a retrieval index. They fit, caching makes the
 *    repeat cost small, and nothing can silently drop the clause that decides an answer.
 *  - Degrees of difficulty, list legality, scores and standings are answered by tools
 *    that call the app's own functions, not from the prompt. The assistant therefore
 *    cannot disagree with the dive picker, and the figures stay covered by the app's
 *    tests.
 *
 * Deploy: supabase functions deploy ask
 * Secret: supabase secrets set OPENAI_API_KEY=sk-...
 */
import OpenAI from 'npm:openai@7.25.0';
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import {
  allDives,
  awardNeededForTarget,
  evaluateList,
  lookupDD,
  positionsFor,
  RULE_SETS,
  scoreDive,
  seriesRanking,
  worldRanking,
} from '../_shared/engine.js';
import { RULES, RULE_SET_IDS } from '../_shared/rules-text.js';

/**
 * gpt-5-nano: the cheapest model OpenAI offers, and cached input is a tenth of the
 * input rate, which is what makes sending both rule books on every question
 * affordable. Overridable because which models a key can reach varies by account.
 */
const MODEL = Deno.env.get('OPENAI_MODEL') ?? 'gpt-5-nano';
/**
 * Includes the hidden reasoning tokens, not just the visible answer, so it needs
 * headroom well beyond the length of a reply.
 */
const MAX_OUTPUT_TOKENS = 16000;
/** Low keeps nano from spending the whole output budget thinking before it answers. */
const REASONING_EFFORT = (Deno.env.get('OPENAI_REASONING_EFFORT') ?? 'low') as
  | 'minimal'
  | 'low'
  | 'medium'
  | 'high';
/** Per-user daily ceiling, enforced before any model call. */
const DAILY_CALL_LIMIT = Number(Deno.env.get('ASK_DAILY_LIMIT') ?? '50');
/** Guards against a tool loop that never settles. */
const MAX_TURNS = 8;

const CORS = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SYSTEM_INSTRUCTIONS = `
You answer questions about high diving for divers and coaches, using the two rule books
above and the tools provided.

How to answer:
- The database holds every uploaded result, standing and diver. Look things up with the
  tools before answering, and never ask the user for points, placings or standings that
  a tool can give you. Today's date is given at the start of the conversation; the
  season is its year unless the question says otherwise.
- Do not ask a clarifying question you can resolve with a sensible default. Make the
  assumption, state it in one line, and answer. "The last two years" means this season
  and the one before. A question that does not name a book covers both, reported
  separately; one that does not name a gender covers both, reported separately.
- "Score" usually means a competition total (the sum of the four dives, a few hundred
  points), not ranking points (20 for a Red Bull win, 45 on the World Ranking). If a
  number the user mentions is in the hundreds, they mean the competition total.
- Cite the rule you are relying on, in the book's own numbering: "HD 6.5" for World
  Aquatics, "Red Bull 3.5.3" for Red Bull. A claim about the rules without a citation is
  not useful to a diver arguing with a referee.
- The two books are different documents with different numbers. Never attribute a Red Bull
  rule to World Aquatics or the reverse, and say which book you are answering for when the
  question does not make it clear. Where they differ, say so — the commonest trap is that
  Red Bull requires all four dives from different take-offs while World Aquatics only
  requires each pair to differ. In both books a dive over its slot's DD limit is legal but
  scores at the limit, not at its table DD.
- Never state a degree of difficulty, a score, a legality verdict or a ranking position
  from memory. Call the tool. The DD tables differ between the two books, so a remembered
  number is likely to be wrong for the book being asked about.
- If the books do not answer the question, say that plainly instead of inferring a rule.
  Competition results only exist in the database once an administrator has uploaded them;
  if a season is empty, say so rather than guessing at placings.
- Be brief and concrete. A diver asking what they need on a last dive wants the number.

Two separate season rankings exist and must never be combined:
- The World Series ranking (Red Bull 3.3.1) counts Red Bull tour stops only, sums points,
  and includes the +1 best dive bonus (3.4.1).
- The World Ranking (Red Bull 6.2) also counts World Aquatics High Diving World Cups,
  uses a different points scale, and averages over appearances with a divisor that is
  never below four.
A World Aquatics result changes the World Ranking and has no effect on the World Series
ranking.
`.trim();

/**
 * The whole static prefix, in one string, rule books first.
 *
 * This is what prompt caching keys on, so nothing variable may be added to it: no
 * timestamps, no user name, no season. Anything per-request belongs in `input`.
 */
const RULES_TEXT = RULE_SET_IDS.map((id: string) => RULES[id as keyof typeof RULES]).join(
  '\n\n\n',
);
const SYSTEM_PROMPT = `${RULES_TEXT}\n\n${SYSTEM_INSTRUCTIONS}`;

/** The filters shared by every tool that reads uploaded results. */
const RESULT_FILTERS = {
  season_from: { type: ['integer', 'null'], description: 'first season, inclusive' },
  season_to: { type: ['integer', 'null'], description: 'last season, inclusive' },
  rule_set: { type: ['string', 'null'], enum: ['redbull', 'worldaquatics', null] },
  gender: { type: ['string', 'null'], enum: ['men', 'women', null] },
  diver_name: { type: ['string', 'null'] },
  competition_name: {
    type: ['string', 'null'],
    description: 'matches the competition name or its location, e.g. "World Cup" or "Mostar"',
  },
};

const tools = [
  {
    type: 'function' as const,
    name: 'lookup_dd',
    description:
      'The degree of difficulty of one dive, in one position, at one height, from one ' +
      "rule book's table. Use this for every DD question.",
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        rule_set: { type: 'string', enum: ['redbull', 'worldaquatics'] },
        dive_number: { type: 'string', description: 'e.g. "102", "5141", "5(1)161"' },
        position: { type: 'string', enum: ['A', 'B', 'C', 'D', 'E'] },
        height: {
          type: 'string',
          enum: ['27', '20', '15', '10_12'],
          description: "27 for men's, 20 for women's high diving",
        },
      },
      required: ['rule_set', 'dive_number', 'position', 'height'],
    },
  },
  {
    type: 'function' as const,
    name: 'find_dives',
    description:
      'Search a rule book\'s dive table by number or description, returning each match ' +
      'with the positions it may be performed in and their DDs at a height.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        rule_set: { type: 'string', enum: ['redbull', 'worldaquatics'] },
        height: { type: 'string', enum: ['27', '20', '15', '10_12'] },
        query: { type: 'string', description: 'number or words, e.g. "back 3" or "5141"' },
      },
      required: ['rule_set', 'height', 'query'],
    },
  },
  {
    type: 'function' as const,
    name: 'validate_list',
    description:
      'Check a four-dive list against a rule book: per-dive DD, the slot limits, take-off ' +
      'variety, repeats, and the resulting total DD.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        rule_set: { type: 'string', enum: ['redbull', 'worldaquatics'] },
        gender: { type: 'string', enum: ['men', 'women'] },
        dives: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              slot: {
                type: 'string',
                enum: ['required', 'intermediate', 'optional1', 'optional2'],
              },
              number: { type: 'string' },
              position: { type: 'string', enum: ['A', 'B', 'C', 'D', 'E'] },
            },
            required: ['slot', 'number', 'position'],
          },
        },
      },
      required: ['rule_set', 'gender', 'dives'],
    },
  },
  {
    type: 'function' as const,
    name: 'score_dive',
    description:
      'Score one dive from the judges\' awards and a DD: drops the highest and lowest, ' +
      'sums the rest, multiplies by DD.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        awards: { type: 'array', items: { type: 'number' } },
        dd: { type: 'number' },
        judge_count: { type: 'integer', enum: [5, 7] },
      },
      required: ['awards', 'dd', 'judge_count'],
    },
  },
  {
    type: 'function' as const,
    name: 'award_needed_for_target',
    description:
      'What each counting judge must award on the remaining dives to reach a target total.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        target: { type: 'number' },
        scored_so_far: { type: 'number' },
        remaining_dds: { type: 'array', items: { type: 'number' } },
      },
      required: ['target', 'scored_so_far', 'remaining_dds'],
    },
  },
  {
    type: 'function' as const,
    name: 'get_ranking',
    description:
      'The current standings for a season. "series" is the Red Bull World Series ranking ' +
      '(tour stops, summed); "world" is the World Ranking (tour stops and World Aquatics ' +
      'World Cups, averaged). They are separate tables.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        kind: { type: 'string', enum: ['series', 'world'] },
        season: { type: 'integer' },
        gender: { type: 'string', enum: ['men', 'women'] },
      },
      required: ['kind', 'season', 'gender'],
    },
  },
  {
    type: 'function' as const,
    name: 'placing_needed',
    description:
      'For one diver, the overall ranking position he or she would hold after each ' +
      'possible place at the next event, and the worst place that still reaches a target ' +
      'position. Use this for every "what place does X need" question; the next event ' +
      'does not have to be in the database.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        kind: {
          type: 'string',
          enum: ['series', 'world'],
          description: 'world for a World Aquatics World Cup, which only counts there',
        },
        season: { type: 'integer' },
        gender: { type: 'string', enum: ['men', 'women'] },
        diver_name: { type: 'string' },
        target_position: { type: 'integer' },
      },
      required: ['kind', 'season', 'gender', 'diver_name', 'target_position'],
    },
  },
  {
    type: 'function' as const,
    name: 'query_results',
    description:
      'Individual uploaded results (place, total score, best dive), newest first. Narrow ' +
      'by any of: a range of seasons, rule book, gender, diver name, competition name or ' +
      'location. Pass null for a filter you do not need.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: RESULT_FILTERS,
      required: Object.keys(RESULT_FILTERS),
    },
  },
  {
    type: 'function' as const,
    name: 'score_by_place',
    description:
      'For each finishing place (1st, 2nd, ...), the average, lowest and highest total ' +
      'competition score that earned it across past competitions. Use this for "what ' +
      'score do you need to finish in the top N" questions. A total score is the sum of ' +
      'the four dives, typically a few hundred points; it is not ranking points.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        ...RESULT_FILTERS,
        max_place: { type: 'integer', description: 'last place to report, e.g. 5 for top 5' },
      },
      required: [...Object.keys(RESULT_FILTERS), 'max_place'],
    },
  },
  {
    type: 'function' as const,
    name: 'get_my_lists',
    description: "The signed-in user's own saved dive lists.",
    strict: true,
    parameters: { type: 'object', additionalProperties: false, properties: {}, required: [] },
  },
];

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS });
  }

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    return Response.json(
      { error: 'The assistant is not configured: OPENAI_API_KEY is not set.' },
      { status: 503, headers: CORS },
    );
  }

  const authorization = req.headers.get('Authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) {
    return Response.json({ error: 'Sign in to use the assistant.' }, { status: 401, headers: CORS });
  }

  // The caller's own token, so every query below runs under their row level security.
  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authorization } } },
  );

  const { data: userData, error: userError } = await db.auth.getUser();
  if (userError || !userData?.user) {
    return Response.json({ error: 'Sign in to use the assistant.' }, { status: 401, headers: CORS });
  }
  const userId = userData.user.id;

  // Rate limit before spending anything. Without this one looping client could run the
  // project's whole API budget.
  const today = new Date().toISOString().slice(0, 10);
  const { data: usage } = await db
    .from('ai_usage')
    .select('calls')
    .eq('user_id', userId)
    .eq('day', today)
    .maybeSingle();
  const callsToday = usage?.calls ?? 0;
  if (callsToday >= DAILY_CALL_LIMIT) {
    return Response.json(
      { error: `You have reached today's limit of ${DAILY_CALL_LIMIT} questions.` },
      { status: 429, headers: CORS },
    );
  }
  await db
    .from('ai_usage')
    .upsert({ user_id: userId, day: today, calls: callsToday + 1 }, { onConflict: 'user_id,day' });

  let body: { messages?: { role: 'user' | 'assistant'; content: string }[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Expected a JSON body.' }, { status: 400, headers: CORS });
  }
  const history = (body.messages ?? []).filter(
    (m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string',
  );
  if (!history.length) {
    return Response.json({ error: 'Ask a question.' }, { status: 400, headers: CORS });
  }

  // ---- tool implementations -------------------------------------------------

  /** A season's competitions, results and divers, shaped for the ranking engine. */
  async function loadRankingInput(season: number, gender: string) {
    const [comps, divers] = await Promise.all([
      db.from('competitions').select('*').eq('season', season),
      db.from('divers').select('*'),
    ]);
    if (comps.error) return { error: comps.error.message };
    const competitions = (comps.data ?? []).map((c: Record<string, unknown>) => ({
      id: c.id,
      season: c.season,
      name: c.name,
      location: c.location,
      heldOn: c.held_on,
      ruleSet: c.rule_set,
      gender: c.gender,
      countsForSeries: c.counts_for_series,
      countsForWorldRanking: c.counts_for_world_ranking,
    }));
    let results: Record<string, unknown>[] = [];
    if (competitions.length) {
      const { data: rows, error } = await db
        .from('results')
        .select('*')
        .in('competition_id', competitions.map((c: { id: unknown }) => String(c.id)));
      if (error) return { error: error.message };
      results = (rows ?? []).map((r: Record<string, unknown>) => ({
        competitionId: r.competition_id,
        diverId: r.diver_id,
        rank: r.rank,
        score: r.score == null ? null : Number(r.score),
        bestDive: r.best_dive,
      }));
    }
    return { season, gender, competitions, results, divers: divers.data ?? [] };
  }

  /**
   * Results matching the shared result filters, newest competition first. The filters
   * run in the database (the `!inner` joins make a filter on a competition or diver drop
   * the result, not just blank its embedded row), so nothing is cut off before filtering.
   */
  async function loadResults(input: Record<string, unknown>) {
    const data: unknown[] = [];
    // The API caps a response at 1000 rows, so read in pages.
    for (let from = 0; ; from += 1000) {
      const page = await resultsQuery(input).range(from, from + 999);
      if (page.error) return { error: page.error.message };
      data.push(...(page.data ?? []));
      if ((page.data ?? []).length < 1000) break;
    }
    return { rows: shapeResults(data) };
  }

  function resultsQuery(input: Record<string, unknown>) {
    let q = db
      .from('results')
      .select(
        'rank, score, best_dive, competitions!inner(name, location, season, held_on, gender, rule_set), divers!inner(name)',
      )
      // A stable order, so pages neither skip nor repeat rows.
      .order('competition_id')
      .order('diver_id');
    if (input.season_from != null) q = q.gte('competitions.season', input.season_from as number);
    if (input.season_to != null) q = q.lte('competitions.season', input.season_to as number);
    if (input.rule_set != null) q = q.eq('competitions.rule_set', input.rule_set as string);
    if (input.gender != null) q = q.eq('competitions.gender', input.gender as string);
    if (input.diver_name) q = q.ilike('divers.name', `%${input.diver_name}%`);
    if (input.competition_name) {
      // Commas and parentheses would break the or() expression; they never occur in a name.
      const term = String(input.competition_name).replace(/[,()]/g, ' ');
      q = q.or(`name.ilike.*${term}*,location.ilike.*${term}*`, { referencedTable: 'competitions' });
    }
    return q;
  }

  function shapeResults(data: unknown[]) {
    type Row = {
      rank: number;
      score: number | null;
      best_dive: boolean;
      competitions: Record<string, unknown>;
      divers: { name: string };
    };
    return (data as Row[])
      .map((r) => ({
        competition: [r.competitions.name, r.competitions.location].filter(Boolean).join(', '),
        season: r.competitions.season as number,
        heldOn: r.competitions.held_on as string | null,
        ruleSet: r.competitions.rule_set as string,
        gender: r.competitions.gender as string,
        place: r.rank,
        diver: r.divers.name,
        score: r.score == null ? null : Number(r.score),
        bestDive: r.best_dive,
      }))
      .sort((a, b) => String(b.heldOn ?? '').localeCompare(String(a.heldOn ?? '')) || a.place - b.place);
  }

  async function runTool(name: string, input: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      case 'lookup_dd': {
        const r = lookupDD(
          input.rule_set as never,
          input.dive_number as string,
          input.position as never,
          input.height as never,
        );
        return r.dd == null
          ? {
              found: false,
              reason: r.dive
                ? `${input.dive_number} is not listed in position ${input.position} at ${input.height}m, so it may not be performed there.`
                : `${input.dive_number} is not in the ${input.rule_set} table.`,
            }
          : {
              found: true,
              dd: r.dd,
              description: r.description,
              takeoff: r.parsed?.takeoff ?? null,
              group: r.dive?.group ?? null,
            };
      }

      case 'find_dives': {
        const q = String(input.query ?? '').trim().toLowerCase();
        const height = input.height as never;
        const matches = allDives(input.rule_set as never)
          .filter((d: { dd: Record<string, unknown> }) => d.dd[height as string])
          .filter(
            (d: { number: string; description: string }) =>
              !q ||
              d.number.toLowerCase().includes(q) ||
              d.description.toLowerCase().includes(q),
          )
          .slice(0, 25);
        return {
          count: matches.length,
          dives: matches.map((d: { number: string; description: string; group: number }) => ({
            number: d.number,
            description: d.description,
            group: d.group,
            positions: positionsFor(input.rule_set as never, d.number, height).map((p: string) => ({
              position: p,
              dd: lookupDD(input.rule_set as never, d.number, p as never, height).dd,
            })),
          })),
        };
      }

      case 'validate_list': {
        const rules = RULE_SETS[input.rule_set as 'redbull' | 'worldaquatics'];
        const result = evaluateList(input.dives as never, rules, input.gender as never);
        return {
          legal: result.valid,
          totalDD: result.totalDD,
          maxScore: result.maxScore,
          listProblems: result.violations.map((v: { message: string; citation: string }) => ({
            message: v.message,
            rule: v.citation,
          })),
          dives: result.dives.map(
            (d: {
              slot: string;
              number: string;
              position: string;
              description: string;
              takeoff: string | null;
              rawDD: number | null;
              effectiveDD: number;
              capped: boolean;
              failed: boolean;
              violations: { message: string; citation: string }[];
            }) => ({
              slot: d.slot,
              dive: `${d.number}${d.position}`,
              description: d.description,
              takeoff: d.takeoff,
              dd: d.rawDD,
              scoringDD: d.effectiveDD,
              capped: d.capped,
              failed: d.failed,
              problems: d.violations.map((v) => ({ message: v.message, rule: v.citation })),
            }),
          ),
        };
      }

      case 'score_dive':
        return scoreDive(
          input.awards as number[],
          input.dd as number,
          input.judge_count as number,
        );

      case 'award_needed_for_target':
        return awardNeededForTarget(
          input.target as number,
          input.scored_so_far as number,
          input.remaining_dds as number[],
        );

      case 'get_ranking': {
        const season = input.season as number;
        const loaded = await loadRankingInput(season, input.gender as string);
        if ('error' in loaded) return loaded;
        if (!loaded.competitions.length) {
          return { standings: [], note: `No competitions are recorded for ${season}.` };
        }
        const args = loaded;
        const standings =
          input.kind === 'series' ? seriesRanking(args as never) : worldRanking(args as never);
        return {
          kind: input.kind,
          rule: input.kind === 'series' ? 'Red Bull 3.3.1' : 'Red Bull 6.2',
          standings: standings.slice(0, 30).map((s: Record<string, unknown>) => ({
            position: s.position,
            diver: (s.diver as { name?: string } | null)?.name ?? 'unknown',
            appearances: s.appearances,
            ...(input.kind === 'series'
              ? { points: s.points, bestDives: s.bestDives }
              : {
                  totalPoints: s.totalPoints,
                  divisor: s.divisor,
                  average: s.average,
                  divisorFloored: s.divisorFloored,
                }),
          })),
        };
      }

      case 'placing_needed': {
        const season = input.season as number;
        const kind = input.kind as 'series' | 'world';
        const loaded = await loadRankingInput(season, input.gender as string);
        if ('error' in loaded) return loaded;
        const wanted = String(input.diver_name).toLowerCase();
        const matches = loaded.divers.filter((d: { name?: string }) =>
          String(d.name ?? '').toLowerCase().includes(wanted),
        );
        if (matches.length !== 1) {
          return {
            error: matches.length
              ? `"${input.diver_name}" matches several divers: ${matches.map((d: { name?: string }) => d.name).join(', ')}.`
              : `No diver named "${input.diver_name}".`,
          };
        }
        const diver = matches[0] as { id: string; name: string };
        const rank = kind === 'series' ? seriesRanking : worldRanking;
        const positionOf = (standings: Record<string, unknown>[]) => {
          const row = standings.find((s) => s.diverId === diver.id);
          return row
            ? {
                position: row.position as number,
                ...(kind === 'series' ? { points: row.points } : { average: row.average }),
              }
            : null;
        };

        // The upcoming event is not in the database, so add it as a hypothetical one in
        // which only this diver scores: every other diver stands still.
        const hypothetical = {
          id: '__next_event__',
          season,
          gender: input.gender,
          countsForSeries: kind === 'series',
          countsForWorldRanking: true,
        };
        const target = input.target_position as number;
        const outcomes: { placeAtNextEvent: number; position?: number }[] = [];
        for (let place = 1; place <= (kind === 'series' ? 12 : 20); place++) {
          const standings = rank({
            ...loaded,
            competitions: [...loaded.competitions, hypothetical],
            results: [
              ...loaded.results,
              { competitionId: hypothetical.id, diverId: diver.id, rank: place, score: null, bestDive: false },
            ],
          } as never) as Record<string, unknown>[];
          outcomes.push({ placeAtNextEvent: place, ...positionOf(standings) });
        }
        const good = outcomes.filter((o) => (o.position ?? Infinity) <= target);
        return {
          diver: diver.name,
          kind,
          rule: kind === 'series' ? 'Red Bull 3.3.1, 3.3.2' : 'Red Bull 6.1, 6.2',
          current: positionOf(rank(loaded as never) as Record<string, unknown>[]),
          target_position: target,
          worst_place_that_reaches_target: good.length ? good[good.length - 1].placeAtNextEvent : null,
          outcomes,
          assumption:
            'Only this diver is scored at the next event; every other diver keeps their ' +
            'current total. Ties are broken by placings (most 1st, most 2nd, ...).',
        };
      }

      case 'query_results': {
        const loaded = await loadResults(input);
        if ('error' in loaded) return loaded;
        return {
          count: loaded.rows.length,
          ...(loaded.rows.length > 80 ? { note: 'Showing the newest 80; narrow the filters for more.' } : {}),
          results: loaded.rows.slice(0, 80),
        };
      }

      case 'score_by_place': {
        const loaded = await loadResults(input);
        if ('error' in loaded) return loaded;
        const maxPlace = Math.max(1, Math.min(input.max_place as number, 30));
        const byPlace = new Map<number, number[]>();
        for (const r of loaded.rows) {
          if (r.place > maxPlace || r.score == null) continue;
          byPlace.set(r.place, [...(byPlace.get(r.place) ?? []), r.score]);
        }
        const round = (n: number) => Math.round(n * 100) / 100;
        return {
          competitions: new Set(loaded.rows.map((r) => `${r.competition}|${r.season}|${r.gender}`)).size,
          note:
            'Total competition scores. Red Bull and World Aquatics events use different ' +
            'formats, and men and women dive different heights, so compare like with like.',
          places: [...byPlace.entries()]
            .sort(([a], [b]) => a - b)
            .map(([place, scores]) => ({
              place,
              events: scores.length,
              average: round(scores.reduce((s, x) => s + x, 0) / scores.length),
              lowest: Math.min(...scores),
              highest: Math.max(...scores),
            })),
        };
      }

      case 'get_my_lists': {
        const { data, error } = await db
          .from('dive_lists')
          .select('name, rule_set, gender, dives, updated_at')
          .order('updated_at', { ascending: false })
          .limit(20);
        if (error) return { error: error.message };
        return { lists: data ?? [] };
      }

      default:
        return { error: `No tool named ${name}.` };
    }
  }

  // ---- the model loop -------------------------------------------------------

  const openai = new OpenAI({ apiKey });

  /**
   * The Responses API carries conversation state as a flat list of items rather than a
   * messages array. The model's own output items are appended verbatim between turns —
   * including reasoning items, which must be passed back alongside tool results.
   */
  // The SDK's own item union, so a malformed item is caught here rather than by a 400.
  type InputItem = OpenAI.Responses.ResponseInputItem;
  // The date goes here rather than in the instructions, which must stay byte-identical
  // for the prompt cache.
  const input: InputItem[] = [
    { role: 'developer', content: `Today's date is ${today}.` },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(new TextEncoder().encode(sse(event, data)));

      try {
        for (let turn = 0; turn < MAX_TURNS; turn++) {
          /*
           * Prompt caching is left implicit, which is the default. The rule books and the
           * tool definitions are the front of every request and never change, so the
           * prefix matches on its own. Explicit mode would allow a longer TTL, but a
           * request in explicit mode with a misplaced breakpoint caches nothing at all,
           * and that failure is silent and expensive.
           */
          const events = await openai.responses.create({
            model: MODEL,
            instructions: SYSTEM_PROMPT,
            input,
            tools,
            max_output_tokens: MAX_OUTPUT_TOKENS,
            reasoning: { effort: REASONING_EFFORT },
            stream: true,
          });

          let completed: OpenAI.Responses.Response | undefined;
          let stopped: string | undefined;
          for await (const event of events) {
            if (event.type === 'response.output_text.delta') {
              send('text', { text: event.delta });
            } else if (event.type === 'response.completed') {
              completed = event.response;
            } else if (event.type === 'response.incomplete') {
              stopped = event.response.incomplete_details?.reason ?? 'unknown';
            } else if (event.type === 'response.failed') {
              stopped = event.response.error?.message ?? 'failed';
            } else if (event.type === 'error') {
              send('error', { error: event.message ?? 'The model stream failed.' });
            }
          }

          if (!completed) {
            console.error(`ask: response not completed (${stopped ?? 'stream ended early'})`);
            send('error', {
              error:
                stopped === 'max_output_tokens'
                  ? 'The answer ran past the length limit. Try a narrower question.'
                  : `The model did not finish its answer (${stopped ?? 'stream ended early'}).`,
            });
            break;
          }

          // Keep every item the model produced, in order, or the next turn loses the
          // reasoning that led to the tool call.
          const output = completed.output ?? [];
          input.push(...(output as InputItem[]));

          const calls = output.filter(
            (item): item is OpenAI.Responses.ResponseFunctionToolCall =>
              item.type === 'function_call',
          );

          if (!calls.length) {
            // cached_tokens is the number worth watching: if it stays at zero across
            // questions, the rule-book prefix is not being reused and every answer is
            // paying full price for 32k tokens.
            send('usage', {
              input: completed.usage?.input_tokens ?? 0,
              cached: completed.usage?.input_tokens_details?.cached_tokens ?? 0,
              output: completed.usage?.output_tokens ?? 0,
            });
            break;
          }

          for (const call of calls) {
            send('tool', { name: call.name });
            console.log(`ask: tool ${call.name} ${call.arguments}`);
            let result: unknown;
            try {
              // Arguments arrive as a JSON string; a malformed one is the model's error
              // to recover from, so it goes back as a tool result rather than a throw.
              result = await runTool(call.name, JSON.parse(call.arguments));
            } catch (err) {
              result = { error: err instanceof Error ? err.message : 'Tool failed.' };
            }
            input.push({
              type: 'function_call_output',
              call_id: call.call_id,
              output: JSON.stringify(result),
            });
          }
        }
        send('done', {});
      } catch (err) {
        send('error', {
          error: err instanceof Error ? err.message : 'The assistant failed to answer.',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...CORS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
});
