import { MODULE_ID, MENU_ICON_SIZES } from "./constants.js";
import { DevelopmentService } from "./development-service.js";
import { log } from "./settings.js";
import { makeDraggable, applySavedPosition } from "./utils/draggable.js";

export class TaskbarIntegration {
  static CONTAINER_SELECTORS = [
    "#cypher-taskbar", ".cypher-taskbar", "[data-module='cypher-taskbar']"
  ];
  static WRAPPER_ID = "cypher-xp-player-launcher";
  static POPUP_ID = "cypher-xp-player-flyout";
  static POSITION_SETTING = "playerWidgetPosition";
  static SIZE_SETTING = "playerIconSize";
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

    Hooks.on("updateUser", (user, changes) => {
      if (user.id === game.user.id && foundry.utils.hasProperty(changes, "character")) {
        TaskbarIntegration.refresh(true);
      }
    });

    Hooks.on("updateActor", (actor, changes) => {
      if (!actor.isOwner) return;
      if (foundry.utils.hasProperty(changes, `flags.${MODULE_ID}`) || foundry.utils.hasProperty(changes, "system.basic")) {
        TaskbarIntegration.updateStatus();
      }
    });

    Hooks.on(`${MODULE_ID}.playerIconSizeChanged`, () => TaskbarIntegration.applyIconSize());

    document.addEventListener("click", (event) => {
      const popup = document.getElementById(TaskbarIntegration.POPUP_ID);
      const wrapper = document.getElementById(TaskbarIntegration.WRAPPER_ID);
      if (popup?.classList.contains("cxp-open") && !popup.contains(event.target) && !wrapper?.contains(event.target)) {
        TaskbarIntegration.closePopup();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") TaskbarIntegration.closePopup();
    });

    TaskbarIntegration.attach(document);
    TaskbarIntegration._observer = new MutationObserver(() => {
      const now = Date.now();
      if (now - TaskbarIntegration._lastScan < 500) return;
      TaskbarIntegration._lastScan = now;
      if (!document.getElementById(TaskbarIntegration.WRAPPER_ID)) TaskbarIntegration.attach(document);
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
    if (!container || document.getElementById(TaskbarIntegration.WRAPPER_ID)) return;

    const actor = TaskbarIntegration.getActiveCharacter();
    if (!actor) return;

    const wrapper = TaskbarIntegration.buildLauncher(actor);

    makeDraggable(wrapper, wrapper.querySelector(".cxp-single-gm-btn"), TaskbarIntegration.POSITION_SETTING, {
      onReset: () => TaskbarIntegration.refresh(true)
    });

    if (!applySavedPosition(wrapper, TaskbarIntegration.POSITION_SETTING)) {
      const root = container instanceof HTMLElement ? container : (container?.[0] ?? null);
      const target = (root ? TaskbarIntegration.findContainer(root) : null) ?? (root !== document ? root : null);
      if (!target) {
        wrapper.classList.add("cxp-floating-fallback-player");
        document.body.appendChild(wrapper);
        log("Player taskbar not found — launcher using visible floating fallback.");
      } else {
        target.appendChild(wrapper);
        log("Player launcher attached to taskbar.");
      }
    }

    TaskbarIntegration.applyIconSize();
  }

  static buildLauncher(actor) {
    const wrapper = document.createElement("div");
    wrapper.id = TaskbarIntegration.WRAPPER_ID;
    wrapper.className = "cypher-xp-single-launcher-wrapper cxp-player-launcher";

    const pending = TaskbarIntegration.countOwnPending(actor);

    wrapper.innerHTML = `
      <button type="button" class="cxp-single-gm-btn cxp-player-btn ${pending ? "cxp-has-alerts" : ""}" title="Cypher XP\nDrag to move · right-click to dock">
        <i class="fa-solid fa-chart-line"></i>
        <span class="cxp-badge-bubble" data-cxp-pending ${pending ? "" : "hidden"}>${pending}</span>
      </button>
      <div id="${TaskbarIntegration.POPUP_ID}" class="cypher-xp-flyout-menu cxp-player-flyout">
        <div class="cxp-flyout-header"><i class="fa-solid fa-chart-line"></i> Cypher XP</div>
        <div class="cxp-flyout-status" data-cxp-status></div>
        <div class="cxp-flyout-items">
          <button type="button" class="cxp-flyout-btn" data-cxp="open"><i class="fa-solid fa-table-columns"></i><span>Development Track</span></button>
          <button type="button" class="cxp-flyout-btn" data-cxp="requests"><i class="fa-solid fa-inbox"></i><span>My Requests</span><span class="cxp-item-badge" data-cxp-count="requests">${pending}</span></button>
          <button type="button" class="cxp-flyout-btn" data-cxp="rules"><i class="fa-solid fa-book-open"></i><span>Experience Rules</span></button>
        </div>
        <div class="cxp-flyout-divider"></div>
        <label class="cxp-flyout-setting-row">Icon Size
          <select class="cxp-size-select">
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </label>
        <button type="button" class="cxp-flyout-btn cxp-reset-btn" data-cxp="reset"><i class="fa-solid fa-rotate-left"></i><span>Reset Position</span></button>
      </div>`;

    const btn = wrapper.querySelector(".cxp-single-gm-btn");
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      TaskbarIntegration.togglePopup();
    });

    wrapper.querySelectorAll("[data-cxp]").forEach(item => item.addEventListener("click", async (event) => {
      event.stopPropagation();
      const action = item.dataset.cxp;
      TaskbarIntegration.closePopup();
      await TaskbarIntegration.handleAction(action);
    }));

    const select = wrapper.querySelector(".cxp-size-select");
    select.value = game.settings.get(MODULE_ID, TaskbarIntegration.SIZE_SETTING) || "medium";
    select.addEventListener("change", async (event) => {
      await game.settings.set(MODULE_ID, TaskbarIntegration.SIZE_SETTING, event.target.value);
    });

    return wrapper;
  }

  static togglePopup() {
    const popup = document.getElementById(TaskbarIntegration.POPUP_ID);
    if (!popup) return;
    if (popup.classList.contains("cxp-open")) TaskbarIntegration.closePopup();
    else TaskbarIntegration.openPopup();
  }

  static openPopup() {
    const popup = document.getElementById(TaskbarIntegration.POPUP_ID);
    const wrapper = document.getElementById(TaskbarIntegration.WRAPPER_ID);
    if (!popup || !wrapper) return;
    TaskbarIntegration.updateStatus();
    const rect = wrapper.getBoundingClientRect();
    popup.classList.toggle("cxp-drop-below", rect.top < 320);
    popup.classList.add("cxp-open");
  }

  static closePopup() {
    document.getElementById(TaskbarIntegration.POPUP_ID)?.classList.remove("cxp-open");
  }

  static async handleAction(action) {
    const actor = TaskbarIntegration.getActiveCharacter();
    switch (action) {
      case "open": {
        if (!actor) return ui.notifications.warn("Cypher XP: select or assign a character first.");
        const { PlayerDevelopmentApp } = await import("./apps/player-app.js");
        PlayerDevelopmentApp.show(actor);
        break;
      }
      case "requests": {
        if (!actor) return ui.notifications.warn("Cypher XP: select or assign a character first.");
        const { PlayerDevelopmentApp } = await import("./apps/player-app.js");
        const app = PlayerDevelopmentApp.show(actor);
        app.activeTab = "requests";
        app.render();
        break;
      }
      case "rules": {
        const { RulesApp } = await import("./apps/rules-app.js");
        RulesApp.show();
        break;
      }
      case "reset": {
        await game.settings.set(MODULE_ID, TaskbarIntegration.POSITION_SETTING, null);
        TaskbarIntegration.refresh(true);
        break;
      }
    }
  }

  static updateStatus() {
    const wrapper = document.getElementById(TaskbarIntegration.WRAPPER_ID);
    if (!wrapper) return;
    const actor = TaskbarIntegration.getActiveCharacter();
    if (!actor) return;

    const data = DevelopmentService.getData(actor);
    const tier = actor.system?.basic?.tier ?? 1;
    const xp = actor.system?.basic?.xp ?? 0;
    const threshold = DevelopmentService.getNextThreshold(tier);
    const percent = threshold ? Math.min(100, Math.round((data.progress.lifetime / threshold) * 100)) : 100;
    const pending = TaskbarIntegration.countOwnPending(actor);

    const status = wrapper.querySelector("[data-cxp-status]");
    if (status) {
      status.innerHTML = `
        <div class="cxp-status-row">
          <span class="cxp-tag">Tier ${tier}</span>
          <span class="cxp-tag">XP ${xp}</span>
          <span class="cxp-tag">${data.progress.lifetime}${threshold ? "/" + threshold : ""}</span>
        </div>
        <div class="cxp-mini-progress"><div class="cxp-mini-progress-fill" style="width: ${percent}%;"></div></div>`;
    }

    const badge = wrapper.querySelector("[data-cxp-pending]");
    if (badge) {
      badge.textContent = pending;
      badge.hidden = pending === 0;
    }
    wrapper.querySelector(".cxp-single-gm-btn")?.classList.toggle("cxp-has-alerts", pending > 0);

    const reqBadge = wrapper.querySelector("[data-cxp-count='requests']");
    if (reqBadge) reqBadge.textContent = pending;
  }

  static applyIconSize() {
    const key = game.settings.get(MODULE_ID, TaskbarIntegration.SIZE_SETTING) || "medium";
    const size = MENU_ICON_SIZES[key] ?? MENU_ICON_SIZES.medium;
    const wrapper = document.getElementById(TaskbarIntegration.WRAPPER_ID);
    if (wrapper) {
      wrapper.style.setProperty("--cxp-btn-size", `${size.px}px`);
      const select = wrapper.querySelector(".cxp-size-select");
      if (select) select.value = key;
    }
  }

  static countOwnPending(actor) {
    if (!actor) return 0;
    return DevelopmentService.getData(actor).requests?.filter(r => r.status === "pending").length ?? 0;
  }

  static refresh(rebuild = false) {
    const existing = document.getElementById(TaskbarIntegration.WRAPPER_ID);
    if (existing && rebuild) {
      existing.remove();
      TaskbarIntegration.attach(document);
    } else if (existing) {
      TaskbarIntegration.updateStatus();
    } else {
      TaskbarIntegration.attach(document);
    }
  }
}
