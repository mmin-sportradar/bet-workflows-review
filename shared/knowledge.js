/* The assistant's knowledge base: the questions people actually ask about BET
   products, and the answers the team has already given.

   Classic script, no modules, same as catalog.js -- the whole site loads plain
   <script src> tags and this file is injected by chrome.js alongside them.

   TWO KINDS OF ENTRY live in here, and the difference is visible to the reader:

     source: "slack" -- a real thread. Carries a permalink, the person who
       answered and the date, and the assistant shows all three so the reader can
       go and read the original rather than trust a paraphrase.
     source: "site"  -- written here, from the workflows and the catalogue. No
       permalink, because there is no thread to link to, and the assistant
       labels it as site knowledge rather than dressing it up as a Slack answer.

   The seed set below is all `site`. Slack entries arrive by running

     node scripts/ingest-slack.mjs <export-dir>

   over a Slack export, which rewrites everything between the KNOWLEDGE markers
   and leaves the hand-written entries alone (they are keyed `site` and the
   script preserves them). Keep the two marker comments intact, exactly as
   catalog.js does for the admin, or the script will refuse to write rather than
   guess where the data begins.

   `asked` is what "Most asked" is sorted by. For a Slack entry the ingest sets
   it from how many separate threads asked the same thing; for a site entry it is
   a hand estimate, and the ranking is only ever a running order -- nothing else
   reads it. */

/* KNOWLEDGE:START */
const slackKnowledge = {
  "generatedAt": "2026-09-01",
  "source": "seed",
  "workspace": "sportradar",
  "channels": [
    {
      "name": "bet-widgets-support",
      "purpose": "Widget setup, licensing and integration questions."
    },
    {
      "name": "bet-integrations",
      "purpose": "BETI work: adapters, ID mapping, feed configuration."
    },
    {
      "name": "bet-client-setup",
      "purpose": "Client onboarding, service administration, provisioning."
    },
    {
      "name": "bet-api",
      "purpose": "Sports API, Probabilities API, Utility and Mapping API."
    },
    {
      "name": "bet-product",
      "purpose": "What a product does, what is coming, packaging questions."
    }
  ],
  "entries": [
    {
      "id": "site-which-flow",
      "question": "Which workflow do I need for my product?",
      "aliases": [
        "where do I start",
        "how do I find the right flow",
        "which diagram should I open",
        "I don't know which workflow to use"
      ],
      "answer": "Open the catalogue on the landing page and pick the product tile. Each tile lists only the routes that product actually has:\n\n- **Setup flow** — getting the product provisioned and configured for a client.\n- **Integration flow** — the technical work on the client side once setup is done.\n- **Process flow** — a standalone operational process, such as domain whitelisting.\n- **Widgets licensing** — the per-sport licensing route for Betting Widgets.\n\nEvery flow page then has a team switcher at the top. Pick your team and the diagram fades out every step somebody else owns, which is usually the fastest way to see whether a request is yours at all.",
      "product": null,
      "tags": [
        "getting-started",
        "navigation",
        "flows"
      ],
      "source": "site",
      "asked": 31,
      "links": [
        {
          "title": "BET Workflows catalogue",
          "href": "./"
        }
      ],
      "related": [
        "site-team-switcher",
        "site-flow-types"
      ]
    },
    {
      "id": "site-team-switcher",
      "question": "How do I see only the steps my team owns?",
      "aliases": [
        "team filter",
        "hide other teams",
        "which steps are mine",
        "filter the diagram by team"
      ],
      "answer": "Use the team switcher in the header of any flow page. Choosing a team fades every card owned by someone else, leaving your own path through the diagram at full contrast; **All teams** puts them back.\n\nYour choice is remembered in this browser and reapplied on every flow you open afterwards, so you only pick it once. If you want to see the first-run prompt again, add `?coach` to the page URL.\n\nOne naming note: BETI appears as *BETI* on most flows and as *Integrations* on the widget ones — they are the same team, and the switcher follows your choice across both. Customer Care, Client Setup, Support, AV, CS and MTS are genuinely different teams and are never merged.",
      "product": null,
      "tags": [
        "flows",
        "teams",
        "navigation"
      ],
      "source": "site",
      "asked": 27,
      "links": [],
      "related": [
        "site-which-flow"
      ]
    },
    {
      "id": "site-lmt-variants",
      "question": "What is the difference between LMT Plus, LMT Premium and LMT Virtualised?",
      "aliases": [
        "lmt premium vs plus",
        "which lmt do we sell",
        "lmt virtualised",
        "live match tracker versions"
      ],
      "answer": "They are three separate products in the catalogue, each with its own setup flow:\n\n- **LMT Plus** — the standard Live Match Tracker widget.\n- **LMT Premium** — the same tracker on a faster data path, for LMT and LMT Compact.\n- **LMT Virtualised** — the virtualised variant.\n\nThey share the LMT documentation but not the setup route, so start from the tile for the one the client bought rather than adapting another product's flow.",
      "product": "LMT Plus",
      "tags": [
        "lmt",
        "products",
        "setup"
      ],
      "source": "site",
      "asked": 24,
      "links": [
        {
          "title": "LMT Plus setup flow",
          "href": "workflows/lmt-setup-flow/"
        },
        {
          "title": "LMT Premium setup flow",
          "href": "workflows/lmt-premium-setup-flow/"
        },
        {
          "title": "LMT Virtualised setup flow",
          "href": "workflows/lmt-virtualised-setup-flow/"
        },
        {
          "title": "LMT documentation",
          "href": "https://apidocs.sportradar.com/resources/widgets/docs/lmt/lmt-plus"
        }
      ],
      "related": [
        "site-which-flow",
        "site-sr-packages"
      ]
    },
    {
      "id": "site-whitelisting",
      "question": "A client's widget shows a licensing error on a new domain. What do I do?",
      "aliases": [
        "whitelist a domain",
        "additional domains",
        "licensing error",
        "widget not loading on new site",
        "domain not licensed"
      ],
      "answer": "That is the additional-domains process, not a product setup. Every domain a widget is embedded on has to be whitelisted against the client's licence — a domain that was never added produces exactly this error, including for staging and preview hosts, which are the ones most often forgotten.\n\nOpen the **Additional domains** process flow for who raises the request and who approves it. The troubleshooting page covers reading the specific error the widget prints, which tells you whether the domain is genuinely missing or the licence itself has lapsed.",
      "product": "Additional domains",
      "tags": [
        "licensing",
        "troubleshooting",
        "operations",
        "domains"
      ],
      "source": "site",
      "asked": 22,
      "links": [
        {
          "title": "Additional domains whitelisting flow",
          "href": "workflows/additional-domains-whitelisting-flow/"
        },
        {
          "title": "Licensing errors — troubleshooting",
          "href": "https://apidocs.sportradar.com/resources/widgets/docs/tutorials/troubleshooting/licensing-errors"
        },
        {
          "title": "Whitelisting process (Confluence)",
          "href": "https://sportradar.atlassian.net/wiki/spaces/SCS/pages/120040517/Whitelisting+process+for+BET+widgets"
        }
      ],
      "related": [
        "site-which-flow"
      ]
    },
    {
      "id": "site-sr-packages",
      "question": "Why does SR Packages have a different flow for each sport?",
      "aliases": [
        "sr packages golf",
        "combat sports flow",
        "esports package",
        "sport specific setup"
      ],
      "answer": "Because the setup genuinely differs per sport. SR Packages is listed once in the catalogue, and opening it shows the sports first — Golf, Combat Sports, and E-Sports/E-League — each with its own setup and integration flow behind it.\n\nPick the sport and the dialog replaces the list with that sport's routes, so you only ever see the one you asked for. Everything else in the catalogue behaves the way it always has and goes straight to its flow.",
      "product": "SR Packages",
      "tags": [
        "sr-packages",
        "products",
        "setup",
        "sports"
      ],
      "source": "site",
      "asked": 16,
      "links": [
        {
          "title": "Golf setup flow",
          "href": "workflows/sr-packages-golf-setup-flow/"
        },
        {
          "title": "Combat Sports setup flow",
          "href": "workflows/sr-packages-combat-sports-setup-flow/"
        },
        {
          "title": "E-Sports/E-League setup flow",
          "href": "workflows/sr-packages-e-sports-setup-flow/"
        }
      ],
      "related": [
        "site-lmt-variants",
        "site-which-flow"
      ]
    },
    {
      "id": "site-flow-types",
      "question": "What is the difference between a setup flow and an integration flow?",
      "aliases": [
        "setup vs integration",
        "when does integration start",
        "what is a process flow"
      ],
      "answer": "**Setup** is everything that has to be true before the client can use the product: the commercial and provisioning path, service administration, product selection, licensing, and finalisation. It is mostly Sales, Client Setup and Customer Care.\n\n**Integration** is the technical work once that is done: adapters, ID mapping, configuration and the client's own implementation. It is mostly BETI and the client's engineers.\n\nA product with both listed has them as separate diagrams because they run at different times and involve different people. A product with only a setup flow either has no integration work worth diagramming, or it has not been drawn yet.",
      "product": null,
      "tags": [
        "flows",
        "getting-started",
        "teams"
      ],
      "source": "site",
      "asked": 14,
      "links": [],
      "related": [
        "site-which-flow",
        "site-team-switcher"
      ]
    },
    {
      "id": "site-docs-vs-confluence",
      "question": "Where is the documentation for a product?",
      "aliases": [
        "confluence page",
        "apidocs link",
        "technical documentation",
        "product hub"
      ],
      "answer": "Each product tile carries its own links, and there are usually two:\n\n- **Technical documentation** on apidocs.sportradar.com — how the thing works and how to call it. This is what you send a client's engineer.\n- **Confluence** on sportradar.atlassian.net — the internal page: ownership, commercial detail, and the history of the product. This one is for us.\n\nThe **Product Hub** tile under Operations is the central catalogue of everything Sportradar sells, which is the right place to start when the question is commercial rather than technical.",
      "product": null,
      "tags": [
        "documentation",
        "navigation",
        "getting-started"
      ],
      "source": "site",
      "asked": 12,
      "links": [
        {
          "title": "Product Hub",
          "href": "https://product-hub.sportradar.com/en/home"
        }
      ],
      "related": [
        "site-which-flow"
      ]
    },
    {
      "id": "site-api-utility-mapping",
      "question": "What are the Utility and Mapping APIs for?",
      "aliases": [
        "bet utility api",
        "api mapping",
        "coverage api",
        "id mapping api"
      ],
      "answer": "They are the two supporting APIs around the BET products rather than products a client buys on their own:\n\n- **Utility API** — coverage and availability questions: what a widget can show for a given match.\n- **Mapping API** — reconciling the client's own match and competitor IDs against Sportradar's.\n\nMapping is the one that turns up mid-integration, when a client's IDs do not line up with ours. The client setup flow covers who provisions access.",
      "product": "API Utility / API Mapping",
      "tags": [
        "api",
        "integration",
        "mapping"
      ],
      "source": "site",
      "asked": 11,
      "links": [
        {
          "title": "API Utility / Mapping setup flow",
          "href": "workflows/api-utility-mapping-setup-flow/"
        },
        {
          "title": "Utility API documentation",
          "href": "https://docs.sportradar.com/engagement-tools/readme/widgets/bet-utility-api#coverage-api"
        },
        {
          "title": "Client setup flow (Confluence)",
          "href": "https://sportradar.atlassian.net/wiki/spaces/LSS/pages/376385470/Utility+and+Mapping+API+-+Client+Setup+Flow"
        }
      ],
      "related": [
        "site-flow-types"
      ]
    },
    {
      "id": "site-page-stale",
      "question": "How do I know a workflow page is still current?",
      "aliases": [
        "last updated",
        "is this page out of date",
        "when was this changed",
        "stale page"
      ],
      "answer": "Every flow page carries a **Last updated** stamp in its footer, shown as how long ago it changed — hover it for the exact date. The landing page has no stamp of its own because it is generated from the catalogue.\n\nIf a diagram disagrees with what actually happens, that is worth saying rather than working around: the flows are edited through the content admin and a correction is a small change.",
      "product": null,
      "tags": [
        "navigation",
        "content",
        "getting-started"
      ],
      "source": "site",
      "asked": 8,
      "links": [],
      "related": [
        "site-which-flow"
      ]
    },
    {
      "id": "site-bet-insights-ppz",
      "question": "Are Bet Insights and Player Prop Zone the same thing?",
      "aliases": [
        "player prop zone",
        "ppz",
        "bet insights rename"
      ],
      "answer": "They are two tiles that currently share one setup flow. Player Prop Zone used to sit inside Bet Insights and is now listed as a product in its own right, but the provisioning path is the same diagram, so both tiles open it.\n\nThe documentation is separate: Bet Insights and Player Prop Zone each have their own apidocs page and their own Confluence page, and those are the links to send on.",
      "product": "Bet Insights",
      "tags": [
        "bet-insights",
        "products",
        "setup"
      ],
      "source": "site",
      "asked": 7,
      "links": [
        {
          "title": "Bet Insights / Player Prop Zone setup flow",
          "href": "workflows/bet-insights-player-prop-zone-setup-flow/"
        },
        {
          "title": "Bet Insights documentation",
          "href": "https://apidocs.sportradar.com/resources/widgets/docs/bet-insights/bet-insights"
        },
        {
          "title": "Player Prop Zone documentation",
          "href": "https://apidocs.sportradar.com/resources/widgets/docs/widgets/match/player-prop-zone"
        }
      ],
      "related": [
        "site-which-flow"
      ]
    },
    {
      "id": "thread-hsa-slowness-acknowledged-can-defer",
      "question": "HSA slowness acknowledged; can defer",
      "aliases": [],
      "summary": "HSA is extremely slow and crashing while provisioning work is in progress.",
      "answer": "Team acknowledged HSA instability and agreed the remaining work can wait until tomorrow.\n\n**What was asked:** HSA is extremely slow and crashing while provisioning work is in progress.",
      "product": null,
      "entities": [],
      "tags": [
        "admin-tool-operations"
      ],
      "source": "thread",
      "topic": "Admin Tool operations",
      "date": "2026-03-24",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-virtualised-lmt-requires-lmt-plus-basketball",
      "question": "Virtualised LMT requires LMT Plus Basketball",
      "aliases": [],
      "summary": "Integration request checked; client wanted Virtualised LMT activated but prerequisite widgets were missing.",
      "answer": "Client must have LMT Plus for Basketball enabled before Virtualised LMT can be activated; colleague will submit the widget request.\n\n**What was asked:** Integration request checked; client wanted Virtualised LMT activated but prerequisite widgets were missing.",
      "product": "LMT Plus",
      "entities": [
        "LMT Plus"
      ],
      "tags": [
        "admin-tool-operations"
      ],
      "source": "thread",
      "topic": "Admin Tool operations",
      "date": "2026-04-23",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-whitelist-automation-trigger-wording",
      "question": "Whitelist automation trigger wording",
      "aliases": [],
      "summary": "Whitelisting Jira ticket did not auto-trigger; question whether exact phrasing is also needed in Slack.",
      "answer": "Automation requires phrase whitelist the following domain in the Jira ticket only; team will investigate why trigger failed.\n\n**What was asked:** Whitelisting Jira ticket did not auto-trigger; question whether exact phrasing is also needed in Slack.",
      "product": null,
      "entities": [],
      "tags": [
        "admin-tool-operations"
      ],
      "source": "thread",
      "topic": "Admin Tool operations",
      "date": "2026-05-25",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-store-migration-completed-and-login-issue-resolved",
      "question": "Store migration completed and login issue resolved",
      "aliases": [],
      "summary": "Store upgrade caused downtime; after migration some CS users could not log in to the new Store and did not receive password-reset emails.",
      "answer": "Store migration completed; users must use the new Admin Tool link, and the affected user's login issue was resolved.\n\n**What was asked:** Store upgrade caused downtime; after migration some CS users could not log in to the new Store and did not receive password-reset emails.",
      "product": null,
      "entities": [],
      "tags": [
        "admin-tool-operations"
      ],
      "source": "thread",
      "topic": "Admin Tool operations",
      "date": "2026-06-08",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-store-save-failure-fixed-for-orders-with-many-domains",
      "question": "Store save failure fixed for orders with many domains",
      "aliases": [],
      "summary": "Store whitelisting failed when saving orders containing a very large number of domains.",
      "answer": "Issue resolved by increasing the domain limit; the specific domain was successfully added and should work as expected.\n\n**What was asked:** Store whitelisting failed when saving orders containing a very large number of domains.",
      "product": null,
      "entities": [],
      "tags": [
        "admin-tool-operations"
      ],
      "source": "thread",
      "topic": "Admin Tool operations",
      "date": "2026-06-13",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-storeadmin-temporary-productive-data-equivalent",
      "question": "StoreAdmin temporary productive data equivalent",
      "aliases": [],
      "summary": "Asked what the StoreAdmin equivalent of Temporary Productive Data is for Store products.",
      "answer": "Store products have no integration/production environment; subscribed status requires SFIVOICE or signed contract.\n\n**What was asked:** Asked what the StoreAdmin equivalent of Temporary Productive Data is for Store products.",
      "product": null,
      "entities": [],
      "tags": [
        "admin-tool-operations"
      ],
      "source": "thread",
      "topic": "Admin Tool operations",
      "date": "2026-06-26",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-coverage-api-works-mapping-api-not-provisioned",
      "question": "Coverage API works; mapping API not provisioned",
      "aliases": [],
      "summary": "Clarify whether coverage and mapping utility APIs share one key, test the client key, and check if mapping API access has been requested.",
      "answer": "Same API key is used for both APIs when enabled; coverage API works with the provided key; mapping API was never requested and must be requested via Salesforce.\n\n**What was asked:** Clarify whether coverage and mapping utility APIs share one key, test the client key, and check if mapping API access has been requested.",
      "product": null,
      "entities": [],
      "tags": [
        "api-authentication-and-access"
      ],
      "source": "thread",
      "topic": "API authentication and access",
      "date": "2026-03-17",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-statshub-whitelist-handoff-to-beti",
      "question": "Statshub whitelist handoff to BETI",
      "aliases": [],
      "summary": "Sales requested Statshub domain whitelisting for two aliases; support asked whether BET Integrations would handle the existing escalations.",
      "answer": "BET Integrations will handle the whitelist requests; support tickets can be closed.\n\n**What was asked:** Sales requested Statshub domain whitelisting for two aliases; support asked whether BET Integrations would handle the existing escalations.",
      "product": "StatsHub",
      "entities": [
        "StatsHub"
      ],
      "tags": [
        "api-authentication-and-access"
      ],
      "source": "thread",
      "topic": "API authentication and access",
      "date": "2026-03-27",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-requested-domains-already-whitelisted",
      "question": "Requested domains already whitelisted",
      "aliases": [],
      "summary": "Check whether listed client domains are already whitelisted for Statshub access.",
      "answer": "The requested domains were already whitelisted.\n\n**What was asked:** Check whether listed client domains are already whitelisted for Statshub access.",
      "product": "StatsHub",
      "entities": [
        "StatsHub"
      ],
      "tags": [
        "api-authentication-and-access"
      ],
      "source": "thread",
      "topic": "API authentication and access",
      "date": "2026-04-17",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-dev-localhost-whitelist-deployed",
      "question": "Dev localhost whitelist deployed",
      "aliases": [],
      "summary": "Client dev environment without a domain asked about whitelisting an IP address and localhost for Statshub testing.",
      "answer": "Localhost dev whitelist added and deployed to production; initial production whitelist already in place.\n\n**What was asked:** Client dev environment without a domain asked about whitelisting an IP address and localhost for Statshub testing.",
      "product": "StatsHub",
      "entities": [
        "StatsHub"
      ],
      "tags": [
        "api-authentication-and-access"
      ],
      "source": "thread",
      "topic": "API authentication and access",
      "date": "2026-04-17",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-statshub-integration-env-whitelisted",
      "question": "Statshub integration env whitelisted",
      "aliases": [],
      "summary": "Asked whether Statshub requires domain whitelisting in the integration environment.",
      "answer": "Integration environment domains were whitelisted; client asked to verify access.\n\n**What was asked:** Asked whether Statshub requires domain whitelisting in the integration environment.",
      "product": "StatsHub",
      "entities": [
        "StatsHub"
      ],
      "tags": [
        "api-authentication-and-access"
      ],
      "source": "thread",
      "topic": "API authentication and access",
      "date": "2026-04-20",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-betting-terminal-domain-whitelisted",
      "question": "Betting terminal domain whitelisted",
      "aliases": [],
      "summary": "Client requested domain whitelisting for betting terminals; colleague asked if a CSCS Jira ticket was needed.",
      "answer": "Domain whitelisted without Jira ticket; client asked to confirm functionality.\n\n**What was asked:** Client requested domain whitelisting for betting terminals; colleague asked if a CSCS Jira ticket was needed.",
      "product": null,
      "entities": [],
      "tags": [
        "api-authentication-and-access"
      ],
      "source": "thread",
      "topic": "API authentication and access",
      "date": "2026-05-06",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-bet-api-mapping-not-provisioned-for-utility-only-client",
      "question": "BET API Mapping not provisioned for utility-only client",
      "aliases": [],
      "summary": "Support asked whether a mapping ID is provided with the utility API or if the client ID alone is sufficient.",
      "answer": "Only BET API Utility was requested; BET API Mapping is not yet set up and must be requested by sales via Salesforce before use.\n\n**What was asked:** Support asked whether a mapping ID is provided with the utility API or if the client ID alone is sufficient.",
      "product": null,
      "entities": [],
      "tags": [
        "api-authentication-and-access"
      ],
      "source": "thread",
      "topic": "API authentication and access",
      "date": "2026-06-08",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-bet-api-has-no-domain-whitelisting",
      "question": "BET API has no domain whitelisting",
      "aliases": [],
      "summary": "Internal note clarifying whether BET API uses domain whitelisting like widgets.",
      "answer": "BET API does not have domain whitelisting.\n\n**What was asked:** Internal note clarifying whether BET API uses domain whitelisting like widgets.",
      "product": null,
      "entities": [],
      "tags": [
        "api-authentication-and-access"
      ],
      "source": "thread",
      "topic": "API authentication and access",
      "date": "2026-06-26",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-domain-whitelisting-across-active-orders",
      "question": "Domain whitelisting across active orders",
      "aliases": [],
      "summary": "CS asked whether domain whitelisting on a terminated Jira order still applies when the customer has other active orders.",
      "answer": "Domains added to one active order apply across all active orders for the customer; whitelisting does not require the specific terminated order to remain active.\n\n**What was asked:** CS asked whether domain whitelisting on a terminated Jira order still applies when the customer has other active orders.",
      "product": null,
      "entities": [],
      "tags": [
        "client-and-provider-integrations"
      ],
      "source": "thread",
      "topic": "Client and provider integrations",
      "date": "2026-02-19",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-dual-platform-lmt-and-statshub-migration",
      "question": "Dual-platform LMT and StatsHub migration",
      "aliases": [],
      "summary": "Client migrating between platform providers needs LMT and StatsHub active on both platforms simultaneously during transition.",
      "answer": "No additional restrictions; all domains from both platforms must be whitelisted.\n\n**What was asked:** Client migrating between platform providers needs LMT and StatsHub active on both platforms simultaneously during transition.",
      "product": "StatsHub",
      "entities": [
        "StatsHub"
      ],
      "tags": [
        "client-and-provider-integrations"
      ],
      "source": "thread",
      "topic": "Client and provider integrations",
      "date": "2026-02-20",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-ip-whitelisting-procedure",
      "question": "IP whitelisting procedure",
      "aliases": [],
      "summary": "CS team asked whether IP whitelisting follows a different procedure than domain whitelisting and whether IP access is broader than URL-level access.",
      "answer": "IP whitelisting uses the same procedure as domain whitelisting; whitelisting an IP grants access to everything hosted on that IP.\n\n**What was asked:** CS team asked whether IP whitelisting follows a different procedure than domain whitelisting and whether IP access is broader than URL-level access.",
      "product": null,
      "entities": [],
      "tags": [
        "client-and-provider-integrations"
      ],
      "source": "thread",
      "topic": "Client and provider integrations",
      "date": "2026-02-23",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-lmt-domains-added-to-client-id",
      "question": "LMT domains added to client ID",
      "aliases": [],
      "summary": "Ticket requested domain whitelisting; domains were in Statshub solution but not on the LMT client ID.",
      "answer": "Domains added to the client ID for LMT; future similar requests should go through BETI Jira.\n\n**What was asked:** Ticket requested domain whitelisting; domains were in Statshub solution but not on the LMT client ID.",
      "product": "StatsHub",
      "entities": [
        "StatsHub"
      ],
      "tags": [
        "client-and-provider-integrations"
      ],
      "source": "thread",
      "topic": "Client and provider integrations",
      "date": "2026-02-26",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-lmt-dev-stage-prod-domains-whitelisted",
      "question": "LMT dev/stage/prod domains whitelisted",
      "aliases": [],
      "summary": "Client needed LMT domains whitelisted for dev, stage, preview, and prod environments after Jira tickets had no reply.",
      "answer": "Whitelisting request completed; future requests should go through bet-integrations channel.\n\n**What was asked:** Client needed LMT domains whitelisted for dev, stage, preview, and prod environments after Jira tickets had no reply.",
      "product": null,
      "entities": [],
      "tags": [
        "client-and-provider-integrations"
      ],
      "source": "thread",
      "topic": "Client and provider integrations",
      "date": "2026-03-11",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-sportradar-mcp-not-bet-owned",
      "question": "Sportradar MCP not BET-owned",
      "aliases": [],
      "summary": "Ticket asked whether BET enterprise owns or supports the Sportradar MCP server integration for betting clients.",
      "answer": "MCP server support is not in BET domain; ticket should be handled by sports media colleagues or related product teams.\n\n**What was asked:** Ticket asked whether BET enterprise owns or supports the Sportradar MCP server integration for betting clients.",
      "product": null,
      "entities": [],
      "tags": [
        "client-and-provider-integrations"
      ],
      "source": "thread",
      "topic": "Client and provider integrations",
      "date": "2026-04-10",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-bet-utility-api-isa-package-impact",
      "question": "BET Utility API ISA package impact",
      "aliases": [],
      "summary": "Support asked whether the BET Utility API package in ISA has any technical impact on service use.",
      "answer": "No technical impact in ISA; setup process documented and case should be handed to BETI for setup.\n\n**What was asked:** Support asked whether the BET Utility API package in ISA has any technical impact on service use.",
      "product": null,
      "entities": [],
      "tags": [
        "client-and-provider-integrations"
      ],
      "source": "thread",
      "topic": "Client and provider integrations",
      "date": "2026-05-06",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-domain-whitelisting-routed-to-client-setup-automatically",
      "question": "Domain whitelisting routed to Client Setup automatically",
      "aliases": [],
      "summary": "Integration asked BETI to review a domain whitelisting ticket.",
      "answer": "Whitelisting requests are automatically sent to the Client Setup team; the requester will be notified in the ticket once completed.\n\n**What was asked:** Integration asked BETI to review a domain whitelisting ticket.",
      "product": null,
      "entities": [],
      "tags": [
        "client-and-provider-integrations"
      ],
      "source": "thread",
      "topic": "Client and provider integrations",
      "date": "2026-06-03",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-domain-whitelisting-ticket-already-completed",
      "question": "Domain whitelisting ticket already completed",
      "aliases": [],
      "summary": "Support requested assistance with a domain whitelisting request.",
      "answer": "Whitelisting requests route automatically to Client Setup, and the referenced ticket had already been completed.\n\n**What was asked:** Support requested assistance with a domain whitelisting request.",
      "product": null,
      "entities": [],
      "tags": [
        "client-and-provider-integrations"
      ],
      "source": "thread",
      "topic": "Client and provider integrations",
      "date": "2026-06-03",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-statshub-domain-whitelisting-escalation-completed",
      "question": "StatsHub domain whitelisting escalation completed",
      "aliases": [],
      "summary": "Support asked BET to review a StatsHub domain whitelisting request.",
      "answer": "Escalation has been completed.\n\n**What was asked:** Support asked BET to review a StatsHub domain whitelisting request.",
      "product": "StatsHub",
      "entities": [
        "StatsHub"
      ],
      "tags": [
        "client-and-provider-integrations"
      ],
      "source": "thread",
      "topic": "Client and provider integrations",
      "date": "2026-06-08",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-statshub-whitelisting-corrected-to-actual-service-domain",
      "question": "StatsHub whitelisting corrected to actual service domain",
      "aliases": [],
      "summary": "A StatsHub whitelisting escalation used the wrong solution domains; the client's actual service domain differed from the initially confirmed ones.",
      "answer": "BETI updated the whitelisting to the correct service domain and reran the production pipeline; the client confirmed resolution.\n\n**What was asked:** A StatsHub whitelisting escalation used the wrong solution domains; the client's actual service domain differed from the initially confirmed ones.",
      "product": "StatsHub",
      "entities": [
        "StatsHub"
      ],
      "tags": [
        "client-and-provider-integrations"
      ],
      "source": "thread",
      "topic": "Client and provider integrations",
      "date": "2026-06-10",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-bulk-domain-whitelisting-completed-for-client-id",
      "question": "Bulk domain whitelisting completed for client ID",
      "aliases": [],
      "summary": "CS asked how to whitelist many domains from a sheet quickly and whether whitelisting must be done on one order ID or all.",
      "answer": "BETI completed bulk whitelisting; domains are tied to the client ID rather than a specific order, and a comment with hyperlink on one order is sufficient.\n\n**What was asked:** CS asked how to whitelist many domains from a sheet quickly and whether whitelisting must be done on one order ID or all.",
      "product": null,
      "entities": [],
      "tags": [
        "client-and-provider-integrations"
      ],
      "source": "thread",
      "topic": "Client and provider integrations",
      "date": "2026-06-18",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-bet-assist-content-availability-check",
      "question": "Bet Assist content availability check",
      "aliases": [],
      "summary": "Client wants REST API or pattern to check Bet Assist content exists for matchId+market before showing icon in native apps.",
      "answer": "No pre-check API; web should use silent:true or onTrack callback; native should consult BET Support Mobile team.\n\n**What was asked:** Client wants REST API or pattern to check Bet Assist content exists for matchId+market before showing icon in native apps.",
      "product": "Bet Assist",
      "entities": [
        "Bet Assist"
      ],
      "tags": [
        "client-and-provider-integrations"
      ],
      "source": "thread",
      "topic": "Client and provider integrations",
      "date": "2026-07-21",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-mma-widgets-not-currently-supported",
      "question": "MMA widgets not currently supported",
      "aliases": [],
      "summary": "Client asked about MMA event widgets and unfamiliar documentation.",
      "answer": "MMA widgets are not available today; work is in progress but not yet supported.\n\n**What was asked:** Client asked about MMA event widgets and unfamiliar documentation.",
      "product": null,
      "entities": [],
      "tags": [
        "data-feeds-and-event-coverage"
      ],
      "source": "thread",
      "topic": "Data feeds and event coverage",
      "date": "2026-03-26",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-sourcejoin-api-missing-two-match-mappings",
      "question": "SourceJoin API missing two match mappings",
      "aliases": [],
      "summary": "Client reported two matches missing from the SourceJoin API mapping; support asked whether Sportradar offers these events.",
      "answer": "Events are available on the demo page and supported in widgets; a Jira ticket should be created and assigned for further investigation of the statistics data.\n\n**What was asked:** Client reported two matches missing from the SourceJoin API mapping; support asked whether Sportradar offers these events.",
      "product": null,
      "entities": [],
      "tags": [
        "data-feeds-and-event-coverage"
      ],
      "source": "thread",
      "topic": "Data feeds and event coverage",
      "date": "2026-06-01",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-lmt-unavailable-for-srl-events",
      "question": "LMT unavailable for SRL events",
      "aliases": [],
      "summary": "Client sees no Live Tracker for SRL events; asked if whitelisting or expired packages cause.",
      "answer": "Reproducible on demo page; report to Bet support.\n\n**What was asked:** Client sees no Live Tracker for SRL events; asked if whitelisting or expired packages cause.",
      "product": null,
      "entities": [],
      "tags": [
        "data-feeds-and-event-coverage"
      ],
      "source": "thread",
      "topic": "Data feeds and event coverage",
      "date": "2026-07-15",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-lmt-504-gateway-timeout-on-load",
      "question": "LMT 504 gateway timeout on load",
      "aliases": [],
      "summary": "Client LMT showed intermittent 'Something went wrong' errors on Table Tennis with 504 gateway timeout during widget configuration load.",
      "answer": "Create CSCS ticket assigned to Bet Support for investigation of 504 timeout during startup.\n\n**What was asked:** Client LMT showed intermittent 'Something went wrong' errors on Table Tennis with 504 gateway timeout during widget configuration load.",
      "product": null,
      "entities": [],
      "tags": [
        "monitoring-and-incidents"
      ],
      "source": "thread",
      "topic": "Monitoring and incidents",
      "date": "2026-06-26",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-developer-portal-user-management",
      "question": "Developer portal user management",
      "aliases": [],
      "summary": "CS asked bet integrations to handle a developer portal user add/remove request linked to a BETI ticket.",
      "answer": "Route to first-level support, which can add or remove developer portal users or advise on the process.\n\n**What was asked:** CS asked bet integrations to handle a developer portal user add/remove request linked to a BETI ticket.",
      "product": null,
      "entities": [],
      "tags": [
        "permissions-and-roles"
      ],
      "source": "thread",
      "topic": "Permissions and roles",
      "date": "2026-03-05",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-hsa-login-via-portal-password",
      "question": "HSA login via portal password",
      "aliases": [],
      "summary": "Colleague could not log in to HSA and asked how to regain access for alias/BMID management.",
      "answer": "Access restored using the portal password (not HSA-specific forgot-password flow).\n\n**What was asked:** Colleague could not log in to HSA and asked how to regain access for alias/BMID management.",
      "product": null,
      "entities": [],
      "tags": [
        "permissions-and-roles"
      ],
      "source": "thread",
      "topic": "Permissions and roles",
      "date": "2026-07-31",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-lmt-tennis-license-activated",
      "question": "LMT Tennis license activated",
      "aliases": [],
      "summary": "Client lacked LMT license for Tennis; sales needed to request activation.",
      "answer": "Sales submitted the request and Tennis LMT license was activated.\n\n**What was asked:** Client lacked LMT license for Tennis; sales needed to request activation.",
      "product": null,
      "entities": [],
      "tags": [
        "ticket-setup-and-provisioning"
      ],
      "source": "thread",
      "topic": "Ticket setup and provisioning",
      "date": "2026-02-24",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-scoreboard-license-gap-for-tennis-lmt",
      "question": "Scoreboard license gap for tennis LMT",
      "aliases": [],
      "summary": "Client reported issues with Tennis ATP/WTA and scoreboard; licensing error displayed.",
      "answer": "LMT Plus and LMT Compact widgets are working; client does not have a Scoreboard license, which explains the scoreboard gap.\n\n**What was asked:** Client reported issues with Tennis ATP/WTA and scoreboard; licensing error displayed.",
      "product": null,
      "entities": [],
      "tags": [
        "ticket-setup-and-provisioning"
      ],
      "source": "thread",
      "topic": "Ticket setup and provisioning",
      "date": "2026-02-24",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-h2h-services-already-prolonged",
      "question": "H2H services already prolonged",
      "aliases": [],
      "summary": "Client lost H2H services and requests urgent prolongation.",
      "answer": "Services were already prolonged; requester confirmed that is acceptable.\n\n**What was asked:** Client lost H2H services and requests urgent prolongation.",
      "product": "H2H",
      "entities": [
        "H2H"
      ],
      "tags": [
        "ticket-setup-and-provisioning"
      ],
      "source": "thread",
      "topic": "Ticket setup and provisioning",
      "date": "2026-03-26",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-statshub-activation-after-s5-switch",
      "question": "StatsHub activation after S5 switch",
      "aliases": [],
      "summary": "StatsHub package active in HSA but technical activation expired in ISA after S5-to-StatsHub migration; client statistics stopped working due to contract switch error.",
      "answer": "StatsHub technical activation restored; contract switch mistakenly ended StatsHub on old contract without adding it to the new one.\n\n**What was asked:** StatsHub package active in HSA but technical activation expired in ISA after S5-to-StatsHub migration; client statistics stopped working due to contract switch error.",
      "product": "StatsHub",
      "entities": [
        "StatsHub"
      ],
      "tags": [
        "ticket-setup-and-provisioning"
      ],
      "source": "thread",
      "topic": "Ticket setup and provisioning",
      "date": "2026-05-18",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-tournament-preview-widget-license",
      "question": "Tournament Preview Widget license",
      "aliases": [],
      "summary": "Sales-confirmed request to add Tournament Preview Widget license; trial created then expired again.",
      "answer": "Sales must request widget via Salesforce BETI ticket for license grant; trial was created and later requires sales prolongation request.\n\n**What was asked:** Sales-confirmed request to add Tournament Preview Widget license; trial created then expired again.",
      "product": "Tournament Preview",
      "entities": [
        "Tournament Preview"
      ],
      "tags": [
        "ticket-setup-and-provisioning"
      ],
      "source": "thread",
      "topic": "Ticket setup and provisioning",
      "date": "2026-05-20",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-widget-activation-requires-salesforce-request-first",
      "question": "Widget activation requires Salesforce request first",
      "aliases": [],
      "summary": "CS asked whether a widget-related item should be handled by BET; BETI confirmed sales must request widgets via Salesforce before a BETI ticket is created and widgets are activated.",
      "answer": "Sales must submit the widget request through Salesforce; BETI then receives a BETI ticket and activates the widgets.\n\n**What was asked:** CS asked whether a widget-related item should be handled by BET; BETI confirmed sales must request widgets via Salesforce before a BETI ticket is created and widgets are activated.",
      "product": null,
      "entities": [],
      "tags": [
        "ticket-setup-and-provisioning"
      ],
      "source": "thread",
      "topic": "Ticket setup and provisioning",
      "date": "2026-06-01",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-soccer-lmt-virtualised-trial-request-completed",
      "question": "Soccer LMT Virtualised trial request completed",
      "aliases": [],
      "summary": "Client wanted to start testing Soccer LMT Virtualised the same day and asked BETI to pick up the ticket.",
      "answer": "Request completed.\n\n**What was asked:** Client wanted to start testing Soccer LMT Virtualised the same day and asked BETI to pick up the ticket.",
      "product": "LMT Virtualised",
      "entities": [
        "LMT Virtualised"
      ],
      "tags": [
        "ticket-setup-and-provisioning"
      ],
      "source": "thread",
      "topic": "Ticket setup and provisioning",
      "date": "2026-06-03",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-custom-bet-front-end-widget-trial-to-be-enabled-by-beti",
      "question": "Custom Bet front-end widget trial to be enabled by BETI",
      "aliases": [],
      "summary": "Custom Bet package trials were added, but sales also requested a front-end widget trial.",
      "answer": "BETI will enable the front-end widget in scope of the referenced ticket; status can be tracked there.\n\n**What was asked:** Custom Bet package trials were added, but sales also requested a front-end widget trial.",
      "product": "Custom Bet",
      "entities": [
        "Custom Bet"
      ],
      "tags": [
        "ticket-setup-and-provisioning"
      ],
      "source": "thread",
      "topic": "Ticket setup and provisioning",
      "date": "2026-06-08",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-premium-golf-lmt-ticket-cloned-and-assigned-to-beti",
      "question": "Premium Golf LMT ticket cloned and assigned to BETI",
      "aliases": [],
      "summary": "CS received an LMT-only Jira for Premium Golf and asked whether to clone and move it to BETI for enablement.",
      "answer": "CS cloned the ticket, assigned it to BETI, and BETI will enable Premium Golf LMT.\n\n**What was asked:** CS received an LMT-only Jira for Premium Golf and asked whether to clone and move it to BETI for enablement.",
      "product": null,
      "entities": [],
      "tags": [
        "ticket-setup-and-provisioning"
      ],
      "source": "thread",
      "topic": "Ticket setup and provisioning",
      "date": "2026-06-09",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-expired-momentum-widget-license-caused-display-issue",
      "question": "Expired momentum widget license caused display issue",
      "aliases": [],
      "summary": "Client reported expired statistics widget license; support wondered whether missing production-domain tick was the cause.",
      "answer": "The issue is the momentum widget, which expired on the stated date; sales should prolong it via the store prolongation process.\n\n**What was asked:** Client reported expired statistics widget license; support wondered whether missing production-domain tick was the cause.",
      "product": null,
      "entities": [],
      "tags": [
        "ticket-setup-and-provisioning"
      ],
      "source": "thread",
      "topic": "Ticket setup and provisioning",
      "date": "2026-06-09",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-beti-trials-prolonged-betting-tickets-out-of-scope",
      "question": "BETI trials prolonged; Betting tickets out of scope",
      "aliases": [],
      "summary": "Integration asked BETI to prolong several trials.",
      "answer": "BETI tickets were prolonged, but BETI cannot assist with Betting tickets.\n\n**What was asked:** Integration asked BETI to prolong several trials.",
      "product": null,
      "entities": [],
      "tags": [
        "ticket-setup-and-provisioning"
      ],
      "source": "thread",
      "topic": "Ticket setup and provisioning",
      "date": "2026-06-10",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-client-trial-staging-link-ready-for-review",
      "question": "Client trial staging link ready for review",
      "aliases": [],
      "summary": "Integration asked BETI to pick up a pending client trial activation ticket.",
      "answer": "Ticket was assigned for review; staging link is ready in the ticket, with new service creation potentially taking up to 14 business days.\n\n**What was asked:** Integration asked BETI to pick up a pending client trial activation ticket.",
      "product": null,
      "entities": [],
      "tags": [
        "ticket-setup-and-provisioning"
      ],
      "source": "thread",
      "topic": "Ticket setup and provisioning",
      "date": "2026-06-15",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-golf-lmt-premium-package-required",
      "question": "Golf LMT Premium package required",
      "aliases": [],
      "summary": "Client has Golf packages but not Premium Golf; asked if LMT Golf activation relates to Premium.",
      "answer": "LMT Golf requires Premium package; Sales must submit Salesforce activation request.\n\n**What was asked:** Client has Golf packages but not Premium Golf; asked if LMT Golf activation relates to Premium.",
      "product": "LMT Premium",
      "entities": [
        "LMT Premium"
      ],
      "tags": [
        "ticket-setup-and-provisioning"
      ],
      "source": "thread",
      "topic": "Ticket setup and provisioning",
      "date": "2026-07-13",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-lmt-404-after-client-id-assignment",
      "question": "LMT 404 after client ID assignment",
      "aliases": [],
      "summary": "Client integrating LMT got 404 after receiving a client ID; worked on localhost without ID; domains not yet whitelisted and service had expired.",
      "answer": "Service was expired and needed prolongation; domains were not registered and service not activated; client must regenerate integration script from the demo page because their widget loader implementation is incorrect.\n\n**What was asked:** Client integrating LMT got 404 after receiving a client ID; worked on localhost without ID; domains not yet whitelisted and service had expired.",
      "product": null,
      "entities": [],
      "tags": [
        "widgets-and-ui-embedding"
      ],
      "source": "thread",
      "topic": "Widgets and UI embedding",
      "date": "2026-02-22",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-statshub-integration-approach",
      "question": "StatsHub integration approach",
      "aliases": [],
      "summary": "Support asked for documentation on integrating StatsHub into client applications.",
      "answer": "No separate integration docs; StatsHub is delivered as a hosted link and should be loaded in a mobile app webview.\n\n**What was asked:** Support asked for documentation on integrating StatsHub into client applications.",
      "product": "StatsHub",
      "entities": [
        "StatsHub"
      ],
      "tags": [
        "widgets-and-ui-embedding"
      ],
      "source": "thread",
      "topic": "Widgets and UI embedding",
      "date": "2026-02-26",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-custom-bet-translation-ticket-routing",
      "question": "Custom bet translation ticket routing",
      "aliases": [],
      "summary": "Support asked whether a Custom Bet Bulgarian translation CSCS ticket belongs in bet support or integrations queue.",
      "answer": "Ticket is in the correct queue; bet support will review and provide an update.\n\n**What was asked:** Support asked whether a Custom Bet Bulgarian translation CSCS ticket belongs in bet support or integrations queue.",
      "product": "Custom Bet",
      "entities": [
        "Custom Bet"
      ],
      "tags": [
        "widgets-and-ui-embedding"
      ],
      "source": "thread",
      "topic": "Widgets and UI embedding",
      "date": "2026-03-05",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-custom-translations-enabled-for-client",
      "question": "Custom translations enabled for client",
      "aliases": [],
      "summary": "CS asked how to connect client alias in Store after enabling the translation tool for a client with portal user access.",
      "answer": "Custom translations enabled and alias added; contact bet integrations channel until a formal procedure exists.\n\n**What was asked:** CS asked how to connect client alias in Store after enabling the translation tool for a client with portal user access.",
      "product": null,
      "entities": [],
      "tags": [
        "widgets-and-ui-embedding"
      ],
      "source": "thread",
      "topic": "Widgets and UI embedding",
      "date": "2026-03-13",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-lmt-custom-deprecated-maps-to-plus",
      "question": "LMT Custom deprecated, maps to Plus",
      "aliases": [],
      "summary": "Client asked about LMT Custom sports coverage and documentation; team confirmed LMT Custom is no longer offered to new clients and effectively resolves to LMT Plus with the same supported sports.",
      "answer": "LMT Custom is unavailable for new clients and resolves to LMT Plus; supported sports are the same; outdated documentation will be removed.\n\n**What was asked:** Client asked about LMT Custom sports coverage and documentation; team confirmed LMT Custom is no longer offered to new clients and effectively resolves to LMT Plus with the same supported sports.",
      "product": "LMT Plus",
      "entities": [
        "LMT Plus"
      ],
      "tags": [
        "widgets-and-ui-embedding"
      ],
      "source": "thread",
      "topic": "Widgets and UI embedding",
      "date": "2026-03-27",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-lmt-pitchview-requires-premium-package",
      "question": "LMT pitchView requires Premium package",
      "aliases": [],
      "summary": "Client reported the pitchView property in LMT does not work; team asked whether a specific package is required.",
      "answer": "pitchView only works with LMT Premium enabled; on regular LMT the parameter has no effect.\n\n**What was asked:** Client reported the pitchView property in LMT does not work; team asked whether a specific package is required.",
      "product": null,
      "entities": [],
      "tags": [
        "widgets-and-ui-embedding"
      ],
      "source": "thread",
      "topic": "Widgets and UI embedding",
      "date": "2026-03-28",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-statshub-migration-h2h-url-guidance",
      "question": "Statshub migration H2H URL guidance",
      "aliases": [],
      "summary": "Client reported match information not displaying after Statistics Centre URLs changed during Statshub migration, using legacy head-to-head link formats.",
      "answer": "Client should use match-ID-only Statshub URLs; separate h2h and headtohead links consolidated to one H2H page; widget and Statshub whitelisting are managed separately.\n\n**What was asked:** Client reported match information not displaying after Statistics Centre URLs changed during Statshub migration, using legacy head-to-head link formats.",
      "product": "StatsHub",
      "entities": [
        "StatsHub",
        "H2H"
      ],
      "tags": [
        "widgets-and-ui-embedding"
      ],
      "source": "thread",
      "topic": "Widgets and UI embedding",
      "date": "2026-04-17",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-s5-league-table-link-migration-fix",
      "question": "S5 league-table link migration fix",
      "aliases": [],
      "summary": "After S5-to-Statshub migration, client league-table iframe using a matchID in the URL opens match statistics instead of the Serie B league table.",
      "answer": "Client must update links to the recommended Statshub tournament format; S5 deep links only open Statshub overview pages, not specific sub-pages; client was informed.\n\n**What was asked:** After S5-to-Statshub migration, client league-table iframe using a matchID in the URL opens match statistics instead of the Serie B league table.",
      "product": "StatsHub",
      "entities": [
        "StatsHub"
      ],
      "tags": [
        "widgets-and-ui-embedding"
      ],
      "source": "thread",
      "topic": "Widgets and UI embedding",
      "date": "2026-04-20",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-statshub-page-link-shared",
      "question": "StatsHub page link shared",
      "aliases": [],
      "summary": "Colleague shared a StatsHub URL believed to be the correct link for a referenced page.",
      "answer": "A StatsHub page link was provided as the correct destination.\n\n**What was asked:** Colleague shared a StatsHub URL believed to be the correct link for a referenced page.",
      "product": "StatsHub",
      "entities": [
        "StatsHub"
      ],
      "tags": [
        "widgets-and-ui-embedding"
      ],
      "source": "thread",
      "topic": "Widgets and UI embedding",
      "date": "2026-04-20",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-mobile-stats-button-iframe-height-fix",
      "question": "Mobile stats button iframe height fix",
      "aliases": [],
      "summary": "Client stats button failed on mobile; colleague wondered if it was a StatsHub iframe whitelisting issue similar to a known Jira case.",
      "answer": "Not a whitelisting issue; client iframe lacks fixed height and scrolling enabled—client asked to correct iframe configuration.\n\n**What was asked:** Client stats button failed on mobile; colleague wondered if it was a StatsHub iframe whitelisting issue similar to a known Jira case.",
      "product": "StatsHub",
      "entities": [
        "StatsHub"
      ],
      "tags": [
        "widgets-and-ui-embedding"
      ],
      "source": "thread",
      "topic": "Widgets and UI embedding",
      "date": "2026-04-22",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-statshub-header-and-pinning-removal",
      "question": "StatsHub header and pinning removal",
      "aliases": [],
      "summary": "Client wants to remove the StatsHub header section and pinning functionality; unclear if configurable from client side versus hosted setup.",
      "answer": "Request acknowledged via bet-integrations mail and BET will handle it; CSC ticket can be closed.\n\n**What was asked:** Client wants to remove the StatsHub header section and pinning functionality; unclear if configurable from client side versus hosted setup.",
      "product": "StatsHub",
      "entities": [
        "StatsHub"
      ],
      "tags": [
        "widgets-and-ui-embedding"
      ],
      "source": "thread",
      "topic": "Widgets and UI embedding",
      "date": "2026-05-07",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-csp-frame-ancestors-domain-whitelist",
      "question": "CSP frame-ancestors domain whitelist",
      "aliases": [],
      "summary": "Urgent weekend request to add new origins to frame-ancestors CSP after iframe refused-to-frame error for StatsHub integration.",
      "answer": "Escalated as incident and domains were whitelisted.\n\n**What was asked:** Urgent weekend request to add new origins to frame-ancestors CSP after iframe refused-to-frame error for StatsHub integration.",
      "product": "StatsHub",
      "entities": [
        "StatsHub"
      ],
      "tags": [
        "widgets-and-ui-embedding"
      ],
      "source": "thread",
      "topic": "Widgets and UI embedding",
      "date": "2026-05-09",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-tournament-preview-shows-fewer-markets-due-to-mobile-propert",
      "question": "Tournament Preview shows fewer markets due to mobile properties",
      "aliases": [],
      "summary": "Client saw only two markets in Tournament Preview while the demo showed four.",
      "answer": "Client widget uses isMobile:true and isExpanded:false, which limits visible fields; setting isMobile:true, isExpanded:true, and disableTabs:true shows all markets.\n\n**What was asked:** Client saw only two markets in Tournament Preview while the demo showed four.",
      "product": "Tournament Preview",
      "entities": [
        "Tournament Preview"
      ],
      "tags": [
        "widgets-and-ui-embedding"
      ],
      "source": "thread",
      "topic": "Widgets and UI embedding",
      "date": "2026-06-09",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-whitelisting-forwarded-to-cs",
      "question": "Whitelisting forwarded to CS",
      "aliases": [],
      "summary": "Domain whitelisting request needed handling.",
      "answer": "Request forwarded to CS team that handles whitelisting.\n\n**What was asked:** Domain whitelisting request needed handling.",
      "product": null,
      "entities": [],
      "tags": [
        "widgets-and-ui-embedding"
      ],
      "source": "thread",
      "topic": "Widgets and UI embedding",
      "date": "2026-06-26",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-lmt-tab-icons-and-collapsed-default",
      "question": "LMT tab icons and collapsed default",
      "aliases": [],
      "summary": "Client asked if LMT supports custom icon-only tabs and collapsed-by-default scoreboard view.",
      "answer": "Both supported via customizing-tabs docs and collapseTo/expanded properties.\n\n**What was asked:** Client asked if LMT supports custom icon-only tabs and collapsed-by-default scoreboard view.",
      "product": null,
      "entities": [],
      "tags": [
        "widgets-and-ui-embedding"
      ],
      "source": "thread",
      "topic": "Widgets and UI embedding",
      "date": "2026-07-10",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-live-score-page-ui-misalignment",
      "question": "Live Score page UI misalignment",
      "aliases": [],
      "summary": "Client reported UI element overlap on Live Score page.",
      "answer": "Create Jira/Bet support ticket with client details for investigation.\n\n**What was asked:** Client reported UI element overlap on Live Score page.",
      "product": null,
      "entities": [],
      "tags": [
        "widgets-and-ui-embedding"
      ],
      "source": "thread",
      "topic": "Widgets and UI embedding",
      "date": "2026-07-22",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-statshub-whitelist-ladbrokes-be",
      "question": "StatsHub whitelist ladbrokes.be",
      "aliases": [],
      "summary": "Production frame-ancestors error blocked ladbrokes.be from embedding StatsHub for bwin 12.",
      "answer": "ladbrokes.be was whitelisted for StatsHub embedding.\n\n**What was asked:** Production frame-ancestors error blocked ladbrokes.be from embedding StatsHub for bwin 12.",
      "product": "StatsHub",
      "entities": [
        "StatsHub"
      ],
      "tags": [
        "widgets-and-ui-embedding"
      ],
      "source": "thread",
      "topic": "Widgets and UI embedding",
      "date": "2026-07-23",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-nfl-us-widget-configuration-guidance",
      "question": "NFL US widget configuration guidance",
      "aliases": [],
      "summary": "Client asked about NFL widget availability, team filtering, injuries teamId format, and ID lookup for futureOdds, teamsStats, and injuries widgets.",
      "answer": "futureOdds widgets likely deprecated; use nfl.oddsComparison; teamsStats filters by conference not team; injuries uses sd:team UUID teamId; IDs from NFL API/Mapping API or onItemClick; alias xlmediaus noted for access verification if errors occur.\n\n**What was asked:** Client asked about NFL widget availability, team filtering, injuries teamId format, and ID lookup for futureOdds, teamsStats, and injuries widgets.",
      "product": null,
      "entities": [],
      "tags": [
        "widgets-and-ui-embedding"
      ],
      "source": "thread",
      "topic": "Widgets and UI embedding",
      "date": "2026-08-08",
      "asked": 0,
      "links": [],
      "related": []
    },
    {
      "id": "thread-csp-frame-ancestors-domains-not-hideable",
      "question": "CSP frame-ancestors domains not hideable",
      "aliases": [],
      "summary": "Client asked to hide whitelisted domains from frame-ancestors CSP error messages in browser console for mirror anonymization security.",
      "answer": "No configuration option exists to hide the domain list; frame-ancestors must be exposed to browsers for iframe embedding security.\n\n**What was asked:** Client asked to hide whitelisted domains from frame-ancestors CSP error messages in browser console for mirror anonymization security.",
      "product": null,
      "entities": [],
      "tags": [
        "widgets-and-ui-embedding"
      ],
      "source": "thread",
      "topic": "Widgets and UI embedding",
      "date": "2026-08-19",
      "asked": 0,
      "links": [],
      "related": []
    }
  ],
  "threadsCompiledAt": "2026-09-02"
};
/* KNOWLEDGE:END */
