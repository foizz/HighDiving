// src/lib/dive.ts
var POSITIONS = ["A", "B", "C", "D", "E"];
var POSITION_NAMES = {
  A: "Straight",
  B: "Pike",
  C: "Tuck",
  D: "Free",
  E: "3 positions"
};
var TAKEOFFS = ["Front", "Back", "Reverse", "Inward", "Armstand"];
var GROUP_NAMES = {
  1: "Forward",
  2: "Back",
  3: "Reverse",
  4: "Inward",
  5: "Armstand",
  6: "Forward Twists",
  7: "Back Twists",
  8: "Reverse Twists",
  9: "Inward Twists",
  10: "Armstand Twists"
};
var ROTATION_TAKEOFF = {
  1: "Front",
  2: "Back",
  3: "Reverse",
  4: "Inward"
};
var DiveParseError = class extends Error {
};
function tokenize(input) {
  const tokens = [];
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === "(") {
      const close = input.indexOf(")", i);
      if (close === -1) throw new DiveParseError(`unclosed "(" in "${input}"`);
      const inner = input.slice(i + 1, close);
      if (!/^\d+$/.test(inner)) throw new DiveParseError(`"(${inner})" is not a number in "${input}"`);
      tokens.push({ value: Number(inner), parenthesised: true });
      i = close;
    } else if (ch >= "0" && ch <= "9") {
      tokens.push({ value: Number(ch), parenthesised: false });
    } else {
      throw new DiveParseError(`unexpected "${ch}" in "${input}"`);
    }
  }
  return tokens;
}
function groupFor(rotation, armstand, halfTwists) {
  const naturalHalfTwist = rotation === 1 || rotation === 4;
  const staysInBase = halfTwists === 0 || halfTwists === 1 && naturalHalfTwist;
  if (armstand) return staysInBase ? 5 : 10;
  return staysInBase ? rotation : rotation + 5;
}
function parseDiveNumber(raw) {
  const input = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (!input) throw new DiveParseError("empty dive number");
  let body = input;
  const posMatch = /^(.*?)([ABCDE])$/.exec(body);
  if (posMatch) body = posMatch[1];
  let midTurn = false;
  if (body.endsWith("M")) {
    midTurn = true;
    body = body.slice(0, -1);
  }
  if (!body) throw new DiveParseError(`"${raw}" has no dive number`);
  const tokens = tokenize(body);
  const digits = tokens.map((t) => t.value);
  let rotation;
  let halfSomersaults;
  let halfTwists = 0;
  let armstand = false;
  let flying = false;
  if (digits[0] >= 1 && digits[0] <= 4) {
    if (tokens.length !== 3) {
      throw new DiveParseError(`"${raw}" should have 3 parts for a non-twisting dive`);
    }
    rotation = digits[0];
    flying = digits[1] === 1;
    halfSomersaults = digits[2];
  } else if (digits[0] === 5) {
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
    rotation,
    takeoff: armstand ? "Armstand" : ROTATION_TAKEOFF[rotation],
    group: groupFor(rotation, armstand, halfTwists),
    halfSomersaults,
    halfTwists,
    armstand,
    flying,
    midTurn
  };
}
function tryParseDiveNumber(raw) {
  try {
    return parseDiveNumber(raw);
  } catch {
    return null;
  }
}
function positionOf(raw) {
  const m = /([ABCDE])$/.exec(raw.trim().toUpperCase());
  return m ? m[1] : null;
}
function halvesToText(halves) {
  const whole = Math.floor(halves / 2);
  const half = halves % 2 === 1;
  if (whole === 0) return "1/2";
  return half ? `${whole} 1/2` : String(whole);
}
function describeDive(d) {
  const parts = [];
  if (d.armstand) parts.push("Armstand");
  parts.push(["", "Forward", "Back", "Reverse", "Inward"][d.rotation]);
  if (d.flying) parts.push("Flying");
  parts.push(halvesToText(d.halfSomersaults));
  parts.push(d.halfSomersaults > 2 ? "Somersaults" : "Somersault");
  if (d.halfTwists > 0) {
    parts.push(halvesToText(d.halfTwists));
    parts.push(d.halfTwists > 2 ? "Twists" : "Twist");
  }
  if (d.midTurn) parts.push("mid-turn");
  return parts.filter(Boolean).join(" ");
}

// src/data/dd-table.json
var dd_table_default = {
  source: "2017-2021_high_diving_13082019_0.pdf (Appendix 2)",
  dives: [
    {
      number: "5(1)141",
      description: "Forward Flying 2 Somersaults 1/2 Twist",
      group: 1,
      groupName: "Forward",
      dd: {
        "15": {
          B: 3,
          C: 2.8
        },
        "20": {
          B: 2.9,
          C: 2.7
        },
        "27": {
          B: 3,
          C: 2.8
        },
        "10_12": {
          B: 2.9,
          C: 2.7
        }
      }
    },
    {
      number: "5(1)161",
      description: "Forward Flying 3 Somersaults 1/2 Twist",
      group: 1,
      groupName: "Forward",
      dd: {
        "15": {
          B: 3.8,
          C: 3.5
        },
        "20": {
          B: 3.6,
          C: 3.3
        },
        "27": {
          B: 3.6,
          C: 3.3
        },
        "10_12": {
          B: 4,
          C: 3.7
        }
      }
    },
    {
      number: "5(1)181",
      description: "Forward Flying 4 Somersaults 1/2 Twist",
      group: 1,
      groupName: "Forward",
      dd: {
        "27": {
          B: 4.5,
          C: 3.9
        },
        "10_12": {
          B: 5.7,
          C: 5.1
        }
      }
    },
    {
      number: "51(10)1",
      description: "Forward 5 Somersaults 1/2 Twist",
      group: 1,
      groupName: "Forward",
      dd: {
        "27": {
          B: 5.1,
          C: 4.6
        }
      }
    },
    {
      number: "51(12)1",
      description: "Forward 6 Somersaults 1/2 Twist",
      group: 1,
      groupName: "Forward",
      dd: {
        "27": {
          B: 6.4,
          C: 5.9
        }
      }
    },
    {
      number: "102",
      description: "Forward 1 Somersault",
      group: 1,
      groupName: "Forward",
      dd: {
        "15": {
          A: 2.8,
          B: 2.6,
          C: 2.5,
          E: 2.7
        },
        "20": {
          A: 2.9,
          B: 2.7,
          C: 2.6,
          E: 2.8
        },
        "27": {
          A: 3,
          B: 2.8,
          C: 2.7,
          E: 2.9
        },
        "10_12": {
          A: 2.7,
          B: 2.5,
          C: 2.4,
          E: 2.6
        }
      }
    },
    {
      number: "104",
      description: "Forward 2 Somersaults",
      group: 1,
      groupName: "Forward",
      dd: {
        "15": {
          B: 3.2,
          C: 3,
          E: 3.1
        },
        "20": {
          B: 3.1,
          C: 2.9
        },
        "27": {
          B: 3.2,
          C: 3,
          E: 3.3
        },
        "10_12": {
          B: 3.1,
          C: 2.9,
          E: 3.2
        }
      }
    },
    {
      number: "106",
      description: "Forward 3 Somersaults",
      group: 1,
      groupName: "Forward",
      dd: {
        "15": {
          B: 4,
          C: 3.8,
          E: 3.8
        },
        "20": {
          B: 3.8,
          C: 3.6
        },
        "27": {
          B: 3.8,
          C: 3.6
        },
        "10_12": {
          B: 4.2,
          C: 4,
          E: 4
        }
      }
    },
    {
      number: "108",
      description: "Forward 4 Somersaults",
      group: 1,
      groupName: "Forward",
      dd: {
        "15": {
          B: 5.4,
          C: 5.1
        },
        "20": {
          B: 5,
          C: 4.7
        },
        "27": {
          B: 4.7,
          C: 4.4
        },
        "10_12": {
          B: 5.9,
          C: 5.6
        }
      }
    },
    {
      number: "112",
      description: "Forward Flying 1 Somersault",
      group: 1,
      groupName: "Forward",
      dd: {
        "15": {
          B: 2.7,
          C: 2.6
        },
        "20": {
          B: 2.8,
          C: 2.7
        },
        "27": {
          B: 2.9,
          C: 2.8
        },
        "10_12": {
          B: 2.6,
          C: 2.5
        }
      }
    },
    {
      number: "114",
      description: "Forward Flying 2 Somersaults",
      group: 1,
      groupName: "Forward",
      dd: {
        "15": {
          B: 3.3,
          C: 3.1
        },
        "20": {
          B: 3.2,
          C: 3
        },
        "27": {
          B: 3.3,
          C: 3.1
        },
        "10_12": {
          B: 3.2,
          C: 3
        }
      }
    },
    {
      number: "116",
      description: "Forward Flying 3 Somersaults",
      group: 1,
      groupName: "Forward",
      dd: {
        "15": {
          B: 4.2,
          C: 3.9
        },
        "20": {
          B: 4,
          C: 3.7
        },
        "27": {
          B: 4,
          C: 3.7
        },
        "10_12": {
          B: 4.4,
          C: 4.1
        }
      }
    },
    {
      number: "5121",
      description: "Forward 1 Somersault 1/2 Twist",
      group: 1,
      groupName: "Forward",
      dd: {
        "15": {
          D: 2.4
        },
        "20": {
          D: 2.5
        },
        "27": {
          D: 2.6
        },
        "10_12": {
          D: 2.3
        }
      }
    },
    {
      number: "5141",
      description: "Forward 2 Somersaults 1/2 Twist",
      group: 1,
      groupName: "Forward",
      dd: {
        "15": {
          B: 2.9,
          C: 2.7,
          E: 3
        },
        "20": {
          B: 2.8,
          C: 2.6,
          E: 2.9
        },
        "27": {
          B: 2.9,
          C: 2.7,
          E: 3
        },
        "10_12": {
          B: 2.8,
          C: 2.6,
          E: 2.9
        }
      }
    },
    {
      number: "5161",
      description: "Forward 3 Somersaults 1/2 Twist",
      group: 1,
      groupName: "Forward",
      dd: {
        "15": {
          B: 3.6,
          C: 3.4
        },
        "20": {
          B: 3.4,
          C: 3.2
        },
        "27": {
          B: 3.4,
          C: 3.2,
          E: 3.6
        },
        "10_12": {
          B: 3.8,
          C: 3.6,
          E: 4
        }
      }
    },
    {
      number: "5161m",
      description: "Forward 3 Somersaults 1/2 Twist mid-turn",
      group: 1,
      groupName: "Forward",
      dd: {
        "15": {
          B: 3.7,
          C: 3.6
        },
        "20": {
          B: 3.5,
          C: 3.4
        },
        "27": {
          B: 3.5,
          C: 3.4
        },
        "10_12": {
          B: 3.9,
          C: 3.8
        }
      }
    },
    {
      number: "5181",
      description: "Forward 4 Somersaults 1/2 Twist",
      group: 1,
      groupName: "Forward",
      dd: {
        "15": {
          B: 4.8,
          C: 4.5
        },
        "20": {
          B: 4.4,
          C: 4.1
        },
        "27": {
          B: 4.1,
          C: 3.8,
          E: 4.5
        },
        "10_12": {
          B: 5.3,
          C: 5,
          E: 5.7
        }
      }
    },
    {
      number: "5181m",
      description: "Forward 4 Somersaults 1/2 Twist mid-turn",
      group: 1,
      groupName: "Forward",
      dd: {
        "15": {
          B: 5.1,
          C: 4.8
        },
        "27": {
          B: 4.4,
          C: 4.1
        },
        "10_12": {
          B: 5.6,
          C: 5.3
        }
      }
    },
    {
      number: "20(10)",
      description: "Back 5 Somersaults",
      group: 2,
      groupName: "Back",
      dd: {
        "27": {
          B: 5.8,
          C: 5.3
        }
      }
    },
    {
      number: "202",
      description: "Back 1 Somersault",
      group: 2,
      groupName: "Back",
      dd: {
        "15": {
          A: 2.9,
          B: 2.7,
          C: 2.6,
          E: 2.8
        },
        "20": {
          A: 2.9,
          B: 2.7,
          C: 2.6,
          E: 2.8
        },
        "27": {
          A: 2.9,
          B: 2.7,
          C: 2.6,
          E: 2.8
        },
        "10_12": {
          A: 2.8,
          B: 2.6,
          C: 2.5,
          E: 2.7
        }
      }
    },
    {
      number: "204",
      description: "Back 2 Somersaults",
      group: 2,
      groupName: "Back",
      dd: {
        "15": {
          A: 3.4,
          B: 3.2,
          C: 3,
          E: 3.3
        },
        "20": {
          A: 3.4,
          B: 3.2,
          C: 3,
          E: 3.3
        },
        "27": {
          A: 3.3,
          B: 3.1,
          C: 2.9,
          E: 3.2
        },
        "10_12": {
          A: 3.3,
          B: 3.1,
          C: 2.9,
          E: 3.2
        }
      }
    },
    {
      number: "206",
      description: "Back 3 Somersaults",
      group: 2,
      groupName: "Back",
      dd: {
        "15": {
          B: 4.2,
          C: 4,
          E: 4.4
        },
        "20": {
          B: 4,
          C: 3.8,
          E: 4.2
        },
        "27": {
          B: 3.8,
          C: 3.6,
          E: 4
        },
        "10_12": {
          B: 4.4,
          C: 4.2,
          E: 4.6
        }
      }
    },
    {
      number: "208",
      description: "Back 4 Somersaults",
      group: 2,
      groupName: "Back",
      dd: {
        "15": {
          B: 5.7,
          C: 5.4
        },
        "20": {
          B: 5.2,
          C: 4.9
        },
        "27": {
          B: 4.6,
          C: 4.3,
          E: 5
        },
        "10_12": {
          B: 6.2,
          C: 5.9
        }
      }
    },
    {
      number: "212",
      description: "Back Flying 1 Somersault",
      group: 2,
      groupName: "Back",
      dd: {
        "15": {
          B: 2.8,
          C: 2.7
        },
        "20": {
          B: 2.8,
          C: 2.7
        },
        "27": {
          B: 2.8,
          C: 2.7
        },
        "10_12": {
          B: 2.7,
          C: 2.6
        }
      }
    },
    {
      number: "214",
      description: "Back Flying 2 Somersaults",
      group: 2,
      groupName: "Back",
      dd: {
        "15": {
          B: 3.3,
          C: 3.1
        },
        "20": {
          B: 3.3,
          C: 3.1
        },
        "27": {
          B: 3.2,
          C: 3
        },
        "10_12": {
          B: 3.2,
          C: 3
        }
      }
    },
    {
      number: "216",
      description: "Back Flying 3 Somersaults",
      group: 2,
      groupName: "Back",
      dd: {
        "27": {
          B: 4,
          C: 3.7
        }
      }
    },
    {
      number: "30(10)",
      description: "Reverse 5 Somersaults",
      group: 3,
      groupName: "Reverse",
      dd: {
        "27": {
          B: 6.1,
          C: 5.6
        }
      }
    },
    {
      number: "302",
      description: "Reverse 1 Somersault",
      group: 3,
      groupName: "Reverse",
      dd: {
        "15": {
          A: 2.9,
          B: 2.7,
          C: 2.6,
          E: 2.8
        },
        "20": {
          A: 2.9,
          B: 2.7,
          C: 2.6,
          E: 2.8
        },
        "27": {
          A: 2.9,
          B: 2.7,
          C: 2.6,
          E: 2.8
        },
        "10_12": {
          A: 2.9,
          B: 2.7,
          C: 2.6,
          E: 2.8
        }
      }
    },
    {
      number: "304",
      description: "Reverse 2 Somersaults",
      group: 3,
      groupName: "Reverse",
      dd: {
        "15": {
          B: 3.3,
          C: 3.1,
          E: 3.1
        },
        "20": {
          B: 3.2,
          C: 3
        },
        "27": {
          B: 3.1,
          C: 2.9,
          E: 3.2
        },
        "10_12": {
          B: 3.3,
          C: 3.1,
          E: 3.4
        }
      }
    },
    {
      number: "306",
      description: "Reverse 3 Somersaults",
      group: 3,
      groupName: "Reverse",
      dd: {
        "15": {
          B: 4.3,
          C: 4.1,
          E: 4.1
        },
        "20": {
          B: 4.1,
          C: 3.9
        },
        "27": {
          B: 3.9,
          C: 3.7
        },
        "10_12": {
          B: 4.5,
          C: 4.3,
          E: 4.3
        }
      }
    },
    {
      number: "308",
      description: "Reverse 4 Somersaults",
      group: 3,
      groupName: "Reverse",
      dd: {
        "15": {
          B: 5.9,
          C: 5.6
        },
        "20": {
          B: 5.4,
          C: 5.1
        },
        "27": {
          B: 4.8,
          C: 4.5
        },
        "10_12": {
          B: 6.4,
          C: 6.1
        }
      }
    },
    {
      number: "312",
      description: "Reverse Flying 1 Somersault",
      group: 3,
      groupName: "Reverse",
      dd: {
        "15": {
          B: 2.8,
          C: 2.7
        },
        "20": {
          B: 2.8,
          C: 2.7
        },
        "27": {
          B: 2.8,
          C: 2.7
        },
        "10_12": {
          B: 2.8,
          C: 2.7
        }
      }
    },
    {
      number: "54(10)1",
      description: "Inward 5 Somersaults 1/2 Twist",
      group: 4,
      groupName: "Inward",
      dd: {
        "27": {
          B: 5.9,
          C: 5.4
        }
      }
    },
    {
      number: "402",
      description: "Inward 1 Somersault",
      group: 4,
      groupName: "Inward",
      dd: {
        "15": {
          B: 3,
          C: 2.9,
          E: 3
        },
        "20": {
          B: 3,
          C: 2.9
        },
        "27": {
          B: 2.9,
          C: 2.8,
          E: 3
        },
        "10_12": {
          B: 2.9,
          C: 2.8,
          E: 3
        }
      }
    },
    {
      number: "404",
      description: "Inward 2 Somersaults",
      group: 4,
      groupName: "Inward",
      dd: {
        "15": {
          B: 3.7,
          C: 3.5
        },
        "20": {
          B: 3.6,
          C: 3.4
        },
        "27": {
          B: 3.5,
          C: 3.3
        },
        "10_12": {
          B: 3.6,
          C: 3.4
        }
      }
    },
    {
      number: "406",
      description: "Inward 3 Somersaults",
      group: 4,
      groupName: "Inward",
      dd: {
        "15": {
          B: 4.7,
          C: 4.5
        },
        "20": {
          B: 4.5,
          C: 4.3
        },
        "27": {
          B: 4.3,
          C: 4.1
        },
        "10_12": {
          B: 4.9,
          C: 4.7
        }
      }
    },
    {
      number: "408",
      description: "Inward 4 Somersaults",
      group: 4,
      groupName: "Inward",
      dd: {
        "20": {
          B: 5.9,
          C: 5.6
        },
        "27": {
          B: 5.4,
          C: 5.1
        }
      }
    },
    {
      number: "412",
      description: "Inward Flying 1 Somersault",
      group: 4,
      groupName: "Inward",
      dd: {
        "15": {
          B: 3.1,
          C: 3
        },
        "20": {
          B: 3.1,
          C: 3
        },
        "27": {
          B: 3,
          C: 2.9
        },
        "10_12": {
          B: 3,
          C: 2.9
        }
      }
    },
    {
      number: "5421",
      description: "Inward 1 Somersault 1/2 Twist",
      group: 4,
      groupName: "Inward",
      dd: {
        "15": {
          D: 2.7
        },
        "20": {
          D: 2.7
        },
        "27": {
          D: 2.6
        },
        "10_12": {
          D: 2.6
        }
      }
    },
    {
      number: "5441",
      description: "Inward 2 Somersaults 1/2 Twist",
      group: 4,
      groupName: "Inward",
      dd: {
        "15": {
          B: 3.3,
          C: 3.1,
          E: 3.4
        },
        "20": {
          B: 3.2,
          C: 3
        },
        "27": {
          B: 3.1,
          C: 2.9
        },
        "10_12": {
          B: 3.2,
          C: 3,
          E: 3.1
        }
      }
    },
    {
      number: "5461",
      description: "Inward 3 Somersaults 1/2 Twist",
      group: 4,
      groupName: "Inward",
      dd: {
        "15": {
          B: 4.2,
          C: 4
        },
        "20": {
          B: 4,
          C: 3.8
        },
        "27": {
          B: 3.8,
          C: 3.6
        },
        "10_12": {
          B: 4.4,
          C: 4.2
        }
      }
    },
    {
      number: "5481",
      description: "Inward 4 Somersaults 1/2 Twist",
      group: 4,
      groupName: "Inward",
      dd: {
        "15": {
          B: 5.7,
          C: 5.4
        },
        "20": {
          B: 5.2,
          C: 4.9
        },
        "27": {
          B: 4.7,
          C: 4.4
        },
        "10_12": {
          B: 6.2,
          C: 5.9
        }
      }
    },
    {
      number: "611",
      description: "Armstand Forward 1/2 Somersault",
      group: 5,
      groupName: "Armstand",
      dd: {
        "15": {
          A: 2.7,
          B: 2.5,
          C: 2.4
        },
        "20": {
          A: 2.8,
          B: 2.6,
          C: 2.5
        },
        "27": {
          A: 2.9,
          B: 2.7,
          C: 2.6
        },
        "10_12": {
          A: 2.6,
          B: 2.4,
          C: 2.3
        }
      }
    },
    {
      number: "613",
      description: "Armstand Forward 1 1/2 SomersaultS",
      group: 5,
      groupName: "Armstand",
      dd: {
        "15": {
          B: 3.2,
          C: 3
        },
        "20": {
          B: 3.2,
          C: 3
        },
        "27": {
          B: 3.3,
          C: 3.1
        },
        "10_12": {
          B: 3.1,
          C: 2.9
        }
      }
    },
    {
      number: "615",
      description: "Armstand Forward 2 1/2 SomersaultS",
      group: 5,
      groupName: "Armstand",
      dd: {
        "15": {
          B: 4.3,
          C: 4.1
        },
        "20": {
          B: 4.2,
          C: 4
        },
        "27": {
          B: 4.2,
          C: 4
        },
        "10_12": {
          B: 4.5,
          C: 4.3
        }
      }
    },
    {
      number: "621",
      description: "Arm. Back 1/2 Somersault",
      group: 5,
      groupName: "Armstand",
      dd: {
        "15": {
          A: 2.8,
          B: 2.6,
          C: 2.5
        },
        "20": {
          A: 2.8,
          B: 2.6,
          C: 2.5
        },
        "27": {
          A: 2.8,
          B: 2.6,
          C: 2.5
        },
        "10_12": {
          A: 2.7,
          B: 2.5,
          C: 2.4
        }
      }
    },
    {
      number: "623",
      description: "Arm. Back 1 1/2 Somersault",
      group: 5,
      groupName: "Armstand",
      dd: {
        "15": {
          A: 3.3,
          B: 3.1,
          C: 2.9
        },
        "20": {
          A: 3.3,
          B: 3.1,
          C: 2.9
        },
        "27": {
          A: 3.3,
          B: 3.1,
          C: 2.9
        },
        "10_12": {
          A: 3.2,
          C: 2.8
        }
      }
    },
    {
      number: "625",
      description: "Arm. Back 2 1/2 Somersaults",
      group: 5,
      groupName: "Armstand",
      dd: {
        "15": {
          B: 4.2
        },
        "20": {
          B: 4,
          C: 3.8
        },
        "27": {
          B: 3.8,
          C: 3.6
        },
        "10_12": {
          B: 4.4,
          C: 4.2
        }
      }
    },
    {
      number: "627",
      description: "Arm. Back 3 1/2 Somersaults",
      group: 5,
      groupName: "Armstand",
      dd: {
        "27": {
          B: 4.8,
          C: 4.5
        }
      }
    },
    {
      number: "629",
      description: "Arm. Back 4 1/2 Somersaults",
      group: 5,
      groupName: "Armstand",
      dd: {
        "27": {
          B: 6.1,
          C: 5.6
        }
      }
    },
    {
      number: "631",
      description: "Arm. Reverse 1/2 Somersault",
      group: 5,
      groupName: "Armstand",
      dd: {
        "15": {
          A: 2.9,
          B: 2.7,
          C: 2.6
        },
        "20": {
          A: 2.9,
          B: 2.7,
          C: 2.6
        },
        "27": {
          A: 2.9,
          B: 2.7,
          C: 2.6
        },
        "10_12": {
          A: 2.8,
          B: 2.6,
          C: 2.5
        }
      }
    },
    {
      number: "633",
      description: "Arm. Reverse 1 1/2 Somersault",
      group: 5,
      groupName: "Armstand",
      dd: {
        "15": {
          B: 3.4,
          C: 3.2
        },
        "20": {
          B: 3.3,
          C: 3.1
        },
        "27": {
          B: 3.3,
          C: 3.1
        },
        "10_12": {
          B: 3.3,
          C: 3.1
        }
      }
    },
    {
      number: "635",
      description: "Arm. Reverse 2 1/2 Somersaults",
      group: 5,
      groupName: "Armstand",
      dd: {
        "15": {
          B: 4.3,
          C: 4.1
        },
        "20": {
          B: 4.2,
          C: 4
        },
        "27": {
          B: 4.1,
          C: 3.9
        },
        "10_12": {
          B: 4.5,
          C: 4.3
        }
      }
    },
    {
      number: "637",
      description: "Arm. Reverse 3 1/2 Somersaults",
      group: 5,
      groupName: "Armstand",
      dd: {
        "20": {
          B: 5.5,
          C: 5.2
        },
        "27": {
          B: 5.1,
          C: 4.8
        }
      }
    },
    {
      number: "6131",
      description: "Arm. Forward 1 1/2 Somersault 1/2 Twist",
      group: 5,
      groupName: "Armstand",
      dd: {
        "15": {
          D: 2.9
        },
        "20": {
          D: 2.9
        },
        "27": {
          D: 3
        },
        "10_12": {
          D: 2.8
        }
      }
    },
    {
      number: "6151",
      description: "Arm. Forward 2 1/2 Somersaults 1/2 Twist",
      group: 5,
      groupName: "Armstand",
      dd: {
        "15": {
          B: 3.8,
          C: 3.6
        },
        "20": {
          B: 3.7,
          C: 3.5
        },
        "27": {
          B: 3.7,
          C: 3.5
        },
        "10_12": {
          C: 3.8
        }
      }
    },
    {
      number: "6171",
      description: "Arm. Forward 3 1/2 Somersaults 1/2 Twist",
      group: 5,
      groupName: "Armstand",
      dd: {
        "27": {
          B: 4.6,
          C: 4.3
        }
      }
    },
    {
      number: "5142",
      description: "Forward 2 Somersaults 1 Twist",
      group: 6,
      groupName: "Forward Twists",
      dd: {
        "15": {
          D: 3.5
        },
        "20": {
          D: 3.4
        },
        "27": {
          D: 3.5
        },
        "10_12": {
          D: 3.4
        }
      }
    },
    {
      number: "5143",
      description: "Forward 2 Somersaults 1 1/2 Twist",
      group: 6,
      groupName: "Forward Twists",
      dd: {
        "15": {
          D: 3.2
        },
        "20": {
          D: 3.1
        },
        "27": {
          D: 3.2
        },
        "10_12": {
          D: 3.1
        }
      }
    },
    {
      number: "5144",
      description: "Forward 2 Somersaults 2 Twists",
      group: 6,
      groupName: "Forward Twists",
      dd: {
        "15": {
          D: 4
        },
        "20": {
          D: 3.9
        },
        "27": {
          D: 4
        },
        "10_12": {
          D: 4
        }
      }
    },
    {
      number: "5145",
      description: "Forward 2 Somersaults 2 1/2 Twists",
      group: 6,
      groupName: "Forward Twists",
      dd: {
        "15": {
          D: 3.6
        },
        "20": {
          D: 3.5
        },
        "27": {
          D: 3.6
        },
        "10_12": {
          D: 3.6
        }
      }
    },
    {
      number: "5146",
      description: "Forward 2 Somersaults 3 Twists",
      group: 6,
      groupName: "Forward Twists",
      dd: {
        "15": {
          D: 4.6
        },
        "20": {
          D: 4.5
        },
        "27": {
          D: 4.6
        },
        "10_12": {
          D: 4.8
        }
      }
    },
    {
      number: "5147",
      description: "Forward 2 Somersaults 3 1/2 Twists",
      group: 6,
      groupName: "Forward Twists",
      dd: {
        "15": {
          D: 4.1
        },
        "20": {
          D: 4
        },
        "27": {
          D: 4.1
        },
        "10_12": {
          D: 4.3
        }
      }
    },
    {
      number: "5149",
      description: "Forward 2 Somersaults 4 1/2 Twists",
      group: 6,
      groupName: "Forward Twists",
      dd: {
        "15": {
          D: 4.7
        },
        "27": {
          D: 4.7
        },
        "10_12": {
          D: 5.2
        }
      }
    },
    {
      number: "5162",
      description: "Forward 3 Somersaults 1 Twist",
      group: 6,
      groupName: "Forward Twists",
      dd: {
        "15": {
          B: 4.5,
          C: 4.3
        },
        "20": {
          B: 4.3,
          C: 4.1
        },
        "27": {
          B: 4.2,
          C: 4
        },
        "10_12": {
          B: 4.7,
          C: 4.5
        }
      }
    },
    {
      number: "5163",
      description: "Forward 3 Somersaults 1 1/2 Twist",
      group: 6,
      groupName: "Forward Twists",
      dd: {
        "15": {
          B: 4.1,
          C: 3.9
        },
        "20": {
          B: 3.9,
          C: 3.7
        },
        "27": {
          B: 3.8,
          C: 3.6
        },
        "10_12": {
          B: 4.3,
          C: 4.1
        }
      }
    },
    {
      number: "5164",
      description: "Forward 3 Somersaults 2 Twists",
      group: 6,
      groupName: "Forward Twists",
      dd: {
        "15": {
          B: 5.2,
          C: 5
        },
        "20": {
          B: 5,
          C: 4.8
        },
        "27": {
          B: 4.8,
          C: 4.6
        },
        "10_12": {
          B: 5.5,
          C: 5.3
        }
      }
    },
    {
      number: "5165",
      description: "Forward 3 Somersaults 2 1/2 Twists",
      group: 6,
      groupName: "Forward Twists",
      dd: {
        "15": {
          B: 4.7,
          C: 4.5
        },
        "20": {
          B: 4.5,
          C: 4.3
        },
        "27": {
          B: 4.3,
          C: 4.1
        },
        "10_12": {
          B: 5,
          C: 4.8
        }
      }
    },
    {
      number: "5166",
      description: "Forward 3 Somersaults 3 Twists",
      group: 6,
      groupName: "Forward Twists",
      dd: {
        "20": {
          D: 5.8
        },
        "27": {
          D: 5.5
        }
      }
    },
    {
      number: "5167",
      description: "Forward 3 Somersaults 3 1/2 Twists",
      group: 6,
      groupName: "Forward Twists",
      dd: {
        "27": {
          D: 4.9
        }
      }
    },
    {
      number: "5169",
      description: "Forward 3 Somersaults 4 1/2 Twists",
      group: 6,
      groupName: "Forward Twists",
      dd: {
        "27": {
          D: 5.6
        }
      }
    },
    {
      number: "5182",
      description: "Forward 4 Somersaults 1 Twist",
      group: 6,
      groupName: "Forward Twists",
      dd: {
        "27": {
          B: 5.3,
          C: 5
        }
      }
    },
    {
      number: "5183",
      description: "Forward 4 Somersaults 1 1/2 Twist",
      group: 6,
      groupName: "Forward Twists",
      dd: {
        "27": {
          B: 4.7,
          C: 4.4
        }
      }
    },
    {
      number: "5185",
      description: "Forward 4 Somersaults 2 1/2 Twists",
      group: 6,
      groupName: "Forward Twists",
      dd: {
        "27": {
          B: 5.4,
          C: 5.1
        }
      }
    },
    {
      number: "52(10)2",
      description: "Back 5 Somersaults 1 Twist",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "27": {
          B: 5.6,
          C: 5.1
        }
      }
    },
    {
      number: "524(10)",
      description: "Back 2 Somersaults 5 Twists",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "27": {
          D: 5
        }
      }
    },
    {
      number: "526(10)",
      description: "Back 3 Somersaults 5 Twists",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "27": {
          D: 6
        }
      }
    },
    {
      number: "5241",
      description: "Back 2 Somersaults 1/2 Twist",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "15": {
          D: 3.5
        },
        "20": {
          D: 3.4
        },
        "27": {
          D: 3.4
        },
        "10_12": {
          D: 3.4
        }
      }
    },
    {
      number: "5242",
      description: "Back 2 Somersaults 1 Twist",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "15": {
          D: 3.2
        },
        "20": {
          D: 3.1
        },
        "27": {
          D: 3.1
        },
        "10_12": {
          D: 3.1
        }
      }
    },
    {
      number: "5243",
      description: "Back 2 Somersaults 1 1/2 Twist",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "15": {
          D: 3.8
        },
        "20": {
          D: 3.7
        },
        "27": {
          D: 3.7
        },
        "10_12": {
          D: 3.8
        }
      }
    },
    {
      number: "5244",
      description: "Back 2 Somersaults 2 Twists",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "15": {
          D: 3.5
        },
        "20": {
          D: 3.4
        },
        "27": {
          D: 3.4
        },
        "10_12": {
          D: 3.5
        }
      }
    },
    {
      number: "5245",
      description: "Back 2 Somersaults 2 1/2 Twists",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "15": {
          D: 4.3
        },
        "20": {
          D: 4.2
        },
        "27": {
          D: 4.2
        },
        "10_12": {
          D: 4.5
        }
      }
    },
    {
      number: "5246",
      description: "Back 2 Somersaults 3 Twists",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "15": {
          D: 3.9
        },
        "20": {
          D: 3.8
        },
        "27": {
          D: 3.8
        },
        "10_12": {
          D: 4.1
        }
      }
    },
    {
      number: "5247",
      description: "Back 2 Somersaults 3 1/2 Twists",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "27": {
          D: 4.8
        }
      }
    },
    {
      number: "5248",
      description: "Back 2 Somersaults 4 Twists",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "15": {
          D: 4.5
        },
        "20": {
          D: 4.4
        },
        "27": {
          D: 4.3
        },
        "10_12": {
          D: 4.9
        }
      }
    },
    {
      number: "5261",
      description: "Back 3 Somersaults 1/2 Twist",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "15": {
          B: 4.5,
          C: 4.3
        },
        "20": {
          B: 4.3,
          C: 4.1
        },
        "27": {
          B: 4.2,
          C: 4
        },
        "10_12": {
          B: 4.7,
          C: 4.5
        }
      }
    },
    {
      number: "5262",
      description: "Back 3 Somersaults 1 Twist",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "15": {
          B: 4,
          C: 3.8
        },
        "20": {
          B: 3.8,
          C: 3.6
        },
        "27": {
          B: 3.7,
          C: 3.5
        },
        "10_12": {
          B: 4.2,
          C: 4
        }
      }
    },
    {
      number: "5263",
      description: "Back 3 Somersaults 1 1/2 Twist",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "15": {
          B: 5,
          C: 4.8
        },
        "20": {
          B: 4.8,
          C: 4.6
        },
        "27": {
          B: 4.6,
          C: 4.4
        },
        "10_12": {
          B: 5.3,
          C: 5.1
        }
      }
    },
    {
      number: "5264",
      description: "Back 3 Somersaults 2 Twists",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "15": {
          B: 4.5,
          C: 4.3
        },
        "20": {
          B: 4.3,
          C: 4.1
        },
        "27": {
          B: 4.1,
          C: 3.9
        },
        "10_12": {
          B: 4.8,
          C: 4.6
        }
      }
    },
    {
      number: "5265",
      description: "Back 3 Somersaults 2 1/2 Twist",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "27": {
          B: 5.2,
          C: 5
        }
      }
    },
    {
      number: "5266",
      description: "Back 3 Somersaults 3 Twists",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "15": {
          B: 5.1,
          C: 4.9
        },
        "20": {
          B: 4.9,
          C: 4.7
        },
        "27": {
          B: 4.6,
          C: 4.4
        },
        "10_12": {
          B: 5.6,
          C: 5.4
        }
      }
    },
    {
      number: "5267",
      description: "Back 3 Somersaults 3 1/2 Twists",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "27": {
          D: 5.9
        }
      }
    },
    {
      number: "5268",
      description: "Back 3 Somersaults 4 Twists",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "27": {
          D: 5.2
        }
      }
    },
    {
      number: "5281",
      description: "Back 4 Somersaults 1/2 Twist",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "27": {
          B: 5.2,
          C: 4.9
        }
      }
    },
    {
      number: "5282",
      description: "Back 4 Somersaults 1 Twist",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "15": {
          B: 5.3,
          C: 5
        },
        "20": {
          B: 4.9,
          C: 4.6
        },
        "27": {
          B: 4.5,
          C: 4.2
        },
        "10_12": {
          B: 5.8,
          C: 5.5
        }
      }
    },
    {
      number: "5282m",
      description: "Back 4 Somersaults 1 Twist mid-turn",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "27": {
          B: 4.8,
          C: 4.5
        }
      }
    },
    {
      number: "5283",
      description: "Back 4 Somersaults 1 1/2 Twist",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "27": {
          B: 5.8,
          C: 5.5
        }
      }
    },
    {
      number: "5284",
      description: "Back 4 Somersaults 2 Twists",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "27": {
          B: 5.1,
          C: 4.8
        }
      }
    },
    {
      number: "5286",
      description: "Back 4 Somersaults 3 Twists",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "27": {
          B: 5.8,
          C: 5.5
        }
      }
    },
    {
      number: "534(10)",
      description: "Reverse 2 Somersaults 5 Twists",
      group: 8,
      groupName: "Reverse Twists",
      dd: {
        "27": {
          D: 5.4
        }
      }
    },
    {
      number: "5341",
      description: "Reverse 2 Somersaults 1/2 Twist",
      group: 8,
      groupName: "Reverse Twists",
      dd: {
        "15": {
          D: 3.6
        },
        "20": {
          D: 3.4
        },
        "27": {
          D: 3.4
        },
        "10_12": {
          D: 3.5
        }
      }
    },
    {
      number: "5342",
      description: "Reverse 2 Somersaults 1 Twist",
      group: 8,
      groupName: "Reverse Twists",
      dd: {
        "15": {
          D: 3.3
        },
        "20": {
          D: 3.1
        },
        "27": {
          D: 3.1
        },
        "10_12": {
          D: 3.2
        }
      }
    },
    {
      number: "5343",
      description: "Reverse 2 Somersaults 1 1/2 Twist",
      group: 8,
      groupName: "Reverse Twists",
      dd: {
        "15": {
          D: 4
        },
        "20": {
          D: 3.8
        },
        "27": {
          D: 3.8
        },
        "10_12": {
          D: 3.9
        }
      }
    },
    {
      number: "5344",
      description: "Reverse 2 Somersaults 2 Twists",
      group: 8,
      groupName: "Reverse Twists",
      dd: {
        "15": {
          D: 3.7
        },
        "20": {
          D: 3.5
        },
        "27": {
          D: 3.5
        },
        "10_12": {
          D: 3.6
        }
      }
    },
    {
      number: "5345",
      description: "Reverse 2 Somersaults 2 1/2 Twists",
      group: 8,
      groupName: "Reverse Twists",
      dd: {
        "15": {
          D: 4.6
        },
        "20": {
          D: 4.4
        },
        "27": {
          D: 4.4
        },
        "10_12": {
          D: 4.7
        }
      }
    },
    {
      number: "5346",
      description: "Reverse 2 Somersaults 3 Twists",
      group: 8,
      groupName: "Reverse Twists",
      dd: {
        "15": {
          D: 4.2
        },
        "20": {
          D: 4
        },
        "27": {
          D: 4
        },
        "10_12": {
          D: 4.3
        }
      }
    },
    {
      number: "5347",
      description: "Reverse 2 Somersaults 3 1/2 Twists",
      group: 8,
      groupName: "Reverse Twists",
      dd: {
        "15": {
          D: 5.3
        },
        "27": {
          D: 5.1
        },
        "10_12": {
          D: 5.8
        }
      }
    },
    {
      number: "5348",
      description: "Reverse 2 Somersaults 4 Twists",
      group: 8,
      groupName: "Reverse Twists",
      dd: {
        "15": {
          D: 4.8
        },
        "27": {
          D: 4.6
        },
        "10_12": {
          D: 5.3
        }
      }
    },
    {
      number: "5361",
      description: "Reverse 3 Somersaults 1/2 Twist",
      group: 8,
      groupName: "Reverse Twists",
      dd: {
        "15": {
          B: 4.6,
          C: 4.4
        },
        "20": {
          B: 4.4,
          C: 4.2
        },
        "27": {
          B: 4.3,
          C: 4.1
        },
        "10_12": {
          B: 4.8,
          C: 4.6
        }
      }
    },
    {
      number: "5362",
      description: "Reverse 3 Somersaults 1 Twist",
      group: 8,
      groupName: "Reverse Twists",
      dd: {
        "15": {
          B: 4.1,
          C: 3.9
        },
        "20": {
          B: 3.9,
          C: 3.7
        },
        "27": {
          B: 3.8,
          C: 3.6
        },
        "10_12": {
          B: 4.3,
          C: 4.1
        }
      }
    },
    {
      number: "5363",
      description: "Reverse 3 Somersaults 1 1/2 Twist",
      group: 8,
      groupName: "Reverse Twists",
      dd: {
        "27": {
          B: 4.9,
          C: 4.7
        }
      }
    },
    {
      number: "5364",
      description: "Reverse 3 Somersaults 2 Twists",
      group: 8,
      groupName: "Reverse Twists",
      dd: {
        "27": {
          B: 4.4,
          C: 4.2
        }
      }
    },
    {
      number: "5365",
      description: "Reverse 3 Somersaults 2 1/2 Twists",
      group: 8,
      groupName: "Reverse Twists",
      dd: {
        "27": {
          B: 5.7,
          C: 5.5
        }
      }
    },
    {
      number: "5366",
      description: "Reverse 3 Somersaults 3 Twists",
      group: 8,
      groupName: "Reverse Twists",
      dd: {
        "27": {
          B: 5.1,
          C: 4.9
        }
      }
    },
    {
      number: "5381",
      description: "Reverse 4 Somersaults 1/2 Twist",
      group: 8,
      groupName: "Reverse Twists",
      dd: {
        "27": {
          B: 5.4,
          C: 5.1
        }
      }
    },
    {
      number: "5382",
      description: "Reverse 4 Somersaults 1 Twist",
      group: 8,
      groupName: "Reverse Twists",
      dd: {
        "27": {
          B: 4.7,
          C: 4.4
        }
      }
    },
    {
      number: "5442",
      description: "Inward 2 Somersaults 1 Twist",
      group: 9,
      groupName: "Inward Twists",
      dd: {
        "27": {
          D: 3.9
        }
      }
    },
    {
      number: "5443",
      description: "Inward 2 Somersaults 1 1/2 Twist",
      group: 9,
      groupName: "Inward Twists",
      dd: {
        "15": {
          D: 3.7
        },
        "20": {
          D: 3.6
        },
        "27": {
          D: 3.5
        },
        "10_12": {
          D: 3.6
        }
      }
    },
    {
      number: "5445",
      description: "Inward 2 Somersaults 2 1/2 Twists",
      group: 9,
      groupName: "Inward Twists",
      dd: {
        "20": {
          D: 4.1
        },
        "27": {
          D: 4
        }
      }
    },
    {
      number: "5447",
      description: "Inward 2 Somersaults 3 1/2 Twists",
      group: 9,
      groupName: "Inward Twists",
      dd: {
        "27": {
          D: 4.6
        }
      }
    },
    {
      number: "5462",
      description: "Inward 3 Somersaults 1 Twist",
      group: 9,
      groupName: "Inward Twists",
      dd: {
        "27": {
          B: 4.8,
          C: 4.6
        }
      }
    },
    {
      number: "5463",
      description: "Inward 3 Somersaults 1 1/2 Twist",
      group: 9,
      groupName: "Inward Twists",
      dd: {
        "27": {
          B: 4.3,
          C: 4.1
        }
      }
    },
    {
      number: "625(10)",
      description: "Arm. Back 2 1/2 Somersaults 5 Twists",
      group: 10,
      groupName: "Armstand twists",
      dd: {
        "27": {
          D: 6.2
        }
      }
    },
    {
      number: "6132",
      description: "Arm. Forward 1 1/2 Somersault 1 Twist",
      group: 10,
      groupName: "Armstand twists",
      dd: {
        "15": {
          D: 3.7
        },
        "20": {
          D: 3.5
        },
        "27": {
          D: 3.6
        },
        "10_12": {
          D: 3.6
        }
      }
    },
    {
      number: "6133",
      description: "Arm. Forward 1 1/2 Somersault 1 1/2 Twist",
      group: 10,
      groupName: "Armstand twists",
      dd: {
        "15": {
          D: 3.4
        },
        "20": {
          D: 3.2
        },
        "27": {
          D: 3.3
        },
        "10_12": {
          D: 3.3
        }
      }
    },
    {
      number: "6134",
      description: "Arm. Forward 1 1/2 Somersault 2 Twists",
      group: 10,
      groupName: "Armstand twists",
      dd: {
        "15": {
          D: 4.4
        },
        "20": {
          D: 4
        },
        "27": {
          D: 4.1
        },
        "10_12": {
          D: 4.4
        }
      }
    },
    {
      number: "6135",
      description: "Arm. Forward 1 1/2 Somersault 2 1/2 Twists",
      group: 10,
      groupName: "Armstand twists",
      dd: {
        "15": {
          D: 4
        },
        "20": {
          D: 3.6
        },
        "27": {
          D: 3.7
        },
        "10_12": {
          D: 4
        }
      }
    },
    {
      number: "6152",
      description: "Arm. Forward 2 1/2 Somersaults 1 Twist",
      group: 10,
      groupName: "Armstand twists",
      dd: {
        "15": {
          B: 4.9,
          C: 4.7
        },
        "20": {
          B: 4.6,
          C: 4.4
        },
        "27": {
          B: 4.6,
          C: 4.4
        },
        "10_12": {
          B: 5.2,
          C: 5
        }
      }
    },
    {
      number: "6153",
      description: "Arm. Forward 2 1/2 Somersaults 1 1/2 Twist",
      group: 10,
      groupName: "Armstand twists",
      dd: {
        "15": {
          B: 4.4,
          C: 4.2
        },
        "20": {
          B: 4.1,
          C: 3.9
        },
        "27": {
          B: 4.1,
          C: 3.9
        },
        "10_12": {
          B: 4.7,
          C: 4.5
        }
      }
    },
    {
      number: "6154",
      description: "Arm. Forward 2 1/2 Somersaults 2 Twists",
      group: 10,
      groupName: "Armstand twists",
      dd: {
        "27": {
          D: 5.2
        }
      }
    },
    {
      number: "6155",
      description: "Arm. Forward 2 1/2 Somersaults 2 1/2 Twists",
      group: 10,
      groupName: "Armstand twists",
      dd: {
        "27": {
          D: 4.6
        }
      }
    },
    {
      number: "6156",
      description: "Arm. Forward 2 1/2 Somersaults 3 Twists",
      group: 10,
      groupName: "Armstand twists",
      dd: {
        "27": {
          D: 5.9
        }
      }
    },
    {
      number: "6157",
      description: "Arm. Forward 2 1/2 Somersaults 3 1/2 Twists",
      group: 10,
      groupName: "Armstand twists",
      dd: {
        "27": {
          D: 5.2
        }
      }
    },
    {
      number: "6173",
      description: "Arm. Forward 3 1/2 Somersaults 1 1/2 Twist",
      group: 10,
      groupName: "Armstand twists",
      dd: {
        "27": {
          B: 5.2,
          C: 4.9
        }
      }
    },
    {
      number: "6231",
      description: "Arm Back 1 1/2 Somersault 1/2 Twist",
      group: 10,
      groupName: "Armstand twists",
      dd: {
        "15": {
          D: 3.2
        },
        "20": {
          D: 3.2
        },
        "27": {
          D: 3.3
        },
        "10_12": {
          D: 3.1
        }
      }
    },
    {
      number: "6232",
      description: "Arm. Back 1 1/2 Somersault 1 Twist",
      group: 10,
      groupName: "Armstand twists",
      dd: {
        "15": {
          D: 2.9
        },
        "20": {
          D: 2.9
        },
        "27": {
          D: 3
        },
        "10_12": {
          D: 2.8
        }
      }
    },
    {
      number: "6233",
      description: "Arm Back 1 1/2 Somersault 1 1/2 Twist",
      group: 10,
      groupName: "Armstand twists",
      dd: {
        "15": {
          D: 3.5
        },
        "20": {
          D: 3.5
        },
        "27": {
          D: 3.7
        },
        "10_12": {
          D: 3.6
        }
      }
    },
    {
      number: "6251",
      description: "Arm Back 2 1/2 Somersault 1/2 Twist",
      group: 10,
      groupName: "Armstand twists",
      dd: {
        "15": {
          B: 4.4,
          C: 4.2
        },
        "20": {
          B: 4.2,
          C: 4
        },
        "27": {
          B: 4.1,
          C: 3.9
        },
        "10_12": {
          B: 4.6,
          C: 4.4
        }
      }
    },
    {
      number: "6252",
      description: "Arm. Back 2 1/2 Somersaults 1 Twist",
      group: 10,
      groupName: "Armstand twists",
      dd: {
        "15": {
          B: 3.9,
          C: 3.7
        },
        "20": {
          B: 3.7,
          C: 3.5
        },
        "27": {
          B: 3.6,
          C: 3.4
        },
        "10_12": {
          B: 4.1,
          C: 3.9
        }
      }
    },
    {
      number: "6253",
      description: "Arm Back 2 1/2 Somersaults 1 1/2 Twist",
      group: 10,
      groupName: "Armstand twists",
      dd: {
        "15": {
          B: 4.9,
          C: 4.7
        },
        "20": {
          B: 4.7,
          C: 4.5
        },
        "27": {
          B: 4.6,
          C: 4.4
        },
        "10_12": {
          B: 5.2,
          C: 5
        }
      }
    },
    {
      number: "6254",
      description: "Arm. Back 2 1/2 Somersaults 2 Twists",
      group: 10,
      groupName: "Armstand twists",
      dd: {
        "15": {
          B: 4.4,
          C: 4.2
        },
        "20": {
          B: 4.2,
          C: 4
        },
        "27": {
          B: 4.1,
          C: 3.9
        },
        "10_12": {
          B: 4.7,
          C: 4.5
        }
      }
    },
    {
      number: "6255",
      description: "Arm Back 2 1/2 Somersaults 2 1/2 Twists",
      group: 10,
      groupName: "Armstand twists",
      dd: {
        "27": {
          D: 5.3
        }
      }
    },
    {
      number: "6256",
      description: "Arm. Back 2 1/2 Somersaults 3 Twists",
      group: 10,
      groupName: "Armstand twists",
      dd: {
        "15": {
          D: 5.1
        },
        "20": {
          D: 4.8
        },
        "27": {
          D: 4.7
        },
        "10_12": {
          D: 5.5
        }
      }
    },
    {
      number: "6257",
      description: "Arm Back 2 1/2 Somersaults 3 1/2 Twists",
      group: 10,
      groupName: "Armstand twists",
      dd: {
        "15": {
          D: 6.7
        },
        "27": {
          D: 6.1
        },
        "10_12": {
          D: 7.2
        }
      }
    },
    {
      number: "6258",
      description: "Arm. Back 2 1/2 Somersaults 4 Twists",
      group: 10,
      groupName: "Armstand twists",
      dd: {
        "15": {
          D: 6
        },
        "27": {
          D: 5.4
        },
        "10_12": {
          D: 6.5
        }
      }
    },
    {
      number: "6271",
      description: "Arm Back 3 1/2 Somersaults 1/2 Twist",
      group: 10,
      groupName: "Armstand twists",
      dd: {
        "27": {
          B: 5.2,
          C: 4.9
        },
        "10_12": {
          B: 6.5,
          C: 6.2
        }
      }
    },
    {
      number: "6272",
      description: "Arm. Back 3 1/2 Somersaults 1 Twist",
      group: 10,
      groupName: "Armstand twists",
      dd: {
        "27": {
          B: 4.5,
          C: 4.2
        },
        "10_12": {
          B: 5.8,
          C: 5.5
        }
      }
    },
    {
      number: "6273",
      description: "Arm Back 3 1/2 Somersaults 1 1/2 Twist",
      group: 10,
      groupName: "Armstand twists",
      dd: {
        "27": {
          B: 5.9,
          C: 5.6
        }
      }
    },
    {
      number: "6274",
      description: "Arm. Back 3 1/2 Somersault 2 Twists",
      group: 10,
      groupName: "Armstand twists",
      dd: {
        "27": {
          B: 5.2,
          C: 4.9
        }
      }
    }
  ]
};

// src/data/dd-table.redbull.json
var dd_table_redbull_default = {
  source: 'RED BULL CLIFF DIVING WORLD SERIES 2026 RULE BOOK, Appendix 3 ("2025 DD TABLE"), transcribed from the scanned pages \u2014 see scripts/rb-dd-source.txt',
  heights: [
    "27",
    "20"
  ],
  dives: [
    {
      number: "102",
      description: "Forward 1 Somersault",
      group: 1,
      groupName: "Forward",
      dd: {
        "20": {
          A: 2.9,
          B: 2.7,
          C: 2.6,
          E: 2.8
        },
        "27": {
          A: 3,
          B: 2.8,
          C: 2.7,
          E: 2.9
        }
      }
    },
    {
      number: "104",
      description: "Forward 2 Somersaults",
      group: 1,
      groupName: "Forward",
      dd: {
        "20": {
          B: 3.1,
          C: 2.9,
          E: 3.2
        },
        "27": {
          A: 3.4,
          B: 3.2,
          C: 3,
          E: 3.3
        }
      }
    },
    {
      number: "106",
      description: "Forward 3 Somersaults",
      group: 1,
      groupName: "Forward",
      dd: {
        "20": {
          B: 3.9,
          C: 3.7,
          E: 4.1
        },
        "27": {
          B: 3.9,
          C: 3.7,
          E: 4.1
        }
      }
    },
    {
      number: "108",
      description: "Forward 4 Somersaults",
      group: 1,
      groupName: "Forward",
      dd: {
        "20": {
          B: 4.9,
          C: 4.6
        },
        "27": {
          B: 4.7,
          C: 4.4
        }
      }
    },
    {
      number: "112",
      description: "Forward Flying 1 Somersault",
      group: 1,
      groupName: "Forward",
      dd: {
        "20": {
          B: 2.8,
          C: 2.7
        },
        "27": {
          B: 2.9,
          C: 2.8
        }
      }
    },
    {
      number: "114",
      description: "Forward Flying 2 Somersaults",
      group: 1,
      groupName: "Forward",
      dd: {
        "20": {
          B: 3.2,
          C: 3
        },
        "27": {
          B: 3.3,
          C: 3.1
        }
      }
    },
    {
      number: "116",
      description: "Forward Flying 3 Somersaults",
      group: 1,
      groupName: "Forward",
      dd: {
        "20": {
          B: 4.1,
          C: 3.8
        },
        "27": {
          B: 4.1,
          C: 3.8
        }
      }
    },
    {
      number: "5121",
      description: "Forward 1 Somersault 1/2 Twist",
      group: 1,
      groupName: "Forward",
      dd: {
        "20": {
          D: 2.7
        },
        "27": {
          D: 2.8
        }
      }
    },
    {
      number: "5141",
      description: "Forward 2 Somersaults 1/2 Twist",
      group: 1,
      groupName: "Forward",
      dd: {
        "20": {
          B: 2.8,
          C: 2.6,
          E: 2.9
        },
        "27": {
          B: 2.9,
          C: 2.7,
          E: 3
        }
      }
    },
    {
      number: "5(1)141",
      description: "Forward Flying 2 Somersaults with 1/2 Twist",
      group: 1,
      groupName: "Forward",
      dd: {
        "20": {
          B: 2.9,
          C: 2.7
        },
        "27": {
          B: 3,
          C: 2.8
        }
      }
    },
    {
      number: "5161",
      description: "Forward 3 Somersaults 1/2 Twist",
      group: 1,
      groupName: "Forward",
      dd: {
        "20": {
          B: 3.5,
          C: 3.3
        },
        "27": {
          B: 3.5,
          C: 3.3,
          E: 3.7
        }
      }
    },
    {
      number: "5(1)161",
      description: "Forward Flying 3 Somersaults 1/2 Twist",
      group: 1,
      groupName: "Forward",
      dd: {
        "20": {
          B: 3.7,
          C: 3.4
        },
        "27": {
          B: 3.7,
          C: 3.4
        }
      }
    },
    {
      number: "5181",
      description: "Forward 4 Somersaults 1/2 Twist",
      group: 1,
      groupName: "Forward",
      dd: {
        "20": {
          B: 4.4,
          C: 4
        },
        "27": {
          B: 4.2,
          C: 3.9
        }
      }
    },
    {
      number: "5(1)181",
      description: "Forward Flying 4 Somersaults with 1/2 Twist",
      group: 1,
      groupName: "Forward",
      dd: {
        "27": {
          B: 4.6,
          C: 4
        }
      }
    },
    {
      number: "51(10)1",
      description: "Forward 5 Somersaults 1/2 Twist",
      group: 1,
      groupName: "Forward",
      dd: {
        "27": {
          B: 5.1,
          C: 4.7
        }
      }
    },
    {
      number: "51(12)1",
      description: "Forward 6 Somersaults 1/2 Twist",
      group: 1,
      groupName: "Forward",
      dd: {
        "27": {
          B: 6.1,
          C: 5.7
        }
      }
    },
    {
      number: "202",
      description: "Back 1 Somersault",
      group: 2,
      groupName: "Back",
      dd: {
        "20": {
          A: 2.7,
          B: 2.5,
          C: 2.4,
          E: 2.6
        },
        "27": {
          A: 2.8,
          B: 2.6,
          C: 2.5,
          E: 2.7
        }
      }
    },
    {
      number: "204",
      description: "Back 2 Somersaults",
      group: 2,
      groupName: "Back",
      dd: {
        "20": {
          A: 3.2,
          B: 3,
          C: 2.8
        },
        "27": {
          A: 3.1,
          B: 2.9,
          C: 2.7,
          E: 3
        }
      }
    },
    {
      number: "206",
      description: "Back 3 Somersaults",
      group: 2,
      groupName: "Back",
      dd: {
        "20": {
          B: 3.9,
          C: 3.7
        },
        "27": {
          B: 3.7,
          C: 3.5,
          E: 3.9
        }
      }
    },
    {
      number: "208",
      description: "Back 4 Somersaults",
      group: 2,
      groupName: "Back",
      dd: {
        "20": {
          B: 5,
          C: 4.6
        },
        "27": {
          B: 4.6,
          C: 4.3,
          E: 4.9
        }
      }
    },
    {
      number: "20(10)",
      description: "Back 5 Somersaults",
      group: 2,
      groupName: "Back",
      dd: {
        "27": {
          B: 5.6,
          C: 5.2
        }
      }
    },
    {
      number: "212",
      description: "Back Flying 1 Somersault",
      group: 2,
      groupName: "Back",
      dd: {
        "20": {
          B: 2.6,
          C: 2.5
        },
        "27": {
          B: 2.7,
          C: 2.6
        }
      }
    },
    {
      number: "214",
      description: "Back Flying 2 Somersaults",
      group: 2,
      groupName: "Back",
      dd: {
        "20": {
          B: 3.1,
          C: 2.9
        },
        "27": {
          B: 3,
          C: 2.8
        }
      }
    },
    {
      number: "216",
      description: "Back Flying 3 Somersaults",
      group: 2,
      groupName: "Back",
      dd: {
        "20": {
          B: 4.1,
          C: 3.8
        },
        "27": {
          B: 3.9,
          C: 3.6
        }
      }
    },
    {
      number: "302",
      description: "Reverse 1 Somersault",
      group: 3,
      groupName: "Reverse",
      dd: {
        "20": {
          A: 2.8,
          B: 2.6,
          C: 2.4,
          E: 2.7
        },
        "27": {
          A: 2.8,
          B: 2.6,
          C: 2.5,
          E: 2.7
        }
      }
    },
    {
      number: "304",
      description: "Reverse 2 Somersaults",
      group: 3,
      groupName: "Reverse",
      dd: {
        "20": {
          B: 3.1,
          C: 2.9
        },
        "27": {
          B: 3,
          C: 2.8,
          E: 3.1
        }
      }
    },
    {
      number: "306",
      description: "Reverse 3 Somersaults",
      group: 3,
      groupName: "Reverse",
      dd: {
        "20": {
          B: 4.1,
          C: 3.9
        },
        "27": {
          B: 3.8,
          C: 3.6,
          E: 4
        }
      }
    },
    {
      number: "308",
      description: "Reverse 4 Somersaults",
      group: 3,
      groupName: "Reverse",
      dd: {
        "20": {
          B: 5.2,
          C: 4.8
        },
        "27": {
          B: 4.7,
          C: 4.4
        }
      }
    },
    {
      number: "30(10)",
      description: "Reverse 5 Somersaults",
      group: 3,
      groupName: "Reverse",
      dd: {
        "27": {
          B: 5.7,
          C: 5.3
        }
      }
    },
    {
      number: "312",
      description: "Reverse Flying 1 Somersault",
      group: 3,
      groupName: "Reverse",
      dd: {
        "20": {
          B: 2.7,
          C: 2.6
        },
        "27": {
          B: 2.7,
          C: 2.6
        }
      }
    },
    {
      number: "402",
      description: "Inward 1 Somersault",
      group: 4,
      groupName: "Inward",
      dd: {
        "20": {
          B: 2.9,
          C: 2.8,
          E: 3
        },
        "27": {
          B: 2.9,
          C: 2.8,
          E: 3
        }
      }
    },
    {
      number: "404",
      description: "Inward 2 Somersaults",
      group: 4,
      groupName: "Inward",
      dd: {
        "20": {
          B: 3.4,
          C: 3.2
        },
        "27": {
          B: 3.4,
          C: 3.2
        }
      }
    },
    {
      number: "406",
      description: "Inward 3 Somersaults",
      group: 4,
      groupName: "Inward",
      dd: {
        "20": {
          B: 4.3,
          C: 4.1
        },
        "27": {
          B: 4.2,
          C: 4
        }
      }
    },
    {
      number: "408",
      description: "Inward 4 Somersaults",
      group: 4,
      groupName: "Inward",
      dd: {
        "20": {
          B: 5.4,
          C: 5
        },
        "27": {
          B: 5.1,
          C: 4.8
        }
      }
    },
    {
      number: "412",
      description: "Inward Flying 1 Somersault",
      group: 4,
      groupName: "Inward",
      dd: {
        "20": {
          B: 3,
          C: 2.9
        },
        "27": {
          B: 3,
          C: 2.9
        }
      }
    },
    {
      number: "5421",
      description: "Inward 1 Somersault 1/2 Twist",
      group: 4,
      groupName: "Inward",
      dd: {
        "20": {
          D: 2.8
        },
        "27": {
          D: 2.9
        }
      }
    },
    {
      number: "5441",
      description: "Inward 2 Somersaults 1/2 Twist",
      group: 4,
      groupName: "Inward",
      dd: {
        "20": {
          B: 3.1,
          C: 2.9
        },
        "27": {
          B: 3.1,
          C: 2.9,
          E: 3.2
        }
      }
    },
    {
      number: "5461",
      description: "Inward 3 Somersaults 1/2 Twist",
      group: 4,
      groupName: "Inward",
      dd: {
        "20": {
          B: 3.9,
          C: 3.7
        },
        "27": {
          B: 3.8,
          C: 3.6
        }
      }
    },
    {
      number: "5481",
      description: "Inward 4 Somersaults 1/2 Twist",
      group: 4,
      groupName: "Inward",
      dd: {
        "20": {
          B: 4.9,
          C: 4.5
        },
        "27": {
          B: 4.6,
          C: 4.3
        }
      }
    },
    {
      number: "54(10)1",
      description: "Inward 5 Somersaults 1/2 Twist",
      group: 4,
      groupName: "Inward",
      dd: {
        "27": {
          B: 5.5,
          C: 5.1
        }
      }
    },
    {
      number: "611",
      description: "Handstand Forward 1/2 Somersault",
      group: 5,
      groupName: "Handstand",
      dd: {
        "20": {
          A: 2.9,
          B: 2.7,
          C: 2.6
        },
        "27": {
          A: 3,
          B: 2.8,
          C: 2.7
        }
      }
    },
    {
      number: "613",
      description: "Handstand Forward 1 1/2 Somersaults",
      group: 5,
      groupName: "Handstand",
      dd: {
        "20": {
          B: 3.2,
          C: 3
        },
        "27": {
          B: 3.3,
          C: 3.1
        }
      }
    },
    {
      number: "615",
      description: "Handstand Forward 2 1/2 Somersaults",
      group: 5,
      groupName: "Handstand",
      dd: {
        "20": {
          B: 4.2,
          C: 4
        },
        "27": {
          B: 4.1,
          C: 3.9
        }
      }
    },
    {
      number: "6131",
      description: "Handstand Forward 1 1/2 Somersaults 1/2 Twist",
      group: 5,
      groupName: "Handstand",
      dd: {
        "20": {
          D: 2.9
        },
        "27": {
          D: 3
        }
      }
    },
    {
      number: "6151",
      description: "Handstand Forward 2 1/2 Somersaults 1/2 Twist",
      group: 5,
      groupName: "Handstand",
      dd: {
        "20": {
          B: 3.8,
          C: 3.6
        },
        "27": {
          B: 3.7,
          C: 3.5
        }
      }
    },
    {
      number: "6171",
      description: "Handstand Forward 3 1/2 Somersaults 1/2 Twist",
      group: 5,
      groupName: "Handstand",
      dd: {
        "27": {
          B: 4.6,
          C: 4.2
        }
      }
    },
    {
      number: "621",
      description: "Handstand Back 1/2 Somersault",
      group: 5,
      groupName: "Handstand",
      dd: {
        "20": {
          A: 2.7,
          B: 2.5,
          C: 2.4
        },
        "27": {
          A: 2.8,
          B: 2.6,
          C: 2.5
        }
      }
    },
    {
      number: "623",
      description: "Handstand Back 1 1/2 Somersaults",
      group: 5,
      groupName: "Handstand",
      dd: {
        "20": {
          A: 3.2,
          B: 3,
          C: 2.8
        },
        "27": {
          A: 3.2,
          B: 3,
          C: 2.8
        }
      }
    },
    {
      number: "625",
      description: "Handstand Back 2 1/2 Somersaults",
      group: 5,
      groupName: "Handstand",
      dd: {
        "20": {
          B: 3.9,
          C: 3.7
        },
        "27": {
          B: 3.8,
          C: 3.6
        }
      }
    },
    {
      number: "627",
      description: "Handstand Back 3 1/2 Somersaults",
      group: 5,
      groupName: "Handstand",
      dd: {
        "20": {
          B: 5.1,
          C: 4.7
        },
        "27": {
          B: 4.8,
          C: 4.4
        }
      }
    },
    {
      number: "629",
      description: "Handstand Back 4 1/2 Somersaults",
      group: 5,
      groupName: "Handstand",
      dd: {
        "27": {
          B: 6,
          C: 5.4
        }
      }
    },
    {
      number: "631",
      description: "Handstand Reverse 1/2 Somersault",
      group: 5,
      groupName: "Handstand",
      dd: {
        "20": {
          A: 2.9,
          B: 2.7,
          C: 2.6
        },
        "27": {
          A: 2.9,
          B: 2.7,
          C: 2.6
        }
      }
    },
    {
      number: "633",
      description: "Handstand Reverse 1 1/2 Somersaults",
      group: 5,
      groupName: "Handstand",
      dd: {
        "20": {
          B: 3.2,
          C: 3
        },
        "27": {
          B: 3.2,
          C: 3
        }
      }
    },
    {
      number: "635",
      description: "Handstand Reverse 2 1/2 Somersaults",
      group: 5,
      groupName: "Handstand",
      dd: {
        "20": {
          B: 4.2,
          C: 4
        },
        "27": {
          B: 4,
          C: 3.8
        }
      }
    },
    {
      number: "637",
      description: "Handstand Reverse 3 1/2 Somersaults",
      group: 5,
      groupName: "Handstand",
      dd: {
        "27": {
          B: 5.1,
          C: 4.7
        }
      }
    },
    {
      number: "641",
      description: "Handstand Inward 1/2 Somersaults",
      group: 5,
      groupName: "Handstand",
      dd: {
        "27": {
          B: 2.9,
          C: 2.8
        }
      }
    },
    {
      number: "643",
      description: "Handstand Inward 1 1/2 Somersaults",
      group: 5,
      groupName: "Handstand",
      dd: {
        "27": {
          B: 3.4,
          C: 3.2
        }
      }
    },
    {
      number: "6431",
      description: "Handstand Inward 1/2 Somersaults 1/2 Twists",
      group: 5,
      groupName: "Handstand",
      dd: {
        "27": {
          B: 3.1,
          C: 2.9
        }
      }
    },
    {
      number: "5142",
      description: "Forward 2 Somersaults 1 Twist",
      group: 6,
      groupName: "Forward Twists",
      dd: {
        "20": {
          D: 3.4
        },
        "27": {
          D: 3.5
        }
      }
    },
    {
      number: "5143",
      description: "Forward 2 Somersaults 1 1/2 Twists",
      group: 6,
      groupName: "Forward Twists",
      dd: {
        "20": {
          D: 3.1
        },
        "27": {
          D: 3.2
        }
      }
    },
    {
      number: "5144",
      description: "Forward 2 Somersaults 2 Twists",
      group: 6,
      groupName: "Forward Twists",
      dd: {
        "20": {
          D: 3.8
        },
        "27": {
          D: 3.9
        }
      }
    },
    {
      number: "5145",
      description: "Forward 2 Somersaults 2 1/2 Twists",
      group: 6,
      groupName: "Forward Twists",
      dd: {
        "20": {
          D: 3.5
        },
        "27": {
          D: 3.6
        }
      }
    },
    {
      number: "5146",
      description: "Forward 2 Somersaults 3 Twists",
      group: 6,
      groupName: "Forward Twists",
      dd: {
        "20": {
          D: 4.2
        },
        "27": {
          D: 4.3
        }
      }
    },
    {
      number: "5147",
      description: "Forward 2 Somersaults 3 1/2 Twists",
      group: 6,
      groupName: "Forward Twists",
      dd: {
        "20": {
          D: 3.9
        },
        "27": {
          D: 4
        }
      }
    },
    {
      number: "5149",
      description: "Forward 2 Somersaults 4 1/2 Twists",
      group: 6,
      groupName: "Forward Twists",
      dd: {
        "27": {
          D: 4.4
        }
      }
    },
    {
      number: "5162",
      description: "Forward 3 Somersaults 1 Twist",
      group: 6,
      groupName: "Forward Twists",
      dd: {
        "20": {
          B: 4.4,
          C: 4.2
        },
        "27": {
          B: 4.3,
          C: 4.1
        }
      }
    },
    {
      number: "5163",
      description: "Forward 3 Somersaults 1 1/2 Twists",
      group: 6,
      groupName: "Forward Twists",
      dd: {
        "20": {
          B: 4,
          C: 3.8
        },
        "27": {
          B: 3.9,
          C: 3.7
        }
      }
    },
    {
      number: "5164",
      description: "Forward 3 Somersaults 2 Twists",
      group: 6,
      groupName: "Forward Twists",
      dd: {
        "20": {
          B: 5,
          C: 4.8
        },
        "27": {
          B: 4.8,
          C: 4.6
        }
      }
    },
    {
      number: "5165",
      description: "Forward 3 Somersaults 2 1/2 Twists",
      group: 6,
      groupName: "Forward Twists",
      dd: {
        "20": {
          B: 4.6,
          C: 4.4
        },
        "27": {
          B: 4.4,
          C: 4.2
        }
      }
    },
    {
      number: "5166",
      description: "Forward 3 Somersaults 3 Twists",
      group: 6,
      groupName: "Forward Twists",
      dd: {
        "27": {
          D: 5.3
        }
      }
    },
    {
      number: "5167",
      description: "Forward 3 Somersaults 3 1/2 Twists",
      group: 6,
      groupName: "Forward Twists",
      dd: {
        "27": {
          D: 4.9
        }
      }
    },
    {
      number: "5169",
      description: "Forward 3 Somersaults 4 1/2 Twists",
      group: 6,
      groupName: "Forward Twists",
      dd: {
        "27": {
          D: 5.4
        }
      }
    },
    {
      number: "5182",
      description: "Forward 4 Somersaults 1 Twist",
      group: 6,
      groupName: "Forward Twists",
      dd: {
        "27": {
          B: 5.2,
          C: 4.9
        }
      }
    },
    {
      number: "5183",
      description: "Forward 4 Somersaults 1 1/2 Twist",
      group: 6,
      groupName: "Forward Twists",
      dd: {
        "27": {
          B: 4.7,
          C: 4.4
        }
      }
    },
    {
      number: "5185",
      description: "Forward 4 Somersaults 2 1/2 Twist",
      group: 6,
      groupName: "Forward Twists",
      dd: {
        "27": {
          B: 5.3,
          C: 5
        }
      }
    },
    {
      number: "5187",
      description: "Forward 4 Somersaults 3 1/2 Twist",
      group: 6,
      groupName: "Forward Twists",
      dd: {
        "27": {
          B: 5.9,
          C: 5.6
        }
      }
    },
    {
      number: "51(10)3",
      description: "Forward 5 Somersaults 1 1/2 Twist",
      group: 6,
      groupName: "Forward Twists",
      dd: {
        "27": {
          B: 5.7,
          C: 5.3
        }
      }
    },
    {
      number: "5241",
      description: "Back 2 Somersaults 1/2 Twist",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "20": {
          D: 3.3
        },
        "27": {
          D: 3.4
        }
      }
    },
    {
      number: "5242",
      description: "Back 2 Somersaults 1 Twist",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "20": {
          D: 3
        },
        "27": {
          D: 3.1
        }
      }
    },
    {
      number: "5243",
      description: "Back 2 Somersaults 1 1/2 Twists",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "20": {
          D: 3.7
        },
        "27": {
          D: 3.7
        }
      }
    },
    {
      number: "5244",
      description: "Back 2 Somersaults 2 Twists",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "20": {
          D: 3.4
        },
        "27": {
          D: 3.4
        }
      }
    },
    {
      number: "5245",
      description: "Back 2 Somersaults 2 1/2 Twists",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "20": {
          D: 4.1
        },
        "27": {
          D: 4.1
        }
      }
    },
    {
      number: "5246",
      description: "Back 2 Somersaults 3 Twists",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "20": {
          D: 3.8
        },
        "27": {
          D: 3.8
        }
      }
    },
    {
      number: "5247",
      description: "Back 2 Somersaults 3 1/2 Twists",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "27": {
          D: 4.5
        }
      }
    },
    {
      number: "5248",
      description: "Back 2 Somersaults 4 Twists",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "20": {
          D: 4.2
        },
        "27": {
          D: 4.2
        }
      }
    },
    {
      number: "524(10)",
      description: "Back 2 Somersaults 5 Twists",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "27": {
          D: 4.8
        }
      }
    },
    {
      number: "5261",
      description: "Back 3 Somersaults 1/2 Twist",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "20": {
          B: 4.3,
          C: 4.1
        },
        "27": {
          B: 4.2,
          C: 4
        }
      }
    },
    {
      number: "5262",
      description: "Back 3 Somersaults 1 Twist",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "20": {
          B: 3.9,
          C: 3.7
        },
        "27": {
          B: 3.8,
          C: 3.6
        }
      }
    },
    {
      number: "5263",
      description: "Back 3 Somersaults 1 1/2 Twists",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "20": {
          B: 4.8,
          C: 4.6
        },
        "27": {
          B: 4.6,
          C: 4.4
        }
      }
    },
    {
      number: "5264",
      description: "Back 3 Somersaults 2 Twists",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "20": {
          B: 4.4,
          C: 4.2
        },
        "27": {
          B: 4.2,
          C: 4
        }
      }
    },
    {
      number: "5265",
      description: "Back 3 Somersaults 2 1/2 Twists",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "27": {
          B: 5.1,
          C: 4.9
        }
      }
    },
    {
      number: "5266",
      description: "Back 3 Somersaults 3 Twists",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "20": {
          B: 4.9,
          C: 4.7
        },
        "27": {
          B: 4.7,
          C: 4.5
        }
      }
    },
    {
      number: "5267",
      description: "Back 3 Somersaults 3 1/2 Twists",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "27": {
          D: 5.6
        }
      }
    },
    {
      number: "5268",
      description: "Back 3 Somersaults 4 Twists",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "27": {
          D: 5.2
        }
      }
    },
    {
      number: "526(10)",
      description: "Back 3 Somersaults 5 Twists",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "27": {
          D: 5.9
        }
      }
    },
    {
      number: "5281",
      description: "Back 4 Somersaults 1/2 Twist",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "27": {
          B: 5.1,
          C: 4.8
        }
      }
    },
    {
      number: "5282",
      description: "Back 4 Somersaults 1 Twist",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "20": {
          B: 4.9,
          C: 4.5
        },
        "27": {
          B: 4.6,
          C: 4.3
        }
      }
    },
    {
      number: "5283",
      description: "Back 4 Somersaults 1 1/2 Twists",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "27": {
          B: 5.6,
          C: 5.3
        }
      }
    },
    {
      number: "5284",
      description: "Back 4 Somersaults 2 Twists",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "27": {
          B: 5.1,
          C: 4.8
        }
      }
    },
    {
      number: "5286",
      description: "Back 4 Somersaults 3 Twists",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "27": {
          B: 5.7,
          C: 5.4
        }
      }
    },
    {
      number: "52(10)2",
      description: "Back 5 Somersaults 1 Twist",
      group: 7,
      groupName: "Back Twists",
      dd: {
        "27": {
          B: 5.5,
          C: 5.1
        }
      }
    },
    {
      number: "5341",
      description: "Reverse 2 Somersaults 1/2 Twist",
      group: 8,
      groupName: "Reverse Twists",
      dd: {
        "20": {
          D: 3.4
        },
        "27": {
          D: 3.5
        }
      }
    },
    {
      number: "5342",
      description: "Reverse 2 Somersaults 1 Twist",
      group: 8,
      groupName: "Reverse Twists",
      dd: {
        "20": {
          D: 3.1
        },
        "27": {
          D: 3.2
        }
      }
    },
    {
      number: "5343",
      description: "Reverse 2 Somersaults 1 1/2 Twists",
      group: 8,
      groupName: "Reverse Twists",
      dd: {
        "20": {
          D: 3.8
        },
        "27": {
          D: 3.9
        }
      }
    },
    {
      number: "5344",
      description: "Reverse 2 Somersaults 2 Twists",
      group: 8,
      groupName: "Reverse Twists",
      dd: {
        "20": {
          D: 3.5
        },
        "27": {
          D: 3.6
        }
      }
    },
    {
      number: "5345",
      description: "Reverse 2 Somersaults 2 1/2 Twists",
      group: 8,
      groupName: "Reverse Twists",
      dd: {
        "27": {
          D: 4.4
        }
      }
    },
    {
      number: "5346",
      description: "Reverse 2 Somersaults 3 Twists",
      group: 8,
      groupName: "Reverse Twists",
      dd: {
        "27": {
          D: 4.1
        }
      }
    },
    {
      number: "5347",
      description: "Reverse 2 Somersaults 3 1/2 Twists",
      group: 8,
      groupName: "Reverse Twists",
      dd: {
        "27": {
          D: 4.9
        }
      }
    },
    {
      number: "5348",
      description: "Reverse 2 Somersaults 4 Twists",
      group: 8,
      groupName: "Reverse Twists",
      dd: {
        "27": {
          D: 4.6
        }
      }
    },
    {
      number: "534(10)",
      description: "Reverse 2 Somersaults 5 Twists",
      group: 8,
      groupName: "Reverse Twists",
      dd: {
        "27": {
          D: 5.3
        }
      }
    },
    {
      number: "5361",
      description: "Reverse 3 Somersaults 1/2 Twist",
      group: 8,
      groupName: "Reverse Twists",
      dd: {
        "20": {
          B: 4.4,
          C: 4.2
        },
        "27": {
          B: 4.3,
          C: 4.1
        }
      }
    },
    {
      number: "5362",
      description: "Reverse 3 Somersaults 1 Twist",
      group: 8,
      groupName: "Reverse Twists",
      dd: {
        "20": {
          B: 4,
          C: 3.8
        },
        "27": {
          B: 3.9,
          C: 3.7
        }
      }
    },
    {
      number: "5363",
      description: "Reverse 3 Somersaults 1 1/2 Twists",
      group: 8,
      groupName: "Reverse Twists",
      dd: {
        "27": {
          B: 4.8,
          C: 4.6
        }
      }
    },
    {
      number: "5364",
      description: "Reverse 3 Somersaults 2 Twists",
      group: 8,
      groupName: "Reverse Twists",
      dd: {
        "27": {
          B: 4.4,
          C: 4.2
        }
      }
    },
    {
      number: "5365",
      description: "Reverse 3 Somersaults 2 1/2 Twists",
      group: 8,
      groupName: "Reverse Twists",
      dd: {
        "27": {
          B: 5.5,
          C: 5.3
        }
      }
    },
    {
      number: "5366",
      description: "Reverse 3 Somersaults 3 Twists",
      group: 8,
      groupName: "Reverse Twists",
      dd: {
        "27": {
          B: 5.1,
          C: 4.9
        }
      }
    },
    {
      number: "5368",
      description: "Reverse 3 Somersaults 4 Twists",
      group: 8,
      groupName: "Reverse Twists",
      dd: {
        "27": {
          D: 5.8
        }
      }
    },
    {
      number: "5381",
      description: "Reverse 4 Somersaults 1/2 Twist",
      group: 8,
      groupName: "Reverse Twists",
      dd: {
        "27": {
          B: 5.2,
          C: 4.9
        }
      }
    },
    {
      number: "5382",
      description: "Reverse 4 Somersaults 1 Twist",
      group: 8,
      groupName: "Reverse Twists",
      dd: {
        "27": {
          B: 4.7,
          C: 4.4
        }
      }
    },
    {
      number: "5442",
      description: "Inward 2 Somersaults 1 Twist",
      group: 9,
      groupName: "Inward Twists",
      dd: {
        "20": {
          D: 3.7
        },
        "27": {
          D: 3.8
        }
      }
    },
    {
      number: "5443",
      description: "Inward 2 Somersaults 1 1/2 Twists",
      group: 9,
      groupName: "Inward Twists",
      dd: {
        "20": {
          D: 3.4
        },
        "27": {
          D: 3.5
        }
      }
    },
    {
      number: "5445",
      description: "Inward 2 Somersaults 2 1/2 Twists",
      group: 9,
      groupName: "Inward Twists",
      dd: {
        "20": {
          D: 3.9
        },
        "27": {
          D: 4
        }
      }
    },
    {
      number: "5447",
      description: "Inward 2 Somersaults 3 1/2 Twists",
      group: 9,
      groupName: "Inward Twists",
      dd: {
        "27": {
          D: 4.5
        }
      }
    },
    {
      number: "5462",
      description: "Inward 3 Somersaults 1 Twist",
      group: 9,
      groupName: "Inward Twists",
      dd: {
        "27": {
          B: 4.6,
          C: 4.4
        }
      }
    },
    {
      number: "5463",
      description: "Inward 3 Somersaults 1 1/2 Twists",
      group: 9,
      groupName: "Inward Twists",
      dd: {
        "27": {
          B: 4.2,
          C: 4
        }
      }
    },
    {
      number: "6132",
      description: "Handstand Forward 1 1/2 Somersaults 1 Twist",
      group: 10,
      groupName: "Handstand Twists",
      dd: {
        "20": {
          D: 3.5
        },
        "27": {
          D: 3.5
        }
      }
    },
    {
      number: "6133",
      description: "Handstand Forward 1 1/2 Somersaults 1 1/2 Twists",
      group: 10,
      groupName: "Handstand Twists",
      dd: {
        "20": {
          D: 3.2
        },
        "27": {
          D: 3.2
        }
      }
    },
    {
      number: "6134",
      description: "Handstand Forward 1 1/2 Somersaults 2 Twists",
      group: 10,
      groupName: "Handstand Twists",
      dd: {
        "20": {
          D: 3.9
        },
        "27": {
          D: 3.9
        }
      }
    },
    {
      number: "6135",
      description: "Handstand Forward 1 1/2 Somersaults 2 1/2 Twists",
      group: 10,
      groupName: "Handstand Twists",
      dd: {
        "20": {
          D: 3.6
        },
        "27": {
          D: 3.6
        }
      }
    },
    {
      number: "6152",
      description: "Handstand Forward 2 1/2 Somersaults 1 Twist",
      group: 10,
      groupName: "Handstand Twists",
      dd: {
        "20": {
          B: 4.6,
          C: 4.4
        },
        "27": {
          B: 4.5,
          C: 4.3
        }
      }
    },
    {
      number: "6153",
      description: "Handstand Forward 2 1/2 Somersaults 1 1/2 Twists",
      group: 10,
      groupName: "Handstand Twists",
      dd: {
        "20": {
          B: 4.2,
          C: 4
        },
        "27": {
          B: 4.1,
          C: 3.9
        }
      }
    },
    {
      number: "6154",
      description: "Handstand Forward 2 1/2 Somersaults 2 Twists",
      group: 10,
      groupName: "Handstand Twists",
      dd: {
        "27": {
          D: 5
        }
      }
    },
    {
      number: "6155",
      description: "Handstand Forward 2 1/2 Somersaults 2 1/2 Twists",
      group: 10,
      groupName: "Handstand Twists",
      dd: {
        "27": {
          D: 4.6
        }
      }
    },
    {
      number: "6156",
      description: "Handstand Forward 2 1/2 Somersaults 3 Twists",
      group: 10,
      groupName: "Handstand Twists",
      dd: {
        "27": {
          D: 5.5
        }
      }
    },
    {
      number: "6157",
      description: "Handstand Forward 2 1/2 Somersaults 3 1/2 Twists",
      group: 10,
      groupName: "Handstand Twists",
      dd: {
        "27": {
          D: 5.1
        }
      }
    },
    {
      number: "6173",
      description: "Handstand Forward 3 1/2 Somersaults 1 1/2 Twists",
      group: 10,
      groupName: "Handstand Twists",
      dd: {
        "27": {
          B: 5.1,
          C: 4.7
        }
      }
    },
    {
      number: "6231",
      description: "Handstand Back 1 1/2 Somersaults 1/2 Twist",
      group: 10,
      groupName: "Handstand Twists",
      dd: {
        "20": {
          D: 3.3
        },
        "27": {
          D: 3.4
        }
      }
    },
    {
      number: "6232",
      description: "Handstand Back 1 1/2 Somersaults 1 Twist",
      group: 10,
      groupName: "Handstand Twists",
      dd: {
        "20": {
          D: 3
        },
        "27": {
          D: 3.1
        }
      }
    },
    {
      number: "6233",
      description: "Handstand Back 1 1/2 Somersaults 1 1/2 Twists",
      group: 10,
      groupName: "Handstand Twists",
      dd: {
        "20": {
          D: 3.7
        },
        "27": {
          D: 3.7
        }
      }
    },
    {
      number: "6251",
      description: "Handstand Back 2 1/2 Somersaults 1/2 Twist",
      group: 10,
      groupName: "Handstand Twists",
      dd: {
        "20": {
          B: 4.3,
          C: 4.1
        },
        "27": {
          B: 4.2,
          C: 4
        }
      }
    },
    {
      number: "6252",
      description: "Handstand Back 2 1/2 Somersaults 1 Twist",
      group: 10,
      groupName: "Handstand Twists",
      dd: {
        "20": {
          B: 3.9,
          C: 3.7
        },
        "27": {
          B: 3.8,
          C: 3.6
        }
      }
    },
    {
      number: "6253",
      description: "Handstand Back 2 1/2 Somersaults 1 1/2 Twist",
      group: 10,
      groupName: "Handstand Twists",
      dd: {
        "20": {
          B: 4.8,
          C: 4.6
        },
        "27": {
          B: 4.6,
          C: 4.4
        }
      }
    },
    {
      number: "6254",
      description: "Handstand Back 2 1/2 Somersaults 2 Twists",
      group: 10,
      groupName: "Handstand Twists",
      dd: {
        "20": {
          B: 4.4,
          C: 4.2
        },
        "27": {
          B: 4.2,
          C: 4
        }
      }
    },
    {
      number: "6255",
      description: "Handstand Back 2 1/2 Somersaults 2 1/2 Twist",
      group: 10,
      groupName: "Handstand Twists",
      dd: {
        "27": {
          D: 5.1
        }
      }
    },
    {
      number: "6256",
      description: "Handstand Back 2 1/2 Somersaults 3 Twists",
      group: 10,
      groupName: "Handstand Twists",
      dd: {
        "20": {
          D: 4.9
        },
        "27": {
          D: 4.7
        }
      }
    },
    {
      number: "6257",
      description: "Handstand Back 2 1/2 Somersaults 3 1/2 Twist",
      group: 10,
      groupName: "Handstand Twists",
      dd: {
        "27": {
          D: 5.7
        }
      }
    },
    {
      number: "6258",
      description: "Handstand Back 2 1/2 Somersaults 4 Twists",
      group: 10,
      groupName: "Handstand Twists",
      dd: {
        "27": {
          D: 5.3
        }
      }
    },
    {
      number: "625(10)",
      description: "Handstand Back 2 1/2 Somersaults 5 Twists",
      group: 10,
      groupName: "Handstand Twists",
      dd: {
        "27": {
          D: 6
        }
      }
    },
    {
      number: "6271",
      description: "Handstand Back 3 1/2 Somersaults 1/2 Twist",
      group: 10,
      groupName: "Handstand Twists",
      dd: {
        "27": {
          B: 5.2,
          C: 4.8
        }
      }
    },
    {
      number: "6272",
      description: "Handstand Back 3 1/2 Somersaults 1 Twist",
      group: 10,
      groupName: "Handstand Twists",
      dd: {
        "27": {
          B: 4.7,
          C: 4.3
        }
      }
    },
    {
      number: "6273",
      description: "Handstand Back 3 1/2 Somersaults 1 1/2 Twists",
      group: 10,
      groupName: "Handstand Twists",
      dd: {
        "27": {
          B: 5.7,
          C: 5.3
        }
      }
    },
    {
      number: "6274",
      description: "Handstand Back 3 1/2 Somersaults 2 Twists",
      group: 10,
      groupName: "Handstand Twists",
      dd: {
        "27": {
          B: 5.2,
          C: 4.8
        }
      }
    },
    {
      number: "6275",
      description: "Handstand Back 3 1/2 Somersaults 2 1/2 Twists",
      group: 10,
      groupName: "Handstand Twists",
      dd: {
        "27": {
          B: 6.3,
          C: 5.9
        }
      }
    },
    {
      number: "6276",
      description: "Handstand Back 3 1/2 Somersaults 3 Twists",
      group: 10,
      groupName: "Handstand Twists",
      dd: {
        "27": {
          B: 5.8,
          C: 5.4
        }
      }
    }
  ]
};

// src/lib/ddTable.ts
var TABLES = {
  worldaquatics: dd_table_default,
  redbull: dd_table_redbull_default
};
var INDEX = {
  worldaquatics: new Map(dd_table_default.dives.map((d) => [d.number, d])),
  redbull: new Map(dd_table_redbull_default.dives.map((d) => [d.number, d]))
};
function tableSource(ruleSet) {
  return TABLES[ruleSet].source;
}
function allDives(ruleSet) {
  return TABLES[ruleSet].dives;
}
function findDive(ruleSet, number) {
  return INDEX[ruleSet].get(number.trim().toUpperCase()) ?? null;
}
function positionsFor(ruleSet, number, height) {
  const dive = findDive(ruleSet, number);
  if (!dive) return [];
  const at = dive.dd[height];
  return at ? Object.keys(at) : [];
}
function lookupDD(ruleSet, number, position, height) {
  const key = number.trim().toUpperCase();
  const dive = findDive(ruleSet, key);
  const parsed = tryParseDiveNumber(key);
  const description = dive?.description ?? (parsed ? describeDive(parsed) : key);
  const dd = dive?.dd[height]?.[position];
  return {
    dd: dd ?? null,
    source: dd == null ? "none" : "table",
    dive,
    parsed,
    description
  };
}

// src/lib/scoring.ts
var MAX_AWARD = 10;
var AWARD_STEP = 0.5;
function dropPerSide(judgeCount) {
  if (judgeCount >= 7) return 2;
  if (judgeCount >= 5) return 1;
  return 0;
}
function round2(n) {
  return Math.round(n * 100) / 100;
}
function scoreDive(awards, dd, judgeCount) {
  const sorted = [...awards].sort((a, b) => a - b);
  const drop = sorted.length >= judgeCount ? dropPerSide(judgeCount) : 0;
  const droppedLow = sorted.slice(0, drop);
  const droppedHigh = drop > 0 ? sorted.slice(-drop) : [];
  const counted = sorted.slice(drop, drop === 0 ? void 0 : -drop);
  const sum = counted.reduce((a, b) => a + b, 0);
  return {
    counted,
    droppedHigh,
    droppedLow,
    sum: round2(sum),
    dd,
    points: round2(sum * dd)
  };
}
function awardNeededForTarget(target, scoredSoFar, remainingDDs) {
  const remaining = round2(target - scoredSoFar);
  const ddSum = remainingDDs.reduce((a, b) => a + b, 0);
  const maxAchievable = round2(scoredSoFar + ddSum * 3 * MAX_AWARD);
  if (remaining <= 0) {
    return {
      remaining: 0,
      requiredAward: null,
      impossible: false,
      alreadyReached: true,
      maxAchievable
    };
  }
  if (ddSum === 0) {
    return { remaining, requiredAward: null, impossible: true, alreadyReached: false, maxAchievable };
  }
  const award = remaining / (3 * ddSum);
  if (award > MAX_AWARD) {
    return { remaining, requiredAward: null, impossible: true, alreadyReached: false, maxAchievable };
  }
  const rounded = Math.ceil(award / AWARD_STEP) * AWARD_STEP;
  return {
    remaining,
    requiredAward: round2(Math.min(rounded, MAX_AWARD)),
    impossible: false,
    alreadyReached: false,
    maxAchievable
  };
}

// src/rules/validate.ts
var SLOT_ORDER = ["required", "intermediate", "optional1", "optional2"];
function evaluateList(entries, ruleSet, gender) {
  const height = ruleSet.heights[gender].table;
  const slotDefs = ruleSet.slots(gender);
  const listViolations = [];
  const dives = [];
  for (const def of slotDefs) {
    const entry = entries.find((e) => e.slot === def.id);
    if (!entry || !entry.number.trim()) continue;
    const violations = [];
    const lookup = lookupDD(ruleSet.id, entry.number, entry.position, height);
    const parsed = lookup.parsed ?? tryParseDiveNumber(entry.number);
    let rawDD = lookup.dd;
    let effectiveDD = rawDD ?? 0;
    let capped = false;
    let failed = false;
    if (rawDD == null) {
      failed = true;
      violations.push({
        level: "error",
        slot: def.id,
        message: lookup.dive ? `${entry.number} is not listed in position ${entry.position} at ${ruleSet.heights[gender].label}.` : `${entry.number} is not in the ${ruleSet.shortName} table.`,
        citation: ruleSet.source
      });
    } else if (def.maxDD != null && rawDD > def.maxDD) {
      if (ruleSet.overLimit === "cap") {
        capped = true;
        effectiveDD = def.maxDD;
        violations.push({
          level: "warning",
          slot: def.id,
          message: `DD ${rawDD.toFixed(1)} is above the ${def.label.toLowerCase()} limit of ${def.maxDD.toFixed(1)} \u2014 it will score as ${def.maxDD.toFixed(1)}.`,
          citation: ruleSet.citations.overLimit
        });
      } else {
        failed = true;
        effectiveDD = 0;
        violations.push({
          level: "error",
          slot: def.id,
          message: `DD ${rawDD.toFixed(1)} is above the ${def.label.toLowerCase()} limit of ${def.maxDD.toFixed(1)} \u2014 this counts as a failed dive.`,
          citation: ruleSet.citations.overLimit
        });
      }
    }
    dives.push({
      slot: def.id,
      number: entry.number.trim().toUpperCase(),
      position: entry.position,
      description: lookup.description,
      takeoff: parsed?.takeoff ?? null,
      group: lookup.dive?.group ?? parsed?.group ?? null,
      rawDD,
      effectiveDD,
      capped,
      failed,
      violations
    });
  }
  const byNumber = /* @__PURE__ */ new Map();
  for (const d of dives) {
    const list = byNumber.get(d.number) ?? [];
    list.push(d);
    byNumber.set(d.number, list);
  }
  for (const [number, group] of byNumber) {
    if (group.length < 2) continue;
    for (const d of group) {
      d.failed = true;
      d.effectiveDD = 0;
      d.violations.push({
        level: "error",
        slot: d.slot,
        message: `${number} appears ${group.length} times \u2014 a repeated dive scores zero.`,
        citation: ruleSet.citations.repeat
      });
    }
  }
  const withTakeoff = dives.filter((d) => d.takeoff);
  if (ruleSet.takeoffRule === "allDistinct") {
    const seen = /* @__PURE__ */ new Map();
    for (const d of withTakeoff) {
      const list = seen.get(d.takeoff) ?? [];
      list.push(d);
      seen.set(d.takeoff, list);
    }
    for (const [takeoff, group] of seen) {
      if (group.length < 2) continue;
      const where = group.map((d) => d.number).join(" and ");
      for (const d of group) {
        d.failed = true;
        d.effectiveDD = 0;
        d.violations.push({
          level: "error",
          slot: d.slot,
          message: `All four dives must use different take-offs; ${where} are both ${takeoff}.`,
          citation: ruleSet.citations.takeoff
        });
      }
    }
  } else {
    const pairs = [
      ["required", "intermediate", "The required and intermediate dives"],
      ["optional1", "optional2", "The two optional dives"]
    ];
    for (const [a, b, label] of pairs) {
      const first = dives.find((d) => d.slot === a);
      const second = dives.find((d) => d.slot === b);
      if (!first?.takeoff || !second?.takeoff) continue;
      if (first.takeoff !== second.takeoff) continue;
      for (const d of [first, second]) {
        d.violations.push({
          level: "error",
          slot: d.slot,
          message: `${label} must come from different take-offs; both are ${first.takeoff}.`,
          citation: ruleSet.citations.takeoff
        });
      }
      listViolations.push({
        level: "error",
        slot: null,
        message: `${label} must come from different take-offs.`,
        citation: ruleSet.citations.takeoff
      });
    }
  }
  const filled = dives.length;
  if (filled < SLOT_ORDER.length) {
    listViolations.push({
      level: "warning",
      slot: null,
      message: `${SLOT_ORDER.length - filled} of ${SLOT_ORDER.length} dives still to choose.`,
      citation: ruleSet.source
    });
  }
  const totalDD = round2(dives.reduce((n, d) => n + (d.failed ? 0 : d.effectiveDD), 0));
  const hasError = listViolations.some((v) => v.level === "error") || dives.some((d) => d.violations.some((v) => v.level === "error"));
  return {
    dives,
    violations: listViolations,
    totalDD,
    maxScore: round2(totalDD * 3 * 10),
    valid: filled === SLOT_ORDER.length && !hasError
  };
}

// src/rules/index.ts
function slots(gender) {
  const required = gender === "men" ? 2.8 : 2.6;
  const intermediate = gender === "men" ? 3.6 : 3.4;
  return [
    { id: "required", label: "Required", maxDD: required },
    { id: "intermediate", label: "Intermediate", maxDD: intermediate },
    { id: "optional1", label: "Optional 1", maxDD: null },
    { id: "optional2", label: "Optional 2", maxDD: null }
  ];
}
var REDBULL = {
  id: "redbull",
  name: "Red Bull Cliff Diving World Series",
  shortName: "Red Bull",
  source: "Red Bull Cliff Diving World Series 2026 Rule Book",
  heights: {
    men: { table: "27", label: "26.5\u201328 m" },
    women: { table: "20", label: "20\u201322 m" }
  },
  judgeCounts: [5],
  defaultJudgeCount: 5,
  slots,
  overLimit: "cap",
  takeoffRule: "allDistinct",
  citations: {
    repeat: "Red Bull 3.5.3",
    takeoff: "Red Bull 3.5.1",
    overLimit: "Red Bull 3.1 / 3.5.3",
    scoring: "Red Bull 12.1.3"
  }
};
var WORLD_AQUATICS = {
  id: "worldaquatics",
  name: "World Aquatics High Diving",
  shortName: "World Aquatics",
  source: "World Aquatics High Diving Competition Regulations (in force 9 Nov 2024)",
  heights: {
    men: { table: "27", label: "27 m" },
    women: { table: "20", label: "20 m" }
  },
  judgeCounts: [7, 5],
  defaultJudgeCount: 7,
  slots,
  overLimit: "cap",
  takeoffRule: "pairwise",
  citations: {
    repeat: "HD 3.3.1",
    takeoff: "HD 3.4.1 / 3.4.2",
    overLimit: "HD 3.4.1 / 3.4.2",
    scoring: "HD 6.5 / 6.6"
  }
};
var RULE_SETS = {
  redbull: REDBULL,
  worldaquatics: WORLD_AQUATICS
};
var RULE_SET_IDS = ["redbull", "worldaquatics"];

// src/lib/ranking.ts
var SERIES_POINTS = [20, 16, 13, 10, 8, 7, 6, 5, 4, 3, 2, 1];
var WORLD_POINTS = [
  45,
  38,
  32,
  27,
  23,
  20,
  18,
  16,
  14,
  12,
  10,
  9,
  8,
  7,
  6,
  5,
  4,
  3,
  2,
  1
];
var MIN_WORLD_RANKING_DIVISOR = 4;
var BEST_DIVE_BONUS = 1;
function seriesPointsFor(rank) {
  return SERIES_POINTS[rank - 1] ?? 0;
}
function worldPointsFor(rank) {
  return WORLD_POINTS[rank - 1] ?? 0;
}
function round22(n) {
  return Math.round(n * 100) / 100;
}
function compareByPlacings(a, b) {
  const depth = Math.max(a.length, b.length);
  for (let rank = 1; rank < depth; rank++) {
    const diff = (b[rank] ?? 0) - (a[rank] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
function gather(input, counts, pointsFor) {
  const eligible = new Map(
    input.competitions.filter((c) => c.season === input.season && c.gender === input.gender && counts(c)).map((c) => [c.id, c])
  );
  const byDiver = /* @__PURE__ */ new Map();
  for (const result of input.results) {
    if (!eligible.has(result.competitionId)) continue;
    const entry = byDiver.get(result.diverId) ?? { diverId: result.diverId, appearances: 0, placings: [], points: 0, bestDives: 0 };
    entry.appearances += 1;
    entry.placings[result.rank] = (entry.placings[result.rank] ?? 0) + 1;
    entry.points += pointsFor(result.rank);
    if (result.bestDive) entry.bestDives += 1;
    byDiver.set(result.diverId, entry);
  }
  return byDiver;
}
function assignPositions(rows, tied) {
  rows.forEach((row, i) => {
    row.position = i === 0 || !tied(rows[i - 1], row) ? i + 1 : rows[i - 1].position;
  });
  return rows;
}
function seriesRanking(input) {
  const divers = new Map((input.divers ?? []).map((d) => [d.id, d]));
  const gathered = gather(input, (c) => c.countsForSeries, seriesPointsFor);
  const rows = [...gathered.values()].map((g) => ({
    diverId: g.diverId,
    diver: divers.get(g.diverId) ?? null,
    appearances: g.appearances,
    placings: g.placings,
    placingPoints: g.points,
    bestDives: g.bestDives,
    points: g.points + g.bestDives * BEST_DIVE_BONUS,
    position: 0
  }));
  rows.sort((a, b) => b.points - a.points || compareByPlacings(a.placings, b.placings));
  return assignPositions(
    rows,
    (a, b) => a.points === b.points && compareByPlacings(a.placings, b.placings) === 0
  );
}
function worldRanking(input) {
  const divers = new Map((input.divers ?? []).map((d) => [d.id, d]));
  const gathered = gather(input, (c) => c.countsForWorldRanking, worldPointsFor);
  const rows = [...gathered.values()].map((g) => {
    const divisor = Math.max(g.appearances, MIN_WORLD_RANKING_DIVISOR);
    return {
      diverId: g.diverId,
      diver: divers.get(g.diverId) ?? null,
      appearances: g.appearances,
      placings: g.placings,
      totalPoints: g.points,
      divisor,
      average: round22(g.points / divisor),
      divisorFloored: g.appearances < MIN_WORLD_RANKING_DIVISOR,
      position: 0
    };
  });
  rows.sort((a, b) => b.average - a.average || compareByPlacings(a.placings, b.placings));
  return assignPositions(
    rows,
    (a, b) => a.average === b.average && compareByPlacings(a.placings, b.placings) === 0
  );
}
export {
  AWARD_STEP,
  BEST_DIVE_BONUS,
  GROUP_NAMES,
  MAX_AWARD,
  MIN_WORLD_RANKING_DIVISOR,
  POSITIONS,
  POSITION_NAMES,
  REDBULL,
  RULE_SETS,
  RULE_SET_IDS,
  SERIES_POINTS,
  TAKEOFFS,
  WORLD_AQUATICS,
  WORLD_POINTS,
  allDives,
  awardNeededForTarget,
  describeDive,
  dropPerSide,
  evaluateList,
  findDive,
  lookupDD,
  parseDiveNumber,
  positionOf,
  positionsFor,
  scoreDive,
  seriesPointsFor,
  seriesRanking,
  tableSource,
  tryParseDiveNumber,
  worldPointsFor,
  worldRanking
};
