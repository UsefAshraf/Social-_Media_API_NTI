import type { Mention } from '@/lib/posts';

// Mirrors the backend (src/shared/utils/text.js) so what's tappable here is what the
// server indexed: #tag = letters/digits/_ in any script (1–50), lowercased;
// @username = 3–30 ASCII word chars. Both need a non-word char (or start) before them.
const HASHTAG = /(^|[^\p{L}\p{N}_])#([\p{L}\p{N}_]{1,50})/gu;
const MENTION = /(^|[^\w@])@(\w{3,30})\b/g;

export type RichSegment =
  | { kind: 'text'; text: string }
  | { kind: 'hashtag'; text: string; tag: string }
  | { kind: 'mention'; text: string; username: string; userId: string | null };

interface Token {
  start: number;
  end: number;
  segment: RichSegment;
}

function collect(re: RegExp, text: string, make: (raw: string, name: string) => RichSegment): Token[] {
  const out: Token[] = [];
  for (const m of text.matchAll(re)) {
    const start = (m.index ?? 0) + m[1].length;
    const raw = m[0].slice(m[1].length);
    out.push({ start, end: start + raw.length, segment: make(raw, m[2]) });
  }
  return out;
}

/** Splits post/comment text into plain, #hashtag and @mention segments. */
export function parseRichText(text: string, mentions: readonly Mention[] = []): RichSegment[] {
  if (!text) return [];
  const byName = new Map<string, string>();
  const byLower = new Map<string, string>();
  for (const m of mentions) {
    byName.set(m.username, m.id);
    if (!byLower.has(m.username.toLowerCase())) byLower.set(m.username.toLowerCase(), m.id);
  }

  const tokens = [
    ...collect(HASHTAG, text, (raw, name) => ({ kind: 'hashtag', text: raw, tag: name.toLowerCase() })),
    ...collect(MENTION, text, (raw, name) => ({
      kind: 'mention',
      text: raw,
      username: name,
      userId: byName.get(name) ?? byLower.get(name.toLowerCase()) ?? null,
    })),
  ].sort((a, b) => a.start - b.start);

  const segments: RichSegment[] = [];
  let pos = 0;
  for (const t of tokens) {
    if (t.start < pos) continue; // overlapping match — keep the first
    if (t.start > pos) segments.push({ kind: 'text', text: text.slice(pos, t.start) });
    segments.push(t.segment);
    pos = t.end;
  }
  if (pos < text.length) segments.push({ kind: 'text', text: text.slice(pos) });
  return segments;
}
