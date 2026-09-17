const flowShell = document.querySelector(".flow-shell");
const teamButtons = document.querySelectorAll(".team-button");
const stageCards = document.querySelectorAll(".stage-card");
const referenceCard = document.querySelector(".reference-card");
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

  const sectionCount = content.querySelectorAll(".instruction-section").length;
  if (sectionCount > 1) content.classList.add("has-branches");
  if (sectionCount > 2) content.classList.add("has-many-branches");
  dialog.append(content);
}

function selectTeam(team) {
  flowShell.dataset.selected = team;
  teamButtons.forEach((button) => {
    button.classList.toggle("selected", button.dataset.team === team);
  });
  stageCards.forEach((card) => {
    const isOwner = team === "all" || card.dataset.owner === team;
    card.classList.toggle("is-dependency", !isOwner);
    card.disabled = !isOwner;
    card.setAttribute("aria-disabled", String(!isOwner));
  });
  if (referenceCard) {
    // The note is a card of the grid like any other, so it mutes when it is not
    // yours rather than disappearing -- same treatment the steps get above.
    const ownsReference = team === "all" || team === "additional";
    referenceCard.classList.toggle("is-dependency", !ownsReference);
    const action = referenceCard.querySelector(".reference-action");
    if (action) action.disabled = !ownsReference;
  }
}

function openDialog(id) {
  const dialog = document.getElementById(id);
  if (dialog) dialog.showModal();
}

dialogs.forEach(organizeDialog);
teamButtons.forEach((button) => {
  button.addEventListener("click", () => selectTeam(button.dataset.team));
});
stageCards.forEach((card) => {
  card.addEventListener("click", () => {
    if (!card.disabled) openDialog(card.dataset.dialog);
  });
});
referenceCard?.querySelector(".reference-action")?.addEventListener("click", () => {
  openDialog(referenceCard.querySelector(".reference-action").dataset.dialog);
});
dialogs.forEach((dialog) => {
  dialog.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
});
