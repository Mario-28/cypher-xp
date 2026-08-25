import { RulesApp } from "../apps/rules-app.js";

export class RulesLauncher {
  static attach(appElement) {
    if (!appElement?.querySelector) return;
    if (appElement.id === "cypher-xp-rules") return;
    if (appElement.querySelector(".cxp-rules-fab")) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cxp-rules-fab";
    btn.title = "Open the Experience Rules";
    btn.setAttribute("aria-label", "Open the Experience Rules");
    btn.innerHTML = '<i class="fa-solid fa-book-open"></i>';
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      RulesApp.show();
    });

    appElement.appendChild(btn);
  }
}
