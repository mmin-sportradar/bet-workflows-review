#!/usr/bin/env node
/**
 * Issue an access key for the content admin.
 *
 * The editor is served publicly and used to be gated by the GitHub token
 * itself: a string that is recognisably a credential and works from curl the
 * moment anyone sees it. A key issued here is that token encrypted under a
 * passphrase, with the person's name and an expiry sealed inside it. Handing
 * one out, or losing one, gives away nothing on its own -- the passphrase
 * travels separately and is the other half.
 *
 * It is a command line tool rather than a panel in the editor on purpose: the
 * raw token should never be typed into a page that is served to the public.
 *
 *   node scripts/issue-key.mjs                 issue a key
 *   node scripts/issue-key.mjs --verify        unwrap one again to check it
 *
 * What this buys, and what it does not: a leaked key is useless without the
 * passphrase, but a person holding both can still read the token out of their
 * own browser. See DEPLOY.md, and ADMIN-HOSTING.md for the arrangement where no
 * browser holds a credential at all.
 */

import { pbkdf2Sync, randomBytes, createCipheriv, createDecipheriv } from "crypto";
import { createInterface } from "readline";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";

// Both halves of this file's format live here, and admin/index.html repeats
// them in the browser's own crypto API. Change one and you must change the
// other -- hence the version in the prefix, so a mismatch is recognised rather
// than guessed at.
export const PREFIX = "srk1_";
export const ITERATIONS = 250000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_BYTES = 32;
const TAG_BYTES = 16;

const b64url = (buf) =>
  buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const unb64url = (s) =>
  Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

/** The token, the person and the expiry, sealed under the passphrase. */
export function wrap({ token, name, email, expires }, passphrase) {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = pbkdf2Sync(passphrase, salt, ITERATIONS, KEY_BYTES, "sha256");
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const payload = JSON.stringify({ t: token, n: name, e: email, x: expires });
  const body = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  // The browser's AES-GCM expects the tag appended to the ciphertext; node
  // hands it over separately, so it is joined on here.
  return PREFIX + b64url(Buffer.concat([salt, iv, body, cipher.getAuthTag()]));
}

/**
 * The reverse. Throws with a reason a person can act on: a key that is not one,
 * a passphrase that does not match, a key whose date has passed.
 */
export function unwrap(keyString, passphrase, now = new Date()) {
  const trimmed = String(keyString || "").trim();
  if (!trimmed.startsWith(PREFIX)) throw new Error("That is not an access key.");
  const raw = unb64url(trimmed.slice(PREFIX.length));
  if (raw.length < SALT_BYTES + IV_BYTES + TAG_BYTES + 2) {
    throw new Error("That access key is damaged — ask for a new one.");
  }
  const salt = raw.subarray(0, SALT_BYTES);
  const iv = raw.subarray(SALT_BYTES, SALT_BYTES + IV_BYTES);
  const body = raw.subarray(SALT_BYTES + IV_BYTES, raw.length - TAG_BYTES);
  const tag = raw.subarray(raw.length - TAG_BYTES);
  const key = pbkdf2Sync(passphrase, salt, ITERATIONS, KEY_BYTES, "sha256");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  let json;
  try {
    json = Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  } catch {
    // AES-GCM authenticates, so a wrong passphrase and a tampered key both
    // land here rather than producing plausible rubbish.
    throw new Error("That passphrase does not match this key.");
  }
  const data = JSON.parse(json);
  if (data.x && new Date(data.x) < now) {
    throw new Error(`That key expired on ${data.x} — ask for a new one.`);
  }
  return { token: data.t, name: data.n, email: data.e, expires: data.x };
}

/* ---------------------------------------------------------------- prompts */

// One interface for the whole session, not one per question: closing and
// reopening loses whatever is already buffered on stdin, which works by luck at
// a terminal and hangs the moment answers are piped in.
function prompts() {
  const tty = Boolean(process.stdin.isTTY);
  if (!tty) {
    // Answers piped in, which is how this gets tested. readline is no use
    // here: with a non-terminal stream it emits every line as fast as it can
    // read them, and the ones that arrive between two questions land on the
    // floor. So the answers are read in one go and handed out in order.
    const piped = readFileSync(0, "utf8").split("\n");
    let at = 0;
    return {
      ask: async (question) => {
        const answer = (piped[at++] || "").trim();
        process.stdout.write(question + answer + "\n");
        return answer;
      },
      close: () => {},
    };
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: tty });
  let muted = false;
  if (tty && typeof rl._writeToOutput === "function") {
    const write = rl._writeToOutput.bind(rl);
    rl._writeToOutput = (s) => { if (!muted) write(s); };
  }
  const ask = (question, { hidden = false } = {}) =>
    new Promise((resolve) => {
      if (hidden && tty) {
        // Nothing echoes, so a token or passphrase does not stay on the screen
        // or in a screen share. readline is given the prompt and muted only
        // once it has painted it: writing the prompt by hand instead looks fine
        // in a bare terminal and vanishes in the ones that redraw the line,
        // which reads as the tool having hung.
        rl.question(question, (answer) => {
          muted = false;
          process.stdout.write("\n");
          resolve(answer.trim());
        });
        muted = true;
        return;
      }
      rl.question(question, (answer) => resolve(answer.trim()));
    });
  return { ask, close: () => rl.close() };
}

const plusDays = (n) => {
  const d = new Date(Date.now() + n * 86400000);
  return d.toISOString().slice(0, 10);
};

async function issue({ ask }) {
  console.log("Issue an access key for the content admin.\n");
  const token = await ask("GitHub token (not echoed): ", { hidden: true });
  if (!/^(ghp_|github_pat_)/.test(token)) {
    console.log("\nThat does not look like a GitHub token. Nothing was written.");
    process.exit(1);
  }
  const name = await ask("Issued to (name): ");
  const email = await ask("Their work email: ");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.log("\nThat is not an email address. Nothing was written.");
    process.exit(1);
  }
  const expiresIn = await ask(`Valid until [${plusDays(180)}]: `);
  const expires = expiresIn || plusDays(180);
  if (Number.isNaN(new Date(expires).getTime())) {
    console.log("\nThat is not a date (use YYYY-MM-DD). Nothing was written.");
    process.exit(1);
  }
  const pass = await ask("Passphrase (not echoed): ", { hidden: true });
  if (pass.length < 8) {
    console.log("\nUse a passphrase of at least 8 characters. Nothing was written.");
    process.exit(1);
  }
  const again = await ask("Passphrase again: ", { hidden: true });
  if (pass !== again) {
    console.log("\nThose two passphrases differ. Nothing was written.");
    process.exit(1);
  }

  const key = wrap({ token, name, email, expires }, pass);
  console.log(`\nKey for ${name}, valid until ${expires}:\n\n${key}\n`);
  console.log("Send the key and the sign-in URL together. Send the passphrase");
  console.log("through something else -- a call, a different app. One channel");
  console.log("carrying both is the same as sending the token itself.\n");
}

async function verify({ ask }) {
  const key = await ask("Access key: ");
  const pass = await ask("Passphrase (not echoed): ", { hidden: true });
  try {
    const out = unwrap(key, pass);
    console.log(`\nGood key.\n  issued to  ${out.name} <${out.email}>`);
    console.log(`  expires    ${out.expires}`);
    console.log(`  token      ${out.token.slice(0, 8)}… (${out.token.length} characters)\n`);
  } catch (err) {
    console.log(`\n${err.message}\n`);
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const io = prompts();
  const run = process.argv.includes("--verify") ? verify : issue;
  run(io)
    .then(() => io.close())
    .catch((err) => {
      io.close();
      console.error(err.message);
      process.exit(1);
    });
}
