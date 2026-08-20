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
│   ├── chrome.js       # Shared header, sidebar, and breadcrumb logic
│   └── chrome.css      # Shared layout and navigation styles
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

## Repository

Private repository: [mmin-sportradar/Internal-workflow](https://github.com/mmin-sportradar/Internal-workflow)
