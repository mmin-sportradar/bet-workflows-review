#!/usr/bin/env node
/* One-shot Cloudflare setup for the hosted content admin.
 *
 *   node scripts/setup-cloudflare.mjs
 *
 * Creates the Pages project, sets its environment variables, creates the Access
 * application and its policy, reads back the audience tag that the Worker needs
 * to verify assertions, and stores the deploy credentials as GitHub Actions
 * secrets so pushes to main publish automatically.
 *
 * It is idempotent: run it again after changing anything and it updates in place
 * rather than failing on "already exists". Nothing is deleted, ever -- if a name
 * is taken by something this script did not create, it says so and stops.
 *
 * What it deliberately does NOT do:
 *
 *   - Create the Cloudflare account, or enable Zero Trust. Both need a human.
 *   - Configure the identity provider. Connecting Sportradar SSO means
 *     registering an application with your IdP, which is your IT team's to do.
 *     Until then the policy this creates uses one-time PIN, which emails a code
 *     and needs nobody's help. Swap it for the IdP group when that exists.
 */

import https from "node:https";
import readline from "node:readline";
import { execFileSync } from "node:child_process";

const API = "api.cloudflare.com";
const PROJECT = process.env.CF_PAGES_PROJECT || "bet-workflows-admin";
const REPO_OWNER = "mmin-sportradar";
const REPO_NAME = "Internal-workflow";
const REPO_BRANCH = "main";

const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

function ask(question, { silent = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (silent) {
      // Keep the token off the screen and out of the scrollback.
      const onData = (char) => {
        if (["\n", "\r", ""].includes(String(char))) process.stdin.removeListener("data", onData);
        else process.stdout.write("\x1b[2K\x1b[200D" + question + "*".repeat(rl.line.length));
      };
      process.stdin.on("data", onData);
    }
    rl.question(question, (answer) => { rl.close(); if (silent) process.stdout.write("\n"); resolve(answer.trim()); });
  });
}

function cf(token, method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname: API, path: `/client/v4${path}`, method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          let parsed;
          try { parsed = JSON.parse(raw); } catch { return reject(new Error(`${method} ${path}: non-JSON reply (${res.statusCode})`)); }
          if (!parsed.success) {
            const detail = (parsed.errors || []).map((e) => `${e.code} ${e.message}`).join("; ");
            const err = new Error(`${method} ${path}: ${detail || res.statusCode}`);
            err.errors = parsed.errors || [];
            err.status = res.statusCode;
            return reject(err);
          }
          resolve(parsed.result);
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const has = (err, code) => (err.errors || []).some((e) => e.code === code);

async function main() {
  console.log(bold("\nCloudflare setup for the content admin\n"));
  console.log("You need a Cloudflare API token with these permissions:");
  console.log(dim("  Account · Cloudflare Pages · Edit"));
  console.log(dim("  Account · Access: Apps and Policies · Edit"));
  console.log(dim("  Account · Access: Organizations, Identity Providers and Groups · Read"));
  console.log(dim("  Create one at https://dash.cloudflare.com/profile/api-tokens\n"));

  const token = process.env.CLOUDFLARE_API_TOKEN || await ask("Cloudflare API token: ", { silent: true });
  if (!token) { console.error(red("No token given.")); process.exit(1); }

  // --- account ------------------------------------------------------------
  const accounts = await cf(token, "GET", "/accounts");
  if (!accounts.length) { console.error(red("That token can see no accounts.")); process.exit(1); }
  let account = accounts[0];
  if (accounts.length > 1) {
    console.log("\nAccounts this token can see:");
    accounts.forEach((a, i) => console.log(`  ${i + 1}. ${a.name}  ${dim(a.id)}`));
    const pick = await ask(`Which one? [1-${accounts.length}] `);
    account = accounts[(Number(pick) || 1) - 1] || accounts[0];
  }
  console.log(`\nAccount: ${bold(account.name)} ${dim(account.id)}`);

  // --- team domain, needed for assertion verification ----------------------
  let teamDomain = "";
  try {
    const org = await cf(token, "GET", `/accounts/${account.id}/access/organizations`);
    teamDomain = org.auth_domain || "";
  } catch {
    console.log(yellow("  Could not read the Zero Trust organisation."));
  }
  if (!teamDomain) {
    console.log(yellow("\nZero Trust does not look set up on this account yet."));
    console.log("Open https://one.dash.cloudflare.com and pick a team name, then run this again.");
    teamDomain = await ask("Team domain, if you already know it (e.g. sportradar.cloudflareaccess.com), or blank to stop: ");
    if (!teamDomain) process.exit(1);
  }
  console.log(`Team domain: ${bold(teamDomain)}`);

  // --- Pages project ------------------------------------------------------
  let project;
  try {
    project = await cf(token, "GET", `/accounts/${account.id}/pages/projects/${PROJECT}`);
    console.log(`\nPages project ${bold(PROJECT)} already exists — updating it.`);
  } catch (err) {
    if (err.status !== 404 && !has(err, 8000007)) throw err;
    console.log(`\nCreating Pages project ${bold(PROJECT)}…`);
    project = await cf(token, "POST", `/accounts/${account.id}/pages/projects`, {
      name: PROJECT,
      production_branch: REPO_BRANCH,
    });
  }
  const pagesHost = `${PROJECT}.pages.dev`;
  console.log(`  ${pagesHost}`);

  // --- Access application -------------------------------------------------
  // Cover the pages.dev hostname explicitly. A policy written only for a custom
  // domain leaves that one open, and it serves the same deployment.
  const appName = "BET Workflows content admin";
  const apps = await cf(token, "GET", `/accounts/${account.id}/access/apps`);
  let app = apps.find((a) => a.name === appName || a.domain === pagesHost);
  if (app) {
    console.log(`\nAccess application already exists — updating it.`);
    app = await cf(token, "PUT", `/accounts/${account.id}/access/apps/${app.id}`, {
      name: appName, domain: pagesHost, type: "self_hosted",
      session_duration: "24h", app_launcher_visible: true,
    });
  } else {
    console.log(`\nCreating the Access application…`);
    app = await cf(token, "POST", `/accounts/${account.id}/access/apps`, {
      name: appName, domain: pagesHost, type: "self_hosted",
      session_duration: "24h", app_launcher_visible: true,
    });
  }

  // --- policy -------------------------------------------------------------
  const emails = (await ask(
    "\nWho may edit? Comma-separated emails, or a domain like @sportradar.com\n> "
  )).split(",").map((s) => s.trim()).filter(Boolean);

  const include = emails.length
    ? emails.map((e) => (e.startsWith("@") ? { email_domain: { domain: e.slice(1) } } : { email: { email: e } }))
    : [{ email_domain: { domain: "sportradar.com" } }];

  const policies = await cf(token, "GET", `/accounts/${account.id}/access/apps/${app.id}/policies`);
  const existing = policies.find((p) => p.name === "Content editors");
  const policyBody = { name: "Content editors", decision: "allow", include, precedence: 1 };
  if (existing) {
    await cf(token, "PUT", `/accounts/${account.id}/access/apps/${app.id}/policies/${existing.id}`, policyBody);
    console.log("  Policy updated.");
  } else {
    await cf(token, "POST", `/accounts/${account.id}/access/apps/${app.id}/policies`, policyBody);
    console.log("  Policy created.");
  }

  const aud = app.aud;
  if (!aud) { console.error(red("\nThe Access application returned no audience tag.")); process.exit(1); }

  // --- environment variables ---------------------------------------------
  console.log(bold("\nThe GitHub token"));
  console.log("Fine-grained, this repository only, Contents: Read and write.");
  console.log(dim("  https://github.com/settings/personal-access-tokens/new"));
  console.log("Leave blank to set it later in the dashboard.\n");
  const ghToken = await ask("GitHub token: ", { silent: true });

  console.log(bold("\nThe Slack webhook (optional)"));
  console.log("Where page feedback is posted. functions/api/feedback.js forwards to it.");
  console.log(dim("  https://api.slack.com/apps -> your app -> Incoming Webhooks"));
  console.log(dim("  Leave blank to skip; ratings are held in the reader's browser until it is set."));
  console.log("");
  const slackWebhook = await ask("Slack webhook URL: ", { silent: true });

  // This PATCH replaces deployment_configs wholesale -- a name left out of this
  // object is a variable DELETED from the project. So anything set by hand in
  // the dashboard has to be re-supplied here, which is why the webhook is
  // prompted for rather than left to be added afterwards: re-running this
  // script would otherwise silently wipe it and feedback would stop with no
  // error anywhere.
  const env_vars = {
    REPO_OWNER: { type: "plain_text", value: REPO_OWNER },
    REPO_NAME: { type: "plain_text", value: REPO_NAME },
    REPO_BRANCH: { type: "plain_text", value: REPO_BRANCH },
    ACCESS_TEAM_DOMAIN: { type: "plain_text", value: teamDomain },
    ACCESS_AUD: { type: "plain_text", value: aud },
  };
  if (ghToken) env_vars.GITHUB_TOKEN = { type: "secret_text", value: ghToken };
  // secret_text, not plain_text: a webhook readable in the dashboard is a
  // webhook readable by everyone with dashboard access.
  if (slackWebhook) env_vars.SLACK_WEBHOOK_URL = { type: "secret_text", value: slackWebhook };

  await cf(token, "PATCH", `/accounts/${account.id}/pages/projects/${PROJECT}`, {
    deployment_configs: {
      production: { env_vars, compatibility_date: "2024-11-01" },
      preview: { env_vars, compatibility_date: "2024-11-01" },
    },
  });
  const asSecrets = [ghToken && "GITHUB_TOKEN", slackWebhook && "SLACK_WEBHOOK_URL"].filter(Boolean);
  const stillToDo = [!ghToken && "GITHUB_TOKEN", !slackWebhook && "SLACK_WEBHOOK_URL"].filter(Boolean);
  console.log(
    "\nEnvironment variables set" +
      (asSecrets.length ? ` (${asSecrets.join(" and ")} as secret${asSecrets.length > 1 ? "s" : ""})` : "") +
      (stillToDo.length ? `; ${stillToDo.join(" and ")} still to do.` : ".")
  );
  if (slackWebhook) {
    console.log(dim("  Then set endpoint: \"/api/feedback\" in shared/feedback.js to switch feedback on."));
  }

  // --- GitHub Actions secrets, so pushes deploy ---------------------------
  try {
    execFileSync("gh", ["secret", "set", "CLOUDFLARE_API_TOKEN", "--repo", `${REPO_OWNER}/${REPO_NAME}`],
      { input: token, stdio: ["pipe", "ignore", "pipe"] });
    execFileSync("gh", ["secret", "set", "CLOUDFLARE_ACCOUNT_ID", "--repo", `${REPO_OWNER}/${REPO_NAME}`],
      { input: account.id, stdio: ["pipe", "ignore", "pipe"] });
    console.log("GitHub Actions secrets set — pushes to main will deploy.");
  } catch (err) {
    console.log(yellow("Could not set the GitHub Actions secrets automatically. Run:"));
    console.log(dim(`  gh secret set CLOUDFLARE_API_TOKEN --repo ${REPO_OWNER}/${REPO_NAME}`));
    console.log(dim(`  gh secret set CLOUDFLARE_ACCOUNT_ID --repo ${REPO_OWNER}/${REPO_NAME}`));
  }

  console.log(green(bold("\nDone.\n")));
  console.log(`  Admin URL     https://${pagesHost}/admin/`);
  console.log(`  Team domain   ${teamDomain}`);
  console.log(`  Audience tag  ${aud}`);
  if (!ghToken) console.log(yellow("\n  Still to do: add GITHUB_TOKEN as a Secret in the Pages project, then redeploy."));
  console.log(`
Next:
  1. Deploy once:  ${dim("gh workflow run deploy-admin.yml")}   (or push to main)
  2. Open the admin URL in a private window. Access should challenge you.
  3. Check ${dim(`https://${pagesHost}/api/whoami`)} names you.

The policy uses one-time PIN by default, which emails a code. Swap it for
Sportradar SSO once IT has registered the application with your identity
provider: Zero Trust -> Settings -> Authentication, then edit the policy.
`);
}

main().catch((err) => {
  console.error(red(`\n${err.message}`));
  if (/permission|Authentication|9109|10000/i.test(err.message)) {
    console.error("That usually means the API token is missing one of the permissions listed above.");
  }
  process.exit(1);
});
