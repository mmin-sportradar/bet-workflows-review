const flowShell = document.querySelector(".flow-shell");
const teamButtons = document.querySelectorAll(".team-button");
const stageCards = document.querySelectorAll(".stage-card");
const referenceAction = document.querySelector(".reference-action");
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
  if (sectionCount > 1) {
    content.classList.add("has-branches");
  }
  if (sectionCount > 2) {
    content.classList.add("has-many-branches");
  }
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

referenceAction.addEventListener("click", () => {
  if (flowShell.dataset.selected === "all" || flowShell.dataset.selected === "additional") {
    document.getElementById(referenceAction.dataset.dialog).showModal();
  }
});

dialogs.forEach((dialog) => {
  dialog.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
});
