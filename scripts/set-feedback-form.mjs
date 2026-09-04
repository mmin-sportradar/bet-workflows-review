#!/usr/bin/env node
/* Point the page feedback at a Google Form.
 *
 *   node scripts/set-feedback-form.mjs "<prefilled link>"
 *   node scripts/set-feedback-form.mjs --off
 *
 * The awkward part of wiring up a Google Form by hand is that the field ids are
 * opaque numbers -- entry.1845729301 and four more like it -- and getting one in
 * the wrong slot silently files every comment under "team". So this does not ask
 * you for the ids. It reads them out of a prefilled link, and works out which is
 * which from the answers you typed into it: put the word `rating` in the rating
 * question, `comment` in the comment one, and so on, and the mapping comes for
 * free and cannot be transposed.
 *
 * A form URL is not a credential -- worst case somebody adds rows to your
 * spreadsheet -- so unlike a Slack webhook this is safe to commit, and
 * scripts/check-secrets.py leaves it alone.
 */

import { readFile, writeFile, readdir } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const TARGET = join(ROOT, "shared", "feedback.js");
const CHROME_JS = join(ROOT, "shared", "chrome.js");

// The order here is the order they are written into the file. `rating` is the
// only one the panel cannot function without.
const FIELDS = ["rating", "comment", "page", "title", "team"];

const START = "    googleForm:";
const END = "\n\n    // DO NOT PUT A WEBHOOK URL HERE.";

function parse(link) {
  let url;
  try {
    url = new URL(link);
  } catch {
    throw new Error(`That is not a URL:\n  ${link}`);
  }

  if (!/(^|\.)docs\.google\.com$/.test(url.hostname)) {
    throw new Error(`Expected a docs.google.com link, got ${url.hostname}`);
  }

  // .../forms/d/e/<id>/viewform?usp=pp_url&entry.123=rating&...
  const id = url.pathname.match(/\/forms\/d\/e\/([^/]+)\//)?.[1];
  if (!id) {
    throw new Error(
      "No form id in that path. The link should look like\n" +
        "  https://docs.google.com/forms/d/e/1FAIpQLS.../viewform?usp=pp_url&entry.123=rating&..."
    );
  }

  // Keyed by the answer you typed, which is what makes the mapping self-evident.
  const byAnswer = new Map();
  for (const [key, value] of url.searchParams) {
    if (!key.startsWith("entry.")) continue;
    byAnswer.set(value.trim().toLowerCase(), key);
  }

  if (!byAnswer.size) {
    throw new Error(
      "That link carries no entry.N values. Use 'Get pre-filled link' and fill\n" +
        "every question in before you copy the link."
    );
  }

  const fields = {};
  const missing = [];
  for (const name of FIELDS) {
    const entry = byAnswer.get(name);
    if (entry) fields[name] = entry;
    else missing.push(name);
  }

  if (!fields.rating) {
    throw new Error(
      `Could not find which question is the rating.\n` +
        `The prefilled link has to contain the literal word "rating" as that\n` +
        `question's answer. Found instead: ${[...byAnswer.keys()].map((k) => `"${k}"`).join(", ")}`
    );
  }

  return {
    action: `https://docs.google.com/forms/d/e/${id}/formResponse`,
    fields,
    missing
  };
}

function render({ action, fields }) {
  const lines = FIELDS.filter((name) => fields[name]).map(
    (name) => `        ${name}: "${fields[name]}"`
  );
  return [
    "    googleForm: {",
    `      action: "${action}",`,
    "      fields: {",
    lines.join(",\n"),
    "      }",
    "    },"
  ].join("\n");
}

async function write(block) {
  const current = await readFile(TARGET, "utf8");
  const from = current.indexOf(START);
  const to = current.indexOf(END);
  if (from < 0 || to < 0 || to < from) {
    throw new Error(
      "Could not find the googleForm block in shared/feedback.js.\n" +
        "It has been edited by hand -- set SINK.googleForm yourself."
    );
  }
  await writeFile(TARGET, current.slice(0, from) + block + current.slice(to), "utf8");
}

const OFF = [
  "    googleForm: null,",
  "    // googleForm: {",
  '    //   action: "https://docs.google.com/forms/d/e/YOUR_FORM_ID/formResponse",',
  "    //   fields: {",
  '    //     rating: "entry.000000001",',
  '    //     comment: "entry.000000002",',
  '    //     page: "entry.000000003",',
  '    //     title: "entry.000000004",',
  '    //     team: "entry.000000005"',
  "    //   }",
  "    // },"
].join("\n");

// Editing feedback.js is not enough on its own, and the way it fails is nasty:
// the file is injected by chrome.js, so a reader with a cached chrome.js goes on
// requesting the OLD feedback.js version and never sees the change -- while a
// fresh browser does, which is exactly how you convince yourself it works. Both
// versions have to move, so neither is left to memory.
async function bumpVersions() {
  const bumped = [];

  let chrome = await readFile(CHROME_JS, "utf8");
  const before = chrome;
  chrome = chrome.replace(
    /(shared\/feedback\.js\?v=)(\d+)/,
    (_, prefix, n) => `${prefix}${Number(n) + 1}`
  );
  if (chrome === before) {
    console.warn("  ! shared/chrome.js has no feedback.js?v=N to bump — bump it by hand.");
  } else {
    await writeFile(CHROME_JS, chrome, "utf8");
    bumped.push(`shared/chrome.js  ${chrome.match(/shared\/feedback\.js\?v=\d+/)[0]}`);
  }

  // And chrome.js itself, in every page, or nobody re-fetches the injector.
  const pages = [
    join(ROOT, "index.html"),
    ...(await readdir(join(ROOT, "workflows"), { withFileTypes: true }))
      .filter((d) => d.isDirectory())
      .map((d) => join(ROOT, "workflows", d.name, "index.html"))
  ];

  let touched = 0;
  let stamp = "";
  for (const page of pages) {
    let html;
    try {
      html = await readFile(page, "utf8");
    } catch {
      continue; // a workflow folder without an index.html is not our problem
    }
    const next = html.replace(
      /(chrome\.js\?v=)(\d+)/,
      (_, prefix, n) => `${prefix}${Number(n) + 1}`
    );
    if (next !== html) {
      await writeFile(page, next, "utf8");
      touched += 1;
      stamp = next.match(/chrome\.js\?v=\d+/)[0];
    }
  }
  if (touched) bumped.push(`${touched} page${touched === 1 ? "" : "s"}  ${stamp}`);

  return bumped;
}

async function main() {
  const arg = process.argv[2];

  if (!arg) {
    console.error('usage: node scripts/set-feedback-form.mjs "<prefilled link>"');
    console.error("       node scripts/set-feedback-form.mjs --off");
    process.exit(2);
  }

  if (arg === "--off") {
    await write(OFF);
    console.log("Feedback sink turned off. Ratings are held in the reader's browser again.\n");
    for (const line of await bumpVersions()) console.log(`  bumped ${line}`);
    return;
  }

  const parsed = parse(arg);
  await write(render(parsed));

  console.log("shared/feedback.js now posts to:");
  console.log(`  ${parsed.action}\n`);
  for (const name of FIELDS) {
    console.log(`  ${name.padEnd(8)} ${parsed.fields[name] || "— not mapped, will not be sent"}`);
  }
  if (parsed.missing.length) {
    console.log(
      `\nNot mapped: ${parsed.missing.join(", ")}. Those are optional -- add a question\n` +
        "and re-run with a new prefilled link if you want them."
    );
  }

  console.log("");
  for (const line of await bumpVersions()) console.log(`  bumped ${line}`);
  console.log("\nReload a page, rate it, and check the form's response sheet.");
}

main().catch((err) => {
  console.error(`\n${err.message}\n`);
  process.exit(1);
});
