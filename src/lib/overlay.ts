// Local "draft" overlay for Preview-changes mode: staged NEW star rows kept in the
// browser's localStorage, merged on top of the published CSV only while previewing.
// Pure module (no React) so it's unit-testable. Nothing here is authoritative — a draft
// is just a proposal a human admin reviews and commits.
//
// Explicit .ts extensions so Node's test runner (type-stripping) resolves these at
// runtime; tsc/vite accept them via allowImportingTsExtensions.
import { CATEGORIES, ROLES, SOURCES, CSV_COLUMNS, toCsvRow } from "./aggregate.ts";
import TEAM from "../config/team.config.ts";
import type { StarEvent } from "./aggregate.ts";

export const DRAFT_KEY = "gold-stars-draft";
export const PREVIEW_KEY = "gold-stars-preview";
export const OVERLAY_VERSION = 1;

// Where nominations / staged changes are emailed for an admin to review + commit.
export const ADMIN_EMAIL = TEAM.contact.adminEmail;

/** A staged row: a CSV row plus a client-side id (not stored in the CSV). */
export type DraftRow = StarEvent & { id: string };

export type ValidateResult = { ok: true; row: DraftRow } | { ok: false; reason: string };

const EMPTY = () => ({ version: OVERLAY_VERSION, rows: [] as DraftRow[] });

/** Client-side id for a staged row (React key + edit/remove target). */
export function newId(): string {
  return `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// A field is unsafe if it starts with a char a spreadsheet may treat as a formula —
// staged rows get pasted into a CSV an admin may open in Excel/Sheets. Same guard as
// validateStar() in teams.ts.
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** Validate + normalize one staged row. Reuses parseCsv's rules (non-empty recipient,
 *  YYYY-MM-DD date) and adds category/role/source sanity + a formula-injection guard.
 *  Returns { ok:true, row } (trimmed, with an id) or { ok:false, reason }. */
export function validateDraftRow(row: unknown): ValidateResult {
  if (!row || typeof row !== "object") return { ok: false, reason: "Not a valid entry." };

  const r = row as Record<string, unknown>;
  const get = (k: string) => (typeof r[k] === "string" ? (r[k] as string).trim() : "");
  const norm: DraftRow = {
    id: typeof r.id === "string" && r.id ? r.id : newId(),
    date: get("date"),
    recipient: get("recipient"),
    role: get("role"),
    category: get("category"),
    note: get("note"),
    source: get("source") || "Email",
    awarded_by: get("awarded_by"),
    sub_topic: get("sub_topic"),
  };

  if (!norm.recipient) return { ok: false, reason: "Recipient is required." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(norm.date))
    return { ok: false, reason: "Date must be YYYY-MM-DD." };
  if (!CATEGORIES.includes(norm.category))
    return { ok: false, reason: `Category must be one of: ${CATEGORIES.join(", ")}.` };
  if (norm.role && !ROLES.includes(norm.role))
    return { ok: false, reason: `${TEAM.roles.label} must be one of: ${ROLES.join(", ")}.` };
  if (!SOURCES.includes(norm.source))
    return { ok: false, reason: `Source must be one of: ${SOURCES.join(", ")}.` };

  for (const f of CSV_COLUMNS) {
    if (FORMULA_PREFIX.test(norm[f])) {
      return {
        ok: false,
        reason:
          "A field can't start with = + - @ (spreadsheet-formula safety) — please rephrase.",
      };
    }
  }
  return { ok: true, row: norm };
}

/** Read the draft from localStorage. Defensive: bad JSON / wrong shape / version mismatch
 *  → empty; invalid individual entries are dropped so one bad row can't poison the draft.
 *  Never throws. */
export function loadOverlay(): { version: number; rows: DraftRow[] } {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return EMPTY();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.rows)) return EMPTY();
    if (parsed.version !== OVERLAY_VERSION) return EMPTY(); // future: migration branch
    const rows: DraftRow[] = [];
    for (const r of parsed.rows) {
      const res = validateDraftRow(r);
      if (res.ok) rows.push(res.row);
    }
    return { version: OVERLAY_VERSION, rows };
  } catch {
    return EMPTY();
  }
}

/** Persist the draft rows. Swallows quota/permission errors (private mode, etc.). */
export function saveOverlay(rows: DraftRow[]): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ version: OVERLAY_VERSION, rows }));
  } catch {
    /* ignore */
  }
}

export function loadPreviewMode(): boolean {
  try {
    return localStorage.getItem(PREVIEW_KEY) === "1";
  } catch {
    return false;
  }
}

export function savePreviewMode(on: boolean): void {
  try {
    localStorage.setItem(PREVIEW_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/** Body for the "Submit changes" email: one CSV row per staged star + admin instructions. */
export function buildBatchBody(rows: DraftRow[]): string {
  const lines = rows.map((r) => toCsvRow(r)).join("\n");
  return (
    `Please append the following row(s) to public/gold-stars.csv and commit:\n\n` +
    `${lines}\n\n` +
    `Column order: ${CSV_COLUMNS.join(",")}\n\n` +
    `(Generated from the ${TEAM.branding.appName} "Preview changes" mode. Once committed, the ` +
    `submitter should Clear their local draft so it isn't counted twice.)`
  );
}
