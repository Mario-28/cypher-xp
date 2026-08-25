import { MODULE_ID } from "./constants.js";
import { DevelopmentService } from "./development-service.js";
import { log } from "./settings.js";

/**
 * Player-side Cypher Taskbar integration: compact XP / Progress / Tier widget.
 * Hook-first, throttled observer fallback, and re-attach on character assignment.
 */
export class TaskbarIntegration {
  static CONTAINER_SELECTORS = [
    "#cypher-taskbar", ".cypher-taskbar", "[data-module='cypher-taskbar']"
  ];
  static WIDGET_ID = "cypher-xp-widget";
  static _observer = null;
  static _lastScan = 0;

  static init() {
    if (!game.settings.get(MODULE_ID, "enableTaskbarIntegration")) return;

    Hooks.on("cypherTaskbar.rendered", (data) => {
      TaskbarIntegration.attach(data?.root ?? data?.element ?? data);
    });
    Hooks.on("renderApplicationV2", (app, html) => {
      const id = app?.id?.toLowerCase?.() ?? "";
      if (id.includes("taskbar") && !id.includes("gm")) TaskbarIntegration.attach(html);
    });

    // Re-attach when the player is assigned a character after load.
    Hooks.on("updateUser", (user, changes) => {
      if (user.id === game.user.id && foundry.utils.hasProperty(changes, "character")) {
        TaskbarIntegration.refresh();
      }
    });

    Hooks.on("updateActor", (actor, changes) => {
      if (!actor.isOwner) return;
      if (foundry.utils.hasProperty(changes, `flags.${MODULE_ID}`) || foundry.utils.hasProperty(changes, "system.basic")) {
        TaskbarIntegration.refresh();
      }
    });

    TaskbarIntegration.attach(document);
    TaskbarIntegration._observer = new MutationObserver(() => {
      const now = Date.now();
      if (now - TaskbarIntegration._lastScan < 500) return;
      TaskbarIntegration._lastScan = now;
      if (!document.getElementById(TaskbarIntegration.WIDGET_ID)) TaskbarIntegration.attach(document);
    });
    TaskbarIntegration._observer.observe(document.body, { childList: true, subtree: true });
  }

  static findContainer(root = document) {
    for (const selector of TaskbarIntegration.CONTAINER_SELECTORS) {
      const el = root.querySelector?.(selector) ?? document.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  static getActiveCharacter() {
    return game.user.character ?? canvas?.tokens?.controlled?.[0]?.actor ?? null;
  }

  static attach(container) {
    if (!container || document.getElementById(TaskbarIntegration.WIDGET_ID)) return;
    const root = container instanceof HTMLElement ? container : (container?.[0] ?? null);
    if (!root) return;

    const target = TaskbarIntegration.findContainer(root) ?? (root !== document ? root : null);
    if (!target) return;

    const actor = TaskbarIntegration.getActiveCharacter();
    if (!actor) return;

    const data = DevelopmentService.getData(actor);
    const tier = actor.system?.basic?.tier ?? 1;
    const xp = actor.system?.basic?.xp ?? 0;
    const threshold = DevelopmentService.getNextThreshold(tier);

    const widget = document.createElement("div");
    widget.id = TaskbarIntegration.WIDGET_ID;
    widget.className = "cypher-xp-widget";
    widget.innerHTML = `
      <span class="cxp-icon">&#9670;</span>
      <span class="cxp-xp">XP ${xp}</span>
      <span class="cxp-progress">${data.progress.lifetime}${threshold ? "/" + threshold : ""}</span>
      <span class="cxp-tier">T${tier}</span>`;
    widget.title = `Cypher XP\nTier ${tier}\nXP: ${xp}\nDevelopment Progress: ${data.progress.lifetime}${threshold ? " / " + threshold : " (max tier)"}`;
    widget.addEventListener("click", async () => {
      const { PlayerDevelopmentApp } = await import("./apps/player-app.js");
      PlayerDevelopmentApp.show(actor);
    });

    target.appendChild(widget);
    log("Player widget attached.");
  }

  static refresh() {
    document.getElementById(TaskbarIntegration.WIDGET_ID)?.remove();
    TaskbarIntegration.attach(document);
  }
}
