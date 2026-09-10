# Internal-workflow

Interactive workflow diagrams for BET product setup, integration, and operational processes at Sportradar.

The site is a static HTML/CSS/JS app. Open the landing page to browse products by category, then drill into setup, integration, or process flows for each product.

## Local development

No build step or dependencies are required. Serve the repo root with any static file server:

```bash
python3 -m http.server 8080
```

Then open [http://127.0.0.1:8080/](http://127.0.0.1:8080/).

## Project structure

```
.
├── index.html          # Landing page — product catalog
├── app.js              # Catalog rendering and workflow picker dialog
├── styles.css          # Landing page styles
├── shared/
│   ├── catalog.js      # Product families, workflow paths, shared helpers
│   ├── chrome.js       # Shared header, sidebar, breadcrumb and footer logic
│   ├── chrome.css      # Shared layout and navigation styles
│   ├── assistant.js    # "Ask the team" chat panel and its search
│   ├── assistant.css   # Assistant styles
│   ├── knowledge.js    # The answers the assistant searches (generated + seed)
│   └── feedback.js     # Where page ratings go — posts to /api/feedback
└── workflows/
    └── <flow-name>/    # One directory per workflow diagram
        ├── index.html
        ├── app.js
        ├── styles.css
        └── assets/
```

Each workflow lives under `workflows/` as a self-contained folder. Workflow pages load the shared chrome layer and derive their breadcrumb from `shared/catalog.js`, so navigation stays in sync without hand-written links on every page.

## Adding or updating a workflow

1. Create or edit a folder under `workflows/<flow-name>/`.
2. Register the workflow path in `shared/catalog.js` under the correct product entry (`setup`, `integration`, or `process`).
3. Reload the site — the landing page and sidebar pick up changes from the catalog automatically.

## Workflow types

| Type | Purpose |
|------|---------|
| **Setup flow** | Product onboarding and configuration steps |
| **Integration flow** | Client integration and delivery steps |
| **Process flow** | Operational or cross-product processes |

## The assistant

Every page carries an **Ask the team** button in its footer, next to the page
rating. It opens a chat panel that answers from `shared/knowledge.js` — the
questions the team has already answered — and shows the source of every answer.
There is no model and no network call: it is a ranked search over answers people
wrote, which is what lets each one link back to the Slack thread it came from.

Below a confidence threshold it says it does not know and offers the Slack
channels instead. That is deliberate. An assistant that always produces
something is one nobody can trust the rest of the time.

### Loading Slack answers

`shared/knowledge.js` ships with ten hand-written entries derived from the
workflows on this site. They are marked `source: "site"` and the panel labels
them as site knowledge rather than dressing them up as Slack threads.

To add the real thing, unzip a Slack export and run:

```bash
node scripts/ingest-slack.mjs <export-dir> --dry-run      # see what it would keep
node scripts/ingest-slack.mjs <export-dir>                # write it
node scripts/ingest-slack.mjs <export-dir> --channels=bet-widgets-support
```

It keeps a thread when the parent reads as a question, somebody else replied,
and the reply is long enough to be an answer. Repeat askings of the same
question fold into one entry whose `asked` count is what ranks **Most asked**.
Hand-written `site` entries are preserved across every re-run.

**Read the output before shipping it.** Picking the "best" reply is a heuristic,
and an answer that was correct in the thread can still be wrong on a page.

## BET-Tools in Onyx

Two things, both of which need no credential anywhere.

**1. Answers in the panel.** Where the assistant does not know, it asks
BET-Tools and renders the answer inline with its sources. The request carries
`credentials: "include"`, so Onyx answers as the reader with their own
permissions — they see exactly what they are cleared to see.

**This needs one change on the Onyx deployment.** Cross-site cookies require an
explicit origin, and Onyx answers `Access-Control-Allow-Origin: *`, which the
fetch spec forbids sending credentials to:

```
CORS_ALLOWED_ORIGIN=https://mmin-sportradar.github.io   # an exact origin, not *
Access-Control-Allow-Credentials: true
```

Until that lands, every call is refused, the client latches itself unavailable
after one attempt, and the panel shows what it knows plus the link below.
Nothing is broken in the meantime — it simply does not gain the extra answer.

No API token is involved, deliberately. A shared one is impossible, because
`shared/**` is published to a public repository and a token belonging to the
team would be a token belonging to the internet. A per-reader token also worked
and was dropped: asking everybody to create one is not worth it.

**2. A link that carries the question.**

```
onyx.ai.sportradar.online/app?agentId=423&message=<the question>
```

Always available, needs nothing, and the reader arrives in their own Onyx
session. Shown whenever the panel cannot answer — including while the CORS
change is pending.

Endpoints were found by probing the deployment, since `/openapi.json` is
disabled there and Onyx renamed these after the Danswer fork: an
unauthenticated POST answers 403 where a route exists and 404 where it does not.
`POST /api/chat/create-chat-session` and `POST /api/chat/send-chat-message`
exist; the old `/api/chat/send-message` is gone.

## The crawlable digest

`scripts/build-digest.mjs` flattens every product, every flow step and every
hand-written answer into `/digest/`, generated on every publish. Point any
indexer at that URL — BET-Tools included — and it can read what this site knows.
No credential, no schedule, and it cannot go stale.

## Page feedback

The **Is this site helpful?** control asks for an optional comment after a
rating. Nothing is transmitted until you configure a sink in
`shared/feedback.js` — until then, ratings are queued in the reader's browser
and drain automatically once a sink is turned on.

Three sinks, configured in `shared/feedback.js`. **All three are off — nothing is
transmitted until you turn one on.** Ratings are held in the reader's browser
until then, and sent on the first load after a sink is configured.

| Sink | Setup | Works today? |
|------|-------|--------------|
| **Google Form** | `node scripts/set-feedback-form.mjs "<prefilled link>"` | **Yes** — the only one that does |
| **`endpoint`** | Needs the Cloudflare Pages deployment, then `SLACK_WEBHOOK_URL` on it | No — that deployment does not exist |
| **Slack webhook direct** | — | Never. `shared/**` publishes to a public repo, so the URL would be a live credential on the internet, and the build refuses it |

**Use the Google Form.** The site is served from GitHub Pages, which has no
server side, so a form post from the browser is the only route that reaches
anywhere. A leaked form URL just lets somebody add spreadsheet rows.

**`endpoint` is the better design and is fully built** — `functions/api/feedback.js`
keeps the webhook in the Worker environment, so nothing secret reaches the
browser, and being same-origin it is the only sink that can tell a delivery from
a rejection. It is dormant because the Cloudflare Pages project it runs on has
never been created: `.github/workflows/deploy-admin.yml` no-ops on every push
because its secrets are unset. Stand that deployment up and it needs one line in
`shared/feedback.js` to switch on.

To get Google Form feedback into Slack, connect the response Sheet to Slack at
the Google end (**Tools → Notification settings**, or a few lines of Apps
Script). The webhook then lives in Google's project, never in this repository.

Feedback is **not attributed** — the route has the signed-in person's verified
email and deliberately does not send it. The footer gives no hint that an answer
is signed, and a silently-attributed thumbs-down is a surprise nobody agreed to.

## Repository

Private repository: [mmin-sportradar/Internal-workflow](https://github.com/mmin-sportradar/Internal-workflow)
