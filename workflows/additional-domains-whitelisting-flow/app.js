const flowShell = document.querySelector(".flow-shell");
const teamButtons = document.querySelectorAll(".team-button");
const scenarioButtons = document.querySelectorAll(".scenario-button");
const taskCards = document.querySelectorAll(".task-card");
const dialogs = document.querySelectorAll("dialog");

function organizeDialog(dialog) {
  const content = document.createElement("div");
  content.className = "dialog-content";
  const details = [...dialog.children].filter((element) => (
    !element.matches(".dialog-close, .dialog-owner, h2")
  ));

  details.forEach((element) => content.append(element));
  if (content.children.length) dialog.append(content);
}

function selectTeam(team) {
  flowShell.dataset.selected = team;
  teamButtons.forEach((button) => {
    button.classList.toggle("selected", button.dataset.team === team);
  });
  taskCards.forEach((card) => {
    const isOwner = team === "all" || card.dataset.owner === team;
    card.classList.toggle("is-dependency", !isOwner);
    card.disabled = !isOwner;
    card.setAttribute("aria-disabled", String(!isOwner));
  });
}

function selectScenario(scenario) {
  flowShell.dataset.scenario = scenario;
  scenarioButtons.forEach((button) => {
    button.classList.toggle("selected", button.dataset.scenario === scenario);
  });
  taskCards.forEach((card) => {
    const isAvailable = scenario === "all" || card.dataset.scenarios.includes(scenario);
    card.hidden = !isAvailable;
  });
}

function openDialog(id) {
  const dialog = document.getElementById(id);
  if (dialog) dialog.showModal();
}

dialogs.forEach(organizeDialog);
teamButtons.forEach((button) => {
  button.addEventListener("click", () => selectTeam(button.dataset.team));
});
scenarioButtons.forEach((button) => {
  button.addEventListener("click", () => selectScenario(button.dataset.scenario));
});
taskCards.forEach((card) => {
  card.addEventListener("click", () => {
    if (!card.disabled) openDialog(card.dataset.dialog);
  });
});
dialogs.forEach((dialog) => {
  dialog.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
});
