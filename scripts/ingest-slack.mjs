#!/usr/bin/env node
/* Turn a Slack export into the assistant's knowledge base.
 *
 *   node scripts/ingest-slack.mjs <export-dir> [--channels a,b] [--dry-run]
 *
 * <export-dir> is an unzipped Slack export: users.json, channels.json, and one
 * directory per channel holding a YYYY-MM-DD.json file per day.
 *
 * WHAT IT KEEPS. Not every message is an answer. A thread earns a place here
 * when all of these hold:
 *
 *   - the parent message reads as a question (ends in ?, or opens with one of
 *     the question stems below);
 *   - somebody replied, in a thread, and was not the person who asked;
 *   - the best reply is long enough to be an answer rather than an ack.
 *
 * The best reply is the one with the most reactions, falling back to the
 * longest. That is a blunt heuristic and it is meant to be: this file's output
 * is meant to be read and edited before it ships, and the header it writes says
 * so.
 *
 * WHAT IT PRESERVES. The hand-written `source: "site"` entries in
 * shared/knowledge.js are not derived from Slack and are carried through
 * untouched. Only the Slack entries are replaced, so re-running this over a
 * fresh export is safe.
 *
 * Nothing here writes outside shared/knowledge.js, and --dry-run writes nothing
 * at all.
 */

import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE = resolve(HERE, "..", "shared", "knowledge.js");

const START = "/* KNOWLEDGE:START */";
const END = "/* KNOWLEDGE:END */";

// A reply shorter than this is "yes", "thanks" or "done" -- real in the channel,
// useless as an answer on a page.
const MIN_ANSWER_CHARS = 120;

const QUESTION_STEMS =
  /^(how|what|where|when|which|who|why|can|could|does|do|is|are|should|any(one|body)|need help|quick question)\b/i;

/* ---------- arguments ---------- */

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const exportDir = args.find((a) => !a.startsWith("--"));

const only = (() => {
  const raw = args.find((a) => a.startsWith("--channels="));
  return raw ? new Set(raw.slice("--channels=".length).split(",").map((s) => s.trim())) : null;
})();

if (!exportDir) {
  console.error("usage: node scripts/ingest-slack.mjs <export-dir> [--channels=a,b] [--dry-run]");
  process.exit(2);
}

if (!existsSync(exportDir)) {
  console.error(`No such export directory: ${exportDir}`);
  process.exit(2);
}

/* ---------- reading the export ---------- */

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

const maybeJson = async (path, fallback) =>
  existsSync(path) ? readJson(path) : fallback;

// Slack writes display names in three different places depending on the account
// and the export's age; take the first that is actually there.
function displayName(user) {
  const profile = user.profile || {};
  return (
    profile.real_name ||
    profile.display_name ||
    user.real_name ||
    user.name ||
    "a teammate"
  );
}

// Slack markup out, readable text in. The link forms are the ones that actually
// appear in exports: <url|label>, <url>, <@U123>, <#C123|name>.
function cleanText(text, users) {
  return String(text || "")
    .replace(/<([^|>]+)\|([^>]+)>/g, "$2 ($1)")
    .replace(/<(https?:[^>]+)>/g, "$1")
    .replace(/<@([A-Z0-9]+)>/g, (_, id) => `@${users.get(id) || "someone"}`)
    .replace(/<#[A-Z0-9]+\|([^>]+)>/g, "#$1")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

const isoDate = (ts) => new Date(Number(ts) * 1000).toISOString().slice(0, 10);

// A Slack export carries no permalinks -- they are a property of the workspace,
// not of the archive -- so they are reconstructed. The archive URL is the
// channel ID and the message timestamp with its dot removed, and it resolves in
// the Slack client for anyone who is in the channel. Without the channel ID
// (a channel absent from channels.json) there is nothing to build from, and the
// entry carries a null permalink, which the panel renders as no link rather
// than as a broken one.
function permalinkFor(workspace, channelId, ts) {
  if (!channelId || !ts) return null;
  return `https://${workspace}.slack.com/archives/${channelId}/p${ts.replace(".", "")}`;
}

const reactionCount = (message) =>
  (message.reactions || []).reduce((total, r) => total + (r.count || 0), 0);

/* ---------- shaping an entry ---------- */

// A question as typed makes a poor title: it opens with "Hey all --", carries a
// sentence of preamble, and ends in three question marks. This strips the
// opening pleasantries, keeps the sentence that is actually the question, and
// gives it back a single question mark.
//
// Applied repeatedly, because the openings stack: "Hey all -- quick question,
// client says..." is three of these in a row, and one pass leaves "all" as the
// first word of the title.
const OPENERS =
  /^(hey|hi|hello|morning|afternoon|folks|all|team|everyone|guys|so|ok|okay|sorry|quick question|question|just wondering|wondering|noob question|dumb question|please|pls)\b[\s,.!:;-]*/i;

function toTitle(text) {
  const firstLine = text.split("\n").find((line) => line.trim()) || text;
  let trimmed = firstLine.replace(/\s+/g, " ").trim();

  // Em and en dashes are how people separate the greeting from the question, so
  // they have to go with it rather than survive as a leading character.
  for (let pass = 0; pass < 6; pass += 1) {
    const next = trimmed.replace(OPENERS, "").replace(/^[\s,.!:;\u2013\u2014-]+/, "");
    if (next === trimmed || !next) break;
    trimmed = next;
  }

  // Pick the sentence that carries the substance. Taking the first one with a
  // question mark looked right and is not: "...not loading on their staging
  // domain. Any ideas?" puts the mark on the sign-off, and the title came out as
  // "Any ideas?". So the sign-offs are dropped first, and only then is the
  // question mark used to choose between what is left.
  const FILLER = /^(any ideas|anyone|any one|anybody|thanks|thank you|ta|cheers|tia|help|pls|please|halp)\b/i;

  const sentences = trimmed
    .split(/(?<=[.?!])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !(FILLER.test(part) && part.split(/\s+/).length <= 4));

  const sentence =
    sentences.find((part) => part.includes("?")) ||
    sentences.sort((a, b) => b.length - a.length)[0] ||
    trimmed;

  const capped = sentence.length > 140 ? `${sentence.slice(0, 137).trimEnd()}…` : sentence;
  const punctuated = /[?.!]$/.test(capped) ? capped.replace(/\?+$/, "?") : `${capped}?`;
  return punctuated.charAt(0).toUpperCase() + punctuated.slice(1);
}

const slug = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

function looksLikeQuestion(text) {
  const trimmed = text.trim();
  return trimmed.includes("?") || QUESTION_STEMS.test(trimmed);
}

// The products the answer is about, read off the catalogue rather than guessed,
// so a tag here means the same thing it means everywhere else on the site.
async function productNames() {
  const catalog = await readFile(resolve(HERE, "..", "shared", "catalog.js"), "utf8");
  return [...catalog.matchAll(/name:\s*"([^"]+)"/g)].map((m) => m[1]);
}

// Longest name first, so "LMT Premium" wins over "LMT Plus" sharing a prefix and
// "Bet Insights" is not swallowed by a shorter name.
function firstProductIn(text, ordered) {
  const haystack = text.toLowerCase();
  return ordered.find((name) => haystack.includes(name.toLowerCase())) || null;
}

// The question decides, and the answer is only consulted when the question named
// no product at all. Searching both at once tags a thread by whatever product
// the answer mentions in passing: "LMT Premium won't load" answered with "raise
// it through the Additional domains process" came out tagged Additional domains,
// which is the thing to do about it, not the thing it is about.
function taggedProduct(question, answer, products) {
  const ordered = [...products].sort((a, b) => b.length - a.length);
  return firstProductIn(question, ordered) || firstProductIn(answer, ordered);
}

/* ---------- the walk ---------- */

async function collect(workspace) {
  const users = new Map(
    (await maybeJson(join(exportDir, "users.json"), [])).map((u) => [u.id, displayName(u)])
  );

  const channelMeta = await maybeJson(join(exportDir, "channels.json"), []);
  const products = await productNames();

  const entries = [];
  const channels = [];

  for (const dirent of await readdir(exportDir, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue;
    const name = dirent.name;
    if (only && !only.has(name)) continue;

    const meta = channelMeta.find((c) => c.name === name);
    const channelId = meta?.id || null;
    channels.push({
      name,
      purpose: cleanText(meta?.purpose?.value || meta?.topic?.value || "", users)
    });

    const days = (await readdir(join(exportDir, name))).filter((f) => f.endsWith(".json"));
    const messages = [];
    for (const day of days) {
      const batch = await readJson(join(exportDir, name, day));
      if (Array.isArray(batch)) messages.push(...batch);
    }

    // Replies live in the same day files as their parent, keyed by thread_ts.
    const replies = new Map();
    for (const message of messages) {
      if (!message.thread_ts || message.thread_ts === message.ts) continue;
      if (!replies.has(message.thread_ts)) replies.set(message.thread_ts, []);
      replies.get(message.thread_ts).push(message);
    }

    for (const message of messages) {
      if (message.subtype || !message.text || !message.user) continue;
      if (message.thread_ts && message.thread_ts !== message.ts) continue;

      const question = cleanText(message.text, users);
      if (!looksLikeQuestion(question)) continue;

      const thread = (replies.get(message.ts) || []).filter(
        (reply) => reply.user && reply.user !== message.user && !reply.subtype
      );
      if (!thread.length) continue;

      const best = thread
        .map((reply) => ({ reply, text: cleanText(reply.text, users) }))
        .filter(({ text }) => text.length >= MIN_ANSWER_CHARS)
        .sort(
          (a, b) =>
            reactionCount(b.reply) - reactionCount(a.reply) || b.text.length - a.text.length
        )[0];

      if (!best) continue;

      const title = toTitle(question);
      entries.push({
        id: `slack-${name}-${slug(title)}-${message.ts.split(".")[0]}`,
        question: title,
        // The question as actually typed becomes an alias, so a search for the
        // reader's own words still finds the thread even though the title has
        // been tidied.
        aliases: [question.replace(/\s+/g, " ").slice(0, 200)],
        answer: best.text,
        product: taggedProduct(question, best.text, products),
        tags: [],
        source: "slack",
        channel: name,
        author: users.get(best.reply.user) || "a teammate",
        date: isoDate(message.ts),
        // The thread's parent, not the winning reply: the reader wants the
        // question and everything said under it, not one message out of context.
        permalink: message.permalink || permalinkFor(workspace, channelId, message.ts),
        asked: 1,
        replies: thread.length,
        links: [],
        related: []
      });
    }
  }

  return { entries, channels, users };
}

/* ---------- folding duplicates ---------- */

// The same question gets asked in four different weeks by four different people.
// Those are one entry with asked: 4, not four entries -- and `asked` is what the
// panel's "Most asked" list is sorted by, so folding them is what makes that
// list mean anything.
function fold(entries) {
  // Content words only. An exact key over these looked like enough and is not:
  // "LMT Premium is not loading on their staging domain" and "LMT Premium not
  // loading on a staging domain -- what's the usual cause?" are the same
  // question and share no key at all, so nothing folded and every entry sat at
  // asked: 1.
  const words = (entry) =>
    new Set(
      entry.question
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3)
    );

  // Overlap against the SHORTER of the two, not against the union: one person
  // asks in six words and the next in twenty, and a Jaccard score punishes that
  // pair for the second person's verbosity. Three words minimum, so two terse
  // questions cannot fold on a single shared noun.
  const SAME = 0.6;
  const MIN_SHARED = 3;

  function alike(a, b) {
    if (a.channel !== b.channel) return false;
    const left = words(a);
    const right = words(b);
    if (!left.size || !right.size) return false;
    let shared = 0;
    for (const word of left) if (right.has(word)) shared += 1;
    return shared >= MIN_SHARED && shared / Math.min(left.size, right.size) >= SAME;
  }

  const merged = [];

  for (const entry of entries) {
    const existing = merged.find((candidate) => alike(candidate, entry));

    if (!existing) {
      merged.push(entry);
      continue;
    }

    existing.asked += 1;
    // Keep the answer that drew the most discussion, and every phrasing as an
    // alias, so the fold loses no way of finding the thread.
    for (const alias of entry.aliases) {
      if (!existing.aliases.includes(alias)) existing.aliases.push(alias);
    }
    if (entry.replies > existing.replies) {
      existing.answer = entry.answer;
      existing.author = entry.author;
      existing.date = entry.date;
      existing.permalink = entry.permalink;
      existing.replies = entry.replies;
    }
  }

  return merged.sort((a, b) => b.asked - a.asked || b.replies - a.replies);
}

/* ---------- writing ---------- */

// Read the site entries straight out of the current file, so a hand-written
// answer survives every re-ingest. Parsed by running the existing block rather
// than by regex: it is our own file, and a parser that disagrees with the
// browser about it would be worse than no parser.
async function existingSiteEntries() {
  const current = await readFile(KNOWLEDGE, "utf8");
  const from = current.indexOf(START);
  const to = current.indexOf(END);
  if (from < 0 || to < 0) {
    throw new Error(`shared/knowledge.js is missing its ${START} / ${END} markers.`);
  }

  const block = current.slice(from + START.length, to);
  const data = new Function(`${block}; return slackKnowledge;`)();
  return {
    site: (data.entries || []).filter((entry) => entry.source !== "slack"),
    workspace: data.workspace || "sportradar"
  };
}

function serialise(value, indent = "  ") {
  return JSON.stringify(value, null, 2)
    .split("\n")
    .map((line, i) => (i === 0 ? line : indent + line))
    .join("\n");
}

async function main() {
  const { site, workspace } = await existingSiteEntries();
  const { entries, channels } = await collect(workspace);
  const slack = fold(entries);

  console.log(`Channels read:     ${channels.length}`);
  console.log(`Threads kept:      ${entries.length}`);
  console.log(`After folding:     ${slack.length}`);
  console.log(`Site entries kept: ${site.length}`);

  if (flags.has("--dry-run")) {
    console.log("\n--dry-run: nothing written. Top five by ask count:\n");
    for (const entry of slack.slice(0, 5)) {
      console.log(`  ${String(entry.asked).padStart(3)}×  #${entry.channel}  ${entry.question}`);
    }
    return;
  }

  // The channel list is the union of what the export had and what was already
  // configured: a channel nobody asked a question in this quarter is still a
  // channel the assistant should offer as a place to ask.
  const known = new Map(channels.map((c) => [c.name, c]));
  const { channels: configured = [] } = new Function(
    `${(await readFile(KNOWLEDGE, "utf8")).split(START)[1].split(END)[0]}; return slackKnowledge;`
  )();
  for (const channel of configured) {
    if (!known.has(channel.name)) known.set(channel.name, channel);
    else if (!known.get(channel.name).purpose) known.get(channel.name).purpose = channel.purpose;
  }

  const data = {
    generatedAt: new Date().toISOString().slice(0, 10),
    source: "slack-export",
    workspace,
    channels: [...known.values()],
    entries: [...slack, ...site]
  };

  const current = await readFile(KNOWLEDGE, "utf8");
  const head = current.slice(0, current.indexOf(START) + START.length);
  const tail = current.slice(current.indexOf(END));

  const body = `\nconst slackKnowledge = ${serialise(data, "")};\n`;
  await writeFile(KNOWLEDGE, `${head}${body}${tail}`, "utf8");

  console.log(`\nWrote ${data.entries.length} entries to shared/knowledge.js.`);
  console.log("Read it before shipping: the pick of best-reply is a heuristic,");
  console.log("and an answer that was right in the thread can still be wrong on a page.");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
