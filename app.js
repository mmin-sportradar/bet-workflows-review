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
const dialogClose = document.querySelector(".dialog-close");

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

function showProduct(product, familyName) {
  const types = availableTypes(product);
  const docs = productDocs(product);

  dialogFamily.textContent = familyName;
  dialogTitle.textContent = product.name;
  // Product Hub has no flow to choose between, so the stock instruction would be
  // a lie there; its own description says what the one link is for.
  dialogDescription.textContent = types.length
    ? "Choose a workflow to open the interactive diagram."
    : product.description;

  const options = types.map((type) => `
    <a class="flow-option" href="${product[type]}">
      <span class="flow-option-label">
        <strong class="flow-option-title">${workflowLabel(type)}</strong>
        <span class="flow-option-subtitle">Open interactive workflow</span>
      </span>
      <span class="arrow" aria-hidden="true">→</span>
    </a>
  `);

  if (docs) {
    options.push(`
      <a class="flow-option flow-option--external" href="${escapeHtml(docs.href)}" target="_blank" rel="noopener noreferrer">
        <span class="flow-option-label">
          <strong class="flow-option-title">${escapeHtml(docs.title)}</strong>
          <span class="flow-option-subtitle">${escapeHtml(linkHost(docs.href))}</span>
        </span>
        <span class="arrow" aria-hidden="true">↗</span>
      </a>
    `);
  }

  dialogFlowOptions.innerHTML = options.join("");

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

dialogClose.addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});

renderCatalog();
renderSidebar();
applyLabelSize();

// Re-measure once webfonts settle, in case the label font swapped after render.
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(applyLabelSize);
}
