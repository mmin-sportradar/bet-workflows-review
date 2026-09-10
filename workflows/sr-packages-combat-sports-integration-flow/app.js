const flowShell = document.querySelector(".flow-shell");
const teamButtons = document.querySelectorAll(".team-button");
const stageCards = document.querySelectorAll(".stage-card");
const dialogs = document.querySelectorAll("dialog");

function organizeDialog(dialog) {
  const content = document.createElement("div");
  content.className = "dialog-content";
  const details = [...dialog.children].filter((item) => !item.matches(".dialog-close, .dialog-owner, h2"));
  details.forEach((item) => content.append(item));
  if (!content.children.length) return;
  let section;
  [...content.children].forEach((item) => {
    if (item.tagName === "H3") {
      section = document.createElement("section");
      section.className = "instruction-section";
      content.insertBefore(section, item);
      section.append(item);
    } else if (section && ["P", "UL", "OL"].includes(item.tagName)) {
      section.append(item);
    } else section = undefined;
  });
  if (content.querySelectorAll(".instruction-section").length > 1) content.classList.add("has-branches");
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
    const enabled = team === "all" || card.dataset.owner === team;
    card.classList.toggle("is-dependency", !enabled);
    card.disabled = !enabled;
    card.setAttribute("aria-disabled", String(!enabled));
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
