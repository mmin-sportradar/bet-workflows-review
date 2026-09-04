#!/usr/bin/env node
/* Why can't the setup script see an account?
 *
 *   node scripts/check-cloudflare-token.mjs
 *
 * "That token can see no accounts" is one message covering several different
 * causes, and they have different fixes: a token scoped to the wrong resources,
 * a token with no account-level permission at all, a Cloudflare login that
 * belongs to no account, or simply a token copied wrong. This asks the API each
 * of those questions separately and says which one it is.
 *
 * The token is read with hidden input and is never printed, logged or written
 * anywhere. Nothing here changes anything -- every call is a GET.
 */

import https from "node:https";
import readline from "node:readline";

const bold = (s) => `[1m${s}[0m`;
const dim = (s) => `[2m${s}[0m`;
const green = (s) => `[32m${s}[0m`;
const red = (s) => `[31m${s}[0m`;
const yellow = (s) => `[33m${s}[0m`;

// Hidden input: the token must not land in the terminal scrollback, which on a
// shared screen or a recorded session is as good as printing it.
function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    const onData = () => {
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(question + "*".repeat(rl.line.length));
    };
    process.stdin.on("data", onData);
    rl.question(question, (answer) => {
      process.stdin.removeListener("data", onData);
      rl.close();
      process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

function get(token, path) {
  return new Promise((resolve) => {
    const req = https.request(
      {
        host: "api.cloudflare.com",
        path: `/client/v4${path}`,
        method: "GET",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
      },
      (res) => {
        let body = "";
        res.on("data", (d) => (body += d));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, ...JSON.parse(body) });
          } catch {
            resolve({
              status: res.statusCode,
              success: false,
              errors: [{ message: body.slice(0, 200) }],
            });
          }
        });
      }
    );
    req.on("error", (e) =>
      resolve({ status: 0, success: false, errors: [{ message: e.code || e.message }] })
    );
    req.end();
  });
}

const problems = (r) =>
  (r.errors || []).map((e) => `${e.code ? e.code + " " : ""}${e.message}`).join("; ") ||
  `HTTP ${r.status}`;

const token = process.env.CLOUDFLARE_API_TOKEN || (await ask("Cloudflare API token: "));
if (!token) {
  console.error(red("No token given."));
  process.exit(1);
}

console.log(bold("\n1. Is the token itself valid?"));
const verify = await get(token, "/user/tokens/verify");
if (verify.success) {
  console.log(green(`   Yes - status ${verify.result.status}.`));
} else {
  console.log(red(`   No - ${problems(verify)}`));
  console.log(yellow("   The token is wrong, expired, or was copied with a stray space."));
  console.log(dim("   Cloudflare shows a token once. If unsure, roll it and try again."));
  process.exit(1);
}

console.log(bold("\n2. What accounts can the TOKEN see?"));
const accounts = await get(token, "/accounts");
if (accounts.success && accounts.result.length) {
  accounts.result.forEach((a) => console.log(green(`   ${a.name}  ${dim(a.id)}`)));
} else if (accounts.success) {
  console.log(red("   None."));
} else {
  console.log(red(`   Could not ask - ${problems(accounts)}`));
}

console.log(bold("\n3. What accounts does the LOGIN belong to?"));
console.log(dim("   Memberships belong to the user, not to the token's scope, so this"));
console.log(dim("   separates 'you have no account' from 'the token is not scoped to it'."));
const memberships = await get(token, "/memberships");
if (memberships.success && memberships.result.length) {
  memberships.result.forEach((m) =>
    console.log(
      `   ${m.account?.name || "?"}  ${dim(m.account?.id || "")}  status: ${m.status}  roles: ${
        (m.roles || []).join(", ") || "none"
      }`
    )
  );
} else if (memberships.success) {
  console.log(yellow("   None - this Cloudflare login is not a member of any account."));
} else {
  console.log(yellow(`   Unknown - ${problems(memberships)}`));
  console.log(dim("   An account-scoped token cannot read user memberships, so this is normal"));
  console.log(dim("   and simply means the question went unanswered. It is NOT 'no accounts'."));
}

console.log(bold("\nDiagnosis"));

// Three states, not two. An account-scoped token has no user-level read, so
// /memberships answers "Authentication error" rather than an empty list -- and
// that is UNKNOWN, not "no memberships". Collapsing the two told the first
// person who ran this that they had no Cloudflare account, on evidence that
// said nothing of the sort. Report what was actually established.
const canSee = accounts.success && accounts.result.length > 0;
const membershipsKnown = memberships.success;
const belongs = membershipsKnown && memberships.result.length > 0;

if (canSee) {
  console.log(green("   The token can see an account. Re-run scripts/setup-cloudflare.mjs."));
} else if (belongs) {
  console.log(yellow("   The login has an account, but the token is not scoped to it."));
  console.log("   Re-create the token and set, in the token form:");
  console.log(bold("     Account Resources:  Include  ->  <your account>"));
  console.log("   Permission rows alone are not enough. A token carrying permissions but");
  console.log("   no account in its resource list can see nothing at all.");
} else if (!membershipsKnown) {
  console.log(yellow("   Cannot tell from here, and the likely cause is the token's scope."));
  console.log("   The token is valid but lists no accounts, and it has no user-level read,");
  console.log("   so whether your login owns an account could not be checked.");
  console.log("");
  console.log(bold("   Settle it in the dashboard:") + "  https://dash.cloudflare.com");
  console.log("     - An account name in the sidebar  -> the account exists, so the token");
  console.log("       is the problem. Re-create it and set, in the token form:");
  console.log(bold("         Account Resources:  Include  ->  <your account>"));
  console.log("       Permission rows alone are not enough.");
  console.log("     - A sign-up or 'create account' prompt -> there really is no account.");
  console.log(dim("       https://dash.cloudflare.com/sign-up, or ask to be invited to the"));
  console.log(dim("       Sportradar one."));
} else {
  console.log(yellow("   This Cloudflare login is a member of no account."));
  console.log("   Either the sign-up never completed, or the account you expect belongs");
  console.log("   to someone else and you have not been invited. Create one free at");
  console.log(dim("     https://dash.cloudflare.com/sign-up"));
  console.log("   or ask whoever owns the Sportradar Cloudflare account to invite you.");
}
console.log("");
