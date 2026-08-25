import { MODULE_ID, MENU_ICON_SIZES } from "./constants.js";
import { DevelopmentService } from "./development-service.js";
import { log } from "./settings.js";

/**
 * GM-side integration: a single launcher icon next to the GM Taskbar's
 * Actor Visibility control, opening a flyout menu anchored above the taskbar.
 * Never depends on a guessed taskbar root selector: scans the whole document
 * for the Actor Visibility button, observes late DOM additions, and falls back
 * to a visible floating launcher if no anchor exists.
 */
export class GmTaskbarIntegration {
  static WRAPPER_ID = "cypher-xp-gm-launcher-wrapper";
  static POPUP_ID = "cypher-xp-gm-flyout-menu";
  static MODULE_SPACE_ID = "cypher-xp-module-space";

  static VISIBILITY_SELECTORS = [
    "[title*='Actor Visibility' i]", "[title*='Visibility' i]",
    "[aria-label*='Actor Visibility' i]", "[aria-label*='Visibility' i]",
    "[data-action*='visibility' i]", "[data-action*='actor-visibility' i]",
    ".actor-visibility-btn", ".visibility-btn", "#actor-visibility"
  ];

  static MODULE_SPACE_SELECTORS = [
    "[data-module-space]", ".module-space", "#module-space",
    ".taskbar-module-space", ".gm-module-space", "#gm-module-space"
  ];

  static _observer = null;
  static _lastScan = 0;

  static init() {
    if (!game.user.isGM) return;
    if (!game.settings.get(MODULE_ID, "enableGmTaskbarIntegration")) return;

    Hooks.on("cypherGmTaskbar.rendered", (data) => {
      GmTaskbarIntegration.attach(data?.root ?? data?.element ?? data);
    });
    Hooks.on("cypherGmTaskbar.registerModuleSpace", (container) => {
      GmTaskbarIntegration.renderModuleSpace(container);
    });
    Hooks.on("renderApplicationV2", (app, html) => {
      if (app?.id?.toLowerCase?.().includes("gm-taskbar")) GmTaskbarIntegration.attach(html);
    });

    Hooks.on(`${MODULE_ID}.menuIconSizeChanged`, () => GmTaskbarIntegration.applyIconSize());
    for (const hook of [`${MODULE_ID}.requestCreated`, `${MODULE_ID}.requestUpdated`, `${MODULE_ID}.purchaseApplied`, `${MODULE_ID}.tierBreakthrough`, `${MODULE_ID}.xpAwarded`]) {
      Hooks.on(hook, () => GmTaskbarIntegration.refresh());
    }

    // Intrusion bridge (GM Taskbar owns intrusion logic; we only record XP).
    Hooks.on("cypherGmTaskbar.intrusionAccepted", async ({ actor, recipientActor }) => {
      await DevelopmentService.recordIntrusion(actor, { xpDelta: 2, type: "gm-intrusion", label: "GM Intrusion Accepted", metadata: { transferRequired: true } });
      if (recipientActor) {
        await DevelopmentService.recordIntrusion(actor, { xpDelta: -1, type: "gm-intrusion-transfer-sent", label: "XP Transferred (Intrusion)", metadata: { to: recipientActor.uuid } });
        await DevelopmentService.recordIntrusion(recipientActor, { xpDelta: 1, type: "gm-intrusion-transfer-received", label: "XP Received (Intrusion)", metadata: { from: actor.uuid } });
      }
      GmTaskbarIntegration.refresh();
    });
    Hooks.on("cypherGmTaskbar.intrusionRefused", async ({ actor }) => {
      await DevelopmentService.recordIntrusion(actor, { xpDelta: -1, type: "gm-intrusion-refused", label: "GM Intrusion Refused" });
      GmTaskbarIntegration.refresh();
    });

    // Outside click / Escape close the flyout.
    document.addEventListener("click", (event) => {
      const popup = document.getElementById(GmTaskbarIntegration.POPUP_ID);
      const wrapper = document.getElementById(GmTaskbarIntegration.WRAPPER_ID);
      if (popup?.classList.contains("cxp-open") && !popup.contains(event.target) && !wrapper?.contains(event.target)) {
        GmTaskbarIntegration.closePopup();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") GmTaskbarIntegration.closePopup();
    });

    GmTaskbarIntegration.attach(document);
    GmTaskbarIntegration._observer = new MutationObserver(() => {
      const now = Date.now();
      if (now - GmTaskbarIntegration._lastScan < 500) return;
      GmTaskbarIntegration._lastScan = now;
      GmTaskbarIntegration.attach(document);
    });
    GmTaskbarIntegration._observer.observe(document.body, { childList: true, subtree: true });
  }

  // ---------- DOM discovery ----------

  static findVisibilityButton(root = document) {
    for (const selector of GmTaskbarIntegration.VISIBILITY_SELECTORS) {
      const el = root.querySelector?.(selector) ?? document.querySelector(selector);
      if (el) return el;
    }
    return [...document.querySelectorAll("button, a, [role='button']")].find(el =>
      /actor\s*visibility/i.test(`${el.title || ""} ${el.getAttribute("aria-label") || ""} ${el.dataset?.action || ""} ${el.textContent || ""}`)
    ) ?? null;
  }

  static findModuleSpace(root = document) {
    for (const selector of GmTaskbarIntegration.MODULE_SPACE_SELECTORS) {
      const el = root.querySelector?.(selector) ?? document.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  // ---------- Attach ----------

  static attach(root = document) {
    if (!document.getElementById(GmTaskbarIntegration.WRAPPER_ID)) {
      const wrapper = GmTaskbarIntegration.buildLauncher();
      const anchor = GmTaskbarIntegration.findVisibilityButton(root);
      if (anchor?.parentElement) {
        anchor.insertAdjacentElement("afterend", wrapper);
        log("GM launcher attached next to Actor Visibility.");
      } else {
        wrapper.classList.add("cxp-floating-fallback");
        document.body.appendChild(wrapper);
        log("Actor Visibility not found — GM launcher using visible floating fallback.");
      }
      GmTaskbarIntegration.applyIconSize();
    }
    GmTaskbarIntegration.attachModuleSpace(root);
  }

  static buildLauncher() {
    const wrapper = document.createElement("div");
    wrapper.id = GmTaskbarIntegration.WRAPPER_ID;
    wrapper.className = "cypher-xp-single-launcher-wrapper";

    const pending = GmTaskbarIntegration.countPending();
    const ready = GmTaskbarIntegration.countTierReady();
    const total = pending + ready;

    wrapper.innerHTML = `
      <button type="button" class="cxp-single-gm-btn ${total ? "cxp-has-alerts" : ""}" title="Cypher XP">
        <i class="fa-solid fa-chart-line"></i>
        ${total ? `<span class="cxp-badge-bubble">${total}</span>` : ""}
      </button>
      <div id="${GmTaskbarIntegration.POPUP_ID}" class="cypher-xp-flyout-menu">
        <div class="cxp-flyout-header"><i class="fa-solid fa-chart-line"></i> Cypher XP</div>
        <div class="cxp-flyout-items">
          <button type="button" class="cxp-flyout-btn" data-cxp="dashboard"><i class="fa-solid fa-table-columns"></i><span>GM Dashboard</span></button>
          <button type="button" class="cxp-flyout-btn" data-cxp="award"><i class="fa-solid fa-star"></i><span>Award XP</span></button>
          <button type="button" class="cxp-flyout-btn" data-cxp="requests"><i class="fa-solid fa-inbox"></i><span>Pending Requests</span><span class="cxp-item-badge" data-cxp-count="requests">${pending}</span></button>
          <button type="button" class="cxp-flyout-btn" data-cxp="tier"><i class="fa-solid fa-angles-up"></i><span>Tier Ready</span><span class="cxp-item-badge cxp-tier-badge" data-cxp-count="tier">${ready}</span></button>
        </div>
        <div class="cxp-flyout-divider"></div>
        <label class="cxp-flyout-setting-row">Icon Size
          <select class="cxp-size-select">
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </label>
      </div>`;

    wrapper.querySelector(".cxp-single-gm-btn").addEventListener("click", (event) => {
      event.stopPropagation();
      GmTaskbarIntegration.togglePopup();
    });

    wrapper.querySelectorAll("[data-cxp]").forEach(btn => btn.addEventListener("click", async (event) => {
      event.stopPropagation();
      const action = btn.dataset.cxp;
      GmTaskbarIntegration.closePopup();
      await GmTaskbarIntegration.handleAction(action);
    }));

    const select = wrapper.querySelector(".cxp-size-select");
    select.value = game.settings.get(MODULE_ID, "gmMenuIconSize") || "medium";
    select.addEventListener("change", async (event) => {
      await game.settings.set(MODULE_ID, "gmMenuIconSize", event.target.value);
    });

    return wrapper;
  }

  // ---------- Flyout ----------

  static togglePopup() {
    const popup = document.getElementById(GmTaskbarIntegration.POPUP_ID);
    if (!popup) return;
    if (popup.classList.contains("cxp-open")) GmTaskbarIntegration.closePopup();
    else GmTaskbarIntegration.openPopup();
  }

  static openPopup() {
    const popup = document.getElementById(GmTaskbarIntegration.POPUP_ID);
    if (!popup) return;
    GmTaskbarIntegration.updateBadges();
    popup.classList.add("cxp-open");
  }

  static closePopup() {
    document.getElementById(GmTaskbarIntegration.POPUP_ID)?.classList.remove("cxp-open");
  }

  static async handleAction(action) {
    const { GmDevelopmentDashboard } = await import("./apps/gm-app.js");
    switch (action) {
      case "dashboard": GmDevelopmentDashboard.show(); break;
      case "requests":  GmDevelopmentDashboard.show({ tab: "requests" }); break;
      case "tier":      GmDevelopmentDashboard.show({ tab: "party" }); break;
      case "award":     await GmTaskbarIntegration.awardXpFlow(); break;
    }
  }

  static async awardXpFlow() {
    const actors = GmTaskbarIntegration.getPartyActors();
    if (!actors.length) return ui.notifications.warn("Cypher XP: no player-owned PCs found.");

    const options = actors.map(a => `<option value="${a.id}">${a.name}</option>`).join("");
    const actorId = await foundry.applications.api.DialogV2.prompt({
      window: { title: "Award XP — Choose Character" },
      content: `<label>Character: <select name="actorId">${options}</select></label>`,
      ok: { callback: (event, button, dialog) => dialog.element.querySelector("select[name='actorId']").value }
    }).catch(() => null);
    if (!actorId) return;

    const actor = game.actors.get(actorId);
    if (!actor) return;

    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: `Award XP: ${actor.name}` },
      content: `
        <label>Amount: <input type="number" name="amount" value="1" min="1" step="1"></label><br>
        <label>Reason: <input type="text" name="reason" placeholder="Discovery, GM award, etc."></label>`,
      ok: { callback: (event, button, dialog) => ({
        amount: Number(dialog.element.querySelector("input[name='amount']").value),
        reason: dialog.element.querySelector("input[name='reason']").value
      }) }
    }).catch(() => null);
    if (!result || !Number.isInteger(result.amount) || result.amount <= 0) return;

    await DevelopmentService.gmAward(actor, result.amount, result.reason);
    ui.notifications.info(`Cypher XP: awarded ${result.amount} XP to ${actor.name}.`);
  }

  // ---------- Badges / size ----------

  static updateBadges() {
    const wrapper = document.getElementById(GmTaskbarIntegration.WRAPPER_ID);
    if (!wrapper) return;
    const pending = GmTaskbarIntegration.countPending();
    const ready = GmTaskbarIntegration.countTierReady();
    const total = pending + ready;

    const btn = wrapper.querySelector(".cxp-single-gm-btn");
    let bubble = btn.querySelector(".cxp-badge-bubble");
    if (total > 0) {
      if (!bubble) {
        bubble = document.createElement("span");
        bubble.className = "cxp-badge-bubble";
        btn.appendChild(bubble);
      }
      bubble.textContent = total;
      btn.classList.add("cxp-has-alerts");
    } else {
      bubble?.remove();
      btn.classList.remove("cxp-has-alerts");
    }

    const reqBadge = wrapper.querySelector("[data-cxp-count='requests']");
    if (reqBadge) reqBadge.textContent = pending;
    const tierBadge = wrapper.querySelector("[data-cxp-count='tier']");
    if (tierBadge) tierBadge.textContent = ready;
  }

  static applyIconSize() {
    const key = game.settings.get(MODULE_ID, "gmMenuIconSize") || "medium";
    const size = MENU_ICON_SIZES[key] ?? MENU_ICON_SIZES.medium;
    const wrapper = document.getElementById(GmTaskbarIntegration.WRAPPER_ID);
    if (wrapper) {
      wrapper.style.setProperty("--cxp-btn-size", `${size.px}px`);
      const select = wrapper.querySelector(".cxp-size-select");
      if (select) select.value = key;
    }
    const panelSelect = document.querySelector(`#${GmTaskbarIntegration.MODULE_SPACE_ID} .cxp-size-select`);
    if (panelSelect) panelSelect.value = key;
  }

  static refresh() {
    GmTaskbarIntegration.updateBadges();
  }

  // ---------- Module space panel (optional host region) ----------

  static attachModuleSpace(root = document) {
    if (document.getElementById(GmTaskbarIntegration.MODULE_SPACE_ID)) return;
    const host = GmTaskbarIntegration.findModuleSpace(root);
    if (host) GmTaskbarIntegration.renderModuleSpace(host);
  }

  static renderModuleSpace(container) {
    const root = container instanceof HTMLElement ? container : container?.[0];
    if (!root || root.querySelector?.(`#${GmTaskbarIntegration.MODULE_SPACE_ID}`)) return;

    const panel = document.createElement("div");
    panel.id = GmTaskbarIntegration.MODULE_SPACE_ID;
    panel.className = "cypher-xp-module-space";
    panel.innerHTML = `
      <div class="cxp-module-space-header"><span class="cxp-icon">&#9670;</span> Cypher XP</div>
      <div class="cxp-module-space-row">
        <label>Icon size</label>
        <select class="cxp-size-select">
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </div>
      <div class="cxp-module-space-row">
        <button type="button" class="cxp-module-space-btn"><i class="fa-solid fa-table-columns"></i> Open GM Dashboard</button>
      </div>`;

    const select = panel.querySelector(".cxp-size-select");
    select.value = game.settings.get(MODULE_ID, "gmMenuIconSize") || "medium";
    select.addEventListener("change", async (event) => {
      await game.settings.set(MODULE_ID, "gmMenuIconSize", event.target.value);
    });
    panel.querySelector(".cxp-module-space-btn").addEventListener("click", async () => {
      const { GmDevelopmentDashboard } = await import("./apps/gm-app.js");
      GmDevelopmentDashboard.show();
    });

    root.appendChild(panel);
    log("Module-space panel attached.");
  }

  // ---------- Party stats ----------

  static getPartyActors() {
    return game.actors.filter(a => a.type === "pc" && a.hasPlayerOwner);
  }

  static countPending() {
    return GmTaskbarIntegration.getPartyActors().reduce((sum, actor) =>
      sum + (DevelopmentService.getData(actor).requests?.filter(r => r.status === "pending").length ?? 0), 0);
  }

  static countTierReady() {
    return GmTaskbarIntegration.getPartyActors().reduce((sum, actor) =>
      sum + (DevelopmentService.isTierReady(DevelopmentService.getData(actor), actor.system?.basic?.tier ?? 1) ? 1 : 0), 0);
  }
}
