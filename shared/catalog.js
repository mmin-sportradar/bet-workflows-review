/* The product catalogue, shared by the landing page and by the chrome layer on
   every workflow page. Workflow pages use it to derive their own breadcrumb from
   their directory name, so no page carries hand-written navigation data.

   Classic script, no modules: the whole site loads plain <script src> tags. */

const families = [
  {
    name: "Widget products",
    products: [
      { name: "Betting Widgets", description: "The core Betting Widgets product.", setup: "workflows/betting-widgets-setup-flow/", integration: "workflows/betting-widgets-integration-flow-1/", docs: "https://apidocs.sportradar.com/resources/widgets" },
      { name: "Widgets licensing", description: "The all-widgets-per-sport licensing reference.", setup: "workflows/widgets-licensing-setup-flow/", docs: "https://apidocs.sportradar.com/resources/widgets/docs/tutorials/troubleshooting/licensing-errors" },
      { name: "LMT", description: "LMT widget setup.", setup: "workflows/lmt-setup-flow/", docs: "https://apidocs.sportradar.com/resources/widgets/docs/lmt/lmt-plus" },
      { name: "LMT Premium", description: "Faster data for LMT and LMT Compact.", setup: "workflows/lmt-premium-setup-flow/", docs: "https://apidocs.sportradar.com/resources/widgets/docs/lmt/lmt-plus" },
      { name: "LMT Virtualised", description: "LMT Virtualised product setup.", setup: "workflows/lmt-virtualised-setup-flow/", docs: "https://apidocs.sportradar.com/resources/widgets/docs/lmt/lmt-plus" },
      { name: "Custom Bet", description: "Custom Bet widget setup.", setup: "workflows/custom-bet-setup-flow/", docs: "https://apidocs.sportradar.com/resources/widgets/docs/custom-bet/overview" },
      { name: "H2H", description: "Head-to-head widget setup.", setup: "workflows/h2h-setup-flow/", docs: "https://apidocs.sportradar.com/resources/widgets/docs/head-to-head/button" },
      { name: "Bet Assist", description: "Bet Assist widget setup.", setup: "workflows/bet-assist-setup-flow/", docs: "https://apidocs.sportradar.com/resources/widgets/docs/bet-assist/button" },
      { name: "Tournament Preview", description: "Tournament Preview widget setup.", setup: "workflows/tournament-preview-setup-flow/", docs: "https://apidocs.sportradar.com/resources/widgets/docs/tournament-preview/tournament-preview" },
      { name: "Match Preview", description: "Match Preview widget setup.", setup: "workflows/match-preview-setup-flow/", docs: "https://apidocs.sportradar.com/resources/widgets/docs/match-preview/match-preview" }
    ]
  },
  {
    name: "Packages & combinations",
    products: [
      { name: "BET Packages", description: "BET Product Packages setup.", setup: "workflows/bet-product-packages-setup-flow/", docs: "https://product-hub.sportradar.com/en/products/fan-engagement/content/bet-packages" },
      { name: "BET 3-in-1", description: "BET 3-in-1 setup.", setup: "workflows/bet-3-in-1-setup-flow/", docs: "https://apidocs.sportradar.com/resources/widgets/docs/bet3in1/overview" },
      { name: "LCO / LCP via LMT", description: "LCO via LMT and LCP via LMT.", setup: "workflows/lco-lcp-via-lmt-setup-flow/", integration: "workflows/lco-lcp-via-lmt-integration-flow/", docs: "https://apidocs.sportradar.com/resources/widgets/docs/lmt/lmt-plus" }
    ]
  },
  {
    name: "Experiences & engagement",
    products: [
      { name: "Bet Concierge", description: "Bet Concierge delivery.", setup: "workflows/bet-concierge-setup-flow/", integration: "workflows/bet-concierge-integration-flow/", docs: "https://apidocs.sportradar.com/resources/widgets/docs/bet-concierge/overview" },
      { name: "Virtual Stadium", description: "Virtual Stadium delivery.", setup: "workflows/virtual-stadium-setup-flow/", integration: "workflows/virtual-stadium-integration-flow/", docs: "https://apidocs.sportradar.com/resources/virtual-stadium" },
      { name: "Bet Recommendations", description: "Bet Recommendations setup.", setup: "workflows/bet-recommendations-setup-flow/", docs: "https://apidocs.sportradar.com/resources/widgets/docs/bet-recommendation" },
      { name: "Bet Insights & Player Prop Zone", description: "Bet Insights and Player Prop Zone setup.", setup: "workflows/bet-insights-player-prop-zone-setup-flow/", docs: "https://apidocs.sportradar.com/resources/widgets/docs/bet-insights/bet-insights" }
    ]
  },
  {
    name: "Data & APIs",
    products: [
      { name: "StatsHub", description: "StatsHub product delivery.", setup: "workflows/statshub-setup-flow/", integration: "workflows/statshub-integration-flow/", docs: "https://apidocs.sportradar.com/resources/statshub" },
      { name: "API Betting", description: "Sports API and Probabilities API.", setup: "workflows/bet-api-setup-flow/", docs: "https://developer.sportradar.com/getting-started/docs/make-your-first-call" },
      { name: "API Utility / API Mapping", description: "BET API Utility and BET API Mapping.", setup: "workflows/api-utility-mapping-setup-flow/", docs: "https://docs.sportradar.com/engagement-tools/readme/widgets/bet-utility-api#coverage-api" }
    ]
  },
  {
    name: "Operations",
    products: [
      { name: "Additional domains", description: "Additional domains whitelisting.", process: "workflows/additional-domains-whitelisting-flow/", docs: "https://apidocs.sportradar.com/resources/widgets/docs/tutorials/troubleshooting/licensing-errors" },
      { name: "Product Hub", description: "The central Sportradar product hub.", docs: { title: "Product Hub", href: "https://product-hub.sportradar.com/en/home" } }
    ]
  }
];

const WORKFLOW_TYPES = ["setup", "integration", "process"];

function workflowLabel(type) {
  if (type === "process") return "Process flow";
  return type === "setup" ? "Setup flow" : "Integration flow";
}

function availableTypes(product) {
  return WORKFLOW_TYPES.filter((type) => product[type]);
}

// The product's documentation, as an outbound link. Deliberately NOT a member of
// WORKFLOW_TYPES: that list means "interactive flow hosted on this site", and
// findWorkflow() below matches its values against directory slugs, which an
// absolute URL would never be. `docs` is a plain URL string in the normal case,
// or { title, href } where the link needs a name of its own -- Product Hub is a
// tile that IS the hub, so labelling its one link "Documentation" reads wrong.
// Returns null for a product with no documentation, which callers treat as "no
// link" rather than as an error.
function productDocs(product) {
  if (!product.docs) return null;
  return typeof product.docs === "string"
    ? { title: "Documentation", href: product.docs }
    : product.docs;
}

// Resolve a workflow directory name (e.g. "lmt-setup-flow") back to its catalogue
// entry, so a workflow page can name its own family and flow type. Returns null
// for a folder that is not listed above, which callers treat as "no breadcrumb"
// rather than as an error.
function findWorkflow(slug) {
  for (const family of families) {
    for (const product of family.products) {
      for (const type of availableTypes(product)) {
        if (product[type].replace(/^workflows\/|\/$/g, "") === slug) {
          return { family, product, type };
        }
      }
    }
  }
  return null;
}
