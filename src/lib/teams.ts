// Turns Teams "kudos" messages into gold-star rows for the auto-tally.
//
// Why messages, not reactions: Microsoft Graph returns only ONE reaction per chat
// message (confirmed against the raw v1.0 AND beta APIs), so ⭐ reactions can't be
// read reliably. Message *content* and *@mentions* come back complete, so a kudos
// is expressed as a message instead:
//
//   Post in a monitored chat — a star plus who it's for:
//     "Gold star ⭐ @Ana Silva"       -> Ana, the fallback area
//     "⭐ @Raj Patel 🎨"              -> Raj, CSS (area emoji)
//     "star for Raj on css"           -> Raj, CSS (word + first name)
//
// Rules:
//   * STAR signal: the ⭐/🌟 emoji OR the word "star"/"stars". (The word is matched on
//     tag-stripped text with \b boundaries, so "started"/"rockstar"/the emoji's own
//     title="Star" don't trigger it.)
//   * RECIPIENTS: every @mention PLUS every unambiguous roster first name in the text
//     (resolved to roster full names, de-duped) — so one kudos can thank several
//     people, yielding ONE ROW PER RECIPIENT. Nominator (`awarded_by`) = the author.
//   * SUB-TOPICS: a bracketed group, "[Hooks; Forms]", anywhere in the message. Read as
//     tags and then removed before area/name detection, so a label can't be mistaken for
//     content. Optional — most hand-typed kudos have none.
//   * WRITE-UP: the prose after the first em-dash, but ONLY on a composer-shaped message
//     (star signal first, then " — ", then the text). A note is what promotes a row to a
//     knowledge-base entry, so arbitrary chat tails are left alone rather than published as
//     one.
//   * AREA (earliest signal wins): each area's emoji/keyword patterns come from
//     `categories[].tallyPatterns` in src/config/team.config.ts; anything unmatched
//     falls through to `chat.fallbackCategory`. In this template that means
//     ⚛️/"react"/"hook(s)" → React; 🎨/"css"/"flexbox" → CSS; 📱/"swiftui"/"swift" →
//     SwiftUI; else JavaScript.
//
// Pure transform (messages -> rows). Fetching the messages from the chat platform
// (and resolving each @mention's user id to a canonical name), de-dup, and committing
// are a scheduled job's job — not shipped with this template.
//
// NOTE FOR THIS TEMPLATE: no real chat is wired up (`features.chatComposer` is false),
// so nothing here runs in the app. It ships tested and ready for a team that wants to
// turn it on — see the `chat` block in team.config.ts.
//
// The rules themselves are team-agnostic — only the patterns and the monitored chat
// list are configured. A team with no `chat` block gets an empty MONITORED_CHATS and
// this module simply goes unused.

import type { StarEvent } from "./aggregate";
import type { MonitoredChat } from "../config/types.ts";
// Explicit .ts extension so Node's test runner (type-stripping) can resolve these at
// runtime; tsc/vite accept it via allowImportingTsExtensions.
import { CATEGORY_EMOJI, joinSubTopics, splitSubTopics } from "./aggregate.ts";
import { ROSTER, roleFor } from "../config/roster.ts";
import TEAM from "../config/team.config.ts";

/** The chats whose kudos messages feed the auto-tally. Consumed by the fetcher and by
 *  the in-app composer's chat picker. The first entry is the default.
 *  Empty when the team has no `chat` block configured — the composer hides itself and
 *  the tally has nothing to read. */
export const MONITORED_CHATS: MonitoredChat[] = TEAM.chat?.monitoredChats ?? [];

/** Deep link that opens a specific Teams chat in the client. */
export function teamsChatUrl(chatId: string): string {
  return `https://teams.microsoft.com/l/chat/${chatId}/conversations?context=%7B%22contextType%22%3A%22chat%22%7D`;
}

/** Look up a monitored chat by its short `key`, falling back to the default (first). */
export function chatByKey(key: string | undefined): { key: string; id: string; label: string } {
  return MONITORED_CHATS.find((c) => c.key === key) ?? MONITORED_CHATS[0];
}

/** A resolved @mention. `name` is the canonical display name (the fetcher resolves
 *  the user id -> name so it matches the roster); `id` is the AAD user id. */
export interface TeamsMention {
  id: string;
  name: string;
}

/** A Teams chat message (the fetcher supplies content + resolved mentions). */
export interface TeamsMessage {
  id: string;
  authorName: string; // message author = the nominator
  createdAt: string; // ISO timestamp; the star's date (when the help happened)
  content: string; // message body (HTML/text); searched for the ⭐ / area emoji
  mentions: TeamsMention[];
}

/** Area assigned when a kudos matches no configured pattern. */
const GENERAL = TEAM.chat?.fallbackCategory ?? "";

// A message counts as a star if it has the ⭐/🌟 EMOJI (Graph embeds it as alt="⭐")
// or the WORD "star"/"stars". The word is matched on tag-stripped text so the emoji's
// own title="Star" doesn't self-trigger, and \b boundaries avoid "started"/"rockstar".
const STAR_WORD = /\bstars?\b/i;

// Category signals — emoji OR keyword, from each configured area's `tallyPatterns`.
// The EARLIEST match anywhere in the message wins; areas are checked in config order,
// so an area listed first wins a positional tie. Areas with no tallyPatterns are never
// auto-detected and fall through to GENERAL.
const CATEGORY_RULES: { category: string; patterns: RegExp[] }[] = TEAM.categories
  .filter((c) => c.tallyPatterns?.length)
  .map((c) => ({ category: c.name, patterns: c.tallyPatterns as RegExp[] }));

// First name -> roster full name(s). A name resolves only if it's unambiguous.
const FIRST_NAME_INDEX = (() => {
  const idx = new Map<string, string[]>();
  for (const full of Object.keys(ROSTER)) {
    const first = full.trim().split(/\s+/)[0].toLowerCase();
    idx.set(first, [...(idx.get(first) ?? []), full]);
  }
  return idx;
})();

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Strip HTML tags/entities so word/keyword/name matching sees plain text. */
function toPlainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function hasStar(raw: string, plain: string): boolean {
  return /⭐|🌟/.test(raw) || STAR_WORD.test(plain);
}

/** Category from the EARLIEST emoji/keyword signal in the message, else General. */
function categoryFor(raw: string): string {
  let bestIdx = Infinity;
  let category = GENERAL;
  for (const rule of CATEGORY_RULES) {
    for (const re of rule.patterns) {
      const m = re.exec(raw);
      if (m && m.index < bestIdx) {
        bestIdx = m.index;
        category = rule.category;
      }
    }
  }
  return category;
}

/** All UNAMBIGUOUS roster first names in the text, as full names, ordered by
 *  first appearance. Ambiguous first names (shared by >1 person) are skipped. */
function firstNamesInText(plain: string): string[] {
  const hits: { idx: number; full: string }[] = [];
  for (const [first, fulls] of FIRST_NAME_INDEX) {
    if (fulls.length !== 1) continue; // ambiguous -> don't guess
    const m = new RegExp(`\\b${escapeRegex(first)}\\b`, "i").exec(plain);
    if (m) hits.push({ idx: m.index, full: fulls[0] });
  }
  return hits.sort((a, b) => a.idx - b.idx).map((h) => h.full);
}

/** Distinct recipients of a kudos: every @mentioned person PLUS every unambiguous
 *  roster first name in the text (de-duped, @mentions first). */
function recipientsFor(msg: TeamsMessage, plain: string): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  const add = (raw: string) => {
    const name = raw.trim();
    const key = name.toLowerCase();
    if (name && !seen.has(key)) {
      seen.add(key);
      ordered.push(name);
    }
  };
  for (const m of msg.mentions) if (m.id && m.name.trim()) add(m.name);
  for (const n of firstNamesInText(plain)) add(n);
  return ordered;
}

/** Turn ONE kudos message into gold-star rows — ONE PER RECIPIENT — or [] if it
 *  isn't a kudos (no star signal, or nobody to credit). Exposed so callers that need
 *  the message id (for de-dup) can iterate themselves and reuse the exact rules. */
export function messageToStars(msg: TeamsMessage): StarEvent[] {
  const raw = msg.content;
  const plain = toPlainText(raw);
  if (!hasStar(raw, plain)) return [];

  // Sub-topic tags are a label, not content: read them out first, then take them back OUT of
  // the text everything else reads. A tag like "[CSS grid]" would otherwise match the CSS
  // area's tallyPatterns and quietly overrule the area the awarder chose, and "[Raj's hooks]"
  // would be mistaken for a recipient.
  const { subTopic, note } = parseNominationExtras(plain);
  const searchable = stripTagBrackets(plain);
  const rawWithoutTags = raw.replace(TAG_BRACKETS, " ");

  const recipients = recipientsFor(msg, searchable);
  if (recipients.length === 0) return [];

  const date = msg.createdAt.slice(0, 10); // YYYY-MM-DD
  const category = categoryFor(rawWithoutTags); // shared by all recipients of this message
  const awarded_by = msg.authorName.trim(); // the person who posted the kudos
  return recipients.map((name) => ({
    date,
    recipient: name,
    role: roleFor(name),
    category,
    // Prose from a composer-shaped message; otherwise blank, and the KB summary is written
    // by a human during review.
    note,
    source: "Teams",
    awarded_by,
    sub_topic: subTopic,
  }));
}

/** Transform a batch of Teams messages into gold-star rows (one per recipient). */
export function messagesToStars(messages: TeamsMessage[]): StarEvent[] {
  return messages.flatMap((m) => messageToStars(m));
}

// ---------------------------------------------------------------------------
// The inverse: build a kudos message for a human to post. The in-app composer
// (AwardStarModal) uses this so the text it hands people is guaranteed to parse
// back to the right recipient + area via the rules above. Paste can't carry a real
// @mention, so the recipient goes in as plain text — the tally still resolves it by
// unambiguous first name; the poster can retype "@Name" for an actual ping.
// ---------------------------------------------------------------------------

/** Compose a ready-to-paste Teams kudos: a ⭐, the recipient, the area emoji (so
 *  categoryFor picks the area), the sub-topic tags in [brackets], then optional free-text
 *  context after an em-dash. Both of the trailing parts are read back by
 *  parseNominationExtras, which is what lets a chat shout-out become a knowledge-base entry
 *  instead of a bare tally mark. */
export function buildTeamsNomination(opts: {
  recipient: string;
  category: string;
  detail?: string;
  subTopics?: string[];
}): string {
  const tags = joinSubTopics(opts.subTopics ?? []);
  const head = [
    "⭐ Gold star for",
    opts.recipient.trim(),
    CATEGORY_EMOJI[opts.category] ?? "",
    tags ? `[${tags}]` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const detail = opts.detail?.trim();
  return detail ? `${head} — ${detail}` : head;
}

/** The bracket group carrying sub-topic tags, e.g. "[Hooks; Forms]". Bounded so a stray
 *  bracket in a long message can't swallow half of it. */
const TAG_BRACKETS = /\[([^\]\n]{1,120})\]/;

// An em-dash (or " -- ") separates the kudos head from its prose. Only the FIRST one splits;
// anything after it, dashes included, is prose.
const DETAIL_SPLIT = /\s(?:—|–|--)\s/;

// "Composer-shaped" = the message LEADS with the star signal, the way buildTeamsNomination
// writes it. A mid-sentence "great work — thanks!" doesn't qualify, so its tail stays out of
// the knowledge base.
const COMPOSER_HEAD = /^\s*(?:⭐|🌟|gold star\b|star\b)/i;

/** Strip the tag brackets out of a message. Run before recipient/area detection so a tag like
 *  "[Raj's hooks]" can't be read as a recipient or drag the area off target. */
export function stripTagBrackets(text: string): string {
  return text.replace(TAG_BRACKETS, " ").replace(/\s+/g, " ").trim();
}

/** Pull the sub-topic tags and the write-up out of a kudos message.
 *
 *  Tags come from any message carrying brackets — typing them is an explicit act, so it's a
 *  safe signal. The WRITE-UP is deliberately fussier: a note is what makes a row a
 *  knowledge-base entry, so lifting prose out of every chat message would fill the KB with
 *  "thanks!!" and "you're a legend". It's taken only from a composer-shaped message: the star
 *  signal up front, then an em-dash, then the prose. Everything else keeps an empty note and
 *  gets its summary written by a human during review. */
export function parseNominationExtras(plain: string): { subTopic: string; note: string } {
  const tagMatch = TAG_BRACKETS.exec(plain);
  const subTopic = tagMatch ? joinSubTopics(splitSubTopics(tagMatch[1])) : "";

  const body = stripTagBrackets(plain);
  const split = COMPOSER_HEAD.test(body) ? body.split(DETAIL_SPLIT) : [];
  const note = split.length > 1 ? split.slice(1).join(" — ").trim() : "";

  return { subTopic, note };
}

// ---------------------------------------------------------------------------
// Validation — a safety gate before auto-committing reaction-sourced rows.
// Flags "improper use" / data-quality / injection concerns so the fetcher can
// quarantine those rows for human review instead of committing them.
//
// Off-roster names are deliberately NOT flagged: monitored chats can include people
// from outside the team, so an off-roster *recipient* still earns a star (with a blank
// role — or tracked separately, if `roles.podRoles` is set), and an off-roster
// *nominator* is just someone outside the team saying thanks. The human
// posting the ⭐ is the judgment call; we only gate injection, empties, and self-
// nomination. (Trade-off: a pod member whose @mention failed to resolve to their
// canonical roster name now lands in Friends with a blank role instead of being
// flagged — visible on the board and fixable by re-running the roster.)
// ---------------------------------------------------------------------------

// Leading char that a spreadsheet (e.g. Excel) could treat as a formula.
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** Return a list of concerns about a row; empty = clean / safe to auto-commit. */
export function validateStar(e: StarEvent): string[] {
  const flags: string[] = [];

  for (const [field, value] of Object.entries(e) as [keyof StarEvent, string][]) {
    if (FORMULA_PREFIX.test(value)) flags.push(`possible formula injection in ${field}`);
  }

  const recipient = e.recipient.trim();
  const nominator = e.awarded_by.trim();
  if (!recipient) flags.push("empty recipient");
  if (recipient && nominator && recipient.toLowerCase() === nominator.toLowerCase())
    flags.push("self-nomination");

  return flags;
}

export interface FlaggedStar {
  event: StarEvent;
  flags: string[];
}

/** Split rows into clean (safe to auto-commit) and flagged (hold for review). */
export function partitionStars(events: StarEvent[]): {
  clean: StarEvent[];
  flagged: FlaggedStar[];
} {
  const clean: StarEvent[] = [];
  const flagged: FlaggedStar[] = [];
  for (const event of events) {
    const f = validateStar(event);
    if (f.length) flagged.push({ event, flags: f });
    else clean.push(event);
  }
  return { clean, flagged };
}
