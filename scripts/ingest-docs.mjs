#!/usr/bin/env node
/* Read the product documentation, and compile it into quotable answers.
 *
 *   node scripts/ingest-docs.mjs --dry-run       report, write nothing
 *   node scripts/ingest-docs.mjs                 write shared/docs-knowledge.js
 *   node scripts/ingest-docs.mjs --host=docs.sportradar.com
 *
 * WHAT THIS PUBLISHES, AND WHY THAT IS SAFE
 *
 * Only apidocs.sportradar.com, docs.sportradar.com and developer.sportradar.com
 * -- pages already published on the open internet. `shared/**` is served from a
 * public GitHub Pages mirror, and that equivalence is the entire licence to
 * compile prose here.
 *
 * Confluence is deliberately NOT read by this script. Pulling one product page
 * returned three named bookmaker clients, a named Product Manager, an internal
 * email address and an internal Slack channel -- on the least sensitive kind of
 * page there is. Confluence outlines are a separate script with a separate
 * shape; prose from it is never published.
 *
 * THREE HOSTS, TWO METHODS -- each established by probing, not by assumption
 *
 *   docs.sportradar.com       GitBook. `page.md` serves text/markdown.
 *   developer.sportradar.com  ReadMe.  `page.md` serves text/markdown, and
 *                             /getting-started/docs/llms.txt is a real index.
 *   apidocs.sportradar.com    Next.js. No llms.txt (404), and `page.md`
 *                             returns the APP SHELL as text/html with a 200 --
 *                             a soft success that a markdown parser would read
 *                             as an empty document. Needs a real browser: the
 *                             sidebar is client-rendered, and the content only
 *                             lands in <main> after hydration.
 *
 * Markdown is preferred wherever it exists because a heading in markdown is
 * unambiguous, and because it needs no browser.
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const SCOPE_FILE = path.join(HERE, "docs-scope.json");
const CATALOG = path.join(ROOT, "shared", "catalog.js");
const OUT = path.join(ROOT, "shared", "docs-knowledge.js");
const START = "/* DOCS:START */";
const END = "/* DOCS:END */";

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const FORCE = args.includes("--force");
const HOST_ONLY = (args.find((a) => a.startsWith("--host=")) || "").split("=")[1] || "";

const MAX_PASSAGE = 1200;   // we quote rather than reproduce
const MIN_PASSAGE = 200;    // shorter than this is merged up, not published alone
const MIN_PAGE_WORDS = 60;  // below this a page is a redirect stub
const MAX_QUESTION = 120;
const TIMEOUT = 30000;

// Section headings that orient a reader rather than answer anything. They are
// real content and stay in the corpus -- "Prerequisites" matters once you know
// you are on the right page -- but they were winning questions over the
// sections that answer them, because they are short and the tie-break prefers
// short. Flagged here so the assistant can prefer a substantive sibling.
// Kept deliberately short. The first version also flagged "overview",
// "introduction", "getting started" and "data sources", and that was wrong:
// on a product page the overview IS the description, a getting-started section
// holds the actual steps, and the identifier guide's "Data Sources" section --
// "Sportradar offers a number of data APIs... these provide all the required
// identifiers" -- is the answer to how you get an identifier. Over-flagging
// left that whole page with no substantive section at all, so the weakest of
// its three sections answered the question. Only headings that are almost
// never the answer belong here.
const META_HEADINGS = new Set([
  "audience", "prerequisites", "before you begin",
  "next steps", "what's next", "whats next",
  "in this guide", "in this section", "on this page",
  "contents", "table of contents", "documentation sections", "sections",
  "documentation", "guides", "tutorials", "resources", "links",
  "related", "related pages", "see also", "further reading",
  "summary", "conclusion",
]);

const PUBLIC_HOSTS = new Set([
  "apidocs.sportradar.com",
  "docs.sportradar.com",
  "developer.sportradar.com",
]);

/* ------------------------------------------------------------------ helpers */

const slugify = (text) =>
  String(text).toLowerCase().trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const words = (text) => String(text).trim().split(/\s+/).filter(Boolean).length;

const tidy = (text) => String(text).replace(/\s+/g, " ").trim();

function truncate(text, limit) {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("\n"));
  return (stop > limit * 0.5 ? cut.slice(0, stop + 1) : cut).trim();
}

/* ------------------------------------------------------------------- scope */

async function loadScope() {
  const scope = JSON.parse(await readFile(SCOPE_FILE, "utf8"));
  const sections = scope.sections.filter(
    (s) => !HOST_ONLY || new URL(s.prefix).host === HOST_ONLY
  );
  return { ...scope, sections };
}

function skipped(url, scope) {
  return scope.skip.some((rule) => url.includes(rule));
}

// Which section owns a URL: the longest matching prefix whose slugPrefix, if it
// has one, the page's own slug also satisfies.
function sectionFor(url, scope) {
  let best = null;
  for (const section of scope.sections) {
    if (!url.startsWith(section.prefix) && url !== section.prefix.replace(/\/$/, "")) continue;
    if (section.slugPrefix) {
      const slug = url.slice(section.prefix.length);
      if (!slug.startsWith(section.slugPrefix)) continue;
    }
    if (!best || section.prefix.length > best.prefix.length) best = section;
  }
  return best;
}

function inScope(url, scope) {
  if (skipped(url, scope)) return false;
  try {
    if (!PUBLIC_HOSTS.has(new URL(url).host)) return false;
  } catch {
    return false;
  }
  if (scope.pages.includes(url)) return true;
  if (scope._catalogueUrls && scope._catalogueUrls.has(url)) return true;
  const section = sectionFor(url, scope);
  if (!section) return false;
  // How far below the section prefix a page may sit. Without this, the
  // virtual-stadium section pulled in a whole separate documentation site --
  // moderation UI, SDKs, central hub -- and 588 of 1,545 passages were one
  // product's internal tooling rather than the product the catalogue links.
  const depth = url.slice(section.prefix.length).split("/").filter(Boolean).length;
  return depth <= (section.maxDepth || 3);
}

/* -------------------------------------------------------- markdown adapter */

// A GitBook/ReadMe page. The .md is the same document the reader sees, so the
// headings are the author's own and the anchors are derivable from them.
async function fetchMarkdown(url) {
  const res = await fetch(`${url}.md`, {
    headers: { accept: "text/markdown, text/plain, */*" },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = res.headers.get("content-type") || "";
  const body = await res.text();
  // The guard that matters. apidocs answers 200 text/html for `page.md`, and
  // without this check that shell would compile to a page with no passages
  // rather than to an error.
  if (!/markdown|plain/.test(type)) {
    throw new Error(`expected markdown, got ${type.split(";")[0]} (${body.length} bytes)`);
  }
  return body;
}

function cleanMarkdown(body) {
  let text = body;

  // ReadMe frontmatter, which carries updatedAt.
  let updatedAt = "";
  const front = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (front) {
    const stamp = front[1].match(/updatedAt:\s*(\S+)/);
    if (stamp) updatedAt = stamp[1].slice(0, 10);
    text = text.slice(front[0].length);
  }

  // GitBook prefixes every .md with an advisory pointing at llms.txt, and
  // suffixes every one with the same "# Agent Instructions" block. Both are
  // boilerplate; the trailer in particular would compile into a passage that
  // answers "how do I query the documentation" on every single page.
  text = text.replace(/^>\s*For the complete documentation index[\s\S]*?\n\n/, "");
  text = text.split(/\n#\s+Agent Instructions\s*\n/)[0];
  text = text.replace(/\n#{1,6}\s+Querying This Documentation[\s\S]*$/, "");

  // MDX components ReadMe and GitBook embed. Their text is either decorative or
  // repeated in prose; the tags themselves are noise in a quote.
  text = text.replace(/<\/?[A-Z][A-Za-z]*[^>]*>/g, "");
  text = text.replace(/\{%[\s\S]*?%\}/g, "");
  text = text.replace(/^\s*\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)\s*$/gm, "");

  return { text, updatedAt };
}

// Split a markdown document into heading-delimited passages, keeping fenced
// code intact -- for "what URL do I call", the code block IS the answer.
function markdownPassages(text) {
  const lines = text.split("\n");
  const passages = [];
  let current = null;
  let fenced = false;

  for (const line of lines) {
    if (/^\s*```/.test(line)) fenced = !fenced;
    const heading = !fenced && line.match(/^(#{1,4})\s+(.*\S)\s*$/);
    if (heading) {
      const title = tidy(heading[2].replace(/[*_`]/g, ""));
      current = { heading: title, level: heading[1].length, anchor: slugify(title), lines: [] };
      passages.push(current);
      continue;
    }
    if (current) current.lines.push(line);
  }
  return passages.map((p) => ({ ...p, text: tidy(p.lines.join(" ")), lines: undefined }));
}

async function readMarkdownPage(url) {
  const body = await fetchMarkdown(url);
  const { text, updatedAt } = cleanMarkdown(body);
  const passages = markdownPassages(text);
  const title = (passages.find((p) => p.level === 1) || {}).heading || "";
  if (words(text) < MIN_PAGE_WORDS) throw new Error(`only ${words(text)} words`);
  if (!passages.length) throw new Error("no headings found");
  return { url, title, updatedAt, passages };
}

/* --------------------------------------------------------- browser adapter */

async function launchBrowser() {
  const candidates = [
    "playwright",
    "/Users/m.minnic/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs",
  ];
  for (const spec of candidates) {
    try {
      const { chromium } = await import(spec);
      return await chromium.launch({ channel: "chrome" });
    } catch { /* next */ }
  }
  throw new Error(
    "apidocs.sportradar.com needs Playwright: no llms.txt, and its sidebar and\n" +
    "content are both client-rendered. Run where the test suites run, or\n" +
    "  --host=docs.sportradar.com  to compile the markdown hosts only."
  );
}

// Runs inside the page. A heading WITH a usable anchor opens a passage; a
// heading without one is kept as text inside the passage it sits in, because a
// deep link we cannot build is worse than a slightly longer quote. On apidocs
// only 9 of 23 headings on the LMT Plus page carry an id, so this matters.
function extractInPage() {
  const main = document.querySelector("main");
  if (!main) return { title: document.title, passages: [] };

  const usableAnchor = (el) => {
    const id = el.id || "";
    if (!id || /^radix-/.test(id)) return "";
    return id;
  };
  const chrome = (el) =>
    el.closest("[data-slot='dialog-title']") ||
    el.className.includes("sr-only") ||
    el.closest("nav, aside, header, footer");

  const HEADING = /^H[1-4]$/;
  const BLOCK = /^(P|LI|TD|TH|PRE|BLOCKQUOTE|DT|DD)$/;
  const walker = document.createTreeWalker(main, NodeFilter.SHOW_ELEMENT);
  const passages = [];
  let current = null;

  while (walker.nextNode()) {
    const el = walker.currentNode;
    if (HEADING.test(el.tagName)) {
      if (chrome(el)) continue;
      const text = el.innerText.replace(/^#+\s*/, "").trim();
      if (!text) continue;
      const anchor = usableAnchor(el);
      if (anchor || !current) {
        current = { heading: text, anchor, level: Number(el.tagName[1]), parts: [] };
        passages.push(current);
      } else {
        current.parts.push(`${text}:`);
      }
      continue;
    }
    if (!current || !BLOCK.test(el.tagName) || chrome(el)) continue;
    if (el.querySelector("p, li, pre, blockquote")) continue;
    const text = el.innerText.replace(/\s+/g, " ").trim();
    if (text && !current.parts.includes(text)) current.parts.push(text);
  }

  return {
    title: document.title,
    passages: passages.map((p) => ({ ...p, text: p.parts.join(" "), parts: undefined })),
  };
}

/* ----------------------------------------------------------- shared shaping */

// An in-page table of contents lives inside <main> and gets absorbed into
// whichever passage precedes it, so every item repeats a heading from this same
// page. Then: merge a passage too short to stand alone up into its parent, and
// cap the rest.
function shapePage(page) {
  const headings = new Set(page.passages.map((p) => p.heading.toLowerCase()));
  const cleaned = page.passages.map((p) => {
    let text = tidy(p.text);
    for (const heading of headings) {
      text = text.replace(new RegExp(`(^|\\s)${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s|$)`, "gi"), " ");
    }
    return { ...p, text: tidy(text) };
  });

  const merged = [];
  for (const passage of cleaned) {
    const previous = merged[merged.length - 1];
    if (passage.text.length < MIN_PASSAGE && previous) {
      previous.text = tidy(`${previous.text} ${passage.heading}: ${passage.text}`);
      continue;
    }
    merged.push({ ...passage });
  }

  return {
    ...page,
    passages: merged
      .map((p) => ({ ...p, text: truncate(p.text, MAX_PASSAGE) }))
      .filter((p) => p.text.length >= MIN_PASSAGE),
  };
}

/* -------------------------------------------------------------- catalogue */

async function catalogue() {
  const source = await readFile(CATALOG, "utf8");
  const body = source.replace(/^\s*\/\*[\s\S]*?\*\//, "");
  return new Function(`${body}; return catalogEntities();`)();
}

// Every documentation URL the catalogue actually points at, on a public host.
// These are DECLARED seeds, not discovered ones: they are the pages a reader
// can already reach from a product tile, so they are the last pages that may
// be missed. Seeding only from section prefixes silently lost lmt-golf and
// lmt-mma -- both render fine, but nothing in the crawl links to them, so
// SR Packages Golf and Combat Sports had no documentation at all.
function catalogueDocUrls(entities) {
  const urls = new Set();
  for (const entity of entities) {
    if (!entity.docs) continue;
    const href = entity.docs.href || entity.docs;
    if (typeof href !== "string") continue;
    const url = href.split("#")[0].replace(/\/$/, "");
    try {
      if (PUBLIC_HOSTS.has(new URL(url).host)) urls.add(url);
    } catch { /* not a url */ }
  }
  return urls;
}

/* ------------------------------------------------------------------ crawl */

async function crawlApidocs(scope, report, catalogueUrls) {
  const fromSections = scope.sections
    .filter((s) => new URL(s.prefix).host === "apidocs.sportradar.com")
    .map((s) => s.prefix.replace(/\/$/, ""));
  const fromCatalogue = [...catalogueUrls].filter(
    (u) => new URL(u).host === "apidocs.sportradar.com" && !skipped(u, scope)
  );
  const seeds = [...new Set([...fromSections, ...fromCatalogue])];
  if (!seeds.length) return [];

  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.route("**/*", (route) =>
    ["image", "font", "media"].includes(route.request().resourceType())
      ? route.abort()
      : route.continue()
  );

  const queue = [...seeds];
  const seen = new Set(queue);
  const declared = new Set(seeds);
  const pages = [];

  try {
    while (queue.length) {
      const url = queue.shift();
      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
        const raw = await page.evaluate(extractInPage);
        const links = await page.evaluate(() => [
          ...new Set(
            [...document.querySelectorAll("a[href^='/']")].map((a) =>
              a.getAttribute("href").split(/[#?]/)[0]
            )
          ),
        ]);

        const shaped = shapePage({ ...raw, url, title: tidy(raw.title.replace(/\s*\|.*$/, "")) });
        if (shaped.passages.length) {
          pages.push(shaped);
          report.log(`  ok   ${String(shaped.passages.length).padStart(3)}p  ${url.replace(/^https:\/\//, "").slice(0, 74)}`);
        } else {
          report.bare.push(url);
        }

        const origin = new URL(url).origin;
        for (const href of links) {
          // `page.md` renders the very same page on this host, so following it
          // would duplicate every passage.
          if (href.endsWith(".md")) continue;
          const abs = (origin + href).replace(/\/$/, "");
          if (seen.has(abs) || !inScope(abs, scope)) continue;
          seen.add(abs);
          queue.push(abs);
        }
      } catch (error) {
        const reason = error.message.split("\n")[0].slice(0, 90);
        // A URL we declared in the scope file failing is our problem and must
        // stop the build. A link we merely found on one of their pages failing
        // is their broken link -- worth reporting, never worth blocking on.
        (declared.has(url) ? report.failures : report.broken).push({ url, reason });
      }
    }
  } finally {
    await browser.close();
  }
  return pages;
}

async function readMarkdownHosts(scope, report, catalogueUrls) {
  const urls = new Set(scope.pages.filter((u) => inScope(u, scope)));
  for (const url of catalogueUrls) {
    const host = new URL(url).host;
    if (host === "apidocs.sportradar.com") continue; // browser host
    if (HOST_ONLY && host !== HOST_ONLY) continue;
    if (!skipped(url, scope)) urls.add(url);
  }

  for (const index of scope.indexes || []) {
    if (HOST_ONLY && new URL(index).host !== HOST_ONLY) continue;
    try {
      const res = await fetch(index, { signal: AbortSignal.timeout(TIMEOUT) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.text();
      for (const match of body.matchAll(/\((https:\/\/[^)]+?)\.md\)/g)) {
        if (inScope(match[1], scope)) urls.add(match[1]);
      }
    } catch (error) {
      report.failures.push({ url: index, reason: `index: ${error.message}` });
    }
  }

  const pages = [];
  for (const url of urls) {
    try {
      const shaped = shapePage(await readMarkdownPage(url));
      if (shaped.passages.length) {
        pages.push(shaped);
        report.log(`  ok   ${String(shaped.passages.length).padStart(3)}p  ${url.replace(/^https:\/\//, "").slice(0, 74)}`);
      } else {
        report.bare.push(url);
      }
    } catch (error) {
      report.failures.push({ url, reason: error.message.split("\n")[0].slice(0, 90) });
    }
  }
  return pages;
}

/* ------------------------------------------------------------------ emit */

function toEntries(pages, scope) {
  const entries = [];
  const used = new Set();

  for (const page of pages) {
    const section = sectionFor(page.url, scope);
    const products = section ? section.products : [];
    const shared = Boolean(section && section.shared) || products.length > 1;
    const host = new URL(page.url).host;
    const pageTitle = page.title || page.url.split("/").pop();

    for (const passage of page.passages) {
      const stem = `docs-${slugify(page.url.split("/").slice(-2).join("-"))}-${slugify(passage.heading)}`;
      let id = stem;
      let n = 2;
      while (used.has(id)) id = `${stem}-${n++}`;
      used.add(id);

      // The heading, qualified by its page, is the ONLY high-weight surface.
      // `aliases` and `tags` are empty and must stay empty: an earlier ingest
      // put a sentence of prose into `aliases` and flooded the index with
      // common words, and a `tags: ["documentation"]` on every entry would
      // give every docs-flavoured question a free coverage bump across the
      // whole corpus, because coverage counts matched terms.
      const question = truncate(
        pageTitle && !passage.heading.toLowerCase().includes(pageTitle.toLowerCase())
          ? `${pageTitle} — ${passage.heading}`
          : passage.heading,
        MAX_QUESTION
      );

      entries.push({
        id,
        question,
        aliases: [],
        tags: [],
        answer: passage.text,
        product: products[0] || null,
        entities: products,
        source: "docs",
        pageTitle,
        heading: passage.heading,
        headingLevel: passage.level,
        site: host,
        href: passage.anchor ? `${page.url}#${passage.anchor}` : page.url,
        anchored: Boolean(passage.anchor),
        meta: META_HEADINGS.has(passage.heading.toLowerCase().replace(/[^a-z' ]/g, "").trim()),
        shared,
        updatedAt: page.updatedAt || "",
        asked: 0,
        links: [],
        related: [],
      });
    }
  }
  return entries;
}

/* ------------------------------------------------------------------ guards */

function refuse(message) {
  console.error(`\nRefusing to write. ${message}`);
  process.exit(1);
}

async function check(entries, scope, labels, report) {
  // A failed fetch must never quietly produce a smaller corpus. A
  // documentation redesign has to break the build loudly.
  if (report.failures.length && !FORCE) {
    report.failures.slice(0, 10).forEach((f) => console.error(`   ${f.url}\n     ${f.reason}`));
    refuse(`${report.failures.length} page(s) failed. Fix them, or pass --force.`);
  }
  if (!entries.length) refuse("no passages were extracted at all.");

  const unknown = [...new Set(entries.flatMap((e) => e.entities))].filter((l) => !labels.has(l));
  if (unknown.length) {
    refuse(
      `these are not catalogue labels, so the entity veto would invert on them:\n   ${unknown.join(", ")}`
    );
  }

  const wide = entries.filter((e) => (e.aliases || []).length || (e.tags || []).length);
  if (wide.length) refuse(`${wide.length} entr(ies) carry aliases or tags. Both must stay empty.`);

  const long = entries.filter((e) => e.answer.length > MAX_PASSAGE || e.question.length > MAX_QUESTION);
  if (long.length) refuse(`${long.length} entr(ies) exceed the length caps.`);

  const offHost = entries.filter((e) => !PUBLIC_HOSTS.has(new URL(e.href).host));
  if (offHost.length) refuse(`${offHost.length} entr(ies) cite a host that is not public documentation.`);

  // The structural guarantee is the host allowlist above: content is fetched
  // only from three public hosts, so it is public by construction. This is the
  // belt-and-braces check for the one way that could go wrong -- a redirect
  // landing the fetcher on an internal system.
  //
  // It deliberately does NOT look for @sportradar.com addresses. The public
  // documentation publishes its own support addresses (sales@, bet-integrations@)
  // and flagging those rejected four perfectly publishable passages. Nor does it
  // look for long numbers: the docs are full of legitimate ones, like the match
  // id in "sr:match:50955863".
  const leaks = entries.filter((e) =>
    /atlassian\.net|\/wiki\/spaces\/|sportradar\.atlassian/i.test(`${e.question} ${e.answer} ${e.href}`)
  );
  if (leaks.length && !FORCE) {
    leaks.slice(0, 5).forEach((e) => console.error(`   ${e.id}: ${e.answer.slice(0, 110)}`));
    refuse(`${leaks.length} entr(ies) look like internal content, not public documentation.`);
  }

  if (existsSync(OUT) && !FORCE) {
    const before = await readFile(OUT, "utf8");
    const previous = (before.match(/"source": "docs"/g) || []).length;
    if (previous && entries.length < previous * 0.8) {
      refuse(`${entries.length} passages against ${previous} before -- more than a fifth gone.`);
    }
  }
}

/* -------------------------------------------------------------------- main */

async function main() {
  const scope = await loadScope();
  const entities = await catalogue();
  const labels = new Set(entities.map((entity) => entity.label));
  const catalogueUrls = catalogueDocUrls(entities);
  scope._catalogueUrls = catalogueUrls;
  const report = {
    failures: [],
    broken: [],
    bare: [],
    log: (line) => process.stderr.write(`${line}\n`),
  };

  console.log("Reading the public product documentation.\n");
  const markdownPages = await readMarkdownHosts(scope, report, catalogueUrls);
  const browserPages = HOST_ONLY && HOST_ONLY !== "apidocs.sportradar.com"
    ? []
    : await crawlApidocs(scope, report, catalogueUrls);

  const pages = [...markdownPages, ...browserPages];
  const entries = toEntries(pages, scope);

  const chars = entries.reduce((sum, e) => sum + e.answer.length, 0);
  console.log("");
  console.log(`Pages with content : ${pages.length}`);
  console.log(`Passages compiled  : ${entries.length}`);
  console.log(`Prose              : ${(chars / 1024).toFixed(0)} KB`);
  console.log(`Deep-linkable      : ${entries.filter((e) => e.anchored).length}/${entries.length}`);
  console.log(`Pages with no text : ${report.bare.length}`);
  console.log(`Broken links found : ${report.broken.length} (theirs, not fatal)`);
  console.log(`Failed             : ${report.failures.length}`);

  const byProduct = new Map();
  entries.forEach((e) => e.entities.forEach((label) =>
    byProduct.set(label, (byProduct.get(label) || 0) + 1)));
  console.log("\nPassages per product:");
  [...byProduct.entries()].sort((a, b) => b[1] - a[1])
    .forEach(([label, n]) => console.log(`   ${String(n).padStart(4)}  ${label}`));
  const untagged = entries.filter((e) => !e.entities.length).length;
  console.log(`   ${String(untagged).padStart(4)}  (shared, no single product)`);

  const missing = [...labels].filter((label) =>
    !byProduct.has(label) && !["Widget products", "Packages & combinations", "SR Packages",
      "Experiences & engagement", "Data & APIs", "Operations", "Product Hub"].includes(label));
  if (missing.length) console.log(`\nNo passages for: ${missing.join(", ")}`);

  await check(entries, scope, labels, report);

  if (DRY) {
    console.log("\n--dry-run: nothing written. Three samples:");
    entries.slice(0, 3).forEach((e) =>
      console.log(`\n  [${e.question}]  ${e.entities.join(", ") || "(shared)"}\n  ${e.answer.slice(0, 200)}\n  ${e.href}`));
    return;
  }

  // Re-stamping the date every run makes the file differ day to day even when
  // not one character of content changed -- which defeats "run it twice and
  // diff" as a check and fills review with noise. The date is real provenance,
  // so it is kept and only moved when the content moves.
  let compiledAt = new Date().toISOString().slice(0, 10);
  if (existsSync(OUT)) {
    try {
      const before = await readFile(OUT, "utf8");
      const block = before.split(START)[1].split(END)[0];
      const previous = new Function(`${block}; return betDocsKnowledge;`)();
      if (JSON.stringify(previous.entries) === JSON.stringify(entries)) {
        compiledAt = previous.compiledAt || compiledAt;
      }
    } catch {
      /* no readable previous corpus: the fresh date is right */
    }
  }

  const payload = {
    source: "public product documentation",
    compiledAt,
    hosts: [...PUBLIC_HOSTS],
    pages: pages.length,
    entries,
  };

  const header = `/* Compiled by scripts/ingest-docs.mjs -- do not edit by hand.
 *
 * Passages from Sportradar's PUBLIC product documentation, quoted verbatim so
 * an answer cannot drift from its source, each carrying the deep link to the
 * heading it came from.
 *
 * Loaded lazily -- this file is much larger than the rest of the site, and
 * nobody who does not ask a question should pay for it.
 *
 * Confluence prose is not here, on purpose. See the script's header.
 */

`;

  await writeFile(
    OUT,
    `${header}${START}\nconst betDocsKnowledge = ${JSON.stringify(payload, null, 1)};\n${END}\n\n` +
      `if (typeof window !== "undefined") window.betDocsKnowledge = betDocsKnowledge;\n`,
    "utf8"
  );

  console.log(`\nWrote ${entries.length} passages from ${pages.length} pages to shared/docs-knowledge.js`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
