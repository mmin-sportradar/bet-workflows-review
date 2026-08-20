/* Shared page chrome, loaded by every page in the site.
   - Injects the Sportradar top bar (all pages).
   - Injects the back button and breadcrumb (workflow pages).
   - Runs the team-switcher coach mark and remembers the chosen team.

   Loaded with defer, so it runs after the document is parsed AND after each
   workflow's own non-deferred app.js at the end of body. That ordering is what
   lets the team restore below work by clicking a real button: the page's own
   handler is already listening, so both filtering variants in the repo are
   driven through their existing code rather than reimplemented here. */

(function () {
  const script =
    document.currentScript || document.querySelector('script[src*="chrome.js"]');
  // Every path below is resolved against the site root, which is the parent of
  // /shared/. Keeps the same file working from / and from /workflows/<slug>/.
  const root = new URL("../", script.src).href;

  const STORAGE_KEY = "bet-workflows:team";
  const COACH_FADE_MS = 8000;

  const icon = {
    arrowLeft:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>',
    chevronRight:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
    search:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
    thumbsDown:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"/><path d="M17 14V2"/></svg>',
    meh:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="8" x2="16" y1="15" y2="15"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/></svg>',
    thumbsUp:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/><path d="M7 10v12"/></svg>',
    tag:
      '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M8.62769 1.33432L8.58862 1.33823L8.54956 1.34409L8.51343 1.35092L8.44214 1.37241L8.39722 1.38998L8.30933 1.43686L8.24976 1.47983L8.19507 1.52866L2.16968 7.556C1.63105 8.15851 1.60552 9.05463 2.11499 9.70834L2.19507 9.80502L6.22241 13.8304C6.82495 14.3692 7.72195 14.3947 8.37573 13.8851L8.47144 13.805L14.4714 7.80502C14.5756 7.7009 14.6417 7.5656 14.6609 7.42123L14.6667 7.33334V4.66635C14.6666 2.82566 13.1744 1.33352 11.3337 1.33334L8.62769 1.33432ZM11.3337 2.66635C12.3987 2.66652 13.269 3.49944 13.3298 4.54916L13.3337 4.66635V7.05698L7.55542 12.8363C7.44472 12.9353 7.28451 12.9481 7.17944 12.891L7.13843 12.8617L3.16382 8.88901C3.06488 8.77839 3.05212 8.6181 3.10913 8.51303L3.13843 8.47104L8.94312 2.66635H11.3337ZM9.99976 4.00034C8.89534 4.00051 7.99976 4.89588 7.99976 6.00034C7.99989 7.10468 8.89542 8.00016 9.99976 8.00034C11.1042 8.00034 11.9996 7.10479 11.9998 6.00034C11.9998 4.89577 11.1043 4.00034 9.99976 4.00034ZM9.99976 5.33334C10.3679 5.33334 10.6667 5.63215 10.6667 6.00034C10.6666 6.36841 10.3679 6.66733 9.99976 6.66733C9.6318 6.66715 9.3329 6.3683 9.33276 6.00034C9.33276 5.63226 9.63172 5.33352 9.99976 5.33334Z" fill="#FF0000"></path></svg>'
  };

  // The apidocs tag line. One definition, used by the landing page and by every
  // workflow page, so the glyph lives in a single place.
  function buildTags(labels) {
    const tags = document.createElement("div");
    tags.className = "sr-tags";
    tags.innerHTML = `${icon.tag}<span>${labels.join(", ")}</span>`;
    return tags;
  }

  // Keyed on the page header, which all 26 flows share. The diagram wrapper is
  // not a reliable signal: most flows call it .flow-shell but widgets-licensing
  // calls it .catalog-shell, and keying on that name skipped the whole chrome
  // on that page.
  const isWorkflowPage = Boolean(document.querySelector("header.page-header"));

  // ?coach forces the first-run prompt even when a team is already stored. The
  // stored team is what suppresses it, and that survives a hard refresh and
  // most "clear cache and cookies" runs -- so without this there is no way to
  // look at the prompt again short of wiping site data.
  const forceCoach = /[?&]coach\b/.test(location.search);

  function readTeam() {
    if (forceCoach) return null;
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      return null; // private mode or file:// — degrade to always coaching
    }
  }

  function saveTeam(team) {
    try {
      localStorage.setItem(STORAGE_KEY, team);
    } catch (error) {
      /* not being able to remember is not worth failing the page over */
    }
  }

  // The API Hub's own favicon, vendored alongside the logo.
  function addFavicon() {
    if (document.querySelector('link[rel="icon"]')) return;
    const link = document.createElement("link");
    link.rel = "icon";
    link.href = `${root}shared/favicon.ico`;
    document.head.append(link);
  }

  /* ---------- top bar ---------- */

  function buildTopBar() {
    const bar = document.createElement("header");
    bar.className = "sr-topbar";
    bar.innerHTML = `
      <nav aria-label="Primary navigation">
        <div class="sr-topbar-left">
          <a class="sr-brand" href="${root}" aria-label="BET Workflows home">
            <img src="${root}shared/logo-header.svg" alt="Sportradar" width="150" height="18" />
          </a>
          <div class="sr-navlinks">
            <a class="sr-navlink${isWorkflowPage ? "" : " is-active"}" href="${root}">Explore workflows</a>
            <a class="sr-navlink" href="https://apidocs.sportradar.com/" target="_blank" rel="noopener noreferrer">API Hub</a>
            <a class="sr-navlink" href="https://support.sportradar.com/" target="_blank" rel="noopener noreferrer">Support Portal</a>
          </div>
        </div>
        <div class="sr-topbar-actions"></div>
      </nav>
    `;
    document.body.prepend(bar);
    buildSearch(bar.querySelector(".sr-topbar-actions"));
  }

  /* ---------- search ---------- */

  // Every product/workflow pair as one flat, searchable row. Built from the
  // shared catalogue, so search works identically on all 27 pages.
  function buildSearchIndex() {
    const rows = [];
    families.forEach((family) => {
      family.products.forEach((product) => {
        availableTypes(product).forEach((type) => {
          const label = workflowLabel(type);
          rows.push({
            name: product.name,
            context: `${family.name} · ${label}`,
            // The catalogue's flow paths are relative to the site root, but an
            // absolute URL must be left alone -- concatenating it onto root
            // yields https://site/https://elsewhere, a 404 that only shows up on
            // click.
            href: /^https?:\/\//.test(product[type]) ? product[type] : root + product[type],
            haystack: `${product.name} ${family.name} ${label} ${product.description}`.toLowerCase()
          });
        });

        // Documentation is a row of its own, not a property of a flow: it is how
        // a product with no flow on this site (Product Hub) is reachable at all,
        // and it makes the docs findable by product name from any page.
        const docs = productDocs(product);
        if (docs) {
          rows.push({
            name: product.name,
            context: `${family.name} · ${docs.title}`,
            href: docs.href,
            external: true,
            haystack: `${product.name} ${family.name} ${docs.title} documentation ${product.description}`.toLowerCase()
          });
        }
      });
    });
    return rows;
  }

  function buildSearch(actions) {
    const rows = buildSearchIndex();
    const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "sr-topbar-button";
    trigger.setAttribute("aria-label", "Search");
    trigger.innerHTML = `
      <span class="sr-search-trigger-label">${icon.search}<span>Search</span></span>
      <kbd>${isMac ? "⌘" : "Ctrl"} K</kbd>
    `;
    actions.append(trigger);

    // A native dialog gives the top layer, the backdrop and Escape for free,
    // matching how the rest of the site already opens modals.
    const dialog = document.createElement("dialog");
    dialog.className = "sr-search-dialog";
    dialog.innerHTML = `
      <div class="sr-search-head">
        ${icon.search}
        <input type="search" placeholder="Search products and workflows…" aria-label="Search products and workflows" autocomplete="off" />
        <kbd>Esc</kbd>
      </div>
      <ul class="sr-search-results" role="listbox" aria-label="Search results"></ul>
      <p class="sr-search-empty" hidden>No products or workflows match.</p>
    `;
    document.body.append(dialog);

    const input = dialog.querySelector("input");
    const list = dialog.querySelector(".sr-search-results");
    const empty = dialog.querySelector(".sr-search-empty");
    let shown = [];
    let active = 0;

    function paint() {
      list.innerHTML = shown.map((row, index) => `
        <li>
          <a class="sr-search-hit${index === active ? " is-active" : ""}" href="${row.href}"${row.external ? ' target="_blank" rel="noopener noreferrer"' : ""} role="option" aria-selected="${index === active}">
            <span class="sr-search-hit-name">${row.name}</span>
            <span class="sr-search-hit-context">${row.context}</span>
          </a>
        </li>
      `).join("");
      empty.hidden = shown.length > 0;
      const current = list.querySelector(".is-active");
      if (current) current.scrollIntoView({ block: "nearest" });
    }

    function search(query) {
      const needle = query.trim().toLowerCase();
      // An empty box lists everything, so the palette doubles as a full index.
      shown = needle === "" ? rows.slice() : rows.filter((row) => row.haystack.includes(needle));
      active = 0;
      paint();
    }

    function open() {
      if (dialog.open) return;
      input.value = "";
      search("");
      dialog.showModal();
      input.focus();
    }

    trigger.addEventListener("click", open);
    input.addEventListener("input", () => search(input.value));

    input.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (!shown.length) return;
        active = (active + (event.key === "ArrowDown" ? 1 : -1) + shown.length) % shown.length;
        paint();
        return;
      }
      if (event.key === "Enter" && shown[active]) {
        event.preventDefault();
        // location.href ignores the anchor's target, so Enter would open an
        // outbound doc link in this tab while clicking the same row opens a new
        // one. Match the click.
        const hit = shown[active];
        if (hit.external) window.open(hit.href, "_blank", "noopener");
        else location.href = hit.href;
      }
    });

    // Hovering re-aims the keyboard selection, so the two never disagree.
    list.addEventListener("mousemove", (event) => {
      const hit = event.target.closest(".sr-search-hit");
      if (!hit) return;
      const index = [...list.querySelectorAll(".sr-search-hit")].indexOf(hit);
      if (index === active || index < 0) return;
      active = index;
      paint();
    });

    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });

    document.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        open();
      }
    });
  }

  /* ---------- card polish ---------- */

  // The step cards are laid out by 26 independent stylesheets with different
  // class names, grids and badge positions. Rather than encode each one's
  // geometry, measure what actually collides or sits ragged and correct only
  // that — flows that are already correct are left untouched.
  function polishCards() {
    // Undo anything a previous run applied before measuring. Without this the
    // growth applied in the default view survives into a filtered one, where
    // the collapsed dependency stubs then stretch to enormous heights.
    document.querySelectorAll("[data-sr-grown]").forEach((card) => {
      card.style.aspectRatio = "";
      card.style.height = "";
      card.style.minHeight = "";
      card.style.alignSelf = "";
      card.removeAttribute("data-sr-grown");
    });

    // Several flows size their cards with a fixed aspect-ratio and centre them
    // in the row, so a card whose text runs long pushes its button past the
    // card's own edge. Where that happens, let that grid's cards grow and
    // stretch to a common height — which also gives the buttons a shared
    // baseline to line up on below.
    const overflowing = new Set();
    document.querySelectorAll("[data-dialog]").forEach((card) => {
      const hint = card.querySelector(".detail-hint");
      if (!hint || !card.parentElement) return;
      const style = getComputedStyle(card);
      const cardBox = card.getBoundingClientRect();
      const hintBox = hint.getBoundingClientRect();
      if (!hintBox.height) return;
      if (hintBox.bottom > cardBox.bottom - parseFloat(style.paddingBottom)) {
        overflowing.add(card.parentElement);
      }
    });

    // Let the cards size to their content first. align-self: start matters as
    // much as height: auto — a grid item still stretches to fill its row
    // otherwise, and in these flex-column shells the row is as tall as the
    // viewport, which is what produced 900px-tall cards in the filtered views.
    overflowing.forEach((grid) => {
      grid.querySelectorAll("[data-dialog]").forEach((card) => {
        card.style.aspectRatio = "auto";
        card.style.height = "auto";
        card.style.alignSelf = "start";
        card.setAttribute("data-sr-grown", "");
      });
    });

    // Then equalise each row with an explicit min-height taken from the tallest
    // card in it. This runs for every grid, not just the overflowing ones,
    // because the CSS above stops rows stretching — so without it the cards in
    // a row would size individually to their own text and sit ragged.
    const grids = new Set();
    // Every container the shared contract makes fluid, not just .flow-grid —
    // otherwise the lanes and task lists get neither the row equalising below
    // nor the data-rows count that decides whether their connectors show.
    document
      .querySelectorAll(
        [
          ".flow-grid",
          ".flow-lane",
          ".sportradar-lane",
          ".client-lane",
          ".stage-grid",
          ".widgets-grid",
          ".support-grid",
          ".optional-grid",
          ".task-list",
          ".top-phases",
          ".integration-groups"
        ]
          .map((sel) => `${sel} > [data-dialog]`)
          .join(", ")
      )
      .forEach((card) => grids.add(card.parentElement));
    overflowing.forEach((grid) => grids.add(grid));

    // Every card in a row is equalised, including the ones belonging to another
    // team. There used to be an isCollapsed() exemption here, because a filtered
    // card collapsed to a stub a third the height of its neighbours and being
    // stretched to the row would have left it mostly empty. Those cards now keep
    // their content and only mute, so the row is the height they should take.

    grids.forEach((grid) => {
      const rows = new Map();
      const growable = [];
      // Direct children only. data-dialog marks anything that opens a dialog,
      // which includes the small action button inside a reference note -- and
      // once that note sits in the grid, a descendant search picked the button up
      // as if it were a card and stretched it to the tallest card's height (a
      // 330px tall "View reference" button).
      // The reference note is a card of the grid too -- it just carries its
      // data-dialog on the button inside it -- so include it, or it is the one
      // cell in the row that does not match the others.
      grid.querySelectorAll(":scope > [data-dialog], :scope > .reference-card").forEach((card) => {
        const box = card.getBoundingClientRect();
        if (!box.height) return;
        const key = Math.round(box.top / 20);
        if (!rows.has(key)) rows.set(key, []);
        rows.get(key).push({ card, height: box.height });
        growable.push({ card, height: box.height });
      });

      // Whether a connector reads as a route is a question about geometry, not
      // viewport width: it only means something along a single row. Publishing
      // the count lets CSS hide both the real .flow-arrow elements and the 14
      // flows whose connectors are ::after pseudo-elements this script cannot
      // reach. Written even when the grid has no rows to equalise.
      if (rows.size) grid.dataset.rows = rows.size;
      else delete grid.dataset.rows;

      // One height for the whole grid, not one per row. Equalising per row left
      // a grid with as many different card heights as it had rows, which is what
      // made the steps look ragged wherever the grid wraps -- and it only ever
      // looked right before because the rows happened to compute the same
      // height, a coincidence the fluid type sizing removed.
      //
      // Per GRID rather than per page on purpose: it keeps deliberately distinct
      // groups distinct (virtual-stadium-integration sizes its web and mobile
      // task lists differently) while making each group internally uniform, and
      // leaves .reference-card alone in its own support grid, where it is a
      // full-width note rather than a step.
      // min-height is only a floor, so a card whose content is taller than the
      // measured maximum stays taller and the row is ragged again. That happens
      // for real: switching filters re-expands cards whose icon and title were
      // display:none, and one animation frame later their final height is not
      // yet laid out, so the first measurement comes in short. Re-read after
      // applying and raise the floor until nothing exceeds it.
      if (growable.length > 1) {
        let tallest = Math.max(...growable.map((entry) => entry.height));
        for (let pass = 0; pass < 3; pass += 1) {
          growable.forEach((entry) => {
            entry.card.style.minHeight = `${Math.round(tallest)}px`;
            // Marked so the reset at the top of the next run clears it;
            // otherwise a height measured in one filter state leaks into the
            // next.
            entry.card.setAttribute("data-sr-grown", "");
          });
          const settled = Math.max(
            ...growable.map((entry) => entry.card.getBoundingClientRect().height)
          );
          if (Math.round(settled) <= Math.round(tallest) + 1) break;
          tallest = settled;
        }
      }
    });

    // Line the action buttons up across each row of cards.
    //
    // The card's layout mode is deliberately left alone: these stylesheets set
    // `align-self` on card children, and align-self means "vertical" in grid but
    // "horizontal" in a flex column, so switching a card to flex silently
    // re-aligns everything inside it. Nudging with a transform aligns the
    // buttons without touching the cascade, and reverts cleanly on every re-run.
    const entries = [];
    document.querySelectorAll(".detail-hint").forEach((hint) => {
      const card = hint.closest("[data-dialog]");
      if (!card) return;
      hint.style.transform = "";
      entries.push({ hint, card });
    });

    const rows = new Map();
    entries.forEach((entry) => {
      const hintBox = entry.hint.getBoundingClientRect();
      if (!hintBox.height) return;
      const cardBox = entry.card.getBoundingClientRect();
      entry.bottom = hintBox.bottom;
      entry.height = cardBox.height;
      // How far the button can drop before it runs into the card's own padding.
      entry.slack =
        cardBox.bottom - parseFloat(getComputedStyle(entry.card).paddingBottom) - hintBox.bottom;

      const key = Math.round(cardBox.top / 20);
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key).push(entry);
    });

    rows.forEach((group) => {
      if (group.length < 2) return;
      // Cards of genuinely different heights (a stage holding one tall action
      // beside a stage holding several stacked ones) are not a row to align.
      const heights = group.map((entry) => entry.height);
      if (Math.max(...heights) - Math.min(...heights) > 8) return;

      const target = Math.max(...group.map((entry) => entry.bottom));
      group.forEach((entry) => {
        const drop = Math.min(target - entry.bottom, Math.max(0, entry.slack));
        if (drop > 1) entry.hint.style.transform = `translateY(${Math.round(drop)}px)`;
      });
    });

    // Stop the number badge from sitting on the title. The badge is absolutely
    // positioned against the card's padding box, so adding padding moves the
    // text clear without moving the badge.
    //
    // The push is resolved per grid rather than per card: padding only the
    // cards that happen to collide leaves neighbours in a row sitting on
    // different baselines, which reads as badly centred text. One shared offset
    // per grid keeps a row consistent.
    const holders = new Map();

    document.querySelectorAll(".stage-number, .task-number").forEach((badge) => {
      const card = badge.closest("[data-dialog], .stage-heading");
      if (!card || !card.parentElement) return;

      if (card.dataset.srPadTop !== undefined) card.style.paddingTop = card.dataset.srPadTop;
      if (!holders.has(card.parentElement)) holders.set(card.parentElement, { cards: [], push: 0 });
      holders.get(card.parentElement).cards.push(card);
    });

    holders.forEach((grid) => {
      grid.cards.forEach((card) => {
        const badge = card.querySelector(".stage-number, .task-number");
        const box = badge && badge.getBoundingClientRect();
        if (!box || !box.height) return;

        card.querySelectorAll("h2, strong, .owner, .summary").forEach((text) => {
          const rect = text.getBoundingClientRect();
          const across = Math.min(box.right, rect.right) - Math.max(box.left, rect.left);
          const down = Math.min(box.bottom, rect.bottom) - Math.max(box.top, rect.top);
          // Push far enough that the text clears the badge outright, rather
          // than by the amount they currently overlap.
          if (across > 1 && down > 1) grid.push = Math.max(grid.push, box.bottom + 6 - rect.top);
        });
      });

      if (!grid.push) return;

      grid.cards.forEach((card) => {
        if (card.dataset.srPadTop === undefined) {
          card.dataset.srPadTop = getComputedStyle(card).paddingTop;
        }
        card.style.paddingTop = `${parseFloat(card.dataset.srPadTop) + grid.push}px`;
      });
    });

    // Last, once every card has settled at its final size and position.
    alignArrows();
  }

  // The connector arrows are placed with hardcoded offsets (left: calc(50% -
  // 447px) and friends) that only line up at one viewport width and break as
  // soon as a card changes size. Derive their position from where the cards
  // actually are instead.
  function alignArrows() {
    const arrows = [...document.querySelectorAll(".flow-arrow")];
    if (!arrows.length) return;

    // Drop previous adjustments first so each run measures the stylesheet's own
    // geometry rather than the last run's output.
    arrows.forEach((arrow) => {
      arrow.style.left = "";
      arrow.style.top = "";
      arrow.style.width = "";
      arrow.style.display = "";
    });

    arrows.forEach((arrow) => {
      const style = getComputedStyle(arrow);
      if (style.position === "static" || style.display === "none") return;
      if (!arrow.getBoundingClientRect().width) return;

      let previous = arrow.previousElementSibling;
      while (previous && !previous.matches("[data-dialog]")) previous = previous.previousElementSibling;
      let next = arrow.nextElementSibling;
      while (next && !next.matches("[data-dialog]")) next = next.nextElementSibling;

      const before = previous && previous.getBoundingClientRect();
      const after = next && next.getBoundingClientRect();
      const gap = 14;
      let x;
      let y;

      // The stylesheets give the arrow a fixed width (54px) that is wider than
      // the grid gap, so it bleeds over both cards. Fit it to the gap first,
      // then measure, so the centring below uses the final width.
      if (before && after && Math.abs(before.top - after.top) < 20) {
        const between = after.left - before.right;
        if (arrow.getBoundingClientRect().width > between - 8) {
          arrow.style.width = `${Math.max(20, between - 8)}px`;
        }
      }

      const box = arrow.getBoundingClientRect();

      if (before && after && Math.abs(before.top - after.top) < 20) {
        // Between two cards on the same row: centre it in the gap.
        x = (before.right + after.left) / 2;
        y = (before.top + before.bottom) / 2;
      } else if (before && arrow.previousElementSibling === previous) {
        // Trailing arrow leaving the end of a row.
        x = before.right + gap + box.width / 2;
        y = (before.top + before.bottom) / 2;
      } else if (after) {
        // Entry arrow leading into the next row.
        x = after.left - gap - box.width / 2;
        y = (after.top + after.bottom) / 2;
      } else if (before) {
        x = before.right + gap + box.width / 2;
        y = (before.top + before.bottom) / 2;
      } else {
        return;
      }

      // At narrow widths a row-transition arrow can be pushed past the edge of
      // the page, where it renders as a stray mark. It is decorative, so drop it
      // rather than leave it dangling.
      const viewport = document.documentElement.clientWidth;
      if (x - box.width / 2 < 4 || x + box.width / 2 > viewport - 4) {
        arrow.style.display = "none";
        return;
      }

      // Nudge by the delta from where it currently renders, so whatever
      // transform the stylesheet applies keeps working.
      arrow.style.left = `${(parseFloat(style.left) || 0) + x - (box.left + box.width / 2)}px`;
      arrow.style.top = `${(parseFloat(style.top) || 0) + y - (box.top + box.height / 2)}px`;
    });
  }

  /* ---------- footer ---------- */

  // The apidocs page foot: how old the page is on the left, a helpfulness
  // rating on the right. It replaces the dark branded bar the 26 flows used to
  // end on -- the logotype is already in the top bar on every page, so the foot
  // is free to be about the page rather than about Sportradar.
  //
  // The rating goes nowhere: the site is static and there is no endpoint to
  // post to. The thank-you is the whole response, and it is deliberately not
  // remembered across a reload -- a page that greets you with "Thanks for the
  // feedback" you gave last week reads as a bug, not as a memory.
  // "25 days ago" rather than a date, so the reader can judge staleness without
  // doing the arithmetic. The exact date stays in the title attribute and in
  // the datetime, which is what a machine reads.
  function relativeAge(iso) {
    const then = Date.parse(`${iso}T00:00:00Z`);
    if (Number.isNaN(then)) return null;

    // Whole calendar days between the two dates, not elapsed time: measuring
    // from now would count the hours since midnight as most of another day and
    // report a page stamped 25 days ago as 26.
    const today = new Date();
    const midnight = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const days = Math.round((midnight - then) / 86400000);
    if (days < 0) return null;
    if (days === 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 45) return `${days} days ago`;

    const months = Math.round(days / 30);
    if (months < 18) return `${months} month${months === 1 ? "" : "s"} ago`;

    const years = Math.round(days / 365);
    return `${years} year${years === 1 ? "" : "s"} ago`;
  }

  function buildFooter() {
    // virtual-stadium-integration-flow ships no footer at all, so give it one
    // rather than leaving that page short of the shared row.
    let footer = document.querySelector("footer");
    if (!footer) {
      footer = document.createElement("footer");
      document.body.append(footer);
    }

    // Each page's own last-updated stamp is real content, so it is read off the
    // page rather than rebuilt. The landing page carries none, and simply shows
    // nothing on the left.
    const stamp = footer.querySelector("time");
    const iso = stamp && stamp.getAttribute("datetime");
    const age = iso ? relativeAge(iso) : null;

    footer.classList.add("sr-footer");
    footer.innerHTML = `
      <p class="sr-footer-updated">${
        age
          ? `Last updated <time datetime="${iso}" title="${stamp.textContent.trim()}">${age}</time>`
          : ""
      }</p>
      <div class="sr-feedback-slot">
        <fieldset class="sr-feedback" aria-label="Page feedback">
          <legend class="sr-feedback-legend"><span>Is this site helpful?</span></legend>
          <div class="sr-feedback-buttons">
            <button type="button" class="sr-feedback-button" data-rating="down" aria-label="Thumbs down">${icon.thumbsDown}</button>
            <button type="button" class="sr-feedback-button" data-rating="neutral" aria-label="Neutral">${icon.meh}</button>
            <button type="button" class="sr-feedback-button" data-rating="up" aria-label="Thumbs up">${icon.thumbsUp}</button>
          </div>
        </fieldset>
        <p class="sr-feedback-thanks" role="status"></p>
      </div>
    `;

    const slot = footer.querySelector(".sr-feedback-slot");
    const fieldset = footer.querySelector(".sr-feedback");
    const thanks = footer.querySelector(".sr-feedback-thanks");

    fieldset.addEventListener("click", (event) => {
      const button = event.target.closest(".sr-feedback-button");
      if (!button || slot.dataset.answered) return;

      // The two states live in one grid cell and cross over in place. The
      // question is never removed from the flow -- it only goes invisible --
      // so the slot keeps the width of the wider of the two and the footer
      // does not resize under the animation. Replacing one element with the
      // other, as this did before, changed the row's width halfway through and
      // that is what made the swap look broken.
      slot.dataset.answered = button.dataset.rating;
      button.classList.add("is-chosen");

      // Faded out is not the same as gone: disable the buttons so a keyboard
      // cannot tab into a control nobody can see.
      fieldset.querySelectorAll(".sr-feedback-button").forEach((entry) => {
        entry.disabled = true;
      });

      // Set at answer time, not up front: role="status" announces what appears
      // in it, and text that was already sitting there announces nothing.
      thanks.textContent = "Thanks for the feedback.";
    });
  }

  /* ---------- back button + breadcrumb ---------- */

  function currentSlug() {
    const parts = location.pathname.split("/").filter(Boolean);
    if (parts.length && /\.html?$/i.test(parts[parts.length - 1])) parts.pop();
    return parts[parts.length - 1] || "";
  }

  function buildSubnav() {
    const pageHeader = document.querySelector("header.page-header");
    if (!pageHeader) return;

    // Reuse the row already in the markup when there is one. Inserting this
    // ~108px block from script after the document had parsed pushed the whole
    // diagram down well past first paint, which is the rest of the layout shift
    // on these pages. Building it stays as the fallback for a page that ships
    // without the static row, and the alignment pass at the end runs either way.
    const existing = document.querySelector(".sr-subnav");
    if (existing) {
      alignSubnav(existing, pageHeader);
      window.addEventListener("resize", () => alignSubnav(existing, pageHeader));
      return;
    }

    const subnav = document.createElement("div");
    subnav.className = "sr-subnav";
    subnav.innerHTML = `
      <a class="sr-back" href="${root}">${icon.arrowLeft}Back to workflows</a>
    `;

    // Breadcrumbs come from the shared catalogue, so a workflow page never
    // carries its own copy of where it sits. A folder missing from the
    // catalogue simply gets the back button and no trail.
    const match = typeof findWorkflow === "function" ? findWorkflow(currentSlug()) : null;
    if (match) {
      // Tags sit under the title, as they do on apidocs. The heading block is a
      // plain container in all 26 flows, so appending to it needs no per-page
      // knowledge and leaves the header's flex row alone.
      //
      // They are also pre-rendered into each page's markup, so skip when one is
      // already there. Appending this row from script grew the title block by
      // 32px well after first paint and pushed the whole diagram down -- the
      // single largest layout shift left on these pages. Same idempotence as
      // addFavicon() and buildFooter(). Kept as a fallback so a page without the
      // static row (a new flow, say) still gets its tags.
      if (!pageHeader.querySelector(".sr-tags")) {
        const heading = pageHeader.querySelector("h1");
        if (heading && heading.parentElement) {
          heading.parentElement.append(
            buildTags([match.family.name, match.product.name, workflowLabel(match.type)])
          );
        }
      }

      const crumbs = document.createElement("nav");
      crumbs.setAttribute("aria-label", "Breadcrumb");
      crumbs.innerHTML = `
        <ol class="sr-crumbs">
          <li><a href="${root}">BET Workflows</a>${icon.chevronRight}</li>
          <li><a href="${root}">${match.family.name}</a>${icon.chevronRight}</li>
          <li><span aria-current="page">${workflowLabel(match.type)}</span></li>
        </ol>
      `;
      subnav.append(crumbs);
    }

    // Below the title block, so the page leads with what it is rather than with
    // how to leave it. The header's existing bottom rule separates the two.
    pageHeader.after(subnav);
    alignSubnav(subnav, pageHeader);
    window.addEventListener("resize", () => alignSubnav(subnav, pageHeader));
  }

  // Each flow pads its header differently — clamp(32px,4vw,88px),
  // clamp(36px,5vw,108px), clamp(32px,7vw,150px). Copy whatever this page
  // resolves to so the back button always starts on the same vertical line as
  // the title above it, at every width.
  function alignSubnav(subnav, pageHeader) {
    const header = getComputedStyle(pageHeader);
    subnav.style.paddingLeft = header.paddingLeft;
    subnav.style.paddingRight = header.paddingRight;
    subnav.style.maxWidth = header.maxWidth === "none" ? "" : header.maxWidth;
    subnav.style.marginInline = "auto";
  }

  /* ---------- team switcher: restore, or coach ---------- */

  function placeCoach(bubble, switcher) {
    const rect = switcher.getBoundingClientRect();
    const edge = 12;
    const gap = 12;
    const headerBottom = document.querySelector(".sr-topbar").offsetHeight + 8;
    const width = bubble.offsetWidth;
    const height = bubble.offsetHeight;

    // Aim at the selected button, not at the middle of the whole switcher. The
    // switcher runs 600px wide on most flows against a ~300px bubble, so when
    // the bubble was flush with its right edge the point it was aiming at fell
    // outside the bubble altogether and the arrow sat clamped at its 14px
    // minimum, pointing at nothing. The selected button is also what the
    // message is about ("Showing All teams").
    const aim = (switcher.querySelector(".team-button.selected") || switcher).getBoundingClientRect();
    const aimCentre = aim.left + aim.width / 2;

    // clientWidth, not innerWidth: the latter includes the scrollbar, so
    // right-clamping against it pushes the bubble past the visible area and
    // widens the page.
    const viewport = document.documentElement.clientWidth;
    const left = Math.max(edge, Math.min(aimCentre - width / 2, viewport - width - edge));

    // Below the switcher by default. Above it is the title block; to its left
    // the title runs long on several flows. Two things send it above instead:
    // running out of viewport, and landing on the scenario switcher -- three
    // flows have one, and when the header stacks it sits directly under the
    // team switcher, exactly where this wants to go.
    const scenario = document.querySelector(".page-header .scenario-switcher");

    function hits(candidateTop) {
      if (!scenario) return false;
      const s = scenario.getBoundingClientRect();
      if (!s.height) return false;
      const apart =
        candidateTop + height <= s.top ||
        candidateTop >= s.bottom ||
        left + width <= s.left ||
        left >= s.right;
      return !apart;
    }

    let top = rect.bottom + gap;
    let below = true;
    const roomAbove = rect.top - height - gap >= headerBottom;
    if ((top + height > window.innerHeight - edge || hits(top)) && roomAbove) {
      top = rect.top - height - gap;
      below = false;
    }

    bubble.style.top = `${top}px`;
    bubble.style.left = `${left}px`;
    bubble.classList.toggle("is-below", below);
    // Keep the pointer on that button even when the bubble was nudged inward to
    // stay on screen; the clamps keep it within the bubble's own rounded ends.
    bubble.style.setProperty(
      "--sr-coach-arrow",
      `${Math.max(14, Math.min(aimCentre - left, width - 14))}px`
    );
  }

  // The spotlight is an empty box laid over the switcher; the dim is its
  // box-shadow, so the control shows through it untouched. Sized here rather
  // than in CSS because only the measured rect knows where the switcher is in
  // any given flow's header.
  //
  // Edge to edge with the control, with no halo around it: a padded hole leaves
  // a band of lit page around the switcher that belongs to neither, and the
  // outline ring landed exactly on that boundary, so the red line read as
  // sitting on the lit patch's edge rather than around the control. The radius
  // is copied from the switcher for the same reason -- the flows shape it
  // differently, and a fixed radius cuts the corners at a different curve.
  function placeVeil(veil, target) {
    const rect = target.getBoundingClientRect();
    veil.style.top = `${rect.top}px`;
    veil.style.left = `${rect.left}px`;
    veil.style.width = `${rect.width}px`;
    veil.style.height = `${rect.height}px`;
    veil.style.borderRadius = getComputedStyle(target).borderRadius;
  }

  // The same team goes by two names across the flows: BETI is "beti" on most and
  // "integrations" on the widget ones. Where a flow offers both they are
  // genuinely different teams, so the exact match is always tried first and this
  // is only reached when the flow offers one of the pair. Nothing else is
  // mapped: Customer Care, Client Setup, Support, AV, CS and MTS are distinct
  // teams, and guessing between them would tell someone the wrong steps are
  // theirs.
  const TEAM_ALIASES = {
    beti: ["integrations"],
    integrations: ["beti"]
  };

  function teamButtonFor(switcher, team) {
    for (const key of [team, ...(TEAM_ALIASES[team] || [])]) {
      const button = switcher.querySelector(`.team-button[data-team="${CSS.escape(key)}"]`);
      if (button) return button;
    }
    return null;
  }

  function setUpTeamSwitcher() {
    const switcher = document.querySelector(".team-switcher");
    if (!switcher) return;

    let bubble = null;
    let veil = null;
    let fadeTimer = 0;
    let restoring = false;

    function fadeOut(element) {
      element.classList.add("is-fading");
      element.addEventListener("transitionend", () => element.remove(), { once: true });
      window.setTimeout(() => element.remove(), 600);
    }

    function removeBubble() {
      window.clearTimeout(fadeTimer);
      if (veil) {
        fadeOut(veil);
        veil = null;
        // The ring stood down while the dim was doing its job; with the dim
        // going it comes back, so a switcher nobody has answered yet is still
        // marked once the page returns to normal.
        switcher.classList.remove("sr-coach-lit");
      }
      if (!bubble) return;
      const doomed = bubble;
      bubble = null;
      fadeOut(doomed);
    }

    function stopCoaching() {
      switcher.classList.remove("sr-coach-target", "sr-coach-lit");
      removeBubble();
    }

    // Persist whatever the user picks, and stop nagging for good. Listening on
    // the container leaves each page's own button handler untouched.
    switcher.addEventListener("click", (event) => {
      const button = event.target.closest(".team-button");
      if (!button || !button.dataset.team) return;
      // A restore is not an interaction: it must not re-save the team (see
      // below) and it must not dismiss the coach, which is there precisely to
      // report what was just restored.
      if (restoring) return;
      saveTeam(button.dataset.team);
      stopCoaching();
    });

    // Team vocabularies differ per flow (sales/beti/integrations,
    // sportradar/client, cs/av/beti, ...), so a saved team can only be restored
    // where the page offers it. Restoring first means the copy below can
    // reflect it.
    const saved = readTeam();
    const restoreButton = saved ? teamButtonFor(switcher, saved) : null;
    const restored = restoreButton ? restoreButton.textContent.trim() : null;

    // Deferred, not immediate. This file is deferred and the flows' own app.js
    // is deferred on 10 of the 26 pages, where it therefore runs after this one
    // and resets the filter to "all" -- the team was restored and then silently
    // dropped on exactly those pages. A timeout puts the click after every
    // deferred script, whichever order they were in.
    if (restoreButton) {
      window.setTimeout(() => {
        // Restoring is not choosing: without this the visit would overwrite the
        // saved team with whatever this flow happens to call the equivalent, so
        // picking "BETI Team" once and then opening a flow that only offers
        // "BETI Integrations" would quietly rewrite the choice.
        restoring = true;
        restoreButton.click();
        restoring = false;
        // .selected has just moved, and the arrow points at it.
        if (bubble) placeCoach(bubble, switcher);
      }, 0);
    }

    // The switcher is the one control people miss, so it announces itself on
    // every workflow visit — not just the first. When a team was restored the
    // prompt reports that instead of asking for something already chosen.
    switcher.classList.add("sr-coach-target");

    // Index each button so the hint animation can walk along the row. Written
    // here rather than with nth-child: some flows open the switcher with a
    // label element and some do not, so the buttons' positions differ.
    [...switcher.querySelectorAll(".team-button")].forEach((button, index) => {
      button.style.setProperty("--sr-hint-i", String(index));
    });

    bubble = document.createElement("div");
    bubble.className = "sr-coach";
    bubble.setAttribute("role", "status");
    // Three states, because "has a team saved" and "this flow can show it" are
    // different questions: the four integration flows split the work by
    // Sportradar and Client rather than by team, so a saved team has nothing to
    // map to there and the page has to ask again -- but quietly, since the
    // person has already answered the question once.
    const message = restored
      ? {
          title: `Showing ${restored}`,
          body: "These are the steps your team owns. Pick another team to switch."
        }
      : saved
        ? {
            title: "Different teams on this flow",
            body: "This one splits the steps another way. Pick the side you own here; your usual team is kept for the rest."
          }
        : {
            title: "Select your team",
            body: "Pick a team to highlight the steps you own. We'll remember it for every other workflow."
          };

    bubble.innerHTML = `
        <div>
          <strong>${message.title}</strong>
          <p>${message.body}</p>
        </div>
        <button class="sr-coach-dismiss" type="button" aria-label="Dismiss">&times;</button>
      `;
    // The interrupting version is for people who have never answered: the page
    // dims and the switcher is lit through the dim. Keyed on `saved`, not on
    // `restored` -- once a team has been chosen anywhere on the site, no flow
    // dims the page again, including the ones that cannot offer that team.
    if (!saved) {
      veil = document.createElement("div");
      veil.className = "sr-coach-veil";
      veil.setAttribute("aria-hidden", "true");
      document.body.append(veil);
      placeVeil(veil, switcher);
      // The dim isolates the control far better than the ring does, and the two
      // together crowd the same edge. The ring is for the version without the
      // spotlight; here it stands down.
      switcher.classList.add("sr-coach-lit");
    }

    document.body.append(bubble);
    placeCoach(bubble, switcher);

    bubble.querySelector(".sr-coach-dismiss").addEventListener("click", removeBubble);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") removeBubble();
    });

    // Anywhere at all: having dimmed the page, the first click should clear it
    // whether or not it landed on a team. Bound on the next frame so the click
    // that opened the page cannot immediately close it.
    if (veil) {
      window.requestAnimationFrame(() => {
        document.addEventListener(
          "click",
          (event) => {
            // isTrusted: password managers and other extensions click their own
            // injected controls on load (this site's buttons come back with
            // Dashlane attributes on them), and a synthetic click would clear
            // the prompt before it had been on screen for a frame.
            if (event.isTrusted) removeBubble();
          },
          { once: true }
        );
      });
    }

    // The bubble is the loud part, so it goes on its own; the ring stays until
    // a team is actually chosen.
    fadeTimer = window.setTimeout(removeBubble, COACH_FADE_MS);

    const reposition = () => {
      if (bubble) placeCoach(bubble, switcher);
      if (veil) placeVeil(veil, switcher);
    };
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, { passive: true });
  }

  /* ---------- which steps are yours ---------- */

  // Half the flows mark the other teams' cards with .is-dependency and half do
  // it with `[data-selected=X] .card:not([data-owner=X])` selectors of their
  // own, so there is no one selector that means "not yours" -- which is exactly
  // what the shared fade below needs. This writes one: the comparison is the
  // same in both flows, it is just done here rather than in 26 stylesheets.
  function markInactive() {
    document.querySelectorAll("[data-selected]").forEach((shell) => {
      const selected = shell.dataset.selected;
      shell.querySelectorAll("[data-owner]").forEach((card) => {
        const owner = card.dataset.owner;
        const inactive =
          Boolean(owner) && Boolean(selected) && selected !== "all" && owner !== selected;
        card.classList.toggle("sr-inactive", inactive);
      });
    });
  }

  addFavicon();
  buildTopBar();
  // Outside the isWorkflowPage block: the footer is the same row on all 27
  // pages now that it carries the feedback control rather than a workflow's
  // branding, and the landing page no longer ships a static one of its own.
  buildFooter();
  if (isWorkflowPage) {
    buildSubnav();
    setUpTeamSwitcher();
    markInactive();
    polishCards();

    // Card metrics depend on the final text layout, and change again whenever a
    // team filter collapses cards or the viewport resizes.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(polishCards);
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".team-button, .scenario-button")) return;
      // Before the measuring below: what is faded changes what is measured.
      markInactive();
      // Twice, deliberately. Switching filters un-hides each re-shown card's
      // icon and title, and one frame later their final height is still not laid
      // out -- every card measures short, so the shared min-height comes out too
      // small and the tallest card alone overshoots it. The first pass keeps the
      // response immediate; the second, once layout has settled, is the one that
      // gets the height right. Same reasoning as the debounced resize below.
      requestAnimationFrame(polishCards);
      window.setTimeout(polishCards, 180);
    });
    let resizeTimer = 0;
    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(polishCards, 150);
    });
  } else {
    const intro = document.querySelector(".page-intro");
    if (intro) intro.append(buildTags(families.map((family) => family.name)));
  }
})();
