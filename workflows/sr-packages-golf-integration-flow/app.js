const flowShell = document.querySelector(".flow-shell");
const teamButtons = document.querySelectorAll(".team-button");
const stageCards = document.querySelectorAll(".stage-card");
const dialogs = document.querySelectorAll("dialog");

function organizeDialog(dialog) {
  const content = document.createElement("div");
  content.className = "dialog-content";
  const details = [...dialog.children].filter((element) => !element.matches(".dialog-close, .dialog-owner, h2"));
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
    } else currentSection = undefined;
  });
  const sections = content.querySelectorAll(".instruction-section").length;
  if (sections > 1) content.classList.add("has-branches");
  if (sections > 2) content.classList.add("has-many-branches");
  dialog.append(content);
}
function selectTeam(team) {
  flowShell.dataset.selected = team;
  teamButtons.forEach((button) => {
    const selected = button.dataset.team === team;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  stageCards.forEach((card) => {
    const available = team === "all" || card.dataset.owner === team;
    card.classList.toggle("is-dependency", !available);
    card.disabled = !available;
    card.setAttribute("aria-disabled", String(!available));
  });
}
dialogs.forEach(organizeDialog);
teamButtons.forEach((button) => {
  button.setAttribute("aria-pressed", String(button.classList.contains("selected")));
  button.addEventListener("click", () => selectTeam(button.dataset.team));
});
stageCards.forEach((card) => card.addEventListener("click", () => {
  const dialog = document.getElementById(card.dataset.dialog);
  if (!card.disabled && dialog && !dialog.open) dialog.showModal();
}));
dialogs.forEach((dialog) => {
  dialog.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
});
