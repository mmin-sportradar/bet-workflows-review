const flowShell = document.querySelector(".flow-shell");
const teamButtons = document.querySelectorAll(".team-button");
const stageCards = document.querySelectorAll(".stage-card");
const dialogs = document.querySelectorAll("dialog");

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
    const isSelected = button.dataset.team === team;
    button.classList.toggle("selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });

  stageCards.forEach((card) => {
    const isOwner = team === "all" || card.dataset.owner === team;
    card.classList.toggle("is-dependency", !isOwner);
    card.disabled = !isOwner;
    card.setAttribute("aria-disabled", String(!isOwner));
  });
}

function openDialog(id) {
  const dialog = document.getElementById(id);
  if (dialog && !dialog.open) dialog.showModal();
}

function closeDialog(dialog) {
  if (dialog.open) dialog.close();
}

dialogs.forEach(organizeDialog);
teamButtons.forEach((button) => {
  button.setAttribute("aria-pressed", String(button.classList.contains("selected")));
  button.addEventListener("click", () => selectTeam(button.dataset.team));
});
stageCards.forEach((card) => {
  card.addEventListener("click", () => {
    if (!card.disabled) openDialog(card.dataset.dialog);
  });
});
dialogs.forEach((dialog) => {
  dialog.querySelector(".dialog-close").addEventListener("click", () => closeDialog(dialog));
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog(dialog);
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") dialogs.forEach(closeDialog);
});
