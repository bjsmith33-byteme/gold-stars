import { test } from "node:test";
import assert from "node:assert/strict";
import {
  messagesToStars,
  messageToStars,
  validateStar,
  partitionStars,
  buildTeamsNomination,
  parseNominationExtras,
  stripTagBrackets,
  teamsChatUrl,
  chatByKey,
  MONITORED_CHATS,
  type TeamsMessage,
} from "./teams.ts";
import type { StarEvent } from "./aggregate.ts";

// The chat auto-tally ships switched off in this template (features.chatComposer is
// false), but the parser is still exercised here against the placeholder `chat` block
// and `categories[].tallyPatterns` in src/config/team.config.ts. Everything below
// follows config — swap in your own areas and these tests describe YOUR rules.

// messageToStars returns an array (one row per recipient); this keeps the
// single-recipient assertions terse.
const one = (m: TeamsMessage): StarEvent | null => {
  const rows = messageToStars(m);
  return rows.length === 1 ? rows[0] : null;
};

// Ana Silva is Mobile and Raj Patel is Backend in the roster; "Pat Visitor" is not.
function msg(over: Partial<TeamsMessage> = {}): TeamsMessage {
  return {
    id: "m1",
    authorName: "Diego Hernandez", // the nominator
    createdAt: "2026-05-20T14:00:00Z",
    content: "Gold star ⭐",
    mentions: [{ id: "u-ana", name: "Ana Silva" }], // the recipient
    ...over,
  };
}

test("a ⭐ + @mention awards the mentioned person; author is the nominator", () => {
  const s = one(msg());
  assert.deepEqual(s, {
    date: "2026-05-20",
    recipient: "Ana Silva",
    role: "Mobile",
    category: "JavaScript", // chat.fallbackCategory — no area signal in the message
    note: "",
    source: "Teams",
    awarded_by: "Diego Hernandez",
    sub_topic: "",
  });
});

test("the WORD 'star' counts too (not only the emoji)", () => {
  const s = one(msg({ content: "Gold star for the assist" }));
  assert.equal(s?.recipient, "Ana Silva"); // recipient still from the @mention
});

test("'started'/'rockstar' do NOT count as a star", () => {
  assert.equal(one(msg({ content: "we started the build" })), null);
  assert.equal(one(msg({ content: "total rockstar move" })), null);
});

test("a star with no @mention resolves an unambiguous roster first name", () => {
  const s = one(msg({ content: "gold star for Raj, great fix!", mentions: [] }));
  assert.equal(s?.recipient, "Raj Patel"); // "Raj" -> roster full name
});

test("a star with neither @mention nor a known name -> ignored", () => {
  assert.equal(one(msg({ content: "gold star for the team! ⭐", mentions: [] })), null);
});

test("@Everyone (no user id) is skipped", () => {
  assert.equal(one(msg({ mentions: [{ id: "", name: "Everyone" }] })), null);
});

test("a second emoji sets the area", () => {
  const cat = (content: string) => one(msg({ content }))!.category;
  assert.equal(cat("⭐ ⚛️"), "React");
  assert.equal(cat("⭐ 🎨"), "CSS");
  assert.equal(cat("⭐ 📱"), "SwiftUI");
  assert.equal(cat("⭐ ❤️"), "JavaScript"); // unrecognized emoji -> fallback
});

test("category keywords work too", () => {
  const cat = (content: string) => one(msg({ content }))!.category;
  assert.equal(cat("⭐ great React help"), "React");
  assert.equal(cat("⭐ explained hooks so clearly"), "React");
  assert.equal(cat("⭐ untangled my flexbox"), "CSS");
  assert.equal(cat("⭐ that CSS fix saved me"), "CSS");
  assert.equal(cat("⭐ SwiftUI state wizardry"), "SwiftUI");
  assert.equal(cat("⭐ promises finally make sense"), "JavaScript");
  assert.equal(cat("⭐ just generally awesome"), "JavaScript"); // fallback
});

test("keyword matching respects word boundaries", () => {
  // "reacted" must not trigger React, so it falls through to the fallback area.
  assert.equal(one(msg({ content: "⭐ reacted fast to the outage" }))!.category, "JavaScript");
});

test("when several area emoji are present, the earliest one wins", () => {
  assert.equal(one(msg({ content: "⭐ ⚛️ then later 🎨" }))!.category, "React");
});

test("recognizes the emoji embedded as an <emoji alt> tag (how Graph sends it)", () => {
  const content =
    'Nice work! <emoji id="star" alt="⭐" title="Star"></emoji> <emoji alt="🎨"></emoji>';
  const s = one(msg({ content }))!;
  assert.equal(s.category, "CSS");
});

test("multiple @mentions each get a row (one kudos, several recipients)", () => {
  const rows = messageToStars(
    msg({
      content: "great teamwork ⭐",
      mentions: [
        { id: "u-ana", name: "Ana Silva" },
        { id: "u-raj", name: "Raj Patel" },
      ],
    }),
  );
  assert.deepEqual(
    rows.map((r) => r.recipient),
    ["Ana Silva", "Raj Patel"],
  );
  assert.ok(rows.every((r) => r.awarded_by === "Diego Hernandez" && r.source === "Teams"));
});

test("@mention + a first name in the text both count, de-duped", () => {
  // Ana is @mentioned AND named (counts once); Raj is only named.
  const rows = messageToStars(
    msg({ content: "⭐ thanks Ana and Raj!", mentions: [{ id: "u-ana", name: "Ana Silva" }] }),
  );
  assert.deepEqual(
    rows.map((r) => r.recipient).sort(),
    ["Ana Silva", "Raj Patel"],
  );
});

test("messagesToStars filters out non-kudos messages", () => {
  const rows = messagesToStars([
    msg(),
    msg({ id: "m2", content: "just chatting" }),
    msg({ id: "m3", content: "⭐", mentions: [] }),
  ]);
  assert.equal(rows.length, 1);
});

test("role is blank for a recipient not on the roster", () => {
  assert.equal(one(msg({ mentions: [{ id: "u-x", name: "Pat Visitor" }] }))!.role, "");
});

// --- buildTeamsNomination (the in-app composer's output must parse back) ---

test("buildTeamsNomination composes a star + name + area emoji + detail", () => {
  assert.equal(
    buildTeamsNomination({ recipient: "Raj Patel", category: "CSS", detail: "fixed my grid" }),
    "⭐ Gold star for Raj Patel 🎨 — fixed my grid",
  );
});

test("buildTeamsNomination omits the emoji and dash for unknown areas / no detail", () => {
  // An area with no kudosEmoji configured (or one that isn't in `categories` at all)
  // composes without a glyph — the tally then files it under the fallback area.
  assert.equal(
    buildTeamsNomination({ recipient: "Raj Patel", category: "Documentation" }),
    "⭐ Gold star for Raj Patel",
  );
});

test("a composed message parses back to the intended recipient + area (round-trip)", () => {
  // No @mention (paste can't carry one) — the tally resolves "Raj" from the text.
  const content = buildTeamsNomination({
    recipient: "Raj Patel",
    category: "CSS",
    detail: "great fix",
  });
  const s = one(msg({ content, mentions: [] }));
  assert.equal(s?.recipient, "Raj Patel");
  assert.equal(s?.category, "CSS");

  const fallback = one(
    msg({
      content: buildTeamsNomination({ recipient: "Ana Silva", category: "JavaScript" }),
      mentions: [],
    }),
  );
  assert.equal(fallback?.recipient, "Ana Silva");
  assert.equal(fallback?.category, "JavaScript");
});

// --- sub-topics and the write-up: composer -> message -> CSV ---

test("buildTeamsNomination brackets the sub-topic tags before the prose", () => {
  assert.equal(
    buildTeamsNomination({
      recipient: "Raj Patel",
      category: "CSS",
      subTopics: ["flexbox", "grid"],
      detail: "gap beats margins for spacing children",
    }),
    "⭐ Gold star for Raj Patel 🎨 [flexbox; grid] — gap beats margins for spacing children",
  );
  // No tags, no brackets — the message stays as short as it was.
  assert.equal(
    buildTeamsNomination({ recipient: "Raj Patel", category: "CSS", detail: "nice" }),
    "⭐ Gold star for Raj Patel 🎨 — nice",
  );
});

test("parseNominationExtras round-trips the composer's own output", () => {
  const content = buildTeamsNomination({
    recipient: "Raj Patel",
    category: "CSS",
    subTopics: ["flexbox", "grid"],
    detail: "use gap instead of last-child margin hacks",
  });
  assert.deepEqual(parseNominationExtras(content), {
    subTopic: "flexbox; grid",
    note: "use gap instead of last-child margin hacks",
  });
});

test("a composed message lands both the tags and the write-up in the row", () => {
  const content = buildTeamsNomination({
    recipient: "Ana Silva",
    category: "CSS",
    subTopics: ["flexbox"],
    detail: "center a div with justify-content and align-items",
  });
  const s = one(msg({ content, mentions: [] }));
  assert.equal(s?.sub_topic, "flexbox");
  assert.equal(s?.note, "center a div with justify-content and align-items");
  assert.equal(s?.category, "CSS");
  assert.equal(s?.recipient, "Ana Silva");
});

test("prose is taken only from a composer-shaped message, so the KB stays clean", () => {
  // A note is what promotes a row to a knowledge-base entry, so an ordinary chat tail must
  // not become one.
  assert.equal(one(msg({ content: "Gold star ⭐ @Ana Silva" }))?.note, "", "no dash, no note");
  assert.equal(
    one(msg({ content: "you're a legend, gold star ⭐ — thanks!!" }))?.note,
    "",
    "the star signal doesn't lead, so the tail is just chat",
  );
  assert.equal(
    one(msg({ content: "⭐ gold star @Ana Silva — explained the render cycle" }))?.note,
    "explained the render cycle",
  );
});

test("an em-dash inside the write-up survives", () => {
  const s = one(msg({ content: "⭐ star @Ana Silva — first — second" }));
  assert.equal(s?.note, "first — second");
});

test("tags are read from a hand-typed message and normalized", () => {
  const s = one(msg({ content: "⭐ @Ana Silva [data flow;state; State]" }));
  assert.equal(s?.sub_topic, "data flow; state", "split, trimmed, de-duped");
});

test("a tag can't hijack the area or be mistaken for a recipient", () => {
  // "css" matches the CSS area's tallyPatterns, but here it's a LABEL on a star with no
  // other area signal — so the row must stay on the fallback area.
  const s = one(msg({ content: "Gold star ⭐ @Ana Silva [css grid]" }));
  assert.equal(s?.category, "JavaScript", "chat.fallbackCategory, not CSS");
  assert.equal(s?.sub_topic, "css grid");

  // "Raj" inside a tag must not add Raj Patel as a second recipient.
  const rows = messageToStars(msg({ content: "Gold star ⭐ @Ana Silva [Raj's hooks]" }));
  assert.deepEqual(rows.map((r) => r.recipient), ["Ana Silva"]);
});

test("stripTagBrackets leaves an untagged message alone", () => {
  assert.equal(stripTagBrackets("⭐ Gold star for Ana Silva 🎨"), "⭐ Gold star for Ana Silva 🎨");
});

test("a tagged row still passes validation", () => {
  // The formula guard walks every column as a string, so the joined cell is covered already.
  assert.deepEqual(validateStar(row({ sub_topic: "flexbox; grid" })), []);
  assert.deepEqual(validateStar(row({ sub_topic: "=cmd(); grid" })), [
    "possible formula injection in sub_topic",
  ]);
});

// --- chat picker (composer "Post in" dropdown + ?chat= deep link) ---

test("teamsChatUrl builds an l/chat deep link for a chat id", () => {
  assert.equal(
    teamsChatUrl("19:abc@thread.v2"),
    "https://teams.microsoft.com/l/chat/19:abc@thread.v2/conversations?context=%7B%22contextType%22%3A%22chat%22%7D",
  );
});

test("chatByKey resolves a known key and defaults to the first chat otherwise", () => {
  assert.equal(chatByKey("web").label, "Web chat");
  assert.equal(chatByKey(undefined).key, MONITORED_CHATS[0].key); // default = first
  assert.equal(chatByKey("nope").key, MONITORED_CHATS[0].key); // unknown -> default
});

test("MONITORED_CHATS keys are unique (so ?chat= is unambiguous)", () => {
  const keys = MONITORED_CHATS.map((c) => c.key);
  assert.equal(new Set(keys).size, keys.length);
});

// --- validation ---

function row(over: Partial<StarEvent> = {}): StarEvent {
  return {
    date: "2026-05-20",
    recipient: "Raj Patel",
    role: "Backend",
    category: "CSS",
    note: "",
    source: "Teams",
    awarded_by: "Diego Hernandez",
    sub_topic: "",
    ...over,
  };
}

test("validateStar passes a clean roster-to-roster row", () => {
  assert.deepEqual(validateStar(row()), []);
});

test("off-roster recipients & nominators are allowed (people outside the team)", () => {
  // Someone off the roster still earns the star (blank role), not a flag.
  assert.deepEqual(validateStar(row({ recipient: "Pat Visitor", role: "" })), []);
  // A teammate thanked BY someone off the roster still counts automatically.
  assert.deepEqual(validateStar(row({ awarded_by: "Pat Visitor" })), []);
  // Both off-roster is fine too.
  assert.deepEqual(
    validateStar(row({ recipient: "Pat Visitor", role: "", awarded_by: "Jo External" })),
    [],
  );
});

test("validateStar still flags formula injection, empty recipient, and self-nomination", () => {
  assert.ok(validateStar(row({ note: '=HYPERLINK("http://x")' })).some((f) => f.includes("note")));
  assert.ok(validateStar(row({ recipient: "" })).includes("empty recipient"));
  assert.ok(validateStar(row({ awarded_by: "Raj Patel" })).includes("self-nomination"));
});

test("partitionStars splits clean from flagged", () => {
  const { clean, flagged } = partitionStars([row(), row({ note: "=cmd|' /C calc'!A1" })]);
  assert.equal(clean.length, 1);
  assert.equal(flagged.length, 1);
  assert.ok(flagged[0].flags.some((f) => f.includes("note")));
});
