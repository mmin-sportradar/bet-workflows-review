/* Landing page: renders the catalogue from shared/catalog.js into the sidebar
   and the tile grid, and opens the workflow dialog from either one.

   The `families` array and the workflowLabel/availableTypes helpers live in
   shared/catalog.js so the workflow pages can derive their breadcrumbs from the
   same data. */

const categoryGrid = document.querySelector("#category-grid");
const sidebarNav = document.querySelector("#sidebar-nav");
const sidebarEmpty = document.querySelector("#sidebar-empty");
const productFilter = document.querySelector("#product-filter");
const dialog = document.querySelector("#flow-dialog");
const dialogFamily = document.querySelector("#dialog-family");
const dialogTitle = document.querySelector("#dialog-product-title");
const dialogDescription = document.querySelector("#dialog-description");
const dialogFlowOptions = document.querySelector("#dialog-flow-options");
const dialogVariantPane = document.querySelector("#dialog-variant-pane");
const dialogVariantFamily = document.querySelector("#dialog-variant-family");
const dialogVariantTitle = document.querySelector("#dialog-variant-title");
const dialogVariantOptions = document.querySelector("#dialog-variant-options");
const dialogVariantBack = document.querySelector("#dialog-variant-back");
const dialogVariantBackLabel = document.querySelector("#dialog-variant-back-label");
const dialogClose = document.querySelector(".dialog-close");

// The product the dialog is currently showing, so a click on one of its sport
// rows can look the sport up without threading it through the DOM.
let openProduct = null;

function escapeHtml(value) {
  return value.replace(/[&<>"]/g, (character) => `&#${character.charCodeAt(0)};`);
}

// Label sizing. Every tile shares one size: the size at which the catalogue's
// longest unbreakable word still fits a tile. A name too long for one line at
// that size wraps ("Bet" over "Recommendations") rather than shrinking, because
// a single tile set a step smaller than its neighbours reads as a mistake.
const LABEL_TRACKING = -0.02; // must match .tile-name letter-spacing
const MEASURE_SAFETY = 1.03; // covers sub-pixel rounding and line-break slack

// Width of a product's longest unbreakable word, in ems of the label font.
function widestWordEm(name, measure) {
  return name.split(/\s+/).reduce((widest, word) => Math.max(widest, measure(word)), 0);
}

function applyLabelSize() {
  const sample = document.querySelector(".tile-name");
  if (!sample) return;

  const style = getComputedStyle(sample);
  const reference = 100;
  const context = document.createElement("canvas").getContext("2d");
  context.font = `${style.fontWeight} ${reference}px ${style.fontFamily}`;

  const measure = (word) =>
    (context.measureText(word).width + LABEL_TRACKING * reference * Math.max(word.length - 1, 0)) /
    reference;

  const widest = families
    .flatMap((family) => family.products.map((product) => product.name))
    .reduce((widest, name) => Math.max(widest, widestWordEm(name, measure)), 0);

  document.documentElement.style.setProperty(
    "--w-word",
    (widest * MEASURE_SAFETY).toFixed(3)
  );
}

function productAttributes(familyIndex, productIndex) {
  return `data-family-index="${familyIndex}" data-product-index="${productIndex}"`;
}

function renderCatalog() {
  categoryGrid.innerHTML = families.map((family, familyIndex) => {
    const tiles = family.products.map((product, productIndex) => `
      <button
        class="tile"
        type="button"
        ${productAttributes(familyIndex, productIndex)}
        data-product-name="${escapeHtml(product.name)}"
        aria-haspopup="dialog"
      >
        <span class="tile-name">${escapeHtml(product.name)}</span>
        <span class="tile-go" aria-hidden="true">→</span>
      </button>
    `).join("");

    return `
      <section class="cat cat--${familyIndex + 1}" aria-labelledby="category-${familyIndex}">
        <header class="cat-head"><h2 id="category-${familyIndex}">${escapeHtml(family.name)}</h2></header>
        <div class="tile-grid">${tiles}</div>
      </section>
    `;
  }).join("");
}

function renderSidebar() {
  sidebarNav.innerHTML = families.map((family, familyIndex) => {
    const links = family.products.map((product, productIndex) => `
      <button
        class="sidebar-link"
        type="button"
        ${productAttributes(familyIndex, productIndex)}
        aria-haspopup="dialog"
      >${escapeHtml(product.name)}</button>
    `).join("");

    return `
      <div class="sidebar-group">
        <h2>${escapeHtml(family.name)}</h2>
        ${links}
      </div>
    `;
  }).join("");
}

// Where an outbound link actually goes. The documentation lives on four
// different hosts, so naming the host beats a fixed "Open documentation" that
// would claim apidocs for a link to the product hub or the developer portal.
function linkHost(href) {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch (error) {
    return "External link";
  }
}

// The dialog's rows, as HTML strings. Both panes render through these, so a
// sport's routes are drawn by the same code as a product's -- a variant carries
// the same setup/integration/docs keys, which is the whole point of its shape.

function flowRow(href, title, subtitle) {
  return `
    <a class="flow-option" href="${href}">
      <span class="flow-option-label">
        <strong class="flow-option-title">${escapeHtml(title)}</strong>
        <span class="flow-option-subtitle">${escapeHtml(subtitle)}</span>
      </span>
      <span class="arrow" aria-hidden="true">→</span>
    </a>
  `;
}

function externalRow(docs) {
  return `
    <a class="flow-option flow-option--external" href="${escapeHtml(docs.href)}" target="_blank" rel="noopener noreferrer">
      <span class="flow-option-label">
        <strong class="flow-option-title">${escapeHtml(docs.title)}</strong>
        <span class="flow-option-subtitle">${escapeHtml(linkHost(docs.href))}</span>
      </span>
      <span class="arrow" aria-hidden="true">↗</span>
    </a>
  `;
}

// Several pages behind one row. A button, not a link, for the same reason the
// sport rows are: it opens the second pane rather than navigating. The subtitle
// counts what is behind it so the row never hides how much there is.
function docsPaneRow(title, links) {
  return `
    <button
      class="flow-option flow-option--variant flow-option--external"
      type="button"
      data-docs-pane="1"
      aria-expanded="false"
      aria-controls="dialog-variant-pane"
    >
      <span class="flow-option-label">
        <strong class="flow-option-title">${escapeHtml(title)}</strong>
        <span class="flow-option-subtitle">${links.length} pages</span>
      </span>
      <span class="arrow" aria-hidden="true">→</span>
    </button>
  `;
}

// A route that is named but not built yet. The two callers differ only by arrow
// and by whether the row is the outlined external one, so they share a builder.
function pendingRow(title, external) {
  return `
    <span class="flow-option flow-option--pending${external ? " flow-option--external" : ""}" aria-disabled="true">
      <span class="flow-option-label">
        <strong class="flow-option-title">${escapeHtml(title)}</strong>
        <span class="flow-option-subtitle">Coming soon</span>
      </span>
      <span class="arrow" aria-hidden="true">${external ? "↗" : "→"}</span>
    </span>
  `;
}

// Every route an entry offers, live ones first. `entry` is a product or one of its
// sport variants.
// `nested` means these rows are being drawn INTO the second pane, where a row
// that opens the second pane would have nowhere to go. There, several Confluence
// links are listed flat instead. One level of nesting is all the dialog has.
function flowRows(entry, nested) {
  const rows = availableTypes(entry).map(
    (type) => flowRow(entry[type], workflowLabel(type), "Open interactive workflow")
  );

  const pending = entry.pending;
  if (pending && pending.flows) pending.flows.forEach((title) => rows.push(pendingRow(title, false)));

  const docs = productDocs(entry);
  if (docs) rows.push(externalRow(docs));
  // An empty `docs` string is a slot waiting for a URL, not an absence: the row
  // still renders, so the reader can see documentation is a route that is coming.
  // A missing `docs` key means the entry genuinely has none.
  else if (entry.docs === "") rows.push(pendingRow("Technical Documentation", true));

  // Confluence sits under the technical docs, whether or not a URL exists yet: the
  // pair is what people are told to look for, and a row that only appeared once
  // someone had pasted a link in would leave the reader to guess whether this
  // product has a Confluence page at all. Unlike `docs`, this needs no empty slot
  // in the catalogue to render -- absence IS the coming-soon state, because the
  // answer for every product today is "coming".
  //
  // Only where there are flows of its own, though. Product Hub is a tile that IS a
  // link -- one row, its own name, no workflow behind it -- and promising it a
  // Confluence page of its own says something untrue about what the tile is. The
  // SR Packages parent falls out the same way and should: it is a chooser, and its
  // sports carry their own documentation rows one pane along.
  //
  // A tile is not always one product -- "Bet Insights & Player Prop Zone" is two,
  // each with its own page -- so several links get a row that opens the second
  // pane, the way a sport does. One link stays one row: sending a reader through
  // a pane to reach a single destination is a click that buys nothing.
  if (availableTypes(entry).length) {
    const confluence = productConfluence(entry);
    if (!confluence) rows.push(pendingRow("Confluence Documentation", true));
    else if (confluence.length === 1) rows.push(externalRow(confluence[0]));
    else if (nested) rows.push(...confluence.map(externalRow));
    else rows.push(docsPaneRow("Confluence Documentation", confluence));
  }

  if (pending && pending.docs) rows.push(pendingRow(pending.docs, true));

  return rows;
}

// One row per sport. A button, not a link: it opens the second pane rather than
// leaving the page, and the subtitle names what that sport actually has so the row
// never promises a route the pane then shows as pending.
function variantRows(product) {
  return productVariants(product).map((variant, index) => {
    const live = availableTypes(variant).map(workflowLabel);
    const summary = live.length ? `${live.join(", ")} · more coming soon` : "Coming soon";

    return `
      <button
        class="flow-option flow-option--variant"
        type="button"
        data-variant-index="${index}"
        aria-expanded="false"
        aria-controls="dialog-variant-pane"
      >
        <span class="flow-option-label">
          <strong class="flow-option-title">${escapeHtml(variant.name)}</strong>
          <span class="flow-option-subtitle">${escapeHtml(summary)}</span>
        </span>
        <span class="arrow" aria-hidden="true">→</span>
      </button>
    `;
  });
}

// `restoreFocus` puts the keyboard back on the sport that was open, which is where
// the reader just was. The pane is hidden by a `display: none` on its column, so
// the class comes off the dialog before anything inside it is focused.
function closeVariantPane(restoreFocus) {
  const open = dialogFlowOptions.querySelector(".flow-option--variant.is-selected, [data-docs-pane].is-selected");

  dialogVariantPane.hidden = true;
  dialogVariantOptions.innerHTML = "";
  dialog.classList.remove("has-variant");
  dialogFlowOptions.querySelectorAll(".flow-option--variant, [data-docs-pane]").forEach((row) => {
    row.classList.remove("is-selected");
    row.setAttribute("aria-expanded", "false");
  });

  if (restoreFocus && open) open.focus();
}

function showDocsPane(title, links) {
  dialogVariantBackLabel.textContent = `All ${openProduct.name} options`;
  dialogVariantFamily.textContent = openProduct.name;
  dialogVariantTitle.textContent = title;
  dialogVariantOptions.innerHTML = links.map(externalRow).join("");
  dialogVariantPane.hidden = false;
  dialog.classList.add("has-variant");

  const row = dialogFlowOptions.querySelector("[data-docs-pane]");
  if (row) {
    row.classList.add("is-selected");
    row.setAttribute("aria-expanded", "true");
  }

  const first = dialogVariantOptions.querySelector("a, button") || dialogVariantBack;
  first.focus();
}

function showVariant(index) {
  const variant = productVariants(openProduct)[index];
  if (!variant) return;

  dialogVariantBackLabel.textContent = `All ${openProduct.name} sports`;
  dialogVariantFamily.textContent = openProduct.name;
  dialogVariantTitle.textContent = variant.name;
  dialogVariantOptions.innerHTML = flowRows(variant, true).join("");
  dialogVariantPane.hidden = false;
  dialog.classList.add("has-variant");

  dialogFlowOptions.querySelectorAll(".flow-option--variant").forEach((row, rowIndex) => {
    const selected = rowIndex === index;
    row.classList.toggle("is-selected", selected);
    row.setAttribute("aria-expanded", String(selected));
  });

  // Follow the click into the pane that replaced the list, so the keyboard lands
  // where the eye already is. `a, button` skips nothing here: with every route
  // pending, the back row is the only thing left to focus, and that is the right
  // place to be.
  const first = dialogVariantOptions.querySelector("a, button") || dialogVariantBack;
  first.focus();
}

// Product Hub has no flow to choose between, so the stock instruction would be a
// lie there; its own description says what the one link is for. A product whose
// flows are per-sport asks for two choices, not one.
function dialogInstruction(product) {
  if (productVariants(product).length) return "Choose a sport to see the workflows it offers.";
  if (availableTypes(product).length || product.pending) {
    return "Choose a workflow to open the interactive diagram.";
  }
  return product.description;
}

function showProduct(product, familyName) {
  openProduct = product;
  closeVariantPane(); // every open starts on the sports list

  dialogFamily.textContent = familyName;
  dialogTitle.textContent = product.name;
  dialogDescription.textContent = dialogInstruction(product);

  // Sports first, then anything the product offers in its own right -- appending
  // rather than branching leaves room for SR Packages to gain a top-level docs
  // link later without a second code path.
  dialogFlowOptions.innerHTML = [...variantRows(product), ...flowRows(product)].join("");

  dialog.showModal();
}

// One filter drives both columns, so the sidebar and the grid never disagree
// about what is on the page.
function applyFilter(query) {
  const needle = query.trim().toLowerCase();
  let matches = 0;

  families.forEach((family, familyIndex) => {
    let shown = 0;

    family.products.forEach((product, productIndex) => {
      const hidden = needle !== "" && !product.name.toLowerCase().includes(needle);
      if (!hidden) shown += 1;

      document
        .querySelectorAll(`[data-family-index="${familyIndex}"][data-product-index="${productIndex}"]`)
        .forEach((element) => { element.hidden = hidden; });
    });

    matches += shown;
    const empty = shown === 0;
    categoryGrid.children[familyIndex].hidden = empty;
    sidebarNav.children[familyIndex].hidden = empty;
  });

  sidebarEmpty.hidden = matches > 0;
}

function openFromEvent(event) {
  const trigger = event.target.closest("[data-family-index][data-product-index]");
  if (!trigger) return;

  const family = families[Number(trigger.dataset.familyIndex)];
  const product = family.products[Number(trigger.dataset.productIndex)];
  showProduct(product, family.name);
}

categoryGrid.addEventListener("click", openFromEvent);
sidebarNav.addEventListener("click", openFromEvent);
productFilter.addEventListener("input", () => applyFilter(productFilter.value));

dialogFlowOptions.addEventListener("click", (event) => {
  const trigger = event.target.closest(".flow-option--variant");
  if (!trigger) return;

  if (trigger.dataset.docsPane) {
    const links = productConfluence(openProduct);
    if (links) showDocsPane("Confluence Documentation", links);
    return;
  }
  showVariant(Number(trigger.dataset.variantIndex));
});

dialogVariantBack.addEventListener("click", () => closeVariantPane(true));

dialogClose.addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});

// Escape returns to the sports list before it closes the dialog: one step back
// rather than all the way out, which is what a drill-down reads as.
dialog.addEventListener("cancel", (event) => {
  if (!dialog.classList.contains("has-variant")) return;
  event.preventDefault();
  closeVariantPane(true);
});

renderCatalog();
renderSidebar();
applyLabelSize();

// Re-measure once webfonts settle, in case the label font swapped after render.
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(applyLabelSize);
}
