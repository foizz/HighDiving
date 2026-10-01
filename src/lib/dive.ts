/**
 * Parsing and classification of high diving dive numbers.
 *
 * Number designations follow FINA/World Aquatics HD 1.4. A dive number is a run of
 * digits, where a count of ten or more is written in parentheses, optionally followed
 * by `m` for a mid-turn variant and a position letter:
 *
 *   102      forward, 1 somersault            112      forward FLYING, 1 somersault
 *   5141     forward, 2 somersaults, ½ twist  5(1)141  the same, flying
 *   51(10)1  forward, 5 somersaults, ½ twist  524(10)  back, 2 somersaults, 5 twists
 *   611      armstand forward, ½ somersault   6131     armstand forward, 1½ ss, ½ twist
 *   5161m    forward, 3 somersaults, ½ twist, mid-turn
 */

/** HD 1.4.8 — the position a dive is performed in. */
export const POSITIONS = ['A', 'B', 'C', 'D', 'E'] as const;
export type Position = (typeof POSITIONS)[number];

export const POSITION_NAMES: Record<Position, string> = {
  A: 'Straight',
  B: 'Pike',
  C: 'Tuck',
  D: 'Free',
  E: '3 positions',
};

/** HD 1.4.11 — the five take-off positions. A dive list is constrained by these. */
export const TAKEOFFS = ['Front', 'Back', 'Reverse', 'Inward', 'Armstand'] as const;
export type Takeoff = (typeof TAKEOFFS)[number];

/** The ten dive groups used to index the DD tables. */
export const GROUP_NAMES: Record<number, string> = {
  1: 'Forward',
  2: 'Back',
  3: 'Reverse',
  4: 'Inward',
  5: 'Armstand',
  6: 'Forward Twists',
  7: 'Back Twists',
  8: 'Reverse Twists',
  9: 'Inward Twists',
  10: 'Armstand Twists',
};

const ROTATION_TAKEOFF: Record<number, Takeoff> = {
  1: 'Front',
  2: 'Back',
  3: 'Reverse',
  4: 'Inward',
};

export interface ParsedDive {
  /** The dive number as written, without any position letter. */
  number: string;
  /** Direction of rotation: 1 forward, 2 back, 3 reverse, 4 inward. */
  rotation: 1 | 2 | 3 | 4;
  takeoff: Takeoff;
  /** Group 1–10, as the DD tables index them. */
  group: number;
  /** Somersaults in halves — 4 means two full somersaults. */
  halfSomersaults: number;
  /** Twists in halves — 1 means a half twist (a barani, off a forward take-off). */
  halfTwists: number;
  armstand: boolean;
  flying: boolean;
  midTurn: boolean;
}

export class DiveParseError extends Error {}

/** Split a number into digit tokens, treating `(n)` as a single token. */
function tokenize(input: string): { value: number; parenthesised: boolean }[] {
  const tokens: { value: number; parenthesised: boolean }[] = [];
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '(') {
      const close = input.indexOf(')', i);
      if (close === -1) throw new DiveParseError(`unclosed "(" in "${input}"`);
      const inner = input.slice(i + 1, close);
      if (!/^\d+$/.test(inner)) throw new DiveParseError(`"(${inner})" is not a number in "${input}"`);
      tokens.push({ value: Number(inner), parenthesised: true });
      i = close;
    } else if (ch >= '0' && ch <= '9') {
      tokens.push({ value: Number(ch), parenthesised: false });
    } else {
      throw new DiveParseError(`unexpected "${ch}" in "${input}"`);
    }
  }
  return tokens;
}

/**
 * The group a dive is tabled under.
 *
 * A single half twist keeps a dive in its base group only when it comes off a forward
 * or inward rotation, where the half twist is the natural barani-style entry: 5141
 * (forward 2 somersaults ½ twist) is tabled as Forward, and 5441 as Inward. Off a back
 * or reverse rotation the same half twist moves the dive into the twist group, so 5241
 * is a Back Twist. Any larger twist always lands in the twist group.
 *
 * Both rule books' tables follow this convention identically.
 */
function groupFor(rotation: number, armstand: boolean, halfTwists: number): number {
  const naturalHalfTwist = rotation === 1 || rotation === 4;
  const staysInBase = halfTwists === 0 || (halfTwists === 1 && naturalHalfTwist);
  if (armstand) return staysInBase ? 5 : 10;
  return staysInBase ? rotation : rotation + 5;
}

/**
 * Parse a dive number, with or without a trailing position letter.
 * Throws {@link DiveParseError} if the number is not a shape the rules define.
 */
export function parseDiveNumber(raw: string): ParsedDive {
  const input = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (!input) throw new DiveParseError('empty dive number');

  // Strip an optional trailing position letter, then an optional mid-turn `m`.
  let body = input;
  const posMatch = /^(.*?)([ABCDE])$/.exec(body);
  if (posMatch) body = posMatch[1];
  let midTurn = false;
  if (body.endsWith('M')) {
    midTurn = true;
    body = body.slice(0, -1);
  }
  if (!body) throw new DiveParseError(`"${raw}" has no dive number`);

  const tokens = tokenize(body);
  const digits = tokens.map((t) => t.value);

  let rotation: number;
  let halfSomersaults: number;
  let halfTwists = 0;
  let armstand = false;
  let flying = false;

  if (digits[0] >= 1 && digits[0] <= 4) {
    // Standing, no twist: group, flying flag, half somersaults.
    if (tokens.length !== 3) {
      throw new DiveParseError(`"${raw}" should have 3 parts for a non-twisting dive`);
    }
    rotation = digits[0];
    flying = digits[1] === 1;
    halfSomersaults = digits[2];
  } else if (digits[0] === 5) {
    // Twisting, standing. A parenthesised second token marks a flying variant.
    if (tokens.length === 5) {
      if (!tokens[1].parenthesised || tokens[1].value !== 1) {
        throw new DiveParseError(`"${raw}" is not a recognised flying twist number`);
      }
      flying = true;
      rotation = digits[2];
      halfSomersaults = digits[3];
      halfTwists = digits[4];
    } else if (tokens.length === 4) {
      rotation = digits[1];
      halfSomersaults = digits[2];
      halfTwists = digits[3];
    } else {
      throw new DiveParseError(`"${raw}" should have 4 or 5 parts for a twisting dive`);
    }
  } else if (digits[0] === 6) {
    // Armstand, optionally twisting.
    armstand = true;
    if (tokens.length === 3) {
      rotation = digits[1];
      halfSomersaults = digits[2];
    } else if (tokens.length === 4) {
      rotation = digits[1];
      halfSomersaults = digits[2];
      halfTwists = digits[3];
    } else {
      throw new DiveParseError(`"${raw}" should have 3 or 4 parts for an armstand dive`);
    }
  } else {
    throw new DiveParseError(`"${raw}" does not start with a known group digit`);
  }

  if (rotation < 1 || rotation > 4) {
    throw new DiveParseError(`"${raw}" has an unknown rotation direction "${rotation}"`);
  }
  if (halfSomersaults < 1) {
    throw new DiveParseError(`"${raw}" has no somersault count`);
  }

  return {
    number: body,
    rotation: rotation as 1 | 2 | 3 | 4,
    takeoff: armstand ? 'Armstand' : ROTATION_TAKEOFF[rotation],
    group: groupFor(rotation, armstand, halfTwists),
    halfSomersaults,
    halfTwists,
    armstand,
    flying,
    midTurn,
  };
}

/** Parse, returning null rather than throwing. */
export function tryParseDiveNumber(raw: string): ParsedDive | null {
  try {
    return parseDiveNumber(raw);
  } catch {
    return null;
  }
}

/** The position letter at the end of a dive code, if one is present. */
export function positionOf(raw: string): Position | null {
  const m = /([ABCDE])$/.exec(raw.trim().toUpperCase());
  return m ? (m[1] as Position) : null;
}

/** Render halves as the rule books do: 4 -> "2", 5 -> "2 1/2". */
export function halvesToText(halves: number): string {
  const whole = Math.floor(halves / 2);
  const half = halves % 2 === 1;
  if (whole === 0) return '1/2';
  return half ? `${whole} 1/2` : String(whole);
}

/** A human-readable description derived from the number, for dives absent from the tables. */
export function describeDive(d: ParsedDive): string {
  const parts: string[] = [];
  if (d.armstand) parts.push('Armstand');
  parts.push(['', 'Forward', 'Back', 'Reverse', 'Inward'][d.rotation]);
  if (d.flying) parts.push('Flying');
  // "1/2 Somersault" and "1 Somersault" are singular; "1 1/2 Somersaults" is not.
  parts.push(halvesToText(d.halfSomersaults));
  parts.push(d.halfSomersaults > 2 ? 'Somersaults' : 'Somersault');
  if (d.halfTwists > 0) {
    parts.push(halvesToText(d.halfTwists));
    parts.push(d.halfTwists > 2 ? 'Twists' : 'Twist');
  }
  if (d.midTurn) parts.push('mid-turn');
  return parts.filter(Boolean).join(' ');
}
