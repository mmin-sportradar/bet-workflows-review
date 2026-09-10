const flowShell = document.querySelector(".flow-shell");
const teamButtons = document.querySelectorAll(".team-button");
const stageCards = document.querySelectorAll(".stage-card");
const dialogs = document.querySelectorAll("dialog:not(.sr-search-dialog)");

function organizeDialog(dialog) {
  const content = document.createElement("div");
  content.className = "dialog-content";
  const details = [...dialog.children].filter((element) => (
    !element.matches(".dialog-close, .dialog-owner, h2")
  ));

  details.forEach((element) => content.append(element));
  if (!content.children.length) return;

  let currentSection;
  [...content.children].forEach((element) => {
    if (element.tagName === "H3") {
      currentSection = document.createElement("section");
      currentSection.className = "instruction-section";
      content.insertBefore(currentSection, element);
      currentSection.append(element);
    } else if (currentSection && ["P", "UL", "OL"].includes(element.tagName)) {
      currentSection.append(element);
    } else {
      currentSection = undefined;
    }
  });

  const sections = content.querySelectorAll(".instruction-section");
  if (sections.length) {
    const firstSection = sections[0];
    const intro = document.createElement("div");
    intro.className = "instruction-intro";

    while (content.firstElementChild && content.firstElementChild !== firstSection) {
      intro.append(content.firstElementChild);
    }

    if (intro.children.length) {
      content.insertBefore(intro, firstSection);
    }
  }

  const sectionCount = sections.length;
  sections.forEach((section) => {
    const body = document.createElement("div");
    body.className = "instruction-section-body";

    while (section.children.length > 1) {
      body.append(section.children[1]);
    }

    if (body.children.length) {
      section.append(body);
    }
  });

  if (sectionCount > 1) {
    content.classList.add("has-branches");
  } else if (sectionCount === 1) {
    content.classList.add("has-section");

    const intro = content.querySelector(".instruction-intro");
    if (intro) {
      intro.classList.add("instruction-panel");
      const panelBody = document.createElement("div");
      panelBody.className = "instruction-panel-body";

      while (intro.firstChild) {
        panelBody.append(intro.firstChild);
      }

      intro.append(panelBody);
    }
  } else {
    content.classList.add("has-flow");

    const panel = document.createElement("div");
    panel.className = "instruction-panel instruction-panel--compact";
    const panelBody = document.createElement("div");
    panelBody.className = "instruction-panel-body";

    while (content.firstChild) {
      panelBody.append(content.firstChild);
    }

    panel.append(panelBody);
    content.append(panel);
  }
  if (sectionCount > 2) {
    content.classList.add("has-many-branches");
  }

  content.querySelectorAll("p").forEach((paragraph) => {
    if (paragraph.textContent.trim().toLowerCase() === "or") {
      paragraph.classList.add("or");
    }
  });

  dialog.append(content);
}

dialogs.forEach(organizeDialog);

teamButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const team = button.dataset.team;
    flowShell.dataset.selected = team;
    teamButtons.forEach((item) => item.classList.toggle("selected", item === button));
  });
});

stageCards.forEach((card) => {
  card.addEventListener("click", () => {
    if (flowShell.dataset.selected !== "all" && card.dataset.owner !== flowShell.dataset.selected) return;
    document.getElementById(card.dataset.dialog).showModal();
  });
});

dialogs.forEach((dialog) => {
  dialog.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
});
