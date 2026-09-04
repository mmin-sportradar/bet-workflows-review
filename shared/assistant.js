/* The BET assistant: the launcher in the page foot and the panel behind it.

   Classic script, no modules, loaded by chrome.js after knowledge.js so
   `slackKnowledge` is already defined. Everything here is one IIFE and touches
   nothing outside .sr-ask-*, because it runs on 27 pages whose own stylesheets
   and app.js files know nothing about it.

   WHAT THIS IS NOT: there is no model in the loop and no request leaves the
   page. The answers are the ones the team has already written -- in Slack
   threads pulled in by scripts/ingest-slack.mjs, and in the hand-written site
   entries -- and the assistant's whole job is to find the right one and show
   where it came from. That is a deliberate choice, not a stopgap: an answer
   about who provisions a licence is only worth anything if you can click
   through to the thread where somebody actually said it. */

(function () {
  // The whole widget is optional. A page that somehow loads this without the
  // knowledge file should carry on being a page rather than throw.
  if (typeof slackKnowledge === "undefined" || !slackKnowledge.entries) return;

  const script =
    document.currentScript || document.querySelector('script[src*="assistant.js"]');
  const root = new URL("../", script.src).href;

  const SESSION_KEY = "bet-workflows:assistant";
  const SEEN_KEY = "bet-workflows:assistant-seen";
  const WORKSPACE = slackKnowledge.workspace || "sportradar";

  // Long enough that the answer reads as a reply rather than as a form
  // submission, short enough that nobody waits for it. See the note on
  // .sr-ask-typing in assistant.css.
  const THINKING_MS = 420;
  // How long a question will wait for the documentation corpus before being
  // answered without it. Long enough for a cached megabyte on a slow machine,
  // short enough that nobody reads it as the assistant having hung.
  const DOCS_WAIT_MS = 1200;

  const icon = {
    // The four paths are named so the stylesheet can move them independently --
    // the wand holds still while its sparkles twinkle, which is the whole point
    // of it being a wand. Scaling the <svg> as one lump, which is what this did
    // before, animates the handle just as hard as the stars and reads as the
    // icon wobbling rather than as anything catching light.
    spark:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path class="sr-wand-stick" d="M9.94 14.06 2 22"/>' +
      '<path class="sr-wand-star" d="M14 4.5 15.5 8l3.5 1.5-3.5 1.5L14 14.5 12.5 11 9 9.5 12.5 8Z"/>' +
      '<path class="sr-wand-glint sr-wand-glint-1" d="M20 15.5 20.75 17l1.5.75-1.5.75L20 20l-.75-1.5L17.75 17.75l1.5-.75Z"/>' +
      '<path class="sr-wand-glint sr-wand-glint-2" d="M5 3l.6 1.4L7 5l-1.4.6L5 7l-.6-1.4L3 5l1.4-.6Z"/>' +
      '</svg>',
    close:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
    restart:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
    back:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>',
    list:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>',
    send:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
    slack:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="3" height="8" x="13" y="2" rx="1.5"/><path d="M19 8.5V10h1.5A1.5 1.5 0 1 0 19 8.5"/><rect width="3" height="8" x="8" y="14" rx="1.5"/><path d="M5 15.5V14H3.5A1.5 1.5 0 1 0 5 15.5"/><rect width="8" height="3" x="14" y="13" rx="1.5"/><path d="M15.5 19H14v1.5a1.5 1.5 0 1 0 1.5-1.5"/><rect width="8" height="3" x="2" y="8" rx="1.5"/><path d="M8.5 5H10V3.5A1.5 1.5 0 1 0 8.5 5"/></svg>',
    page:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h5"/></svg>',
    external:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>',
    up:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/></svg>',
    down:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"/></svg>'
  };

  /* ---------- text ---------- */

  const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[ch]);

  // Answers are escaped first and marked up second, so the only HTML that ever
  // reaches the panel is the handful of tags below. That matters most for the
  // Slack entries: their text is whatever somebody typed into a channel, and it
  // arrives here through a generated file nobody reviews line by line.
  function renderAnswer(text) {
    const blocks = escapeHtml(text).split(/\n{2,}/);

    return blocks
      .map((block) => {
        const lines = block.split("\n");

        if (lines.every((line) => /^\s*[-*]\s+/.test(line))) {
          const items = lines
            .map((line) => `<li>${inline(line.replace(/^\s*[-*]\s+/, ""))}</li>`)
            .join("");
          return `<ul>${items}</ul>`;
        }

        return `<p>${inline(lines.join("<br>"))}</p>`;
      })
      .join("");
  }

  // Bold and code only. Slack's own markup is close enough to this that an
  // ingested answer keeps its emphasis, and anything else degrades to the
  // literal characters rather than to a broken tag.
  const inline = (text) =>
    text
      // Bold first, so the single-asterisk pass below cannot see the inner
      // halves of a **bold** pair and turn them into two stray italics.
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");

  /* ---------- the catalogue, as things a person can name ---------- */

  // Everything in this section exists to answer one question before any scoring
  // happens: WHICH PRODUCT did the reader actually name?
  //
  // Without that, the scorer is guessing. It used to answer "what is the
  // difference between virtual stadium and bet concierge" with the LMT entry,
  // because `difference` and `between` scored against that entry's own title
  // while `virtual` prefix-matched "virtualised" and `bet` prefix-matched
  // "between". Every one of those is a plausible bag-of-words hit. None of them
  // is about the products in the question.

  const CATALOGUE = typeof catalogEntities === "function" ? catalogEntities() : [];
  const NAMEABLE = CATALOGUE.filter((entity) => entity.kind !== "family");

  // One normaliser, used on the reader's words AND on every surface form, so the
  // two can never disagree about what a match is.
  function normalise(text) {
    return String(text)
      .toLowerCase()
      // Dashes to space first: flowOwnerName() joins with an em dash, and nobody
      // types one. "SR Packages — Golf" has to become three plain words.
      .replace(/[‐-―]/g, " ")
      .replace(/&/g, " and ")
      // "E-Sports/E-League" and "API Utility / API Mapping" are two runs each.
      .replace(/\//g, " ")
      // Hyphen and + survive: "3-in-1" and "h2h" depend on them.
      .replace(/[^a-z0-9\-+ ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Hyphenation is inconsistent in the catalogue AND in what people type, so
  // every surface form is registered under all three spellings. "custombet"
  // reaches Custom Bet; "esports" reaches E-Sports/E-League.
  function keysFor(text) {
    // A separator hyphen is not part of a word: "Head to Head - H2H" must not
    // register a key containing a bare "-" token, or "head to head" never
    // matches it.
    const base = normalise(text).replace(/(^|\s)-+(\s|$)/g, " ").replace(/\s+/g, " ").trim();
    if (!base) return [];
    return [...new Set([
      base,
      base.replace(/-/g, " ").replace(/\s+/g, " ").trim(),
      // Spaces out as well as hyphens. This is what reaches "custombet" from
      // "Custom Bet" and "bet3in1" from "BET 3-in-1" -- resolveMentions() looks
      // up a space-stripped gram, so the index has to hold one.
      base.replace(/[\s-]/g, "")
    ])];
  }

  // Single words too vague to identify a product on their own. "bet" is in here
  // because eight products contain it; "lmt" because four do, and being asked
  // which is better than being given one of them.
  const VAGUE = new Set(
    ("bet betting widget widgets api apis package product products " +
      "overview button docs doc documentation home readme resources sports sport " +
      "setup integration process licensing flow flows hub visualisation")
      .split(" ")
  );

  // Short forms that genuinely mean several products. These are NOT in VAGUE,
  // because being asked "which of these four?" is a useful answer and being
  // silently ignored is not. They register against every candidate, which makes
  // resolveMentions() report them as ambiguous.
  const AMBIGUOUS = {
    "lmt": ["LMT Plus", "LMT Premium", "LMT Virtualised", "LCO / LCP via LMT"],
    "preview": ["Tournament Preview", "Match Preview"],
    "packages": ["BET Packages", "SR Packages"]
  };

  // What mining cannot give us. Deliberately short -- anything the miner already
  // produces must NOT be here, or there are two places to fix it.
  const ALIASES = {
    "ppz": "Player Prop Zone",
    "lco": "LCO / LCP via LMT",
    "lcp": "LCO / LCP via LMT",
    "whitelist": "Additional domains",
    "whitelisting": "Additional domains",
    "domain whitelisting": "Additional domains",
    "probabilities api": "API Betting",
    "utility api": "API Utility / API Mapping",
    "mapping api": "API Utility / API Mapping",
    "id mapping": "API Utility / API Mapping",
    "3 in 1": "BET 3-in-1",
    "mma": "SR Packages — Combat Sports",
    "combat": "SR Packages — Combat Sports"
  };

  // Names hiding in the URLs the catalogue already holds: a Confluence page
  // title, and the last segment of a docs path. This is where "head to head"
  // for H2H and "live match tracker" for LMT Plus come from, at no maintenance
  // cost -- they are already there because somebody linked the page.
  function minedFrom(entity) {
    const found = [];

    (entity.confluence || []).forEach((link) => {
      // Only the long form carries a title. Player Prop Zone's /wiki/x/PRPTDg
      // short link matches nothing here, which is the correct outcome.
      const match = /\/pages\/\d+\/([^/?#]+)/.exec(link.href);
      if (match) {
        found.push({ text: decodeURIComponent(match[1]).replace(/\+/g, " "), url: link.href });
      }
    });

    if (entity.docs) {
      // The last TWO segments, because the meaningful one is often not last:
      // H2H's docs end .../docs/head-to-head/button, and "button" is noise while
      // "head-to-head" is exactly the name people say.
      const path = entity.docs.href.split(/[?#]/)[0].replace(/\/+$/, "").split("/");
      path.slice(-2).forEach((segment) => {
        if (segment) found.push({ text: segment.replace(/[-_]/g, " "), url: entity.docs.href });
      });
    }

    return found;
  }

  // A mined alias is discarded when the URL it came from belongs to more than one
  // catalogue entry. One rule, two collisions killed: Betting Widgets and Bet
  // Recommendations share a Confluence page, and FOUR products share the
  // apidocs .../lmt/lmt-plus URL. Deriving this beats listing the exceptions,
  // because the list would go stale on the next catalogue edit and the failure
  // would be a wrong answer rather than an error.
  function mineAliases() {
    const owners = new Map();
    NAMEABLE.forEach((entity) => {
      minedFrom(entity).forEach(({ url }) => {
        if (!owners.has(url)) owners.set(url, new Set());
        owners.get(url).add(entity.id);
      });
    });

    const mined = [];
    NAMEABLE.forEach((entity) => {
      minedFrom(entity).forEach(({ text, url }) => {
        if (owners.get(url).size > 1) return;
        mined.push({ entity, text });
      });
    });
    return mined;
  }

  // key -> { entities, tier, standalone }. Tier 1 is the catalogue's own names
  // and the hand table; tier 2 is mined. A tier-1 entry always wins, so a
  // renamed Confluence page can never shadow a product name.
  function buildSurfaceIndex() {
    const surfaces = new Map();

    function register(text, entity, tier) {
      keysFor(text).forEach((key) => {
        if (!key) return;
        const words = key.split(" ");
        // A one-word surface only counts if the word is distinctive. This is what
        // stops "bet" and "api" from resolving anything at all.
        if (words.length === 1 && VAGUE.has(key)) return;
        if (words.length === 1 && key.length < 3) return;

        // A single word MINED from a URL is rejected outright, however
        // distinctive it looks. Player Prop Zone's docs path is
        // .../widgets/match/player-prop-zone, which registered "match" against
        // it -- so on a sports site, "a preview of the match" resolved to Player
        // Prop Zone. Nothing is lost: every legitimate single-word surface
        // (statshub, golf, esports, mma, whitelisting) is a catalogue name or a
        // hand alias and therefore tier 1.
        if (words.length === 1 && tier > 1) return;

        const existing = surfaces.get(key);
        if (existing) {
          // A better tier replaces; the same tier accumulates into ambiguity.
          if (tier < existing.tier) surfaces.set(key, { entities: [entity], tier });
          else if (tier === existing.tier && !existing.entities.includes(entity)) existing.entities.push(entity);
          return;
        }
        surfaces.set(key, { entities: [entity], tier });
      });
    }

    NAMEABLE.forEach((entity) => {
      register(entity.name, entity, 1);
      register(entity.label, entity, 1);
      // "sr packages golf" as well as "golf": the qualified form is what someone
      // types when they know there is more than one sport.
      if (entity.variant) register(`${entity.product.name} ${entity.variant.name}`, entity, 1);
      // Each run of a slash-separated name on its own, so "lcp" reaches
      // LCO / LCP via LMT even though the full name has four words.
      String(entity.name).split("/").forEach((run) => {
        if (run.trim() && run.trim() !== entity.name) register(run, entity, 1);
      });
    });

    Object.keys(ALIASES).forEach((alias) => {
      const target = NAMEABLE.find((entity) => entity.label === ALIASES[alias] || entity.name === ALIASES[alias]);
      if (target) register(alias, target, 1);
    });

    Object.keys(AMBIGUOUS).forEach((alias) => {
      AMBIGUOUS[alias].forEach((name) => {
        const target = NAMEABLE.find((entity) => entity.label === name || entity.name === name);
        if (target) register(alias, target, 1);
      });
    });

    mineAliases().forEach(({ entity, text }) => register(text, entity, 2));

    return surfaces;
  }

  const SURFACES = buildSurfaceIndex();
  const MAX_SURFACE_WORDS = [...SURFACES.keys()].reduce((n, key) => Math.max(n, key.split(" ").length), 1);

  // Whether a family was named, which is a different question from which product.
  const FAMILIES = new Map();
  CATALOGUE.filter((entity) => entity.kind === "family").forEach((entity) => {
    keysFor(entity.name).forEach((key) => FAMILIES.set(key, entity));
  });

  // The four flow types are nameable too: "the difference between a setup flow
  // and an integration flow" is a real question about them, not about a product.
  const FLOW_TYPES = new Map();
  (typeof WORKFLOW_TYPES !== "undefined" ? WORKFLOW_TYPES : []).forEach((type) => {
    FLOW_TYPES.set(type, { kind: "flowType", id: "flowType:" + type, type, label: workflowLabel(type) });
  });

  // Longest n-gram first, over the token array rather than the raw string.
  //
  // Two reasons it is not a substring search. "a preview of the match" never
  // forms the gram "match preview", so word boundaries come free. And consuming
  // the span of a match means "lmt premium" is found before the bare "lmt" gram
  // is ever tried -- so the specific reading always beats the ambiguous one.
  function resolveMentions(query) {
    const tokens = normalise(query).split(" ").filter(Boolean);
    const taken = tokens.map(() => false);
    const mentions = [];

    for (let width = Math.min(MAX_SURFACE_WORDS, tokens.length); width >= 1; width -= 1) {
      for (let at = 0; at + width <= tokens.length; at += 1) {
        let overlaps = false;
        for (let k = at; k < at + width; k += 1) if (taken[k]) overlaps = true;
        if (overlaps) continue;

        const gram = tokens.slice(at, at + width).join(" ");
        const hit = SURFACES.get(gram) || SURFACES.get(gram.replace(/ /g, ""));
        const family = FAMILIES.get(gram);
        const flowType = width === 1 ? FLOW_TYPES.get(gram) : null;
        if (!hit && !family && !flowType) continue;

        mentions.push({
          at,
          width,
          text: gram,
          candidates: hit ? hit.entities.slice() : family ? [family] : [flowType],
          tier: hit ? hit.tier : 1
        });
        for (let k = at; k < at + width; k += 1) taken[k] = true;
      }
    }

    mentions.sort((a, b) => a.at - b.at);

    // A mention whose candidates all appear among the already-resolved entities
    // asks nothing new. "difference between lmt plus and lmt premium" should not
    // stop to ask what "lmt" meant.
    const resolved = mentions.filter((m) => m.candidates.length === 1).map((m) => m.candidates[0]);
    const useful = mentions.filter((mention) => {
      if (mention.candidates.length === 1) return true;
      return !mention.candidates.every((candidate) => resolved.includes(candidate));
    });

    return {
      tokens,
      mentions: useful,
      entities: useful.filter((m) => m.candidates.length === 1).map((m) => m.candidates[0]),
      ambiguous: useful.filter((m) => m.candidates.length > 1)
    };
  }

  /* ---------- the index ---------- */

  // Four weight classes, not one stopword list.
  //
  // There used to be a single STOPWORDS set holding both grammar and the domain
  // words `widget`, `flow` and `setup`. That set had two opposite bugs at once.
  // "widget setup flow" tokenized to NOTHING, so search() returned [] for a
  // perfectly reasonable question. And `difference` and `between` were absent
  // from it, so "what is the difference between X and Y" contributed twelve
  // points to whichever entry happened to contain those words -- which is the
  // one entry titled "What is the difference between LMT Plus, LMT Premium and
  // LMT Virtualised?".
  //
  // Deleting words cannot fix both. `difference` has to stop scoring without
  // disappearing, or "the difference between a setup flow and an integration
  // flow" becomes an empty query and site-flow-types is unreachable forever.
  // So words are weighted, and only zero-weight ones are dropped from scoring.

  const FUNCTION_WORDS = new Set(
    ("a an and are as at be but by can do does for from get got has have how i if in " +
      "is it me my need of on or our so that the their there they this to us use using " +
      "was we what when where which who why will with you your")
      .split(" ")
  );

  // Words that describe the SHAPE of a question and carry no subject matter at
  // all. Zero weight. Kept in the token stream because the intent classifier
  // reads them -- deleting them is what made "the difference between a setup
  // flow and an integration flow" an empty query.
  const INTENT_WORDS = new Set(
    ("difference differences differ vs versus compare comparison better instead rather " +
      "responsible whose list everything explain about mean means")
      .split(" ")
  );

  // Words that are both an intent signal and real subject matter, plus the
  // domain words that are true of nearly every page here. Demoted, not zeroed.
  //
  // `confluence`, `apidocs` and `docs` started out at zero weight, and that
  // broke two curated aliases outright: "confluence page" lost to the
  // page-staleness entry because only "page" could score, and "apidocs link"
  // scored nothing at all and returned no results. A word can shape a question
  // and still be the most distinctive thing in it.
  const DEMOTED_WORDS = new Set(
    ("widget widgets flow flows workflow workflows setup integration integrations " +
      "process licensing product products sport sports " +
      "docs doc documentation apidocs confluence wiki link links " +
      "owns owner ownership team teams steps step")
      .split(" ")
  );

  function weigh(word) {
    if (FUNCTION_WORDS.has(word) || INTENT_WORDS.has(word)) return 0;
    if (DEMOTED_WORDS.has(word)) return 0.25;
    return 1;
  }

  // Every word survives tokenizing now; the weight decides whether it scores.
  // Identifiers are split into their parts, and the joined form is kept as well.
  //
  // The documentation is full of camelCase and snake_case names -- clientId,
  // matchId, dataProviderConfig, widget-name -- and readers type them as
  // separate words. Lowercasing first destroyed the only boundary there was, so
  // `clientId` became the single token `clientid` and "how do I set the client
  // id on LMT Plus" could not match the section that answers it, which says to
  // replace `sportradar` in the widgetloader path with your clientId. Both
  // forms are indexed, because somebody typing "clientid" is equally right.
  const tokenize = (text) => {
    const out = [];
    const raw = String(text).replace(/_/g, " ").replace(/[^A-Za-z0-9\s-]/g, " ");
    for (const chunk of raw.split(/\s+/)) {
      if (!chunk) continue;
      const joined = chunk.toLowerCase();
      if (joined.length > 1) out.push(joined);
      const parts = chunk
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word.length > 1);
      if (parts.length > 1) out.push(...parts);
    }
    return out;
  };

  // Only the words that actually carry subject matter. Coverage is measured
  // against these, so a question made entirely of an entity and an intent is not
  // scored as 0% matched.
  const contentWords = (words) => words.filter((word) => weigh(word) > 0);

  // Trailing plurals and gerunds, so an exact hit handles what the old reverse
  // prefix match was really for. Only when the stem is still a real word.
  function stem(word) {
    if (word.length > 5 && word.endsWith("ing")) return word.slice(0, -3);
    if (word.length > 4 && word.endsWith("es")) return word.slice(0, -2);
    if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
    return word;
  }

  // Field weights. The question and its aliases are what someone is actually
  // typing a version of, so they dominate; the answer body is worth something
  // but a word buried in a long answer should never outrank a title match.
  const WEIGHTS = { question: 6, alias: 5, tag: 3, product: 3, answer: 1 };

  // A passage quoted out of the public product documentation. There are about a
  // thousand of them against seventy-five hand-written and thread-derived
  // entries, so several rules below need to treat them as their own stratum
  // rather than as more of the same. One predicate, so no rule can drift.
  const isDocs = (entry) => entry && entry.source === "docs";

  // "What is X" -- a question after a definition rather than a procedure.
  const DEFINITIONAL = /^\s*(what|whats|what's)\s+(is|are|was|does)\b|\bwhat\s+does\b.*\bmean\b|\bwhat\s+are\b/i;
  const isDefinitional = (question) => DEFINITIONAL.test(String(question || ""));

  // A heading that is step N of something, rather than an account of what a
  // thing is.
  const PROCEDURAL = /\bstep\s*\d|^\s*(how\s+(to|do)|implement|register|download|pass|create|add|configure|install|enable)\b/i;

  // How a question is matched against an entry.
  //
  // Two fields, weighed differently, because they mean different things: a
  // heading says what a passage is ABOUT, a body merely mentions things. `extra`
  // is the authored surface -- aliases, tags, the product name -- which a
  // compiled entry does not have.
  const FIELD = { heading: 3.2, extra: 2.4, body: 1 };

  // Saturation compresses field weighting almost flat -- with k1 = 1.2 a heading
  // hit at weight 3.2 scores 0.73 of the maximum and a body hit 0.45, a ratio of
  // 1.6 rather than 3.2. So heading presence is paid separately and additively.
  // Without this, "what is an adapter" was answered from "Global SIR API >
  // registerAdapter" rather than the section headed "What is an adapter?".
  const HEADING_HIT = 1.15;

  // BM25 saturation and length normalisation. k1 keeps a word repeated ten
  // times from counting ten times; b discounts a long passage for having more
  // chances to contain the word at all. This is the principled version of the
  // passage-length cap that used to be applied by hand in the compiler.
  const K1 = 1.2;
  const B = 0.6;

  // A phrase is worth far more than its words apart. For "client id", 73 of the
  // 1,057 passages contain both words and compete on equal terms; 42 contain
  // them adjacent; exactly ONE has the phrase in its heading, and it is the
  // right answer. Nothing else in this file could see that difference.
  const PHRASE_HEADING = 2.6;
  const PHRASE_BODY = 0.9;

  function fieldCounts(text) {
    const counts = new Map();
    let length = 0;
    for (const word of tokenize(text || "")) {
      if (!weigh(word)) continue; // function words carry no information
      length += 1;
      counts.set(word, (counts.get(word) || 0) + 1);
      // The stem is counted alongside the word so "licences" and "licence" meet
      // in the middle without a reverse prefix rule.
      const root = stem(word);
      if (root !== word) counts.set(root, (counts.get(root) || 0) + 1);
    }
    return { counts, length };
  }

  function buildIndexRows(entries) {
    return entries.map((entry) => {
      const heading = fieldCounts(entry.question);
      const body = fieldCounts(entry.answer);
      const extraText = isDocs(entry)
        ? entry.product || ""
        : [
            entry.product || "",
            ...(entry.aliases || []),
            ...(entry.tags || []).map((tag) => String(tag).replace(/-/g, " ")),
          ].join(" ");
      const extra = fieldCounts(extraText);

      // The phrases somebody actually wrote for this entry. A query that IS one
      // of them is the strongest signal in the corpus and should not have to win
      // on arithmetic.
      const phrases = new Set(
        [entry.question, ...(isDocs(entry) ? [] : entry.aliases || [])]
          .map((text) => normalise(text))
          .filter(Boolean)
      );

      return {
        entry,
        heading: heading.counts,
        extra: extra.counts,
        body: body.counts,
        bodyLen: body.length,
        // Padded with spaces so a phrase test can require whole words.
        headingText: ` ${phraseText(entry.question)} `,
        bodyText: ` ${phraseText(entry.answer)} `,
        phrases,
      };
    });
  }

  // The text a phrase is matched against: tokenised the same way as the index,
  // so `clientId` in the source and "client id" in the question meet.
  function phraseText(text) {
    return tokenize(text || "").join(" ");
  }

  // Corpus statistics, for term rarity. Recomputed whenever the corpus grows --
  // the documentation arrives long after the first index is built, and an idf
  // taken over 75 entries would be meaningless for 1,132.
  const corpus = { n: 0, df: new Map(), avgBodyLen: 1, idf: new Map() };

  function refreshCorpusStats(rows) {
    corpus.n = rows.length;
    corpus.df = new Map();
    corpus.idf = new Map();
    let total = 0;
    for (const row of rows) {
      total += row.bodyLen;
      const seen = new Set([...row.heading.keys(), ...row.extra.keys(), ...row.body.keys()]);
      for (const term of seen) corpus.df.set(term, (corpus.df.get(term) || 0) + 1);
    }
    corpus.avgBodyLen = Math.max(1, total / Math.max(1, rows.length));
  }

  // Inverse document frequency. "widget" is in 52% of the documentation and
  // "provisioning" in 0.1%; before this they counted the same, which is the
  // whole reason a question could be answered from an unrelated page.
  function idf(term) {
    if (corpus.idf.has(term)) return corpus.idf.get(term);
    const df = corpus.df.get(term) || 0;
    const value = Math.log(1 + (corpus.n - df + 0.5) / (df + 0.5));
    corpus.idf.set(term, value);
    return value;
  }

  // `let`, because the documentation corpus arrives later. Every reader below
  // goes through these bindings rather than copying them, so extending the
  // arrays in place is enough -- see absorbDocs().
  let index = buildIndexRows(slackKnowledge.entries);
  let byId = new Map(index.map(({ entry }) => [entry.id, entry]));
  refreshCorpusStats(index);

  // The compiled documentation is about a megabyte, which is far more than the
  // rest of the site put together, so it is not on the boot path. It is fetched
  // when the reader is idle and, failing that, when the panel opens -- and a
  // question asked before it lands waits a moment for it rather than being told
  // there is no answer.
  const docsState = { asked: false, promise: null, loaded: false };

  function absorbDocs(entries) {
    if (!Array.isArray(entries) || !entries.length) return;
    const fresh = entries.filter((entry) => entry && entry.id && !byId.has(entry.id));
    if (!fresh.length) return;
    slackKnowledge.entries = slackKnowledge.entries.concat(fresh);
    const rows = buildIndexRows(fresh);
    index = index.concat(rows);
    rows.forEach(({ entry }) => byId.set(entry.id, entry));
    // Rarity is a property of the whole corpus, so it has to be recomputed now
    // that it is fifteen times larger. An idf taken over the original 75 entries
    // would say "widget" is rare.
    refreshCorpusStats(index);
    docsState.loaded = true;
    // The header states what the assistant knows, so it has to be restated
    // once it knows more.
    if (panel) refreshSubtitle();
  }

  // The header used to list the corpus -- "23 products - 32 flows - 65 solved
  // threads - 1057 doc sections". That is a fact about the machine, not help for
  // the reader, and nobody asking a question needs to be told how many passages
  // were compiled. Removed at the user's request; the dot alone says it is live.
  function refreshSubtitle() {
    const line = panel && panel.querySelector(".sr-ask-subtitle");
    if (!line) return;
    line.innerHTML = '<span class="sr-ask-dot" aria-hidden="true"></span>Ask about any product or flow';
  }

  function loadDocs() {
    if (docsState.promise) return docsState.promise;
    docsState.asked = true;
    docsState.promise = new Promise((resolve) => {
      if (window.betDocsKnowledge) {
        absorbDocs(window.betDocsKnowledge.entries);
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = `${root}shared/docs-knowledge.js?v=1`;
      script.addEventListener("load", () => {
        try {
          absorbDocs((window.betDocsKnowledge || {}).entries);
        } catch (err) {
          /* a corrupt corpus must not take the assistant with it */
        }
        resolve(docsState.loaded);
      });
      // A failed fetch is not an error worth showing: the assistant answers
      // from the catalogue, the diagrams and the threads exactly as before.
      script.addEventListener("error", () => resolve(false));
      document.head.append(script);
    });
    return docsState.promise;
  }

  // Which catalogue entities an entry is about. `entities` is authored where it
  // matters and falls back to `product`, so nothing in knowledge.js has to
  // change for this to work.
  function entitiesOf(entry) {
    const declared = entry.entities || (entry.product ? [entry.product] : []);
    return declared.map((name) => String(name).toLowerCase());
  }

  function search(query, channel, resolved) {
    const words = tokenize(query);
    if (!words.length) return [];
    const content = contentWords(words);

    // The question's own words, deduplicated, with their rarity. This is the
    // information the question carries; how much of it an entry accounts for is
    // what "does the answer answer the question" means here.
    const queryTerms = [...new Set(content)];
    const totalIdf =
      queryTerms.reduce((sum, word) => sum + idf(word) * weigh(word), 0) || 1;

    // Naming a product sets the context; it is not what is being asked. "How do
    // I set the client id on LMT Plus" was answered with the hand-written
    // comparison of the LMT variants, which covers more of the question than any
    // passage only because "lmt" and "plus" are two of its six words. So a second
    // coverage is measured over what remains once the names are removed -- the
    // part that is actually the question.
    const naming = new Set();  // words that merely name the subject
    for (const entity of subjectsOf(resolved)) {
      for (const word of normalise(entity.label).split(" ")) naming.add(word);
    }
    for (const mention of (resolved && resolved.ambiguous) || []) {
      for (const word of normalise(mention.text || "").split(" ")) naming.add(word);
    }
    const topicTerms = queryTerms.filter((word) => !naming.has(word) && !naming.has(stem(word)));
    const topicIdf = topicTerms.reduce((sum, word) => sum + idf(word) * weigh(word), 0) || 0;

    // Contiguous runs of two or more of the question's words, longest first, so
    // only the longest match is paid for -- and built from the TOPIC, never from
    // the product's name.
    //
    // Naming the product used to earn a phrase bonus on every one of that
    // product's passages: "lmt plus" was worth about twenty points to all of
    // them, while "client id" appearing once in a body was worth under one. The
    // question was drowned by its own subject. Which product is being asked
    // about is the entity veto's job; this is the ranking WITHIN that product,
    // and it should turn on what was asked.
    const grams = [];
    const gramSource = content.filter((word) => !naming.has(word) && !naming.has(stem(word)));
    for (let size = Math.min(gramSource.length, 6); size >= 2; size -= 1) {
      for (let at = 0; at + size <= gramSource.length; at += 1) {
        grams.push(gramSource.slice(at, at + size));
      }
    }

    const scored = [];
    const asked = normalise(query);
    const definitional = isDefinitional(query);

    for (const row of index) {
      const { entry, heading, extra, body, bodyLen, headingText, bodyText, phrases } = row;

      // Slack-only. A derived catalogue answer has no channel, and this used to
      // exclude anything without one the moment a channel chip was active.
      if (channel && entry.source === "slack" && entry.channel !== channel) continue;

      let score = 0;
      let matchedIdf = 0;
      let matchedTopicIdf = 0;
      let matched = 0;

      const norm = 1 - B + (B * bodyLen) / corpus.avgBodyLen;

      for (const word of queryTerms) {
        const root = stem(word);
        const at = (field) => (field.get(word) || 0) + (root !== word ? field.get(root) || 0 : 0);

        let tf =
          FIELD.heading * at(heading) + FIELD.extra * at(extra) + (FIELD.body * at(body)) / norm;

        // Prefix matching, so "licens" finds "licensing". One direction only,
        // four characters minimum, no more than three characters of difference.
        // Discounted, and only where nothing matched outright.
        if (!tf && word.length >= 4) {
          for (const term of heading.keys()) {
            if (term.startsWith(word) && term.length - word.length <= 3) {
              tf = FIELD.heading * 0.6;
              break;
            }
          }
          if (!tf) {
            for (const term of body.keys()) {
              if (term.startsWith(word) && term.length - word.length <= 3) {
                tf = (FIELD.body * 0.6) / norm;
                break;
              }
            }
          }
        }

        if (!tf) continue;

        // Rarity from the corpus, and the domain's own sense of which words are
        // furniture. They are not the same thing: idf says "widget" is in half
        // the documentation, and weigh() says that on this site "widget",
        // "flow" and "setup" are scenery whoever wrote them.
        const weight = idf(word) * weigh(word);

        // BM25 saturation: the fifth occurrence of a word says much less than
        // the first, and a term the corpus uses everywhere says least of all.
        score += weight * (tf / (K1 + tf));

        // Paid separately, because saturation cannot express "this word is in
        // the title" strongly enough on its own -- and again only for what was
        // asked, so that every passage of the named product does not collect it
        // equally for carrying the product's name in its heading.
        if (at(heading) && !naming.has(word) && !naming.has(stem(word))) {
          score += weight * HEADING_HIT;
        }

        matchedIdf += weight;
        if (topicTerms.includes(word)) matchedTopicIdf += weight;
        matched += 1;
      }

      if (!matched) continue;

      // A phrase, and where it sits. Only the longest run counts.
      for (const gram of grams) {
        const text = ` ${gram.join(" ")} `;
        const inHeading = headingText.includes(text);
        const inBody = !inHeading && bodyText.includes(text);
        if (!inHeading && !inBody) continue;
        const weight = gram.reduce((sum, word) => sum + idf(word) * weigh(word), 0);
        score += weight * (inHeading ? PHRASE_HEADING : PHRASE_BODY);
        break;
      }

      // How much of the question's information this entry accounts for, 0..1.
      // Weighted by rarity, so matching "widget" and "flow" out of a five-word
      // question is not two-fifths of an answer.
      const coverage = Math.min(1, matchedIdf / totalIdf);
      // Where the question is nothing but a name, topic coverage is undefined,
      // and full coverage is the only honest measure.
      const topicCoverage = topicIdf ? Math.min(1, matchedTopicIdf / topicIdf) : coverage;
      score *= 0.35 + 0.65 * coverage;

      // Entity awareness. An entry that declares which products it is about
      // cannot win a question about a different product. Multiplicative, never
      // additive -- a bonus able to lift a zero-content match over a threshold
      // is the same mistake as the popularity nudge that used to live here.
      const subjects = subjectsOf(resolved);
      if (subjects.length) {
        const declared = entitiesOf(entry);
        const named = subjects.map((entity) => String(entity.label || "").toLowerCase());
        if (declared.length) {
          const covers = named.every((name) => declared.includes(name));
          score *= covers ? 1.6 : 0.4;
        } else if (isDocs(entry) && entry.shared) {
          // A tutorial, adapter or troubleshooting page carries no single
          // product because it genuinely applies to all of them -- an assertion
          // from the scope file, not a gap in it. Not WRONG about the product
          // named, merely not specific to it, so neither reward nor penalty.
          score *= 1;
        } else if (entry.source === "thread" || isDocs(entry)) {
          // An untagged compiled entry is not about everything. A thread is one
          // incident; if the compiler could not tell which product it concerned,
          // that is not a claim to cover all of them.
          score *= 0.4;
        }
      }

      // A navigational heading is real content but rarely an answer.
      if (entry.meta) score *= 0.75;

      // Shape agreement. A definitional question wants a definition, and one
      // word is not a phrase, so nothing above can separate the section headed
      // "What is an adapter?" from "Step 1: Register your adapter". This is the
      // one signal ranking genuinely cannot express, so it is expressed here --
      // as a term in the score rather than as a filter over candidates.
      if (definitional) {
        const heading = String(entry.question || "");
        if (/\bwhat\s+(is|are)\b/i.test(heading)) score *= 1.5;
        else if (PROCEDURAL.test(heading)) score *= 0.7;
      }

      // Doubled, not floored, so it still competes on merit if two entries both
      // claim the phrase -- but an authored phrase beats an incidental word count.
      const exact = phrases.has(asked);
      if (exact) score *= 2;

      scored.push({
        entry,
        score,
        matched,
        coverage,
        topicCoverage,
        exact,
        of: content.length || words.length,
      });
    }

    // Order, then break ties deterministically. The band is relative because
    // BM25 scores are not on the old scale: two answers within 4% of each other
    // fit about equally well whatever the absolute numbers are.
    const rank = (entry) => (entry.source === "site" ? 0 : isDocs(entry) ? 2 : 1);
    const order = (a, b) => {
      const gap = Math.abs(b.score - a.score);
      if (gap > 0.04 * Math.max(a.score, b.score, 1)) return b.score - a.score;
      const asked2 = (b.entry.asked || 0) - (a.entry.asked || 0);
      if (asked2) return asked2;
      const tier = rank(a.entry) - rank(b.entry);
      if (tier) return tier;
      const meta = (a.entry.meta ? 1 : 0) - (b.entry.meta ? 1 : 0);
      if (meta) return meta;
      const length = (a.entry.answer || "").length - (b.entry.answer || "").length;
      if (length) return length;
      const level = (a.entry.headingLevel || 0) - (b.entry.headingLevel || 0);
      if (level) return level;
      return String(a.entry.id) < String(b.entry.id) ? -1 : 1;
    };

    const ranked = scored.sort(order);

    // Two strata, each guaranteed a place. A flat top five became all
    // documentation for "what parameters does bet concierge need", and every
    // rule below that looks for a curated answer does so with `hits.find` --
    // which then finds nothing, making a perfectly good hand-written answer
    // unreachable rather than merely outranked.
    const curated = ranked.filter((hit) => !isDocs(hit.entry)).slice(0, 5);
    // Five, not three. The gate below rejects passages for good reasons -- a
    // navigational heading, a genuine tie -- and a stratum of three meant two
    // rejections buried the passage that would have answered.
    const docs = ranked.filter((hit) => isDocs(hit.entry)).slice(0, 5);
    return [...curated, ...docs].sort(order);
  }

  // Confidence is two rules, not one number, because the two situations are not
  // comparable. With a product resolved, relevance has already been established
  // and the only question is which answer. With nothing resolved we are back to
  // pure bag-of-words and the bar has to be higher.
  // Expressed as information coverage -- the share of the question's rarity-
  // weighted words the answer accounts for -- rather than as a raw score. A raw
  // score is a magic number in whatever units the ranker happens to use, and it
  // drifts every time the corpus grows: the previous 2.5 and 3.0 were tuned
  // against 75 entries and meant nothing against 1,132. Coverage is 0..1 and
  // means the same thing at any size.
  // Calibrated, not chosen. Across the evaluation set the four questions that
  // SHOULD be refused have top-hit coverage of 0.24, 0.30, 0.37 and 0.41, and
  // every answer worth giving is 0.55 or above. 0.45 sits in the gap.
  const CONFIDENT_ENTITY = 0.4;
  const CONFIDENT_NO_ENTITY = 0.45;

  // Only products and sport variants are SUBJECTS. A flow type or a family is a
  // modifier, and using one as the subject vetoes correct answers: "client
  // widget shows a licensing error on a new domain" resolved `licensing` as the
  // Widgets-licensing flow type, which then vetoed the whitelisting entry --
  // the entry that matched 7 of 7 words and is unambiguously the right answer.
  const subjectsOf = (resolved) =>
    (resolved || []).filter((entity) => entity.kind === "product" || entity.kind === "variant");

  function coversResolved(entry, resolved) {
    const subjects = subjectsOf(resolved);
    if (!subjects.length) return true;
    const declared = entitiesOf(entry);
    // A general note is about everything; an untagged incident report is not,
    // and neither is a shared documentation passage. 444 of the thousand-odd
    // passages come from sections owned by no single product -- tutorials,
    // adapters, troubleshooting -- and treating those as covering every product
    // would be the untagged-thread bug again, at six times the scale.
    if (!declared.length) {
      if (isDocs(entry)) return Boolean(entry.shared);
      return entry.source !== "thread";
    }
    return subjects
      .map((entity) => String(entity.label || "").toLowerCase())
      .every((name) => declared.includes(name));
  }

  // How far behind the best answer a curated one may be and still be given.
  // Coverage says what SHARE of the question an entry accounts for and never how
  // much: an entry matching one word of a question whose other words are all
  // function words scores full coverage on almost nothing. "How do I configure a
  // premium Bet Concierge client for MTS" was answered with an explanation of
  // the team switcher, which is not close to being the best answer to anything
  // in that sentence.
  const COMPETITIVE = 0.6;

  function curatedIsConfident(hit, resolved, query, best) {
    if (!hit) return false;
    if (best && hit !== best && hit.score < best.score * COMPETITIVE) return false;

    // An exact authored phrase is sufficient on its own, not merely doubled.
    // "Which workflow do I need for my product?" is built entirely out of
    // demoted domain words -- workflow and product are 0.25 each -- so a
    // verbatim match of the most-asked question in the corpus reached 2.5 and
    // was refused. Typing somebody's question exactly is not a guess to be
    // scored; it is the answer being asked for by name.
    if (hit.exact) return true;

    if (subjectsOf(resolved).length) {
      return hit.coverage >= CONFIDENT_ENTITY && coversResolved(hit.entry, resolved);
    }

    // One content word cannot identify a question. "match" scored 6 against the
    // LMT entry -- one incidental word out of one, so 100% coverage, so it
    // looked like a perfect match. An exact authored phrase is the exception:
    // "whitelisting" on its own is a real question.
    const content = contentWords(tokenize(query));
    if (content.length < 2 && !hit.exact) return false;

    return hit.coverage >= CONFIDENT_NO_ENTITY;
  }

  /* ---------- panel ---------- */

  const state = {
    view: "home",
    channel: null,
    // Every question asked, in order. This is what Back walks back through: a
    // conversation you can only wipe is a conversation you cannot correct, and
    // "I meant the other LMT" should cost one click, not the whole thread.
    history: [],
    open: false
  };

  let panel = null;
  let threadEl = null;
  let inputEl = null;
  let sendEl = null;
  let launcher = null;
  let thinkingEl = null;
  let spacerEl = null;
  let typerTimer = 0;

  const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // BET-Tools: the curated assistant in Onyx, which holds the internal
  // documentation and can actually converse about it.
  //
  // This is a LINK and not an API call, and that is a constraint rather than a
  // preference. Querying Onyx per question needs the API token, the token can
  // only live in GitHub Actions because this site is static, so a live
  // round-trip from the page is not available. What a link does give us is the
  // reader's own session and their own permissions -- they see exactly what
  // they are allowed to see, which no proxy of ours could promise.
  //
  // The app reads a `message` query parameter (confirmed by reading the
  // deployment's own client bundle), so the question travels and nobody retypes
  // it.
  const ONYX = {
    name: "BET-Tools",
    app: "https://onyx.ai.sportradar.online/app",
    agentId: "423"
  };

  const onyxHref = (question) =>
    `${ONYX.app}?agentId=${encodeURIComponent(ONYX.agentId)}` +
    (question ? `&message=${encodeURIComponent(question)}` : "");

  function slackChannelHref(name) {
    return `https://${WORKSPACE}.slack.com/app_redirect?channel=${encodeURIComponent(name)}`;
  }

  // Site entries carry root-relative hrefs like "workflows/x/", which have to be
  // resolved against the site root -- the same href is rendered on the landing
  // page and from two directories down.
  const resolveHref = (href) =>
    /^(https?:)?\/\//.test(href) || href.startsWith("#") ? href : new URL(href, root).href;

  function buildPanel() {
    panel = document.createElement("div");
    panel.className = "sr-ask-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");
    panel.setAttribute("aria-label", "BET assistant");
    panel.dataset.view = "home";
    // What it knows, not what it lacks.
    //
    // This used to read "Slack threads not imported yet" with an amber dot,
    // which was honest when the whole corpus was ten hand-written entries and
    const status = "Ask about any product or flow";

    panel.innerHTML = `
      <div class="sr-ask-head">
        <span class="sr-ask-mark" aria-hidden="true">${icon.spark}</span>
        <div class="sr-ask-head-text">
          <p class="sr-ask-title">BET Assistant</p>
          <p class="sr-ask-subtitle"><span class="sr-ask-dot" aria-hidden="true"></span>${escapeHtml(status)}</p>
        </div>
        <div class="sr-ask-head-actions">
          <button type="button" class="sr-ask-icon-button sr-ask-back" aria-label="Back">${icon.back}</button>
          <button type="button" class="sr-ask-icon-button sr-ask-restart" aria-label="Start a new conversation">${icon.restart}</button>
          <button type="button" class="sr-ask-icon-button sr-ask-close" aria-label="Close the assistant">${icon.close}</button>
        </div>
      </div>

      <div class="sr-ask-body">
        <div class="sr-ask-view sr-ask-view--home"></div>
        <div class="sr-ask-view sr-ask-view--faq"></div>
        <div class="sr-ask-view sr-ask-view--chat">
          <div class="sr-ask-thread" role="log" aria-live="polite" aria-label="Conversation"></div>
        </div>
      </div>

      <form class="sr-ask-composer">
        <label class="sr-visually-hidden" for="sr-ask-input">Ask the assistant a question</label>
        <textarea id="sr-ask-input" class="sr-ask-input" rows="1"
          placeholder="Ask about a product, a flow, or a licence…"
          autocomplete="off"></textarea>
        <button type="submit" class="sr-ask-send" disabled aria-label="Send">${icon.send}</button>
      </form>
    `;

    document.body.append(panel);

    threadEl = panel.querySelector(".sr-ask-thread");
    inputEl = panel.querySelector(".sr-ask-input");
    sendEl = panel.querySelector(".sr-ask-send");

    renderHome();
    renderFaq();
    wirePanel();
  }

  // The home view is deliberately almost empty: one prompt, one field, and an
  // example that types itself. A panel that opens onto a wall of links asks the
  // reader to read before they can ask, which is backwards for a thing whose
  // whole proposition is "just say what you want". The most-asked list is one
  // click away rather than gone -- see renderFaq().
  function renderHome() {
    const home = panel.querySelector(".sr-ask-view--home");

    home.innerHTML = `
      <div class="sr-ask-hero">
        <span class="sr-ask-hero-orb" aria-hidden="true">${icon.spark}</span>
        <h2 class="sr-ask-hero-title">Ask me a question</h2>
        <p class="sr-ask-hero-sub">
          I answer from the team's Slack threads and the workflows on this site,
          and I always show you where it came from.
        </p>
        <button type="button" class="sr-ask-hero-sample">
          <span class="sr-ask-hero-quote" aria-hidden="true">“</span>
          <span class="sr-ask-typed"></span><span class="sr-ask-caret" aria-hidden="true"></span>
        </button>
        <button type="button" class="sr-ask-hero-browse">${icon.list}Browse most asked</button>
      </div>
    `;

    startTypewriter();
  }

  /* ---------- the typed example ---------- */

  // The examples are the top real entries, not invented copy: everything it
  // offers to type is a question it can actually answer, and clicking the line
  // asks it. A placeholder that suggests something the assistant then fails on
  // is worse than no placeholder.
  const samples = () =>
    [...slackKnowledge.entries]
      .sort((a, b) => (b.asked || 0) - (a.asked || 0))
      .slice(0, 5)
      .map((entry) => entry.question);

  let sampleIndex = 0;

  function startTypewriter() {
    stopTypewriter();

    const target = panel.querySelector(".sr-ask-typed");
    const list = samples();
    if (!target || !list.length) return;

    // Reduced motion gets the same information, standing still.
    if (reduceMotion()) {
      target.textContent = list[sampleIndex % list.length];
      return;
    }

    let chars = 0;
    let deleting = false;

    // setTimeout rather than setInterval: the pause at the end of a finished
    // line is most of what makes this readable, and an interval cannot vary.
    const step = () => {
      const full = list[sampleIndex % list.length];
      chars += deleting ? -1 : 1;
      target.textContent = full.slice(0, chars);

      let delay = deleting ? 18 : 34;
      if (!deleting && chars >= full.length) {
        deleting = true;
        delay = 2200;
      } else if (deleting && chars <= 0) {
        deleting = false;
        sampleIndex = (sampleIndex + 1) % list.length;
        delay = 380;
      }

      typerTimer = window.setTimeout(step, delay);
    };

    typerTimer = window.setTimeout(step, 500);
  }

  // Called on every route away from home and on close. A timer left running
  // behind a hidden view is a wasted wake-up on all 27 pages.
  function stopTypewriter() {
    if (typerTimer) window.clearTimeout(typerTimer);
    typerTimer = 0;
  }

  /* ---------- most asked ---------- */

  function renderFaq() {
    const view = panel.querySelector(".sr-ask-view--faq");

    // Ranked by how often the question comes up, which is the only ordering that
    // makes a "most asked" list mean anything.
    const top = [...slackKnowledge.entries]
      .filter((entry) => !state.channel || entry.channel === state.channel)
      // A documentation heading is not a question anybody asked. They all carry
      // asked: 0 so they cannot reach this list today, but the list is ordered
      // by a field a future ingest could set, and "Required Parameters" is not
      // a most-asked question.
      .filter((entry) => !isDocs(entry))
      .sort((a, b) => (b.asked || 0) - (a.asked || 0))
      .slice(0, 6);

    // The question alone. This carried a "Site knowledge · asked 31×" line under
    // each row and it earned its space on neither count: the source is already
    // stated under the answer, where it is load-bearing, and the ask count is a
    // number the reader can do nothing with. `asked` still decides the order --
    // it just no longer announces itself.
    const faq = top
      .map(
        (entry, position) => `
          <button type="button" class="sr-ask-faq-item" data-entry="${escapeHtml(entry.id)}">
            <span class="sr-ask-faq-rank" aria-hidden="true">${position + 1}</span>
            <span class="sr-ask-faq-text">${escapeHtml(entry.question)}</span>
          </button>`
      )
      .join("");

    const channels = (slackKnowledge.channels || [])
      .map(
        (channel) => `
        <button type="button" class="sr-ask-chip" data-channel="${escapeHtml(channel.name)}"
          aria-pressed="${state.channel === channel.name}"
          title="${escapeHtml(channel.purpose || "")}">#${escapeHtml(channel.name)}</button>`
      )
      .join("");

    view.innerHTML = `
      <div class="sr-ask-section-title">
        <span>Most asked</span>
        ${state.channel ? `<span class="sr-ask-section-note">in #${escapeHtml(state.channel)}</span>` : ""}
      </div>
      <div class="sr-ask-faq">${
        faq || `<p class="sr-ask-hero-sub">Nothing indexed for that channel yet.</p>`
      }</div>

      ${channels ? `
        <div class="sr-ask-section-title"><span>Narrow to a channel</span></div>
        <div class="sr-ask-chips">${channels}</div>` : ""}
    `;
  }

  /* ---------- routing ---------- */

  // The one place that changes the view. Everything that has to follow a route
  // change happens here rather than at the four call sites -- the typewriter is
  // stopped on the way out of home and restarted on the way back in, and the
  // nav buttons are re-evaluated. Leaving updateNav() to the callers is exactly
  // how "Browse most asked" ended up on a view with no way back.
  function goTo(view) {
    state.view = view;
    panel.dataset.view = view;
    if (view === "home") startTypewriter();
    else stopTypewriter();
    updateNav();
  }

  function wirePanel() {
    panel.querySelector(".sr-ask-close").addEventListener("click", () => close());
    panel.querySelector(".sr-ask-restart").addEventListener("click", restart);
    panel.querySelector(".sr-ask-back").addEventListener("click", goBack);

    panel.querySelector(".sr-ask-composer").addEventListener("submit", (event) => {
      event.preventDefault();
      const question = inputEl.value.trim();
      if (question) ask(question);
    });

    inputEl.addEventListener("input", () => {
      sendEl.disabled = !inputEl.value.trim();
      // Grow with the text up to the max-height the stylesheet sets, then let it
      // scroll. Reset first, or the field only ever gets taller.
      inputEl.style.height = "auto";
      inputEl.style.height = `${inputEl.scrollHeight}px`;
    });

    // Enter sends, Shift+Enter breaks the line -- the convention every chat the
    // reader already uses follows, Slack included.
    inputEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        const question = inputEl.value.trim();
        if (question) ask(question);
      }
    });

    // One delegated handler for everything clickable inside the body: the FAQ
    // rows, the channel chips, the follow-up chips and the answer ratings are
    // all re-rendered as the conversation goes, and rebinding them each time is
    // how a handler gets attached twice.
    panel.querySelector(".sr-ask-body").addEventListener("click", (event) => {
      const faq = event.target.closest(".sr-ask-faq-item, .sr-ask-followup");
      if (faq) {
        // Composed answers live in their own map: they are deliberately not in
        // slackKnowledge.entries, or they would leak into the most-asked list
        // and the hero typewriter would start offering machine-written text.
        const entry = byId.get(faq.dataset.entry) || derivedById.get(faq.dataset.entry);
        if (entry) ask(entry.question, entry);
        return;
      }

      const chip = event.target.closest(".sr-ask-chip[data-channel]");
      if (chip) {
        state.channel = state.channel === chip.dataset.channel ? null : chip.dataset.channel;
        renderFaq();
        return;
      }

      if (event.target.closest(".sr-ask-hero-browse")) {
        renderFaq();
        goTo("faq");
        return;
      }

      // Clicking the line that is typing itself asks that question. It is the
      // only reason to put a real question there rather than lorem placeholder
      // text, and without it the reader has to retype what they just read.
      if (event.target.closest(".sr-ask-hero-sample")) {
        const list = samples();
        if (list.length) ask(list[sampleIndex % list.length]);
        return;
      }

      const rate = event.target.closest(".sr-ask-rate-button");
      if (rate) {
        const group = rate.closest(".sr-ask-rate");
        if (group.dataset.rated) return;
        group.dataset.rated = rate.dataset.rating;
        rate.setAttribute("aria-pressed", "true");
        // Nowhere to post it: the site is static. The acknowledgement is the
        // response, and it is deliberately not remembered across a reload --
        // same reasoning as the page feedback in the footer.
        group.querySelector(".sr-ask-rate-label").textContent =
          rate.dataset.rating === "up" ? "Glad that helped." : "Noted — thanks.";
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.open) close();
    });
  }

  /* ---------- reading the flow diagrams ---------- */

  // The catalogue says a product HAS a setup flow. Only the diagram says what
  // the steps are and who owns them, and that is most of what these pages exist
  // to convey -- 194 step cards across 32 flows, none of it previously visible
  // to the assistant.
  //
  // Read live rather than pre-baked into a generated file. A snapshot of 32
  // pages goes stale the moment somebody edits a flow through the admin, and the
  // assistant would then describe a step that no longer exists with complete
  // confidence. Fetching is always current by construction.

  const flowCache = new Map();

  // One selector for all five card shapes on the site (.stage-card, .task-card,
  // .stage-action, .optional-card, .widget-card). Keying on the invariant -- a
  // clickable thing that names an owner and opens a detail dialog -- rather than
  // on class names, which vary per flow and would need a list nobody maintains.
  function extractSteps(doc) {
    const cards = [...doc.querySelectorAll("[data-dialog][data-owner]")];

    const steps = cards.map((card, position) => {
      const dialog = doc.getElementById(card.getAttribute("data-dialog"));
      const pick = (root, selector) => {
        const found = root && root.querySelector(selector);
        return found ? found.textContent.trim().replace(/\s+/g, " ") : "";
      };

      // The title is the first bare <strong> -- it carries no class on any page.
      const strong = card.querySelector("strong");

      // .summary on most pages, a classless <span> on the task-card flows.
      let summary = pick(card, ".summary");
      if (!summary) {
        const spans = [...card.querySelectorAll("span")].filter(
          (span) => !span.className && span.textContent.trim().length > 24
        );
        summary = spans.length ? spans[0].textContent.trim().replace(/\s+/g, " ") : "";
      }

      // The human owner, never the data-owner slug: a reader must not be told a
      // step is owned by "sdsup". The dialog's owner line is the fallback,
      // because it is the only place the team appears on pages whose cards
      // carry no number.
      const owner =
        pick(card, ".owner") ||
        pick(dialog, ".dialog-owner").split("·").pop().trim();

      return {
        order: parseInt(pick(card, ".stage-number, .task-number"), 10) || position + 1,
        title: (strong ? strong.textContent.trim().replace(/\s+/g, " ") : "") || pick(dialog, "h2"),
        summary,
        owner,
        ownerKey: card.getAttribute("data-owner")
      };
    });

    const usable = steps.filter((step) => step.title && step.owner);

    // Decline wholesale rather than return a partial list. widgets-licensing is
    // a sports catalogue, not a flow: its cards would otherwise be reported as
    // "Soccer (23)" owned by BETI. Being able to say "this page is not shaped
    // like a flow" is worth more than parsing it optimistically.
    if (usable.length < 2) return null;
    if (usable.length / Math.max(1, cards.length) < 0.6) return null;
    if (usable.filter((step) => step.summary).length / usable.length < 0.6) return null;

    // Stable sort, so the four parallel steps that share a number on
    // statshub-setup-flow keep their document order.
    return usable
      .map((step, i) => ({ step, i }))
      .sort((a, b) => a.step.order - b.step.order || a.i - b.i)
      .map(({ step }) => step);
  }

  // Same-origin only, cached for the session. Each entry is a record rather than
  // a bare promise, because the composer needs to ask "is it here yet?" without
  // awaiting -- a promise cannot answer that.
  function loadFlow(href) {
    const url = resolveHref(href);
    if (flowCache.has(url)) return flowCache.get(url);

    const record = { url, settled: false, steps: null, promise: null };

    // The page we are standing on needs no request at all, which is the common
    // case for an in-page assistant.
    if (url === location.href.split(/[?#]/)[0]) {
      record.steps = extractSteps(document);
      record.settled = true;
      record.promise = Promise.resolve(record.steps);
      flowCache.set(url, record);
      return record;
    }

    record.promise = fetch(url, { credentials: "same-origin" })
      .then((res) => (res.ok ? res.text() : null))
      .then((html) => (html ? extractSteps(new DOMParser().parseFromString(html, "text/html")) : null))
      .catch(() => null) // file://, offline, or a page that has moved
      .then((steps) => {
        record.steps = steps;
        record.settled = true;
        return steps;
      });

    flowCache.set(url, record);
    return record;
  }

  // Kicked off as soon as the products are known, so the existing 420ms
  // thinking beat is spent on it rather than added to. That delay is there for
  // pacing, and turning it into a network wait would make it variable.
  function warmFlows(resolved) {
    const records = [];
    subjectsOf(resolved.entities).forEach((entity) => {
      entity.paths.forEach((path) => records.push(loadFlow(path.href)));
    });
    return records;
  }

  // Whatever has arrived. Returns null when the page declined to parse, and
  // undefined when the request has not landed -- the composer treats those
  // differently, because one is "this page is not a flow" and the other is
  // "ask me again".
  function stepsIfReady(href) {
    const record = flowCache.get(resolveHref(href));
    if (!record || !record.settled) return undefined;
    return record.steps;
  }

  /* ---------- what kind of question is this ---------- */

  // No model, no training data: a question's shape is readable from the words
  // that describe it rather than its subject, which is exactly what the
  // zero-weight INTENT_WORDS are. Ordered, first match wins.
  function classify(query, resolved) {
    const text = " " + normalise(query) + " ";
    const subjects = subjectsOf(resolved.entities);
    const flowTypes = resolved.entities.filter((entity) => entity.kind === "flowType");
    const family = resolved.entities.find((entity) => entity.kind === "family");

    const has = (re) => re.test(text);

    // A comparison needs two things to compare. The marker alone is not enough:
    // "the difference between the H2H docs and Confluence" names one product,
    // and answering it as a comparison would be nonsense.
    const comparing = has(/\b(difference|differences|differ|vs|versus|compare|comparison|better|instead|rather)\b/);
    if (comparing && subjects.length + flowTypes.length >= 2) return "compare";

    // "links" means WHERE the documentation is. It used to mean any question
    // containing the word, which sent "what does the documentation say about
    // required parameters" to the page-list answer -- so the passage that
    // actually answered it could never compete. The word now needs a
    // where-shaped question, or nothing but the product name beside it.
    const mentionsDocs = has(/\b(docs?|documentation|apidocs|confluence|wiki)\b/);
    const whereShaped =
      has(/\bwhere\b/) ||
      has(/\b(link|links|page|pages|url)\b/) ||
      has(/\b(find|read|documented)\b/);
    if ((mentionsDocs && (whereShaped || nothingButTheName(query, resolved))) ||
        has(/\bwhere\b.*\b(find|read|documented|link)\b/)) return "links";

    // "who" alone is not an ownership question. "Who won the champions league in
    // 2019" was classified as one and answered with an explanation of the team
    // switcher. Ownership needs ownership vocabulary, or a "who does/should"
    // shape -- never a bare "who".
    if (has(/\b(owns|owner|ownership|responsible|whose)\b/) ||
        has(/\bwhich team\b/) ||
        has(/\bwho\s+(does|do|should|is responsible|owns|handles|runs)\b/)) return "owner";

    // "set" needs its "up". This read "how do I set the client id on LMT Plus"
    // as a request for the setup flow and answered with the four steps of the
    // diagram -- because `set` alone matched, and `steps` is a question about
    // this site's process that no documentation may answer. A configuration
    // question is not a getting-started question.
    if (has(/\b(steps?|walk me through|what happens)\b/) ||
        has(/\bhow do i (start|begin)\b/) ||
        has(/\bhow do i set up\b/) ||
        has(/\bwhere do i start\b/)) return "steps";

    if (has(/\b(flows?|workflows?|diagram|route|routes)\b/) ||
        (flowTypes.length && subjects.length)) return "routes";

    if (family && !subjects.length) return "family";

    // A real what-is question, or a query that is nothing but the product's
    // name. NOT a catch-all: as a fallback it swallowed everything, so "how is
    // match preview priced" returned a product profile instead of admitting it
    // has nothing on pricing. An unrecognised question about a known product
    // should reach the gap answer, which says so.
    if (subjects.length) {
      if (has(/^\s*(what\s|whats\s|what's\s|tell me about\s|explain\s|describe\s|about\s)/) ||
          nothingButTheName(query, resolved)) {
        return "what-is";
      }
    }

    return "unknown";
  }

  /* ---------- answers composed from the catalogue ---------- */

  // Everything below builds an entry of the same shape answerHtml() already
  // renders, with source "derived" so the provenance line is honest about
  // nobody having written it.
  //
  // Two constraints from renderAnswer() that are easy to violate when generating
  // strings: a block becomes a <ul> only if EVERY line in it starts with "-", so
  // a lead-in sentence must be its own block; and there is no link syntax at
  // all, so every URL belongs in links[] or it renders as escaped text.

  const derivedById = new Map();

  function derived(id, question, answer, links, related, entities) {
    const entry = {
      id,
      question,
      answer,
      product: entities && entities.length ? entities[0].label : null,
      links: links || [],
      related: related || [],
      source: "derived",
      asked: 0,
      entities: (entities || []).map((entity) => entity.label)
    };
    derivedById.set(id, entry);
    return entry;
  }

  // A product's own links, in the order a reader wants them: what is on this
  // site first, then the outside world.
  function entityLinks(entity) {
    const links = [];
    entity.paths.forEach((path) => links.push({ title: `${entity.label} — ${path.label}`, href: path.href }));
    if (entity.docs) links.push(entity.docs);
    (entity.confluence || []).forEach((page) => links.push(page));
    return links;
  }

  const listOf = (items) => items.map((item) => `- ${item}`).join("\n");

  // The routes a product has, as prose. Deliberately says nothing about the
  // routes it does NOT have: an absent flow key in the catalogue means "not
  // drawn yet", and reading it as "this product needs no integration work" is
  // the most likely way this composer could state something false.
  function routeSentence(entity) {
    if (!entity.paths.length) return "There is no flow for it on this site — it is a link-out tile.";
    const labels = entity.paths.map((path) => `**${path.label}**`);
    const joined = labels.length === 1
      ? labels[0]
      : labels.slice(0, -1).join(", ") + " and " + labels[labels.length - 1];
    return `On this site it has ${joined}.`;
  }

  function sharedFlowNote(entity) {
    if (!entity.sharedFlowWith.length) return "";
    const others = entity.sharedFlowWith.map((name) => `**${name}**`).join(" and ");
    return `Its flow is shared with ${others} — the tiles open the same diagram, ` +
      `and the documentation is separate for each.`;
  }

  function variantNote(entity) {
    if (!entity.variants.length) return "";
    return `It has one flow per sport: ${entity.variants.map((name) => `**${name}**`).join(", ")}.`;
  }

  function composeWhatIs(entity) {
    const blocks = [
      `**${entity.label}** is a product in *${entity.family.name}*.` +
        (entity.description ? ` ${entity.description}` : ""),
      routeSentence(entity)
    ];

    const docs = [];
    if (entity.docs) docs.push(`**${entity.docs.title}** — the technical page, for a client's engineer.`);
    (entity.confluence || []).forEach((page) => docs.push(`**${page.title}** — the internal page.`));
    if (docs.length) blocks.push(listOf(docs));

    const shared = sharedFlowNote(entity);
    if (shared) blocks.push(shared);
    const variants = variantNote(entity);
    if (variants) blocks.push(variants);

    return derived(
      `derived:what-is:${entity.id}`,
      `What is ${entity.label}?`,
      blocks.join("\n\n"),
      entityLinks(entity),
      [],
      [entity]
    );
  }

  function composeLinks(entity) {
    const pages = [];
    if (entity.docs) {
      pages.push(`**${entity.docs.title}** on apidocs.sportradar.com — how it works and how to call it. ` +
        `This is what you send a client's engineer.`);
    }
    (entity.confluence || []).forEach((page) => {
      pages.push(`**${page.title}** on sportradar.atlassian.net — the internal page: ownership, ` +
        `commercial detail, and the history.`);
    });

    const blocks = [];
    if (!pages.length) {
      blocks.push(`The catalogue has no documentation URL for **${entity.label}** yet — its tile shows ` +
        `the row as "Coming soon".`);
    } else {
      blocks.push(pages.length > 1
        ? `**${entity.label}** has ${pages.length} pages, and they are for different readers:`
        : `**${entity.label}** has one documentation page:`);
      blocks.push(listOf(pages));
    }
    if (entity.paths.length) {
      blocks.push(`The ${entity.paths.map((p) => p.label.toLowerCase()).join(" and ")} on this site ` +
        `is the other place to look.`);
    }

    return derived(
      `derived:links:${entity.id}`,
      `Where is the documentation for ${entity.label}?`,
      blocks.join("\n\n"),
      entityLinks(entity),
      ["site-docs-vs-confluence"],
      [entity]
    );
  }

  function composeRoutes(entity) {
    const blocks = [routeSentence(entity)];
    if (entity.paths.length) {
      blocks.push(listOf(entity.paths.map((path) =>
        `**${path.label}** — ${path.type === "setup"
          ? "getting it provisioned and configured for a client"
          : path.type === "integration"
            ? "the technical work on the client side once setup is done"
            : path.type === "licensing"
              ? "the per-sport licensing route"
              : "a standalone operational process"}.`)));
    }
    const shared = sharedFlowNote(entity);
    if (shared) blocks.push(shared);
    const variants = variantNote(entity);
    if (variants) blocks.push(variants);

    return derived(
      `derived:routes:${entity.id}`,
      `Which flows does ${entity.label} have?`,
      blocks.join("\n\n"),
      entityLinks(entity),
      ["site-flow-types", "site-team-switcher"],
      [entity]
    );
  }

  function composeFamily(family) {
    const members = NAMEABLE.filter((entity) => entity.family === family.family && entity.kind === "product");
    return derived(
      `derived:family:${family.id}`,
      `What is in ${family.name}?`,
      [
        `*${family.name}* has ${members.length} product${members.length === 1 ? "" : "s"}:`,
        listOf(members.map((entity) =>
          `**${entity.label}** — ${entity.description || "no description in the catalogue."}`))
      ].join("\n\n"),
      members.flatMap((entity) => entity.paths.map((path) => ({ title: `${entity.label} — ${path.label}`, href: path.href }))),
      [],
      []
    );
  }

  // Two or more products, compared on the axes the catalogue can actually
  // support. It says outright what it cannot compare, because a neat table has
  // the visual authority of an answer whether or not it earned it.
  function composeCompare(entities) {
    const families = [...new Set(entities.map((entity) => entity.family.name))];
    const sameFamily = families.length === 1;
    const paths = entities.map((entity) => new Set(entity.paths.map((path) => path.href)));
    const sharesFlow = paths.some((set, i) => paths.some((other, j) => i !== j && [...set].some((href) => other.has(href))));
    const names = entities.map((entity) => `**${entity.label}**`);
    const joined = names.slice(0, -1).join(", ") + " and " + names[names.length - 1];

    const blocks = [];

    // Different families, nothing in common: they are not alternatives, and
    // laying them out in parallel would imply they were.
    if (!sameFamily && !sharesFlow) {
      blocks.push(`${joined} are not alternatives to each other.`);
      blocks.push(listOf(entities.map((entity) =>
        `**${entity.label}** — ${entity.description || "no description in the catalogue."} In *${entity.family.name}*.`)));
      blocks.push(`If you are choosing between two things for a client, name the two products and ` +
        `I will compare those.`);
    } else {
      blocks.push(sameFamily
        ? `${joined} are separate products, all in *${families[0]}*.`
        : `${joined} sit in different parts of the catalogue: ${entities.map((entity) => `**${entity.label}** in *${entity.family.name}*`).join(", ")}.`);
      blocks.push(listOf(entities.map((entity) =>
        `**${entity.label}** — ${entity.description || "no description in the catalogue."} ` +
        `${entity.paths.length ? entity.paths.map((p) => p.label).join(" and ") + "." : "No flow on this site."}`)));

      if (sharesFlow) {
        blocks.push(`They share a flow: the tiles open the same diagram. The documentation is separate.`);
      } else {
        blocks.push(`They have no routes in common — each has its own diagram, so start from the ` +
          `tile for the one the client bought.`);
      }
    }

    blocks.push(`That is composed from the catalogue on this site, so it covers what they are and how ` +
      `they are delivered — not which one suits a client. For that, ask the team.`);

    return derived(
      `derived:compare:${entities.map((entity) => entity.id).sort().join("+")}`,
      `What is the difference between ${entities.map((entity) => entity.label).join(" and ")}?`,
      blocks.join("\n\n"),
      entities.flatMap(entityLinks),
      [],
      entities
    );
  }

  // Which route to read the steps from. A scope word in the question wins
  // ("who owns the integration for X"); otherwise the first route the product
  // has, which is setup for almost everything.
  function routeFor(entity, resolved) {
    const wanted = resolved.entities.find((one) => one.kind === "flowType");
    if (wanted) {
      const match = entity.paths.find((path) => path.type === wanted.type);
      if (match) return match;
    }
    return entity.paths[0] || null;
  }

  // Ownership, from the diagram rather than from a guess. Teams are listed in
  // the order the steps run, because "who owns this" usually means "who do I
  // talk to next".
  function composeOwner(entity, resolved) {
    const route = routeFor(entity, resolved);
    if (!route) return null;

    const steps = stepsIfReady(route.href);
    if (!steps || !steps.length) return null;

    const teams = [...new Set(steps.map((step) => step.owner.split("·")[0].trim()))];

    return derived(
      `derived:owner:${entity.id}:${route.type}`,
      `Who owns the ${route.label.toLowerCase()} for ${entity.label}?`,
      [
        `**${entity.label}** ${route.label.toLowerCase()} runs across ` +
          `${teams.length} team${teams.length === 1 ? "" : "s"}, in ${steps.length} steps:`,
        listOf(steps.map((step) =>
          `**${step.order} · ${step.title}** — ${step.owner}`)),
        `Open the flow and use the team switcher to fade out everything somebody else owns.`
      ].join("\n\n"),
      [{ title: `${entity.label} — ${route.label}`, href: route.href }, ...entityLinks(entity).slice(1)],
      ["site-team-switcher"],
      [entity]
    );
  }

  // The steps themselves, with what each one is for.
  function composeSteps(entity, resolved) {
    const route = routeFor(entity, resolved);
    if (!route) return null;

    const steps = stepsIfReady(route.href);
    if (!steps || !steps.length) return null;

    return derived(
      `derived:steps:${entity.id}:${route.type}`,
      `What are the steps for ${entity.label} ${route.label.toLowerCase()}?`,
      [
        `**${entity.label}** ${route.label.toLowerCase()} has ${steps.length} steps:`,
        listOf(steps.map((step) =>
          `**${step.order} · ${step.title}** (${step.owner})` +
          (step.summary ? ` — ${step.summary}` : ""))),
        `Each step opens its own instructions on the flow page.`
      ].join("\n\n"),
      [{ title: `${entity.label} — ${route.label}`, href: route.href }],
      ["site-team-switcher", "site-flow-types"],
      [entity]
    );
  }

  // Which channel to send someone to. Read off the family, and validated against
  // the channels the knowledge base actually declares, so a rename degrades to a
  // channel that exists rather than a dead deep link.
  const FAMILY_CHANNEL = {
    "Widget products": "bet-widgets-support",
    "Packages & combinations": "bet-product",
    "Experiences & engagement": "bet-product",
    "Data & APIs": "bet-api",
    "Operations": "bet-client-setup"
  };

  function channelFor(entity) {
    const known = (slackKnowledge.channels || []).map((channel) => channel.name);
    const wanted = entity ? FAMILY_CHANNEL[entity.family.name] : null;
    if (wanted && known.includes(wanted)) return wanted;
    return known.includes("bet-product") ? "bet-product" : known[0] || null;
  }

  // The product is known, the question is not. Name the gap first: leading with
  // what we do have and burying the miss is how a bot reads as evasive.
  function composeGap(entity, nearby, question) {
    const channel = channelFor(entity);
    const blocks = [
      `I don't have anything on that specific question for **${entity.label}** — it is not in the ` +
        `Slack threads I have indexed, and not in the site notes.`,
      `Here is what I do have for it:`,
      listOf([
        `A product in *${entity.family.name}*${entity.description ? `: ${entity.description}` : "."}`,
        entity.paths.length
          ? `${entity.paths.map((path) => path.label).join(" and ")} on this site.`
          : `No flow on this site.`,
        entity.docs || (entity.confluence || []).length
          ? `Documentation, linked below.`
          : `No documentation URL in the catalogue yet.`
      ])
    ];
    blocks.push(`**${ONYX.name}** has the internal documentation for it and can talk it ` +
      `through — your question goes with you. Or ask in **#${channel || "bet-product"}**, and once ` +
      `somebody answers there that thread gets indexed and I will have it next time.`);

    // The escalation first: it is the one most likely to answer the question
    // that was actually asked.
    const links = [
      { title: `Ask ${ONYX.name} in Onyx`, href: onyxHref(question), strong: true },
      ...entityLinks(entity)
    ];
    if (channel) links.push({ title: `Ask in #${channel}`, href: slackChannelHref(channel) });

    return derived(
      `derived:gap:${entity.id}`,
      `About ${entity.label}`,
      blocks.join("\n\n"),
      links,
      (nearby || []).slice(0, 2).map((hit) => hit.entry.id),
      [entity]
    );
  }

  // A correct answer to an underspecified question, not a miss -- so it renders
  // like any other answer, with the candidates as follow-up chips.
  function composeAmbiguous(mention) {
    const candidates = mention.candidates;
    return derived(
      `derived:ambiguous:${mention.text.replace(/\s+/g, "-")}`,
      `Which ${mention.text}?`,
      [
        `**${mention.text}** could be ${candidates.length} things, and they have separate flows:`,
        listOf(candidates.map((entity) =>
          `**${entity.label}** — ${entity.description || "no description in the catalogue."}`)),
        `Which one did you mean?`
      ].join("\n\n"),
      [],
      candidates.map((entity) => `derived:what-is:${entity.id}`),
      []
    );
  }

  // Compose for the classified intent, or null when nothing can be composed --
  // which is what routes a question to the gap answer.
  function compose(intent, resolved) {
    const subjects = subjectsOf(resolved.entities);
    const family = resolved.entities.find((entity) => entity.kind === "family");
    const flowTypes = resolved.entities.filter((entity) => entity.kind === "flowType");

    if (intent === "compare") {
      if (subjects.length >= 2) return composeCompare(subjects.slice(0, 3));
      // Two flow types and no product is the setup-vs-integration question,
      // which a person already wrote a better answer for.
      if (flowTypes.length >= 2) return byId.get("site-flow-types") || null;
      return null;
    }
    if (intent === "family" && family) return composeFamily(family);
    if (!subjects.length) return null;

    const entity = subjects[0];
    if (intent === "links") return composeLinks(entity);
    if (intent === "owner") return composeOwner(entity, resolved) || composeRoutes(entity);
    if (intent === "steps") return composeSteps(entity, resolved) || composeRoutes(entity);
    if (intent === "routes") return composeRoutes(entity);
    if (intent === "what-is") return composeWhatIs(entity);
    return null;
  }

  /* ---------- conversation ---------- */

  function ask(question, forced) {
    state.history.push(question);
    goTo("chat");

    const asked = appendMessage("you", `<p>${escapeHtml(question)}</p>`);

    inputEl.value = "";
    inputEl.style.height = "auto";
    sendEl.disabled = true;

    // Before the thinking beat, so a diagram fetch and the 420ms pacing delay
    // overlap instead of queueing.
    if (!forced) warmFlows(resolveMentions(question));

    // Same idea for the documentation. If it has not landed yet the question
    // waits a beat for it, because answering "I don't have anything on that"
    // while the answer is still in flight is the one outcome worth avoiding.
    // If it takes longer than this, answer from what is here and let the Onyx
    // fallback do its job.
    const docsReady = docsState.loaded
      ? Promise.resolve(true)
      : Promise.race([
          loadDocs(),
          new Promise((resolve) => setTimeout(() => resolve(false), DOCS_WAIT_MS)),
        ]);

    showThinking();
    // Straight away, so the question travels to the top while the dots are
    // still going rather than jumping there when the answer arrives.
    anchorQuestion();

    // Marks it for the moment the eye needs to find it, and comes off once the
    // scroll has settled -- a highlight that stays is just a colour.
    asked.classList.add("is-landing");
    window.setTimeout(() => asked.classList.remove("is-landing"), 900);

    // The thinking beat and the corpus wait run together rather than in series,
    // so the pacing is unchanged in the normal case where the documentation has
    // already landed.
    Promise.all([
      docsReady,
      new Promise((resolve) => window.setTimeout(resolve, THINKING_MS)),
    ]).then(() => {
      hideThinking();
      answer(question, forced);
      // Re-anchor, not re-scroll: the answer changed the thread's height, so the
      // spacer has to be re-measured. The question is already at the top, so
      // this is invisible unless it needed correcting.
      anchorQuestion({ smooth: false });
    });
  }

  function answer(question, forced) {
    // A question arrived at by clicking its own row is not a search -- the
    // reader has already picked the entry, so scoring it again could only find a
    // different one.
    if (forced) {
      appendMessage("bot", answerHtml(forced, []));
      return;
    }

    const resolved = resolveMentions(question);
    const intent = classify(question, resolved);
    // Started here, not awaited: the fetch runs during the thinking beat that
    // was already going to happen, and whatever has landed by then is used.
    warmFlows(resolved);
    const hits = search(question, state.channel, resolved.entities);
    const chosen = arbitrate(question, resolved, intent, hits);

    // Where the assistant has run out, ask BET-Tools and let the answer land
    // here. The local answer goes up first so the panel is never empty.
    const ranOut = !chosen || (chosen.source === "derived" && chosen.id.startsWith("derived:gap:"));

    if (ranOut) {
      const fallback = chosen
        ? derivedHtml(chosen, [])
        : missHtml(hits, question);
      if (askOnyx(question, fallback)) return;
      appendMessage("bot", fallback);
      return;
    }

    appendMessage("bot", answerHtml(chosen, hits.filter((hit) => hit.entry !== chosen).slice(0, 2)));
  }

  // Overrides, by exact key. A hand-written entry beats a composed one for a
  // specific question shape about specific things -- stated as a lookup rather
  // than as a scoring bonus, because a table is inspectable and a tuning
  // constant gets re-tuned forever and is never right.
  const OVERRIDES = {
    "compare|product:lmt-plus,product:lmt-premium": "site-lmt-variants",
    "compare|product:lmt-plus,product:lmt-virtualised": "site-lmt-variants",
    "compare|product:lmt-premium,product:lmt-virtualised": "site-lmt-variants",
    "compare|product:bet-insights,product:player-prop-zone": "site-bet-insights-ppz",
    // Ownership with no product named: the switcher is the honest answer,
    // because the question is about the diagrams generally.
    "owner|": "site-team-switcher",
    "routes|": "site-which-flow",
    "steps|": "site-which-flow",
    "links|": "site-docs-vs-confluence"
  };

  function overrideFor(intent, resolved) {
    const ids = subjectsOf(resolved.entities).map((entity) => entity.id).sort().join(",");
    const id = OVERRIDES[`${intent}|${ids}`];
    // A key naming an entry that no longer exists is dropped rather than
    // failing at query time.
    return id && byId.has(id) ? byId.get(id) : null;
  }

  // Is the query nothing but the product's name? Extracted from classify() so
  // the documentation gate can ask the same question, because "what-is" is not
  // the same test: "what is the required parameter for bet concierge" also
  // classifies as what-is, and that one has real subject matter in it.
  //
  // Measured over FULL-WEIGHT words only. A demoted word -- widget, flow, setup
  // -- is domain furniture that appears in every question and in every one of
  // the thousand passages, so counting it as subject matter would let a passage
  // win a bare product name.
  function nothingButTheName(query, resolved) {
    const content = normalise(query)
      .split(" ")
      .filter((word) => weigh(word) > 0 || DEMOTED_WORDS.has(word));
    if (!content.length) return false;

    // Measured against the words the READER typed, not the length of the
    // catalogue's label for them. Counting label words meant "Live match
    // tracker" -- three words, an alias of the two-word "LMT Plus" -- did not
    // look like a bare product name, so it was answered with a passage about
    // Live Match Tracker accessibility instead of the product.
    const naming = new Set();
    for (const mention of (resolved && resolved.mentions) || []) {
      for (const word of normalise(mention.text || "").split(" ")) naming.add(word);
    }
    for (const entity of subjectsOf((resolved && resolved.entities) || [])) {
      for (const word of normalise(entity.label).split(" ")) naming.add(word);
    }
    if (!naming.size) return false;

    return content.every((word) => naming.has(word) || naming.has(stem(word)));
  }

  // A query that is only nouns: the reader named a thing rather than asking a
  // question about it. "client id?" and "Live match tracker" are requests to be
  // told what something is, and documentation defines things where a thread
  // records what once happened to one.
  const isTopicQuery = (query) => {
    const words = [...new Set(tokenize(query))];
    // Three words, not five. At five, "statshub iframe shows client inactive"
    // counted as naming a thing and took the answer away from the thread that
    // diagnosed exactly that symptom. A report of something going wrong is not
    // a request for a definition, and length is the cheap, reliable difference:
    // "client id", "live match tracker", "bet concierge".
    if (!words.length || words.length > 3) return false;
    if (SYMPTOM.test(query)) return false;
    return words.every((word) => weigh(word) > 0);
  };

  // Words that mean something is wrong, rather than naming a thing.
  const SYMPTOM =
    /\b(not|no|cannot|can't|fails?|failed|failing|error|errors|broken|missing|wrong|shows?|showing|stuck|blank|empty|slow|down)\b/i;

  // Question shapes that ask for something specific. For these, an answer that
  // addresses the shape beats a curated entry that is merely about the same
  // product: "who owns the setup for LMT Plus" was being answered with the
  // hand-written LMT comparison, which covers LMT Plus correctly and says
  // nothing whatever about ownership.
  const SPECIFIC_INTENTS = new Set(["owner", "steps", "links", "routes", "compare", "family"]);

  // "What is X", where X is not one of our products. The catalogue's what-is
  // handling needs a resolved product, so a documented CONCEPT -- a client id, an
  // adapter, a JWT -- fell through to no definitional handling at all, and the
  // answer came from whichever troubleshooting thread mentioned it most.
  //
  // A thread is a record of one incident. It can say that domains were added to
  // a client id on a Tuesday; it cannot say what a client id is. Documentation
  // can. So for a question of this shape, with no product named, a passage that
  // speaks to it beats a thread outright rather than having to outscore it.
  // Documentation answers a narrow class of question well and everything else
  // badly, so it is allowed to win only when these conditions hold.
  const DOCS_INTENTS = new Set(["what-is", "unknown"]);
  // The same measure, one notch higher: a thousand passages of dense domain
  // prose mean something will always score, and the question is whether it
  // scored because it fits.
  const CONFIDENT_DOCS_ENTITY = 0.45;
  const CONFIDENT_DOCS_NO_ENTITY = 0.5;

  function docPassageMayWin(intent, hit, resolved, question) {
    // 1. Only question shapes external documentation can actually answer.
    //    Ownership, steps, routes and family are questions about THIS site's
    //    diagrams and teams, which no vendor page knows; compare is structurally
    //    wrong from one product's page, and composeCompare exists; links is the
    //    page list, handled above.
    if (!DOCS_INTENTS.has(intent)) return false;

    // 2. A bare product name still belongs to the product profile. Somebody
    //    typing "Match Preview" wants to know what it is and where its flows
    //    are, not one section of its API page.
    const subjects = subjectsOf(resolved.entities);
    if (subjects.length && nothingButTheName(question, resolved)) return false;

    // 3. Enough of the question accounted for. This one condition replaced four
    //    -- a score floor, a word-count floor, a topic-word test and a
    //    navigational-heading test -- because all four were approximating "did
    //    this passage answer what was asked", which coverage measures directly.
    if (hit.exact) return true;
    if (subjects.length) {
      if (!coversResolved(hit.entry, resolved.entities)) return false;
      return hit.coverage >= CONFIDENT_DOCS_ENTITY;
    }
    return hit.coverage >= CONFIDENT_DOCS_NO_ENTITY;
  }

  // The best passage the ranker returned that also clears the gate.
  //
  // This used to narrow the candidates through four stages -- heading match,
  // product specificity, shared-versus-specific, definitional shape -- and then
  // decline if the top two were within 25% of each other. Every one of those
  // stages was compensating for a ranker that could not see term rarity or
  // phrases. Now that it can, they were fighting it: passages with 96% coverage
  // were being declined because something unrelated scored nearby.
  function pickPassage(eligible, subjects) {
    if (!eligible.length) return null;

    // With no product named, a page that applies to every product is the answer,
    // not one product's version of it. "What is an adapter" is answered by the
    // adapter overview, not by Bet Concierge's own section headed the same way.
    // Also not a ranking proxy: it is a judgement about which of two equally
    // good matches the reader meant.
    let pool = eligible;

    // Among answers that fit about equally well. Applied across any gap, it
    // reached past the BET Utility API's own "Coverage API" section at 21.81 to
    // a supported-sports list at 14.49, purely for being shared.
    if (!(subjects || []).length) {
      const close = pool.filter((hit) => hit.score >= pool[0].score * 0.85);
      const general = close.filter((hit) => hit.entry.shared);
      if (general.length) pool = general;
    }

    // Among answers that fit about equally well, the one whose heading carries
    // the least beside the question -- "what is an adapter" is answered by the
    // adapter overview, not by "What is a Self-Service Adapter?", which is true
    // of adapters but narrower than the question.
    //
    // Only where no product was named. With one named the reader has already
    // said how specific they want the answer to be, and preferring the shorter
    // heading sent "what parameters does Custom Bet need" to a generic
    // "Overview > Parameters:" instead of Custom Bet's own "Required
    // Parameters".
    const best = pool[0];
    if (!(subjects || []).length) {
      const close = pool.filter((hit) => hit.score >= best.score * 0.85);
      if (close.length > 1) {
        close.sort(
          (a, b) => tokenize(a.entry.question).length - tokenize(b.entry.question).length
        );
        return close[0];
      }
    }

    return best;
  }

  // Which answer to give, in order. Each rule exists because of a case the one
  // below it gets wrong.
  function arbitrate(question, resolved, intent, hits) {
    const best = hits[0];

    // 1. Somebody wrote an answer for exactly this shape and these things.
    const override = overrideFor(intent, resolved);
    if (override) return override;

    // 2. The reader typed somebody's question or alias verbatim. That is the
    //    strongest signal in the corpus and outranks composition.
    //
    //    "Somebody's" is the operative word: this rule is about an authored
    //    phrase. A documentation heading is not authored for this assistant, and
    //    plenty of them are just the product's name -- so typing "player prop
    //    zone" matched the heading of its own docs page exactly and got a
    //    paragraph of API prose where the product profile belongs. A passage
    //    therefore has to clear its own gate even when the match is exact.
    if (best && best.exact) {
      if (!isDocs(best.entry) || docPassageMayWin(intent, best, resolved, question, hits)) {
        return best.entry;
      }
    }

    // 3. Something was named that means several products. Asking is a correct
    //    answer to an underspecified question, and better than picking one.
    //
    //    Unless the answer is the same whichever one they meant. "How do you set
    //    client id on LMT" was met with "lmt could be 4 things" -- but client id
    //    is set identically for all four, and the tutorial that says so is not
    //    about any single product. Where a SHARED passage answers the question,
    //    the ambiguity is real but immaterial, and asking is just an obstacle.
    if (resolved.ambiguous.length && !subjectsOf(resolved.entities).length) {
      // Only where the question asks something beyond the name. A bare "lmt" has
      // no topic at all, and "which of the four did you mean" is the right
      // answer to it -- deferring there let a passage about LMT properties
      // answer a question that had not been asked yet.
      // Only where the question asks something beyond the name. A bare "lmt" has
      // no topic at all, and "which of the four did you mean" is the right answer
      // to it. Measured against the vague surface itself -- passing every
      // candidate product's label made the name look longer than the question
      // and refused "how do you set client id on LMT".
      const vague = new Set(normalise(resolved.ambiguous[0].text || "").split(" "));
      const asking = contentWords(tokenize(question)).some(
        (word) => !vague.has(word) && weigh(word) === 1
      );
      const shared = asking && pickPassage(
        hits.filter(
          (hit) =>
            isDocs(hit.entry) &&
            hit.entry.shared &&
            docPassageMayWin(intent, hit, resolved, question)
        )
      );
      if (!shared) return composeAmbiguous(resolved.ambiguous[0]);
    }

    // 4. Where the documentation is. This wants an entry that LISTS pages -- an
    //    outline, with links on it. It used to accept anything sourced from
    //    documentation, and once passages existed it started answering "where
    //    are H2H's docs" with one section of one page, which carries no links
    //    at all: the reply arrived with zero links where the composed answer
    //    would have given the apidocs page and both Confluence pages.
    const outlineHit = hits.find((hit) => hit.entry.source === "outline");
    if (intent === "links" && outlineHit && curatedIsConfident(outlineHit, resolved.entities, question, hits[0])) {
      return outlineHit.entry;
    }

    // 5. A specific question shape, answered from the data. Before the curated
    //    check, because relevance to the product is not the same as answering
    //    the question -- see SPECIFIC_INTENTS above.
    if (SPECIFIC_INTENTS.has(intent)) {
      const addressed = compose(intent, resolved);
      if (addressed) return addressed;
    }

    // 6. A curated answer that is actually about what was named. People write
    //    better general answers than this file composes.
    //
    //    Docs entries are excluded here. A docs entry declares its product, so
    //    it COVERS a question about that product and was winning "what is Bet
    //    Concierge" with a list of document titles -- an answer to a question
    //    nobody asked. It is a pointer, it answers rule 4, and everywhere else
    //    it belongs in the follow-up chips.
    //    The filter is positive on purpose. As `!== "docs"` it admitted every
    //    future source by default, which is how a compiled corpus gets to
    //    outrank a hand-written answer by accident.
    // "Hand-written outranks compiled" was only ever enforced against
    // documentation, so a thread could still beat a hand-written answer by
    // scoring a shade higher: "coverage api" returned an incident about an API
    // key rather than the note explaining what the Coverage and Mapping APIs
    // are. Among curated answers that fit about equally well, the authored one
    // wins.
    const curated = hits.filter((hit) =>
      hit.entry.source === "site" || hit.entry.source === "thread" || hit.entry.source === "slack"
    );
    const authored = curated.filter((hit) => hit.entry.source === "site");
    const general =
      authored.length && curated.length && authored[0].score >= curated[0].score * COMPETITIVE
        ? authored[0]
        : curated[0];
    // The best passage that clears the gate, not merely the best passage. Taking
    // only the top one meant a single rejection -- a navigational heading, a
    // tie with another page -- discarded the whole corpus for that question,
    // and "how do I get identifiers" refused while the section that answers it
    // sat one place lower.
    const passage = pickPassage(
      hits.filter((hit) => isDocs(hit.entry) && docPassageMayWin(intent, hit, resolved, question)),
      subjectsOf(resolved.entities)
    );

    // A bare product name is a request for the product, not for something that
    // happened to it. "lmt virtualised" answered "Request completed." from a
    // thread about one trial request. The rule already existed for documentation
    // passages; a thread is just as compiled and just as wrong here. A
    // hand-written note stays eligible, because "player prop zone" genuinely is
    // best answered by the note explaining what it shares with Bet Insights.
    const bareName =
      general &&
      general.entry.source !== "site" &&
      subjectsOf(resolved.entities).length &&
      nothingButTheName(question, resolved);

    if (!bareName && curatedIsConfident(general, resolved.entities, question, hits[0])) {
      // A hand-written answer keeps absolute precedence: somebody chose those
      // words for this question. A THREAD does not -- it is compiled too, and
      // one incident's outcome is not automatically worth more than the
      // documentation. "What parameters does Custom Bet need" was answered by a
      // thread about ticket routing scoring 23.5, while the passage that
      // actually lists the parameters scored 40 and never got asked.
      // A hand-written answer keeps absolute precedence: somebody chose those
      // words for this question. A THREAD does not -- it is compiled too, and
      // one incident's outcome is not automatically worth more than the
      // documentation. They now simply compete on the ranking, where before a
      // passage had to beat a thread by half again to be preferred, because the
      // ranking could not be trusted to order them.
      // A thread is somebody's confirmed resolution of a real incident. Losing
      // it to documentation that scored 16% higher is not an improvement:
      // "StatsHub iframe shows client inactive" went from the thread that
      // diagnosed exactly that (the iframe lacks a fixed height) to a passage
      // about URL structure, on 12.79 against 10.99. Displacing it takes a clear
      // margin, not a nose.
      const DOCS_OVER_THREAD = 1.5;
      const outscored =
        general.entry.source !== "site" &&
        passage &&
        passage.score > general.score * DOCS_OVER_THREAD;

      // A curated answer that accounts for far less of the question than the
      // documentation does is answering a different question. "How do I set the
      // client id on LMT Plus" was met with the hand-written comparison of the
      // three LMT variants -- which scores heavily on the product's name and
      // says nothing about client ids -- and "what markets does Custom Bet
      // support" with a thread about ticket queues.
      //
      // This was previously a word-presence test, which is why it kept being
      // fooled: `includes("id")` matches inside "provides". Coverage measures
      // the same thing properly, weighted by how rare each word is, so the
      // comparison is now between two numbers that mean something.
      const answersLess =
        passage && general.topicCoverage + 0.2 < passage.topicCoverage;

      // And one thing the ranking cannot express, however good it gets.
      //
      // "What is client ID?" put the thread "Domains added to the client ID for
      // LMT" against the documentation's "Client ID Authentication". Both have
      // the phrase in their heading; lexically the thread is a perfectly good
      // match. The difference is not lexical at all: a thread records what was
      // done about a thing on one Tuesday, and cannot say what the thing IS.
      // Documentation can. So for a question after a definition, with no product
      // named, documentation is preferred outright.
      //
      // I removed this rule as a "ranking proxy" and it was not one -- it is an
      // editorial judgement about what the two sources are for.
      // Extended from definitional to include "how do I". A thread records what
      // was done for one client on one day; it answers "what happened", and it
      // is often the best answer to a symptom ("StatsHub iframe shows client
      // inactive"). It does not answer "how do I set a client id" -- that is
      // what documentation is for. Gated on the question's SHAPE, so symptom
      // reports still reach the threads that diagnosed them.
      const askingHowOrWhat =
        isDefinitional(question) ||
        isTopicQuery(question) ||
        /^\s*how\s+(do|does|can|would|should)\s+(i|you|we)\b/i.test(question);
      // And the passage has to be the better match, not merely eligible.
      // Preferring documentation for any "how do I" question sent "how do I get
      // a developer portal user added" to a BET Utility API section, when the
      // thread that says to route it to first-level support is the answer.
      const defining =
        passage &&
        general.entry.source !== "site" &&
        askingHowOrWhat &&
        passage.topicCoverage >= general.topicCoverage;

      if (!outscored && !defining && !answersLess) return general.entry;
    }

    // 6b. A documentation passage, quoted. Below every hand-written answer and
    //     above composition, and gated hard -- see docPassageMayWin. Without it
    //     the corpus is inert; without the gate it answers "what is Match
    //     Preview" with a paragraph about parameters.
    if (passage) return passage.entry;

    // 7. Compose the general case -- what a product is.
    const composed = compose(intent, resolved);
    if (composed) return composed;

    // 8. The product is known but the question is not. Name the gap.
    const subjects = subjectsOf(resolved.entities);
    if (subjects.length) return composeGap(subjects[0], hits, question);

    // 9. Nothing resolved and nothing scored: the existing honest miss.
    return null;
  }

  function answerHtml(entry, alternatives) {
    // A third provenance case. Reusing the "site" wording would claim a person
    // wrote this, which is the one thing a composed answer must not do.
    if (entry.source === "derived") return derivedHtml(entry, alternatives);

    // A resolved troubleshooting thread. It says what it is -- somebody's real
    // answer to somebody's real question, on a date -- because that is both what
    // makes it worth trusting and the reason to check it still holds. Falling
    // through to the branch below labelled these "site knowledge, written from
    // the workflows here", which claimed a person had written them as site notes.
    // A quoted passage. It says it is a quote, shows which page and section it
    // came from, and links the heading anchor -- so the reader can check the
    // wording against the source in one click. Nothing here is reworded, which
    // is the point: a paraphrase can misstate a parameter, a quote cannot.
    if (entry.source === "docs") {
      const where = [entry.pageTitle, entry.heading].filter(Boolean).join(" › ");
      const link = {
        title: where || "Read the documentation",
        href: entry.href,
        strong: true,
      };
      return `
        ${where ? `<div class="sr-ask-quote-where">${escapeHtml(where)}</div>` : ""}
        <blockquote class="sr-ask-quote">${renderAnswer(entry.answer)}</blockquote>
        ${linksHtml([link])}
        <div class="sr-ask-source">${icon.external}<span class="sr-ask-source-text">Quoted from the public ${escapeHtml(
          entry.site || "product documentation"
        )} documentation${entry.updatedAt ? `, updated ${escapeHtml(entry.updatedAt)}` : ""}${
          entry.anchored ? "" : " — it links the page, not the section, because that heading has no anchor"
        }.${entry.shared ? " This page covers more than one product." : ""}</span></div>
        ${rateHtml()}
      `;
    }

    if (entry.source === "thread") {
      return `
        ${renderAnswer(entry.answer)}
        ${linksHtml(entry.links)}
        <div class="sr-ask-source">${icon.slack}<span class="sr-ask-source-text">From a resolved BET troubleshooting thread${
          entry.topic ? ` — <b>${escapeHtml(entry.topic)}</b>` : ""
        }${entry.date ? `, ${escapeHtml(entry.date)}` : ""}. What worked then; worth confirming it still does.</span></div>
        ${followupsHtml(
          (entry.related || [])
            .map((id) => byId.get(id) || derivedById.get(id))
            .filter(Boolean)
            .slice(0, 3)
        )}
        ${rateHtml()}
      `;
    }

    // A docs entry is a POINTER: the compile step can
    // see a document's title and its URL and deliberately never its contents,
    // so the line says that outright rather than letting a list of links read
    // like an answer.
    if (entry.source === "docs") {
      return `
        ${renderAnswer(entry.answer)}
        ${linksHtml(entry.links)}
        <div class="sr-ask-source">${icon.external}<span class="sr-ask-source-text">Titles from the internal documentation tool — the pages themselves are behind sign-in, and I cannot read them.</span></div>
        ${followupsHtml(
          (entry.related || [])
            .map((id) => byId.get(id) || derivedById.get(id))
            .filter(Boolean)
            .slice(0, 3)
        )}
        ${rateHtml()}
      `;
    }

    const source = entry.source === "slack"
      ? `${icon.slack}<span class="sr-ask-source-text">From <b>#${escapeHtml(entry.channel)}</b>${
          entry.author ? ` · answered by ${escapeHtml(entry.author)}` : ""
        }${entry.date ? ` · ${escapeHtml(entry.date)}` : ""}</span>${
          entry.permalink
            ? `<a class="sr-ask-source-link" href="${escapeHtml(entry.permalink)}" target="_blank" rel="noopener">Open thread</a>`
            : ""
        }`
      : `${icon.page}<span class="sr-ask-source-text">Site knowledge — written from the workflows here, not a Slack thread.</span>`;

    const links = linksHtml(entry.links);

    // Follow-ups come from the entry's own `related` list first, and the
    // runner-up search hits fill any gap -- so there is always somewhere to go
    // next, even for an entry nobody has linked up yet.
    const seen = new Set([entry.id]);
    const followups = [
      ...(entry.related || []).map((id) => byId.get(id)),
      ...alternatives.map((hit) => hit.entry)
    ]
      .filter((candidate) => candidate && !seen.has(candidate.id) && seen.add(candidate.id))
      .slice(0, 3);

    const followupHtml = followupsHtml(followups);

    return `
      ${renderAnswer(entry.answer)}
      ${links}
      <div class="sr-ask-source">${source}</div>
      ${followupHtml}
      ${rateHtml()}
    `;
  }

  /* ---------- markup shared by both renderers ---------- */

  function linksHtml(links) {
    if (!(links || []).length) return "";
    return `<div class="sr-ask-links">${links
      .map((link) => {
        const href = resolveHref(link.href);
        const external = /^https?:/.test(href) && !href.startsWith(root);
        return `<a class="sr-ask-link${link.strong ? " sr-ask-link--strong" : ""}" href="${escapeHtml(href)}"${
          external ? ' target="_blank" rel="noopener"' : ""
        }>${link.strong ? icon.spark : external ? icon.external : icon.page}${escapeHtml(link.title)}</a>`;
      })
      .join("")}</div>`;
  }

  function followupsHtml(followups) {
    // "People also asked" must be questions people asked. A documentation
    // heading is neither: "Doc Structure & Tips - Product Overview" turned up
    // as a chip under a question about which workflow to use, which is noise
    // wearing the clothes of a suggestion. The answer already links its own
    // source, so nothing is lost by keeping these out.
    followups = (followups || []).filter((entry) => entry && !isDocs(entry));
    if (!followups.length) return "";
    return `<div class="sr-ask-followups">
        <p class="sr-ask-followups-label">People also asked</p>
        <div class="sr-ask-chips">${followups
          .map(
            (item) =>
              `<button type="button" class="sr-ask-chip sr-ask-followup" data-entry="${escapeHtml(
                item.id
              )}">${escapeHtml(item.question)}</button>`
          )
          .join("")}</div>
      </div>`;
  }

  function rateHtml() {
    return `<div class="sr-ask-rate">
        <span class="sr-ask-rate-label">Did that answer it?</span>
        <button type="button" class="sr-ask-rate-button" data-rating="up" aria-label="Yes" aria-pressed="false">${icon.up}</button>
        <button type="button" class="sr-ask-rate-button" data-rating="down" aria-label="No" aria-pressed="false">${icon.down}</button>
      </div>`;
  }

  // A composed answer, rendered like any other but saying plainly where it came
  // from. The links and the follow-ups are shared with answerHtml() rather than
  // duplicated, because a second copy of that markup would drift.
  function derivedHtml(entry, alternatives) {
    const links = linksHtml(entry.links);

    const seen = new Set([entry.id]);
    const followups = [
      ...(entry.related || []).map((id) => byId.get(id) || derivedById.get(id)),
      ...alternatives.map((hit) => hit.entry)
    ]
      .filter((candidate) => candidate && !seen.has(candidate.id) && seen.add(candidate.id))
      .slice(0, 3);

    return `
      ${renderAnswer(entry.answer)}
      ${links}
      <div class="sr-ask-source">${icon.page}<span class="sr-ask-source-text">Composed from the product catalogue on this site — nobody wrote this answer.</span></div>
      ${followupsHtml(followups)}
      ${rateHtml()}
    `;
  }

  /* ---------- asking BET-Tools ---------- */

  // Where the assistant has run out, ask Onyx and render the answer here.
  //
  // Asynchronous, so it cannot go through arbitrate() -- that returns an entry
  // synchronously. Instead the local answer is rendered immediately and the
  // remote one replaces it if it arrives. The reader is never left watching a
  // spinner with nothing behind it: what they can already be told is on screen
  // from the first frame.
  function askOnyx(question, fallbackHtml) {
    if (!window.betOnyx) return null;
    if (window.betOnyx.status().available === false) return null;

    const message = document.createElement("div");
    message.className = "sr-ask-msg sr-ask-msg--bot";
    message.innerHTML = `<div class="sr-ask-bubble">
        ${fallbackHtml}
        <div class="sr-ask-asking" role="status">
          <span class="sr-ask-typing" aria-hidden="true"><span></span><span></span><span></span></span>
          <span>Asking ${escapeHtml(window.betOnyx.name)}…</span>
        </div>
      </div>`;

    if (spacerEl && spacerEl.parentElement === threadEl) threadEl.insertBefore(message, spacerEl);
    else threadEl.append(message);

    window.betOnyx
      .ask(question)
      .then((reply) => {
        message.querySelector(".sr-ask-bubble").innerHTML = onyxHtml(question, reply);
        anchorQuestion({ smooth: false });
      })
      .catch((error) => {
        // Drop the "asking" line and leave the local answer standing. The
        // reader keeps whatever could be said without Onyx, plus the link.
        // Drop the "asking" line and leave the local answer standing, with the
        // reason and the link. The reader keeps everything that could be said
        // without Onyx.
        const asking = message.querySelector(".sr-ask-asking");
        if (!asking) return;
        asking.outerHTML = onyxUnavailableHtml(question, error);
        anchorQuestion({ smooth: false });
        // Only in the console, and only the machine-readable part: a 422's
        // field list is useful while the request shape is being settled and is
        // not something to put in front of a reader.
        if (error.code === "shape" || error.code === "upstream") {
          console.warn(`betOnyx: ${error.code} — ${error.message}`);
        }
      });

    return message;
  }

  function onyxHtml(question, reply) {
    const links = reply.sources.map((source) => ({ title: source.title, href: source.url }));

    return `
      ${renderAnswer(reply.answer)}
      ${linksHtml(links)}
      <div class="sr-ask-source">${icon.spark}<span class="sr-ask-source-text">Answered by <b>${escapeHtml(window.betOnyx.name)}</b> in Onyx, from the internal documentation, as you — so it reflects what you have access to. Generated, so check it against the ${reply.sources.length ? "sources above" : "documentation"}.</span><a class="sr-ask-source-link" href="${escapeHtml(window.betOnyx.appHref(question))}" target="_blank" rel="noopener">Open in Onyx</a></div>
      ${rateHtml()}
    `;
  }

  // Said once, plainly, with the one thing that would fix it. A reader who
  // cannot reach BET-Tools should not be left guessing whether they are signed
  // out or whether it is broken.
  function onyxUnavailableHtml(question, error) {
    const detail =
      error.code === "signed-out"
        ? `You are not signed in to Onyx in this browser.`
        : error.code === "blocked"
          ? `This page is not yet allowed to call Onyx directly.`
          : escapeHtml(error.message || "BET-Tools could not be reached.");

    // The reason only. The answer this is appended to -- the gap answer or the
    // miss -- already carries the "Ask BET-Tools in Onyx" button, and rendering
    // a second one put the same link in the same reply twice.
    return `<p class="sr-ask-aside">${detail} The link above carries your question.</p>`;
  }

  // The honest miss. Near-misses are offered as suggestions rather than served
  // as the answer, and the channel list is the real fallback: the person who
  // knows is in one of them.
  function missHtml(hits, question) {
    const suggestions = hits.slice(0, 3);

    const nearby = suggestions.length
      ? `<div class="sr-ask-followups">
          <p class="sr-ask-followups-label">Closest things I have</p>
          <div class="sr-ask-chips">${suggestions
            .map(
              (hit) =>
                `<button type="button" class="sr-ask-chip sr-ask-followup" data-entry="${escapeHtml(
                  hit.entry.id
                )}">${escapeHtml(hit.entry.question)}</button>`
            )
            .join("")}</div>
        </div>`
      : "";

    const channels = (slackKnowledge.channels || []).slice(0, 3);
    const askTeam = channels.length
      ? `<div class="sr-ask-links">${channels
          .map(
            (channel) =>
              `<a class="sr-ask-link" href="${escapeHtml(slackChannelHref(channel.name))}"
                target="_blank" rel="noopener"
                title="${escapeHtml(channel.purpose || "")}">${icon.slack}Ask in #${escapeHtml(channel.name)}</a>`
          )
          .join("")}</div>`
      : "";

    // The escalation, before the channels. Onyx holds the internal documentation
    // and can hold a conversation about it, which is more likely to help than
    // waiting for somebody to read a channel.
    const escalate = `<div class="sr-ask-links">
        <a class="sr-ask-link sr-ask-link--strong" href="${escapeHtml(onyxHref(question))}"
           target="_blank" rel="noopener">${icon.spark}Ask ${escapeHtml(ONYX.name)} in Onyx</a>
      </div>`;

    return `
      <p>I don't have an answer for that one — I only know this site's products, its flow diagrams, and what the team has written down.</p>
      ${nearby}
      <p style="margin-top:.75rem"><strong>${escapeHtml(ONYX.name)}</strong> has the internal documentation and can talk it through. Your question goes with you.</p>
      ${escalate}
      <p style="margin-top:.75rem">Or ask the team — once someone answers in Slack, that thread gets indexed and I'll have it next time.</p>
      ${askTeam}
    `;
  }

  // Neither of these scrolls. Where the view goes after an exchange is one
  // decision, made by anchorQuestion() below, and having every append nudge the
  // scroll as well is what produced the jump this replaced.
  function appendMessage(who, html) {
    const message = document.createElement("div");
    message.className = `sr-ask-msg sr-ask-msg--${who}`;
    message.innerHTML = `<div class="sr-ask-bubble">${html}</div>`;
    // Before the spacer, which is always the last thing in the thread.
    if (spacerEl && spacerEl.parentElement === threadEl) threadEl.insertBefore(message, spacerEl);
    else threadEl.append(message);
    return message;
  }

  function showThinking() {
    thinkingEl = document.createElement("div");
    thinkingEl.className = "sr-ask-msg sr-ask-msg--bot";
    thinkingEl.innerHTML = `<div class="sr-ask-bubble sr-ask-typing" aria-label="Looking that up"><span></span><span></span><span></span></div>`;
    if (spacerEl && spacerEl.parentElement === threadEl) threadEl.insertBefore(thinkingEl, spacerEl);
    else threadEl.append(thinkingEl);
  }

  function hideThinking() {
    if (thinkingEl) thinkingEl.remove();
    thinkingEl = null;
  }

  /* ---------- where the view goes after you ask ---------- */

  // Your question goes to the top of the panel and stays there while the answer
  // fills in underneath it.
  //
  // This used to scroll to the very bottom of the thread, which for any answer
  // taller than the panel meant landing past the end of it: the question and the
  // opening sentence were both above the fold, and reading the reply started
  // with scrolling back up to find where it began. Pinning the question is what
  // every chat worth using does, and it costs one measurement.
  const ANCHOR_PAD = 12;

  // Scrolling the last question to the top is only possible if there is content
  // below it to scroll past. A short answer has to be padded, or the browser
  // clamps the scroll and the question settles halfway down instead.
  function sizeSpacer(question, body) {
    if (!spacerEl) {
      spacerEl = document.createElement("div");
      spacerEl.className = "sr-ask-spacer";
      spacerEl.setAttribute("aria-hidden", "true");
    }

    // Measure with the spacer out of the way, or each pass measures the last
    // pass's padding and the thing grows without bound.
    if (spacerEl.parentElement) spacerEl.remove();

    const exchange = threadEl.getBoundingClientRect().bottom - question.getBoundingClientRect().top;
    const shortfall = body.clientHeight - exchange - ANCHOR_PAD * 2;

    // Removed rather than zeroed: the thread is a flex column with a gap, so a
    // zero-height spacer still contributes one gap of dead space.
    if (shortfall > 0) {
      spacerEl.style.height = `${Math.round(shortfall)}px`;
      threadEl.append(spacerEl);
    }
  }

  function anchorQuestion({ smooth = true } = {}) {
    const body = panel.querySelector(".sr-ask-body");
    const questions = threadEl.querySelectorAll(".sr-ask-msg--you");
    const question = questions[questions.length - 1];
    if (!question) return;

    // After layout: the message was appended this tick and has no geometry yet.
    requestAnimationFrame(() => {
      sizeSpacer(question, body);

      // getBoundingClientRect deltas, not offsetTop. The panel is
      // position: fixed, so it is the offsetParent -- offsetTop is measured
      // against the panel and not against the scrolling element, which put the
      // question a header's height off.
      const target =
        body.scrollTop +
        (question.getBoundingClientRect().top - body.getBoundingClientRect().top) -
        ANCHOR_PAD;

      body.scrollTo({
        top: Math.max(0, target),
        behavior: reduceMotion() ? "auto" : "smooth",
      });
    });
  }

  // Wipe the conversation and return to the empty state. Distinct from goBack():
  // this is "forget all that", and it is the one that used to be the only way
  // out of a thread.
  function restart() {
    threadEl.innerHTML = "";
    // innerHTML dropped the node, so drop our handle to it too -- otherwise the
    // next sizeSpacer() calls .remove() on a detached element and appends a
    // stale one back into the thread.
    spacerEl = null;
    state.history = [];
    goTo("home");
    inputEl.focus();
  }

  // One step back, not the whole thread. From the most-asked list it returns to
  // the empty state; inside a conversation it removes the last exchange and
  // leaves everything before it standing, so a misfired question costs one click
  // rather than the context you had built up.
  function goBack() {
    if (state.view === "faq") {
      goTo("home");
      return;
    }

    // Mid-answer: drop the pending lookup with the question that started it,
    // otherwise the reply lands into a thread that no longer has its question.
    hideThinking();

    state.history.pop();

    // The last exchange is the trailing user message and everything after it --
    // one bot reply in the normal case, none if Back landed mid-lookup.
    const messages = [...threadEl.querySelectorAll(".sr-ask-msg")];
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const isQuestion = messages[i].classList.contains("sr-ask-msg--you");
      messages[i].remove();
      if (isQuestion) break;
    }

    if (!state.history.length) goTo("home");
    updateNav();
    // Back onto the previous exchange, held in the same place a fresh one is,
    // so stepping back through a conversation is the same view each time.
    anchorQuestion({ smooth: false });
  }

  // Back is offered whenever there is somewhere to go back to, and Restart only
  // once there is a conversation worth discarding. Buttons that are visible but
  // do nothing are worse than buttons that are not there.
  function updateNav() {
    panel.dataset.nav = state.view === "home" && !state.history.length ? "root" : "deep";
    panel.querySelector(".sr-ask-restart").hidden = state.history.length === 0;
    panel.querySelector(".sr-ask-back").hidden = state.view === "home" && !state.history.length;
  }

  /* ---------- open / close ---------- */

  function open() {
    if (!panel) buildPanel();
    // Guaranteed here, in case the idle callback never ran -- a background tab
    // can sit idle for a long time and then be opened straight away.
    loadDocs();
    updateNav();
    if (state.view === "home") startTypewriter();
    state.open = true;
    panel.dataset.open = "";
    launcher.setAttribute("aria-expanded", "true");
    launcher.classList.remove("is-new");
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch (err) {
      /* private mode -- the pulse simply comes back next load */
    }
    // After the transition, not during: focusing an element mid-transform makes
    // the browser scroll the page to it.
    window.setTimeout(() => inputEl.focus(), 60);
  }

  function close() {
    state.open = false;
    // Nothing is animating behind a closed panel.
    stopTypewriter();
    panel.removeAttribute("data-open");
    launcher.setAttribute("aria-expanded", "false");
    launcher.focus();
  }

  function toggle() {
    if (state.open) close();
    else open();
  }

  /* ---------- launcher ---------- */

  // chrome.js calls this with the footer's actions group, once it exists. The
  // launcher goes in beside the feedback slot rather than inside it: the slot is
  // a two-state grid that fades its contents out the moment somebody rates the
  // page, and the assistant should still be there afterwards.
  function mount(host) {
    if (!host || host.querySelector(".sr-ask-launcher")) return;

    let unseen = false;
    try {
      unseen = !sessionStorage.getItem(SEEN_KEY);
    } catch (err) {
      /* private mode -- treat as unseen, which is the friendlier default */
    }

    launcher = document.createElement("button");
    launcher.type = "button";
    launcher.className = `sr-ask-launcher${unseen ? " is-new" : ""}`;
    launcher.setAttribute("aria-expanded", "false");
    launcher.innerHTML = `
      <span class="sr-ask-launcher-icon" aria-hidden="true">${icon.spark}</span>
      <span>Ask the team</span>
    `;
    launcher.addEventListener("click", toggle);
    launcher.addEventListener("pointerdown", burst);
    launcher.addEventListener("animationend", (event) => {
      // Leave .is-bursting on the element and the hover lift stays overridden
      // for good, so this has to name whichever animation actually ran --
      // sr-ask-press normally, sr-ask-ring-still under reduced motion. (It named
      // a single "sr-ask-burst" for a while after that animation was split in
      // two, and quietly never fired at all.)
      if (/^sr-ask-(press|ring-still)$/.test(event.animationName)) {
        launcher.classList.remove("is-bursting");
      }
    });

    host.append(launcher);

    // Fetch the documentation while the reader is doing something else, so that
    // by the time anybody opens the panel it is usually already there. Idle
    // rather than immediate: nothing on the page is waiting for it, and a
    // megabyte competing with the page's own assets would be a poor trade for
    // people who never ask a question.
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => loadDocs(), { timeout: 4000 });
    } else {
      window.setTimeout(() => loadDocs(), 2000);
    }
  }

  // The press effect: a red ripple from the pointer, and a red ring off the edge
  // of the pill. On pointerdown rather than click, so it starts under the finger
  // instead of a frame after it lifts.
  function burst(event) {
    // Under reduced motion the ripple is skipped and the rest still runs: the
    // stylesheet swaps the travelling ring for one that flashes where it stands.
    // Returning early here, which is what this did, left the button with no
    // press feedback of any kind for anyone with the OS setting on.
    if (!reduceMotion()) {
      const box = launcher.getBoundingClientRect();
      const size = Math.max(box.width, box.height) * 2.2;

      const ripple = document.createElement("span");
      ripple.className = "sr-ask-ripple";
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      // Keyboard activation reports 0,0 for the pointer; fall back to the middle
      // of the button, which is where a press with no coordinates comes from.
      ripple.style.left = `${event.clientX ? event.clientX - box.left : box.width / 2}px`;
      ripple.style.top = `${event.clientY ? event.clientY - box.top : box.height / 2}px`;
      ripple.addEventListener("animationend", () => ripple.remove());
      launcher.append(ripple);
    }

    // Restart rather than ignore a second press: without the reflow the class is
    // already there, the browser sees no change, and a double click animates
    // once.
    launcher.classList.remove("is-bursting");
    void launcher.offsetWidth;
    launcher.classList.add("is-bursting");
  }

  // __resolve and __catalogue are exposed for the test suite only: entity
  // resolution decides every answer below, and it has to be assertable directly
  // rather than inferred from rendered HTML.
  window.betAssistant = {
    mount,
    __resolve: resolveMentions,
    __catalogue: () => CATALOGUE,
    __search: search,
    __confident: curatedIsConfident,
    __subjects: (r) => subjectsOf(r),
    __steps: (href) => loadFlow(href).promise,
    __entries: () => slackKnowledge.entries,
    __weigh: weigh,
    __classify: classify,
    __mayWin: docPassageMayWin
  };
})();
