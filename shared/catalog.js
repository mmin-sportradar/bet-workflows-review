/* The product catalogue, shared by the landing page and by the chrome layer on
   every workflow page. Workflow pages use it to derive their own breadcrumb from
   their directory name, so no page carries hand-written navigation data.

   Classic script, no modules: the whole site loads plain <script src> tags. */

// Everything between the CATALOG markers below is rewritten wholesale by the
// content admin (admin/index.html) when someone saves a catalogue change. Edit it
// by hand as freely as ever -- the admin re-reads whatever is here -- but keep the
// two marker comments intact and keep the data between them, or the admin will
// refuse to save rather than guess where the array begins.
/* CATALOG:START */
const families = [
  {
    name: "Widget products",
    products: [
      // Licensing is a route of Betting Widgets, not a product beside it: it is the
      // same widgets, per sport, and as its own tile it read as a second product
      // people had to know to look for. `licensing` is a workflow type like setup
      // and integration, so the row, the breadcrumb on the flow page and the search
      // entry all come from the same place they do for every other flow.
      { name: "Betting Widgets", description: "The core Betting Widgets product.", setup: "workflows/betting-widgets-setup-flow/", integration: "workflows/betting-widgets-integration-flow-1/", licensing: "workflows/widgets-licensing-setup-flow/", docs: "https://apidocs.sportradar.com/resources/widgets", confluence: "https://sportradar.atlassian.net/wiki/spaces/LSS/pages/139172963/Bet+Recommendations+Widgets" },
      { name: "LMT Plus", description: "LMT widget setup.", setup: "workflows/lmt-setup-flow/", docs: "https://apidocs.sportradar.com/resources/widgets/docs/lmt/lmt-plus", confluence: "https://sportradar.atlassian.net/wiki/spaces/LSS/pages/139165990/Live+Match+Tracker" },
      { name: "LMT Premium", description: "Faster data for LMT and LMT Compact.", setup: "workflows/lmt-premium-setup-flow/", docs: "https://apidocs.sportradar.com/resources/widgets/docs/lmt/lmt-plus", confluence: "https://sportradar.atlassian.net/wiki/spaces/LSS/pages/139181924/Live+Match+Tracker+Premium" },
      { name: "LMT Virtualised", description: "LMT Virtualised product setup.", setup: "workflows/lmt-virtualised-setup-flow/", docs: "https://apidocs.sportradar.com/resources/widgets/docs/lmt/lmt-plus", confluence: "https://sportradar.atlassian.net/wiki/spaces/LSS/pages/139178293/LMT+Virtualised" },
      { name: "Custom Bet", description: "Custom Bet widget setup.", setup: "workflows/custom-bet-setup-flow/", docs: "https://apidocs.sportradar.com/resources/widgets/docs/custom-bet/overview", confluence: "https://sportradar.atlassian.net/wiki/spaces/LSS/pages/139172399/CustomBet+Visualisation" },
      { name: "H2H", description: "Head-to-head widget setup.", setup: "workflows/h2h-setup-flow/", docs: "https://apidocs.sportradar.com/resources/widgets/docs/head-to-head/button", confluence: "https://sportradar.atlassian.net/wiki/spaces/LSS/pages/139169024/Head+to+Head+-+H2H" },
      { name: "Bet Assist", description: "Bet Assist widget setup.", setup: "workflows/bet-assist-setup-flow/", docs: "https://apidocs.sportradar.com/resources/widgets/docs/bet-assist/button", confluence: "https://sportradar.atlassian.net/wiki/spaces/LSS/pages/139168685/Bet+Assist" },
      { name: "Tournament Preview", description: "Tournament Preview widget setup.", setup: "workflows/tournament-preview-setup-flow/", docs: "https://apidocs.sportradar.com/resources/widgets/docs/tournament-preview/tournament-preview", confluence: "https://sportradar.atlassian.net/wiki/spaces/LSS/pages/139171399/Tournament+Preview" },
      { name: "Match Preview", description: "Match Preview widget setup.", setup: "workflows/match-preview-setup-flow/", docs: "https://apidocs.sportradar.com/resources/widgets/docs/match-preview/match-preview", confluence: "https://sportradar.atlassian.net/wiki/spaces/LSS/pages/139169009/Match+Preview" }
    ]
  },
  {
    name: "Packages & combinations",
    products: [
      { name: "BET Packages", description: "BET Product Packages setup.", setup: "workflows/bet-product-packages-setup-flow/", docs: "https://product-hub.sportradar.com/en/products/fan-engagement/content/bet-packages", confluence: "https://sportradar.atlassian.net/wiki/spaces/LSS/pages/139181794/BET+Product+Packages" },
      { name: "BET 3-in-1", description: "BET 3-in-1 setup.", setup: "workflows/bet-3-in-1-setup-flow/", docs: "https://apidocs.sportradar.com/resources/widgets/docs/bet3in1/overview", confluence: "https://sportradar.atlassian.net/wiki/spaces/LSS/pages/139185774/BET+3-in-1" },
      { name: "LCO / LCP via LMT", description: "LCO via LMT and LCP via LMT.", setup: "workflows/lco-lcp-via-lmt-setup-flow/", integration: "workflows/lco-lcp-via-lmt-integration-flow/", docs: "https://apidocs.sportradar.com/resources/widgets/docs/lmt/lmt-plus", confluence: [{ title: "LCO via LMT Confluence Doc", href: "https://sportradar.atlassian.net/wiki/spaces/LSS/pages/139174815/LCO+via+LMT" }, { title: "LCP via LMT Confluence Doc", href: "https://sportradar.atlassian.net/wiki/spaces/LSS/pages/139178195/LCP+via+LMT" }] },
      {
        name: "SR Packages",
        description: "SR Packages setup, one flow per sport.",
        // Sports, not workflow types. WORKFLOW_TYPES allows a single setup path per
        // entry and SR Packages ships one per sport, so the sports become entries of
        // their own, each carrying the same setup/integration/docs keys a product
        // does -- which is what lets availableTypes() and productDocs() below read a
        // variant without knowing it is one.
        //
        // An empty `docs` is a slot waiting for a URL: the row still renders, as
        // "Coming soon", so all three of a sport's routes are visible before all
        // three exist. Paste the sport's documentation URL in and the row becomes a
        // live external link with no other change.
        variants: [
          { name: "Golf", setup: "workflows/sr-packages-golf-setup-flow/", integration: "workflows/sr-packages-golf-integration-flow/", docs: "https://apidocs.sportradar.com/resources/widgets/docs/lmt/lmt-golf", confluence: "https://sportradar.atlassian.net/wiki/spaces/LSS/pages/256456190/LMT+Golf+Hybrid" },
          { name: "Combat Sports", setup: "workflows/sr-packages-combat-sports-setup-flow/", integration: "workflows/sr-packages-combat-sports-integration-flow/", docs: "https://apidocs.sportradar.com/resources/widgets/docs/lmt/lmt-mma", confluence: "https://sportradar.atlassian.net/wiki/spaces/LSS/pages/312882557/LMT+Combat+Hybrid" },
          { name: "E-Sports/E-League", setup: "workflows/sr-packages-e-sports-setup-flow/", integration: "workflows/sr-packages-e-sports-integration-flow/", docs: "https://apidocs.sportradar.com/resources/widgets/docs/lmt/lmt-esports", confluence: "https://sportradar.atlassian.net/wiki/spaces/LSS/pages/139183293/24+7+Sports+and+E-leagues+Product+Packages" }
        ]
      }
    ]
  },
  {
    name: "Experiences & engagement",
    products: [
      { name: "Bet Concierge", description: "Bet Concierge delivery.", setup: "workflows/bet-concierge-setup-flow/", integration: "workflows/bet-concierge-integration-flow/", docs: "https://apidocs.sportradar.com/resources/widgets/docs/bet-concierge/overview", confluence: "https://sportradar.atlassian.net/wiki/spaces/LSS/pages/139180693/Bet+Concierge" },
      { name: "Virtual Stadium", description: "Virtual Stadium delivery.", setup: "workflows/virtual-stadium-setup-flow/", integration: "workflows/virtual-stadium-integration-flow/", docs: "https://apidocs.sportradar.com/resources/virtual-stadium", confluence: "https://sportradar.atlassian.net/wiki/spaces/LSS/pages/139175684/Virtual+Stadium" },
      { name: "Bet Recommendations", description: "Bet Recommendations setup.", setup: "workflows/bet-recommendations-setup-flow/", docs: "https://apidocs.sportradar.com/resources/widgets/docs/bet-recommendation", confluence: "https://sportradar.atlassian.net/wiki/spaces/LSS/pages/139172963/Bet+Recommendations+Widgets" },
      { name: "Bet Insights", description: "Bet Insights setup", setup: "workflows/bet-insights-player-prop-zone-setup-flow/", docs: "https://apidocs.sportradar.com/resources/widgets/docs/bet-insights/bet-insights", confluence: { title: "Bet Insights Confluence Doc", href: "https://sportradar.atlassian.net/wiki/spaces/LSS/pages/139175441/Bet+Insights" } },
      { name: "Player Prop Zone", description: "Player Prop Zone setup", setup: "workflows/bet-insights-player-prop-zone-setup-flow/", docs: "https://apidocs.sportradar.com/resources/widgets/docs/widgets/match/player-prop-zone", confluence: "https://sportradar.atlassian.net/wiki/x/PRPTDg" }
    ]
  },
  {
    name: "Data & APIs",
    products: [
      { name: "StatsHub", description: "StatsHub product delivery.", setup: "workflows/statshub-setup-flow/", integration: "workflows/statshub-integration-flow/", docs: "https://apidocs.sportradar.com/resources/statshub", confluence: "https://sportradar.atlassian.net/wiki/spaces/LSS/pages/139185696/StatsHub" },
      { name: "API Betting", description: "Sports API and Probabilities API.", setup: "workflows/bet-api-setup-flow/", docs: "https://developer.sportradar.com/getting-started/docs/make-your-first-call", confluence: "https://sportradar.atlassian.net/wiki/spaces/LSS/pages/139170684/Sports+API" },
      { name: "API Utility / API Mapping", description: "BET API Utility and BET API Mapping.", setup: "workflows/api-utility-mapping-setup-flow/", docs: "https://docs.sportradar.com/engagement-tools/readme/widgets/bet-utility-api#coverage-api", confluence: "https://sportradar.atlassian.net/wiki/spaces/LSS/pages/376385470/Utility+and+Mapping+API+-+Client+Setup+Flow" }
    ]
  },
  {
    name: "Operations",
    products: [
      { name: "Additional domains", description: "Additional domains whitelisting.", process: "workflows/additional-domains-whitelisting-flow/", docs: "https://apidocs.sportradar.com/resources/widgets/docs/tutorials/troubleshooting/licensing-errors", confluence: "https://sportradar.atlassian.net/wiki/spaces/SCS/pages/120040517/Whitelisting+process+for+BET+widgets" },
      { name: "Product Hub", description: "The central Sportradar product hub.", docs: { title: "Product Hub", href: "https://product-hub.sportradar.com/en/home" } }
    ]
  }
];
/* CATALOG:END */

// The order here is the order the rows appear in, on the landing dialog and in
// search alike.
const WORKFLOW_TYPES = ["setup", "integration", "process", "licensing"];

function workflowLabel(type) {
  if (type === "process") return "Process flow";
  if (type === "licensing") return "Widgets licensing";
  return type === "setup" ? "Setup flow" : "Integration flow";
}

function availableTypes(product) {
  return WORKFLOW_TYPES.filter((type) => product[type]);
}

// A product's sport variants, or [] for the ordinary product that IS the flow.
// Each variant is product-shaped, so every helper here reads one unchanged.
function productVariants(product) {
  return product.variants || [];
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
    ? { title: "Technical Documentation", href: product.docs }
    : product.docs;
}

// The product's Confluence pages. Always an array, or null where there are none.
//
// An array rather than one link because a tile is not always one product: "Bet
// Insights & Player Prop Zone" is two things sold together, and each has a
// Confluence page of its own. Collapsing them to one row would mean picking a
// winner, and dropping the second link is not a decision the catalogue should be
// making on a reader's behalf.
//
// Three shapes are accepted, so the common case stays a one-liner:
//
//   confluence: "https://..."                        one page, default title
//   confluence: { title: "...", href: "https://..." } one page, own title
//   confluence: [ ... ]                              several, of either form
//
// Callers get a list either way and do not branch on which was written. Absence
// is still the coming-soon state; see the row-building comment in app.js.
function productConfluence(product) {
  if (!product.confluence) return null;
  const raw = Array.isArray(product.confluence) ? product.confluence : [product.confluence];
  const links = raw
    .map((link) => (typeof link === "string" ? { title: "Confluence Documentation", href: link } : link))
    .filter((link) => link && link.href);
  return links.length ? links : null;
}

// Which of an entry's flow paths points at this directory, if any. Split out of
// findWorkflow() so products and their sport variants share one comparison rather
// than nesting the same loop twice.
function matchSlug(entry, slug) {
  for (const type of availableTypes(entry)) {
    if (entry[type].replace(/^workflows\/|\/$/g, "") === slug) return { type };
  }
  return null;
}

// Resolve a workflow directory name (e.g. "lmt-setup-flow") back to its catalogue
// entry, so a workflow page can name its own family and flow type. Returns null
// for a folder that is not listed above, which callers treat as "no breadcrumb"
// rather than as an error. `variant` is present only for a sport-specific flow.
function findWorkflow(slug) {
  for (const family of families) {
    for (const product of family.products) {
      const direct = matchSlug(product, slug);
      if (direct) return { family, product, type: direct.type };

      for (const variant of productVariants(product)) {
        const inner = matchSlug(variant, slug);
        if (inner) return { family, product, variant, type: inner.type };
      }
    }
  }
  return null;
}

// The name of what a flow belongs to: the product, or the sport inside it. One
// helper so breadcrumbs, header tags and search rows never disagree about it.
function flowOwnerName(match) {
  return match.variant ? `${match.product.name} — ${match.variant.name}` : match.product.name;
}

/* ---------- one flat view of the catalogue ---------- */

// The catalogue as a list of things a person can name, one record per family,
// per product, and per sport variant.
//
// This exists because three separate places were each walking `families`
// themselves -- the landing grid, the search palette in chrome.js, and (as of
// the assistant) question answering -- and they disagreed about the awkward
// cases. A variant has no `description` of its own and inherits the product's; a
// variant's display name is "Product — Sport" but its `name` is just the sport;
// docs and Confluence each have three possible shapes. Getting one of those
// wrong is invisible until somebody searches for the one product it breaks.
//
// Deliberately BELOW the CATALOG:END marker. Everything between the markers is
// rewritten wholesale when the admin saves, so code up there would be destroyed.
// And these are `function` declarations, not `const`: those land on `window`,
// which is how chrome.js can feature-detect them (`typeof x === "function"`)
// exactly as it already does for findWorkflow.

function slugify(text) {
  return String(text)
    .toLowerCase()
    // Em and en dashes to a space before the general strip, or "Product — Sport"
    // would slug as "productsport".
    .replace(/[‐-―]/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// A product or one of its sport variants, as one record. `entry` is whichever of
// the two carries the flow and docs keys; `product` is where the description
// lives. That split is not obvious and is the thing this file exists to hide.
function catalogEntity(family, product, variant) {
  const entry = variant || product;
  const label = variant ? flowOwnerName({ product, variant }) : product.name;

  return {
    kind: variant ? "variant" : "product",
    id: (variant ? "variant:" : "product:") + slugify(label),
    // `name` is what the catalogue calls it ("Golf"); `label` is what a reader
    // would recognise ("SR Packages — Golf"). Both are needed: the first for
    // matching what someone typed, the second for saying it back to them.
    name: entry.name,
    label,
    family,
    product,
    variant: variant || null,
    // Variants have no description of their own; chrome.js:171 already passes
    // the product's, and this keeps that decision in one place.
    description: product.description || "",
    types: availableTypes(entry),
    paths: availableTypes(entry).map((type) => ({
      type,
      label: workflowLabel(type),
      // Left exactly as the catalogue holds it -- root-relative. Resolving it
      // needs a base that only the calling page knows, so callers do that.
      href: entry[type],
    })),
    docs: productDocs(entry),
    confluence: productConfluence(entry),
    variants: productVariants(product).map((one) => one.name),
    sharedFlowWith: [],
  };
}

// Two products can declare the same flow path -- Bet Insights and Player Prop
// Zone both point at bet-insights-player-prop-zone-setup-flow. findWorkflow()
// can only ever return the first of them, so anything reading that slug believes
// the page belongs to Bet Insights alone. Here both records exist and each knows
// about the other, which is the fact worth being able to state. Derived, so if
// they are ever given separate flows this corrects itself.
function linkSharedFlows(entities) {
  const byPath = new Map();

  entities.forEach((entity) => {
    entity.paths.forEach((path) => {
      if (!byPath.has(path.href)) byPath.set(path.href, []);
      byPath.get(path.href).push(entity);
    });
  });

  byPath.forEach((sharing) => {
    if (sharing.length < 2) return;
    sharing.forEach((entity) => {
      sharing.forEach((other) => {
        if (other !== entity && !entity.sharedFlowWith.includes(other.label)) {
          entity.sharedFlowWith.push(other.label);
        }
      });
    });
  });
}

// Families first, then each product, then that product's variants -- the same
// order chrome.js's search index has always emitted, so a caller that filters
// the families out gets byte-identical rows to before.
function catalogEntities() {
  if (catalogEntities.cache) return catalogEntities.cache;

  const entities = [];

  families.forEach((family) => {
    entities.push({
      kind: "family",
      id: "family:" + slugify(family.name),
      name: family.name,
      label: family.name,
      family,
      product: null,
      variant: null,
      description: "",
      types: [],
      paths: [],
      docs: null,
      confluence: null,
      variants: [],
      sharedFlowWith: [],
      children: family.products.map((product) => product.name),
    });

    family.products.forEach((product) => {
      entities.push(catalogEntity(family, product, null));
      productVariants(product).forEach((variant) => {
        entities.push(catalogEntity(family, product, variant));
      });
    });
  });

  linkSharedFlows(entities);
  catalogEntities.cache = entities;
  return entities;
}
