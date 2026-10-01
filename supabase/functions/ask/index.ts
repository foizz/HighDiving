/**
 * The rules assistant.
 *
 * Runs server-side because the Anthropic key must never reach the browser. The caller's
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
 * Secret: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
 */
import Anthropic from 'npm:@anthropic-ai/sdk@0.131.0';
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
import { RULES_TEXT } from '../_shared/rules-text.js';

const MODEL = 'claude-opus-5-5';
const MAX_TOKENS = 4096;
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
- Cite the rule you are relying on, in the book's own numbering: "HD 6.5" for World
  Aquatics, "Red Bull 3.5.3" for Red Bull. A claim about the rules without a citation is
  not useful to a diver arguing with a referee.
- The two books are different documents with different numbers. Never attribute a Red Bull
  rule to World Aquatics or the reverse, and say which book you are answering for when the
  question does not make it clear. Where they differ, say so — the commonest traps are
  that a dive over its DD limit is capped by World Aquatics but is a failed dive under Red
  Bull, and that Red Bull requires all four dives from different take-offs while World
  Aquatics only requires each pair to differ.
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

const tools = [
  {
    name: 'lookup_dd',
    description:
      'The degree of difficulty of one dive, in one position, at one height, from one ' +
      "rule book's table. Use this for every DD question.",
    strict: true,
    input_schema: {
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
    name: 'find_dives',
    description:
      'Search a rule book\'s dive table by number or description, returning each match ' +
      'with the positions it may be performed in and their DDs at a height.',
    strict: true,
    input_schema: {
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
    name: 'validate_list',
    description:
      'Check a four-dive list against a rule book: per-dive DD, the slot limits, take-off ' +
      'variety, repeats, and the resulting total DD.',
    strict: true,
    input_schema: {
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
    name: 'score_dive',
    description:
      'Score one dive from the judges\' awards and a DD: drops the highest and lowest, ' +
      'sums the rest, multiplies by DD.',
    strict: true,
    input_schema: {
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
    name: 'award_needed_for_target',
    description:
      'What each counting judge must award on the remaining dives to reach a target total.',
    strict: true,
    input_schema: {
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
    name: 'get_ranking',
    description:
      'The current standings for a season. "series" is the Red Bull World Series ranking ' +
      '(tour stops, summed); "world" is the World Ranking (tour stops and World Aquatics ' +
      'World Cups, averaged). They are separate tables.',
    strict: true,
    input_schema: {
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
    name: 'query_results',
    description:
      'Uploaded competition results, optionally narrowed to a season, a diver or a ' +
      'competition name.',
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        season: { type: ['integer', 'null'] },
        diver_name: { type: ['string', 'null'] },
        competition_name: { type: ['string', 'null'] },
      },
      required: ['season', 'diver_name', 'competition_name'],
    },
  },
  {
    name: 'get_my_lists',
    description: "The signed-in user's own saved dive lists.",
    strict: true,
    input_schema: { type: 'object', additionalProperties: false, properties: {}, required: [] },
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

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return Response.json(
      { error: 'The assistant is not configured: ANTHROPIC_API_KEY is not set.' },
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
        if (!competitions.length) {
          return { standings: [], note: `No competitions are recorded for ${season}.` };
        }
        const { data: rows, error } = await db
          .from('results')
          .select('*')
          .in('competition_id', competitions.map((c: { id: string }) => c.id));
        if (error) return { error: error.message };
        const results = (rows ?? []).map((r: Record<string, unknown>) => ({
          competitionId: r.competition_id,
          diverId: r.diver_id,
          rank: r.rank,
          score: r.score == null ? null : Number(r.score),
          bestDive: r.best_dive,
        }));
        const args = {
          season,
          gender: input.gender as never,
          competitions,
          results,
          divers: divers.data ?? [],
        };
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

      case 'query_results': {
        let q = db
          .from('results')
          .select('rank, score, best_dive, competitions(name, season, gender, rule_set), divers(name)')
          .order('rank')
          .limit(100);
        if (input.season != null) q = q.eq('competitions.season', input.season as number);
        const { data, error } = await q;
        if (error) return { error: error.message };
        let rows = (data ?? []) as Record<string, never>[];
        const diverName = (input.diver_name as string | null)?.toLowerCase();
        const compName = (input.competition_name as string | null)?.toLowerCase();
        if (diverName) {
          rows = rows.filter((r) =>
            String((r.divers as { name?: string })?.name ?? '').toLowerCase().includes(diverName),
          );
        }
        if (compName) {
          rows = rows.filter((r) =>
            String((r.competitions as { name?: string })?.name ?? '')
              .toLowerCase()
              .includes(compName),
          );
        }
        return { count: rows.length, results: rows.slice(0, 60) };
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

  const anthropic = new Anthropic({ apiKey });
  const messages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(new TextEncoder().encode(sse(event, data)));

      try {
        for (let turn = 0; turn < MAX_TURNS; turn++) {
          const response = await anthropic.messages.stream({
            model: MODEL,
            max_tokens: MAX_TOKENS,
            output_config: { effort: 'medium' },
            system: [
              {
                type: 'text',
                text: RULES_TEXT,
                // The books never change between requests, so this prefix is what makes
                // the assistant cheap to run. An hour covers a coaching session.
                cache_control: { type: 'ephemeral', ttl: '1h' },
              },
              { type: 'text', text: SYSTEM_INSTRUCTIONS },
            ],
            tools,
            messages,
          });

          // Forward the visible answer as it is written; tool calls are handled after
          // the turn completes.
          for await (const event of response) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              send('text', { text: event.delta.text });
            }
          }

          const message = await response.finalMessage();
          messages.push({ role: 'assistant', content: message.content });

          if (message.stop_reason === 'refusal') {
            send('error', { error: 'That question was declined.' });
            break;
          }
          if (message.stop_reason !== 'tool_use') {
            send('usage', {
              input: message.usage.input_tokens,
              cacheRead: message.usage.cache_read_input_tokens ?? 0,
              output: message.usage.output_tokens,
            });
            break;
          }

          const calls = message.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
          );
          // All results go back in one user message; splitting them stops the model
          // making parallel calls in future turns.
          const results: Anthropic.ToolResultBlockParam[] = [];
          for (const call of calls) {
            send('tool', { name: call.name });
            try {
              const result = await runTool(call.name, call.input as Record<string, unknown>);
              results.push({
                type: 'tool_result',
                tool_use_id: call.id,
                content: JSON.stringify(result),
              });
            } catch (err) {
              results.push({
                type: 'tool_result',
                tool_use_id: call.id,
                is_error: true,
                content: err instanceof Error ? err.message : 'Tool failed.',
              });
            }
          }
          messages.push({ role: 'user', content: results });
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
