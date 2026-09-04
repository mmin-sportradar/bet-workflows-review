#!/usr/bin/env node
/* Compile the resolved troubleshooting threads into the assistant's answers.
 *
 *   node scripts/ingest-guides.mjs --dry-run
 *   node scripts/ingest-guides.mjs
 *   node scripts/ingest-guides.mjs --topic=widgets --dry-run
 *
 * Source: "slack data for technical troubleshooting/*.md" -- 201 threads across
 * ten topics, each one a real question somebody asked and the answer that
 * settled it. That is the most useful material this assistant has ever had, and
 * it is also internal Slack, so what gets compiled matters more than usual.
 *
 * TWO FIELDS, AND NEVER THE TRANSCRIPT
 *
 * Each thread has a "Question / issue", a "Troubleshooting conversation" and a
 * "Confirmed outcome". Only the first and last are read. The conversation is
 * skipped entirely, and that is the safety property rather than a stylistic
 * choice: 100 of the 201 transcripts greet a colleague by name ("Hi Eva",
 * "Thank you Urska") and NONE of the outcomes do -- measured, not assumed. So
 * skipping the transcript excludes the chatter where people are named, by
 * construction rather than by filtering.
 *
 * shared/knowledge.js is published to a public repository. The raw guides are
 * not: publish-review-site.yml strips the folder and fails the build if it
 * reappears. This script is the only path from one to the other, which is why
 * it reports what it would publish and refuses to guess on anything doubtful.
 */

import { readFile, writeFile, readdir } from "node:fs/promises";
import { resolve, dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const GUIDES = join(ROOT, "slack data for technical troubleshooting");
const KNOWLEDGE = join(ROOT, "shared", "knowledge.js");

const START = "/* KNOWLEDGE:START */";
const END = "/* KNOWLEDGE:END */";

const args = process.argv.slice(2);
const flag = (name) => args.find((one) => one === `--${name}` || one.startsWith(`--${name}=`));
const value = (name) => {
  const found = flag(name);
  return found && found.includes("=") ? found.slice(found.indexOf("=") + 1) : null;
};
const DRY_RUN = Boolean(flag("dry-run"));
const TOPIC = value("topic");

// Anything that reads like a greeting means the transcript has leaked into a
// field it should not have. It has never happened, and if the source format
// changes it must fail loudly rather than publish quietly.
const GREETING = /\b(?:Hi|Hello|Hey|Dear|Thanks|Thank you|cc)\s+[A-Z][a-z]{2,}\b/;

/* ---------- which threads may be published ---------- */

// shared/knowledge.js is published to a public repository, and 83 of the 201
// threads name a customer -- 29 operator names found by eye, 24 client ids, 18
// domains. A deny-list of names is the obvious approach and it is the wrong one:
// I cannot prove such a list is complete, and one missing name puts a customer's
// incident on a public website.
//
// So the filter is an ALLOWLIST, used to EXCLUDE rather than to redact. A thread
// is publishable only when every capitalised word in it is recognised, it
// carries no long number, and it carries no domain. An operator nobody has
// heard of therefore excludes its thread automatically, which is the failure
// direction that costs an answer rather than a customer.
//
// Nothing is rewritten: a thread is published whole or held back whole. Redacted
// prose reads badly and hides what was removed, and holding a thread is honest
// about the gap.

// Any long number holds the thread. A narrower rule -- hold only numbers next to
// BMID, BID, client or order -- was tried and rejected after looking at what it
// would have let through: "carouselcasinobe 49453" is a customer alias with an
// id and matches no such keyword. Match ids are innocent and are lost with the
// rest, which is the right way round.
const HAS_NUMBER = /\b\d{4,}\b/;
const HAS_DOMAIN = /\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|dev|app|it|bg|eu|uy|ro|pl|de|fr|es|pt|gr|tr|uk|co)\b/i;

// Words that are safe because they are the domain we already publish: the
// catalogue's own vocabulary, competitions and sports, languages and places,
// internal systems, and ordinary sentence-starting English. Anything outside it
// is treated as a name.
const SAFE_WORDS = new Set(
  ("a an and or of for to in on at is are was were be been being by with from as not no if it its this that " +
   "the there then than so such but do does did done can could should would will may might must have has had " +
   "we you they he she who what when where which why how all any both each few more most other some only own " +
   "same too very just now new old first second third next last after before during while until since about " +
   "above below over under again further once here also however therefore because although though despite " +
   "asked ask asks request requested requests confirm confirmed confirms clarify clarified check checked " +
   "create created add added remove removed update updated fix fixed resolve resolved escalate escalated " +
   "route routed provision provisioned activate activated deactivate enable enabled disable disabled " +
   "raise raised close closed open opened reopen send sent share shared advise advised " +
   "issue issues error errors problem problems question questions answer answers outcome " +
   "team teams support level customer care sales internal external colleague colleagues " +
   "client clients account accounts order orders contract contracts trial trials invoice invoicing " +
   "ticket tickets jira freshdesk confluence slack salesforce store portal admin tool automation " +
   "sportradar betradar beti bet cs csc cscs tsr csp sla sir mts imga vpn crm sfivoice storeadmin " +
   "api apis url urls id ids bmid bmdi bid uuid key keys rsa token endpoint " +
   "widget widgets ui embed embedding iframe frame ancestors domain domains whitelist whitelisting " +
   "lmt hsa isa statshub stats statistics scoreboard tracker ticker scores games table " +
   "lco lcp vlmt h2h sourcejoin coverage feed feeds event events match matches " +
   "setup integration integrations migration deployment production staging stage test " +
   "licence licence licences license licenses licensing licensed " +
   "premium plus compact virtualised virtual stadium concierge assist insights recommendations " +
   "preview tournament packages utility mapping probabilities builder carousel theming " +
   "prop player zone custom head basketball tennis soccer football volleyball hockey baseball " +
   "golf mma esoccer esports combat badminton cricket rugby darts snooker " +
   "atp wta nba nfl mlb nhl uefa fifa bundesliga liga serie ligue eredivisie premier champions " +
   "europa cup world league season fixture " +
   "english german french spanish italian portuguese polish romanian bulgarian greek turkish " +
   "dutch swedish norwegian danish finnish czech hungarian croatian serbian " +
   "europe european america american africa asia asian belgian france germany spain italy " +
   "monday tuesday wednesday thursday friday saturday sunday " +
   "january february march april may june july august september october november december " +
   "chrome chromium firefox safari edge browser mobile desktop ios android akamai isp dns cdn " +
   "capacitor origin cors http https json xml csv pdf " +
   "date dates time times day days week weeks month months year years " +
   "yes no none multiple single bulk per via still already pending " +
   "root cause fix workaround guidance approach note noted expired expiry end start " +
   "default order format language translation localization rendering character characters " +
   "access login password user users role roles permission permissions " +
   "service services technical activation alias aliases brand brands " +
   "urgent normal high low priority status " +
   "what from check both two three four five " +
   // Added after seeing which words were holding threads back. Every one of
   // these is a product surface, a protocol, a generic noun or an internal
   // abbreviation -- none of them names a customer.
   //
   // Words I deliberately did NOT add, because I could not tell whether they
   // name a client: Amplify, Gam, LS, MR, Marketplace, Niko. Their threads stay
   // held, which is the right way round for a doubt.
   "s5 s5-to-statshub live ip css centre score light us temporary productive data dev localhost " +
   "mitm leagues fr jwt rs256 rs512 rs512-signed av dual-platform national lottery uof ok mcp " +
   "bet-owned kanji tld escalation casino rest srl reproducible icons covered limited virtualized " +
   "something discussion developer hsa-specific additional betting").split(" ")
);

// Every word that could be a name must be recognised, or the thread is held.
//
// "Could be a name" is deliberately wider than "starts with a capital", which is
// what this checked first and which let three customers through: 36Vegas starts
// with a digit, matchpoint2 is all lowercase, and Cogelo_MTS hid behind an
// underscore that the word boundary treated as part of the word. Operators name
// themselves however they like, so the shape of a name cannot be assumed.
//
// Three catches now, and a token needs only one of them to be checked:
//   - it starts with a capital
//   - it mixes letters and digits, which no ordinary word does
//   - it contains an underscore
const NAME_SHAPED = /\b(?=[A-Za-z0-9_]*[A-Za-z])[A-Za-z0-9_&.'-]{2,}\b/g;

function unknownNames(text) {
  const found = new Set();
  for (const word of text.match(NAME_SHAPED) || []) {
    const bare = word.replace(/^[.'-]+|[.'-]+$/g, "");
    if (!bare) continue;

    const startsCapital = /^[A-Z]/.test(bare);
    const mixesDigits = /[A-Za-z]/.test(bare) && /\d/.test(bare);
    const hasUnderscore = bare.includes("_");
    if (!startsCapital && !mixesDigits && !hasUnderscore) continue;

    const lower = bare.toLowerCase();
    if (SAFE_WORDS.has(lower)) continue;
    // A compound is safe only if every part of it is.
    if (lower.split(/[._'-]/).every((part) => !part || SAFE_WORDS.has(part))) continue;
    found.add(bare);
  }
  return [...found];
}

function publishable(thread) {
  const text = `${thread.title} ${thread.issue} ${thread.outcome}`;
  if (HAS_NUMBER.test(text)) return { ok: false, why: "carries a client or order number" };
  if (HAS_DOMAIN.test(text)) return { ok: false, why: "carries a domain" };
  const names = unknownNames(text);
  if (names.length) return { ok: false, why: `unrecognised name: ${names.slice(0, 3).join(", ")}` };
  return { ok: true };
}

/* ---------- reading the guides ---------- */

// The topic's own title, from the file's H1, so the tag a reader sees is the one
// the guide uses rather than a slug.
function topicOf(body, file) {
  const h1 = /^#\s+(.+)$/m.exec(body);
  return h1 ? h1[1].trim() : basename(file, ".md");
}

const section = (block, name) => {
  const re = new RegExp(`### ${name}\\n+([\\s\\S]*?)(?=\\n### |\\n---|\\n## |$)`);
  const hit = re.exec(block);
  return hit ? hit[1].trim() : "";
};

// Markdown to the assistant's own markdown-lite subset: bold and code survive,
// everything else becomes plain text. Redacted URLs are dropped rather than
// shown as "<[REDACTED_URL]>", which tells a reader nothing.
function clean(text) {
  return text
    .replace(/<\[REDACTED_URL\]>/g, "")
    .replace(/\[REDACTED_URL\]/g, "")
    .replace(/`([^`]+)`/g, "`$1`")
    .replace(/:[a-z_+-]+:/g, "")          // slack emoji shortcodes
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/ +\n/g, "\n")
    .trim();
}

async function readThreads() {
  const files = (await readdir(GUIDES))
    .filter((name) => name.endsWith(".md") && name !== "guide.md")
    .filter((name) => !TOPIC || name.includes(TOPIC))
    .sort();

  const threads = [];

  for (const name of files) {
    const body = await readFile(join(GUIDES, name), "utf8");
    const topic = topicOf(body, name);

    // Split on the thread heading. The first chunk is the file's preamble.
    const blocks = body.split(/\n## Thread: /).slice(1);

    for (const block of blocks) {
      const title = block.split("\n")[0].trim();
      const date = (/\*\*Date:\*\*\s*(\d{4}-\d{2}-\d{2})/.exec(block) || [])[1] || "";
      const ref = (/\*\*Source:\*\*\s*`([^`]+)`\s*\/\s*`?([^`\s]+)`?/.exec(block) || []).slice(1, 3);

      const issue = clean(section(block, "Question / issue"));
      const outcome = clean(section(block, "Confirmed outcome"));

      // Both halves are needed: the issue is what a reader's question looks
      // like, the outcome is the answer. One without the other is not an entry.
      if (!title || !issue || !outcome) continue;

      threads.push({ topic, file: name, title, date, ref, issue, outcome });
    }
  }

  return threads;
}

/* ---------- which products a thread is about ---------- */

// Read off the catalogue so a tag here means what it means everywhere else, and
// so the assistant's entity veto can tell a StatsHub answer from an LMT one.
async function productNames() {
  const source = await readFile(join(ROOT, "shared", "catalog.js"), "utf8");
  const entities = new Function(`${source}; return catalogEntities();`)();
  return entities
    .filter((entity) => entity.kind === "product" || entity.kind === "variant")
    .map((entity) => entity.label)
    // Longest first, so "LMT Premium" wins over "LMT Plus" sharing a prefix.
    .sort((a, b) => b.length - a.length);
}

// Word-boundary matching, and the catalogue's own spelling wins. "Statshub" in a
// thread is StatsHub in the catalogue, and a reader searching either should
// reach it.
function productsIn(text, names) {
  const haystack = text.toLowerCase();
  const found = [];
  for (const name of names) {
    const needle = name.toLowerCase();
    if (!haystack.includes(needle)) continue;
    // Do not add a product whose name is inside one already matched.
    if (found.some((one) => one.toLowerCase().includes(needle))) continue;
    found.push(name);
  }
  return found;
}

/* ---------- composing an entry ---------- */

const slug = (text) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

function toEntry(thread, names, seen) {
  const products = productsIn(`${thread.title} ${thread.issue}`, names);

  let id = `thread-${slug(thread.title)}`;
  // Two threads can share a title across topics; keep both rather than letting
  // the second overwrite the first.
  if (seen.has(id)) {
    let n = 2;
    while (seen.has(`${id}-${n}`)) n += 1;
    id = `${id}-${n}`;
  }
  seen.add(id);

  // The date and the "check it still holds" caveat are NOT written here. The
  // assistant renders them from `topic` and `date` as the entry's provenance
  // line, and having them in the prose too said the same thing twice in two
  // wordings, one right under the other.
  const answer = [thread.outcome, `**What was asked:** ${thread.issue}`].join("\n\n");

  return {
    id,
    question: thread.title,
    // No aliases. The intent was to let a reader phrase the question their own
    // way, and the implementation put a whole SENTENCE of prose into a field the
    // scorer weighs word by word -- so every incidental word in every thread
    // ("client", "domain", "request", "load") became scored surface, 65 times
    // over. That is how a thread about BET API whitelisting came to answer "what
    // is the difference between virtual stadium and bet concierge". The title is
    // the query surface; paraphrase is what the scorer is for.
    aliases: [],
    // Kept, and deliberately not scored: it is prose about the thread, not a
    // thing anybody types.
    summary: thread.issue.split(/(?<=[.?!])\s/)[0].slice(0, 200),
    answer,
    product: products[0] || null,
    entities: products,
    tags: [slug(thread.topic)],
    source: "thread",
    topic: thread.topic,
    date: thread.date,
    asked: 0,
    links: [],
    related: [],
  };
}

/* ---------- knowledge.js ---------- */

async function existing() {
  const current = await readFile(KNOWLEDGE, "utf8");
  const from = current.indexOf(START);
  const to = current.indexOf(END);
  if (from < 0 || to < 0) throw new Error(`shared/knowledge.js is missing its markers.`);
  const data = new Function(`${current.slice(from + START.length, to)}; return slackKnowledge;`)();
  return {
    data,
    // Everything not from this script survives, the way ingest-slack.mjs
    // preserves the hand-written entries.
    keep: (data.entries || []).filter((entry) => entry.source !== "thread"),
  };
}

async function write(data) {
  const current = await readFile(KNOWLEDGE, "utf8");
  const head = current.slice(0, current.indexOf(START) + START.length);
  const tail = current.slice(current.indexOf(END));
  await writeFile(KNOWLEDGE, `${head}\nconst slackKnowledge = ${JSON.stringify(data, null, 2)};\n${tail}`, "utf8");
}

/* ---------- main ---------- */

async function main() {
  const all = await readThreads();
  const names = await productNames();

  const held = [];
  const threads = all.filter((thread) => {
    const verdict = publishable(thread);
    if (!verdict.ok) held.push({ thread, why: verdict.why });
    return verdict.ok;
  });

  const seen = new Set();
  const entries = threads.map((thread) => toEntry(thread, names, seen));

  // The check that matters. If a greeting appears in a compiled answer then the
  // transcript has bled into a field it should not have, and the source format
  // has changed under us.
  const leaked = entries.filter((entry) => GREETING.test(entry.answer) || GREETING.test(entry.question));
  if (leaked.length) {
    console.error(`\nRefusing to write: ${leaked.length} compiled answer(s) read like a transcript.`);
    leaked.slice(0, 3).forEach((entry) => console.error(`  ${entry.id}: ${entry.answer.slice(0, 90)}`));
    console.error(`\n  Only "Question / issue" and "Confirmed outcome" should be read. Check the`);
    console.error(`  source format has not changed.`);
    process.exit(1);
  }

  const byTopic = {};
  entries.forEach((entry) => { byTopic[entry.topic] = (byTopic[entry.topic] || 0) + 1; });

  console.log(`Threads read      : ${all.length}`);
  console.log(`Publishable       : ${entries.length}`);
  console.log(`Held back         : ${held.length}\n`);
  Object.entries(byTopic)
    .sort((a, b) => b[1] - a[1])
    .forEach(([topic, n]) => console.log(`  ${String(n).padStart(3)}  ${topic}`));

  const withProduct = entries.filter((entry) => entry.entities.length).length;
  console.log(`\nLinked to a catalogue product: ${withProduct} of ${entries.length}`);
  console.log(`No greeting in any compiled answer: yes (${entries.length} checked)`);

  // Every held thread, named, so the gap is visible rather than silent.
  const reasons = {};
  held.forEach(({ why }) => {
    const kind = why.startsWith("unrecognised") ? "unrecognised name" : why;
    reasons[kind] = (reasons[kind] || 0) + 1;
  });
  console.log(`\nHeld back, by reason:`);
  Object.entries(reasons).sort((a, b) => b[1] - a[1]).forEach(([why, n]) =>
    console.log(`  ${String(n).padStart(3)}  ${why}`));

  if (flag("held")) {
    console.log(`\nEvery held thread:\n`);
    held.forEach(({ thread, why }) =>
      console.log(`  ${thread.title.slice(0, 62).padEnd(64)} ${why}`));
  } else {
    console.log(`\n  Pass --held to list them all.`);
  }

  if (DRY_RUN) {
    console.log("\n--dry-run: nothing written.");
    return;
  }

  const { data, keep } = await existing();
  // Only move the compile date when the content actually moved. Re-stamping it
  // every run made knowledge.js differ day to day with no content change, which
  // showed up as a spurious failure in the "run it twice and diff" check.
  const combined = [...keep, ...entries];
  const unchanged = JSON.stringify(data.entries || []) === JSON.stringify(combined);
  const threadsCompiledAt = unchanged
    ? data.threadsCompiledAt || new Date().toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  await write({ ...data, threadsCompiledAt, entries: combined });
  console.log(`\nWrote ${entries.length} thread answers to shared/knowledge.js.`);
  console.log(`Kept ${keep.length} existing entries untouched.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
