#!/usr/bin/env node
/* One page holding everything this site knows, for a crawler to read.
 *
 *   node scripts/build-digest.mjs [outdir] [--base https://host/path/]
 *
 * WHY THIS EXISTS. The internal AI documentation tool indexes internal sources.
 * Getting our data into it could be done by pushing through its API, and that is
 * the wrong way round for two reasons: the token's capabilities are Search
 * (read), Chat and LLM Gateway, with no document- or index-write among them; and
 * a push needs a credential, a schedule, and a way to notice when it has
 * silently stopped. A page their crawler already knows how to read needs none of
 * those. It is generated from the repository on every publish, so it cannot go
 * stale.
 *
 * WHAT IS IN IT. Only what is already published on this site:
 *
 *   - every product and sport variant from the catalogue, with its family,
 *     description, routes, documentation and Confluence links
 *   - every step of every flow diagram: number, title, owning team, summary
 *   - the hand-written FAQ answers
 *
 * Nothing here is new information and nothing is confidential -- it is the same
 * content the site serves, flattened into one document instead of 33. That
 * matters: this file is published to a PUBLIC GitHub Pages site, so anything it
 * contained that the site does not already show would be a leak.
 *
 * Two outputs, because indexers differ: digest.html for crawlers that want
 * markup, and digest.txt for those that would rather have plain text.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

// The public mirror, which is where a crawler would reach this. Overridable,
// because the same digest is generated for whatever host serves it.
const DEFAULT_BASE = "https://mmin-sportradar.github.io/bet-workflows-review/";

/* ---------- the catalogue ---------- */

// catalog.js is a classic script, so evaluating it whole hands back `families`
// and every helper. This is how the test suite already reads it, and it means
// the traversal rules -- a variant inherits its product's description, docs and
// Confluence each have three possible shapes -- are not reimplemented here.
function readCatalogue() {
  const source = readFileSync(join(ROOT, "shared", "catalog.js"), "utf8");
  return new Function(`${source}; return catalogEntities();`)();
}

function readFaq() {
  const source = readFileSync(join(ROOT, "shared", "knowledge.js"), "utf8");
  const block = source.split("/* KNOWLEDGE:START */")[1].split("/* KNOWLEDGE:END */")[0];
  const data = new Function(`${block}; return slackKnowledge;`)();
  // Hand-written entries only. A Slack-derived entry quotes somebody's message,
  // and a documentation-derived one is a pointer to a page behind sign-in;
  // neither belongs in a public document.
  return (data.entries || []).filter((entry) => entry.source === "site");
}

/* ---------- the flow diagrams ---------- */

// The same extraction the assistant does in the browser, against raw HTML
// instead of a DOM. Keyed on the invariant -- a clickable element carrying both
// data-dialog and data-owner -- rather than on the five different card class
// names the site uses, for the same reason: the class names vary per flow and a
// list of them is a list somebody has to maintain.
//
// Attribute-driven and whitespace-insensitive on purpose. One page
// (sr-packages-e-sports-integration-flow) is minified onto 12 lines, and
// anything line-oriented mangles it.
const CARD = /<(button|a|div|aside)\b[^>]*?\bdata-dialog="[^"]*"[^>]*?>([\s\S]*?)<\/\1>/gi;

const stripTags = (html) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

function pickClass(html, names) {
  for (const name of names) {
    const re = new RegExp(`<[^>]*\\bclass="[^"]*\\b${name}\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/`, "i");
    const hit = re.exec(html);
    if (hit) {
      const text = stripTags(hit[1]);
      if (text) return text;
    }
  }
  return "";
}

function extractSteps(html) {
  const steps = [];
  let match;
  CARD.lastIndex = 0;

  while ((match = CARD.exec(html)) !== null) {
    const open = match[0].slice(0, match[0].indexOf(">") + 1);
    const owner = /\bdata-owner="([^"]*)"/i.exec(open);
    if (!owner) continue; // a dialog trigger that is not a step

    const inner = match[2];

    // The title is the first bare <strong>; it carries no class on any page.
    const strong = /<strong\b[^>]*>([\s\S]*?)<\/strong>/i.exec(inner);
    const title = strong ? stripTags(strong[1]) : "";

    // .summary on most pages; a classless <span> long enough to be prose on the
    // task-card flows.
    let summary = pickClass(inner, ["summary"]);
    if (!summary) {
      const spans = [...inner.matchAll(/<span(?![^>]*\bclass=)[^>]*>([\s\S]*?)<\/span>/gi)]
        .map((one) => stripTags(one[1]))
        .filter((text) => text.length > 24);
      summary = spans[0] || "";
    }

    const number = pickClass(inner, ["stage-number", "task-number"]);

    steps.push({
      order: parseInt(number, 10) || steps.length + 1,
      title,
      owner: pickClass(inner, ["owner"]),
      summary,
    });
  }

  const usable = steps.filter((step) => step.title && step.owner);

  // Decline wholesale rather than publish a partial list, on the same thresholds
  // the assistant uses. widgets-licensing-setup-flow is a sports catalogue
  // rather than a flow, and without this its cards appear as steps called
  // "Soccer (23)".
  if (usable.length < 2) return null;
  if (usable.length / Math.max(1, steps.length) < 0.6) return null;
  if (usable.filter((step) => step.summary).length / usable.length < 0.6) return null;

  // Stable: the four parallel steps sharing a number on statshub-setup-flow keep
  // their document order.
  return usable
    .map((step, i) => ({ step, i }))
    .sort((a, b) => a.step.order - b.step.order || a.i - b.i)
    .map(({ step }) => step);
}

function readFlows() {
  const dir = join(ROOT, "workflows");
  const flows = [];

  for (const slug of readdirSync(dir).sort()) {
    const page = join(dir, slug, "index.html");
    if (!existsSync(page)) continue;
    const html = readFileSync(page, "utf8");
    const heading = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
    flows.push({
      slug,
      title: heading ? stripTags(heading[1]) : slug,
      steps: extractSteps(html),
    });
  }

  return flows;
}

/* ---------- rendering ---------- */

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch])
  );

// Root-relative in the catalogue, absolute here: a crawler has no page to
// resolve against.
const absolute = (base, href) => (/^https?:\/\//.test(href) ? href : base + href.replace(/^\//, ""));

function buildText(data, base) {
  const out = [];
  const line = (text = "") => out.push(text);

  line("BET PRODUCT SETUP AND INTEGRATION WORKFLOWS");
  line("=".repeat(44));
  line();
  line(`Source: ${base}`);
  line(`Generated: ${data.generatedAt}`);
  line();
  line(
    "A flattened index of every BET product, every step of every setup and " +
      "integration flow, and the answers to the questions the team is asked most. " +
      "Generated from the site itself, so it cannot disagree with it."
  );
  line();

  line("PRODUCTS");
  line("-".repeat(44));
  data.families.forEach((family) => {
    line();
    line(`## ${family.name}`);
    family.entities.forEach((entity) => {
      line();
      line(`### ${entity.label}`);
      if (entity.description) line(entity.description);
      line(`Family: ${family.name}`);
      if (entity.paths.length) {
        entity.paths.forEach((path) => line(`${path.label}: ${absolute(base, path.href)}`));
      } else {
        line("No flow on this site.");
      }
      if (entity.docs) line(`${entity.docs.title}: ${entity.docs.href}`);
      (entity.confluence || []).forEach((page) => line(`${page.title}: ${page.href}`));
      if (entity.sharedFlowWith.length) {
        line(`Shares its flow with: ${entity.sharedFlowWith.join(", ")}`);
      }
      if (entity.variants.length) line(`One flow per sport: ${entity.variants.join(", ")}`);
    });
  });

  line();
  line("FLOWS, STEP BY STEP");
  line("-".repeat(44));
  data.flows.forEach((flow) => {
    if (!flow.steps) return;
    line();
    line(`## ${flow.title}`);
    line(absolute(base, `workflows/${flow.slug}/`));
    flow.steps.forEach((step) => {
      line(`${step.order}. ${step.title} — owned by ${step.owner}`);
      if (step.summary) line(`   ${step.summary}`);
    });
  });

  line();
  line("FREQUENTLY ASKED");
  line("-".repeat(44));
  data.faq.forEach((entry) => {
    line();
    line(`## ${entry.question}`);
    // The answer is markdown-lite; the emphasis markers mean nothing in plain
    // text and only get in a reader's way.
    line(entry.answer.replace(/\*\*/g, "").replace(/^- /gm, "  - "));
  });

  line();
  return out.join("\n");
}

function buildHtml(data, base) {
  const parts = [];
  const p = (text) => parts.push(text);

  p("<!doctype html>");
  p('<html lang="en"><head><meta charset="utf-8">');
  p("<title>BET Workflows — full index</title>");
  p('<meta name="description" content="Every BET product, every flow step, and the most-asked questions, in one page.">');
  p("</head><body>");
  p("<h1>BET product setup and integration workflows</h1>");
  p(
    `<p>A flattened index of every BET product, every step of every setup and ` +
      `integration flow, and the answers to the questions the team is asked most. ` +
      `Generated from <a href="${escapeHtml(base)}">the site</a> itself on ` +
      `${escapeHtml(data.generatedAt)}, so it cannot disagree with it.</p>`
  );

  p("<h2>Products</h2>");
  data.families.forEach((family) => {
    p(`<h3>${escapeHtml(family.name)}</h3>`);
    family.entities.forEach((entity) => {
      p("<article>");
      p(`<h4>${escapeHtml(entity.label)}</h4>`);
      if (entity.description) p(`<p>${escapeHtml(entity.description)}</p>`);
      p(`<p>Family: ${escapeHtml(family.name)}</p>`);
      const links = [
        ...entity.paths.map((path) => ({ title: path.label, href: absolute(base, path.href) })),
        ...(entity.docs ? [entity.docs] : []),
        ...(entity.confluence || []),
      ];
      if (links.length) {
        p("<ul>");
        links.forEach((link) =>
          p(`<li><a href="${escapeHtml(link.href)}">${escapeHtml(link.title)}</a></li>`)
        );
        p("</ul>");
      } else {
        p("<p>No flow on this site.</p>");
      }
      if (entity.sharedFlowWith.length) {
        p(`<p>Shares its flow with ${escapeHtml(entity.sharedFlowWith.join(", "))}.</p>`);
      }
      if (entity.variants.length) {
        p(`<p>One flow per sport: ${escapeHtml(entity.variants.join(", "))}.</p>`);
      }
      p("</article>");
    });
  });

  p("<h2>Flows, step by step</h2>");
  data.flows.forEach((flow) => {
    if (!flow.steps) return;
    const href = absolute(base, `workflows/${flow.slug}/`);
    p(`<h3><a href="${escapeHtml(href)}">${escapeHtml(flow.title)}</a></h3>`);
    p("<ol>");
    flow.steps.forEach((step) => {
      p(
        `<li><strong>${escapeHtml(step.title)}</strong> — owned by ` +
          `${escapeHtml(step.owner)}${step.summary ? `. ${escapeHtml(step.summary)}` : ""}</li>`
      );
    });
    p("</ol>");
  });

  p("<h2>Frequently asked</h2>");
  data.faq.forEach((entry) => {
    p("<article>");
    p(`<h3>${escapeHtml(entry.question)}</h3>`);
    entry.answer.split(/\n{2,}/).forEach((block) => {
      const lines = block.split("\n");
      if (lines.every((one) => /^\s*[-*]\s+/.test(one))) {
        p("<ul>");
        lines.forEach((one) => p(`<li>${escapeHtml(one.replace(/^\s*[-*]\s+/, "").replace(/\*\*/g, ""))}</li>`));
        p("</ul>");
      } else {
        p(`<p>${escapeHtml(block.replace(/\*\*/g, "").replace(/\n/g, " "))}</p>`);
      }
    });
    p("</article>");
  });

  p("</body></html>");
  return parts.join("\n");
}

/* ---------- main ---------- */

function main() {
  const args = process.argv.slice(2);
  const baseArg = args.find((one) => one.startsWith("--base="));
  const base = (baseArg ? baseArg.slice("--base=".length) : DEFAULT_BASE).replace(/\/?$/, "/");
  const outdir = resolve(args.find((one) => !one.startsWith("--")) || join(ROOT, "digest"));

  const entities = readCatalogue();
  const families = entities
    .filter((entity) => entity.kind === "family")
    .map((family) => ({
      name: family.name,
      entities: entities.filter(
        (entity) => entity.kind !== "family" && entity.family.name === family.name
      ),
    }));

  const data = {
    // Deliberately a date and not a timestamp: this file is committed by CI, and
    // a per-second stamp would make every build a diff.
    generatedAt: new Date().toISOString().slice(0, 10),
    families,
    flows: readFlows(),
    faq: readFaq(),
  };

  mkdirSync(outdir, { recursive: true });
  writeFileSync(join(outdir, "index.html"), buildHtml(data, base) + "\n", "utf8");
  writeFileSync(join(outdir, "digest.txt"), buildText(data, base), "utf8");

  const products = families.reduce((n, family) => n + family.entities.length, 0);
  const parsed = data.flows.filter((flow) => flow.steps);
  const steps = parsed.reduce((n, flow) => n + flow.steps.length, 0);
  const declined = data.flows.filter((flow) => !flow.steps).map((flow) => flow.slug);

  console.log(`Digest written to ${outdir}`);
  console.log(`  products and variants : ${products}`);
  console.log(`  flows with steps      : ${parsed.length} of ${data.flows.length}`);
  console.log(`  steps                 : ${steps}`);
  console.log(`  answers               : ${data.faq.length}`);
  if (declined.length) console.log(`  declined (not flows)  : ${declined.join(", ")}`);
}

main();
