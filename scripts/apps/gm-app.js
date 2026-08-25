import { MODULE_ID, BREAKTHROUGH_BENEFITS } from "../constants.js";
import { DevelopmentService } from "../development-service.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class GmDevelopmentDashboard extends HandlebarsApplicationMixin(ApplicationV2) {
  static _instance = null;

  /** Singleton dashboard: focuses the existing window instead of duplicating it. */
  static show({ tab } = {}) {
    if (GmDevelopmentDashboard._instance?.rendered) {
      if (tab) GmDevelopmentDashboard._instance.activeTab = tab;
      GmDevelopmentDashboard._instance.bringToFront?.();
      GmDevelopmentDashboard._instance.render();
      return GmDevelopmentDashboard._instance;
    }
    const app = new GmDevelopmentDashboard();
    if (tab) app.activeTab = tab;
    GmDevelopmentDashboard._instance = app;
    app.render(true);
    return app;
  }

  static DEFAULT_OPTIONS = {
    id: "cypher-xp-gm-dashboard",
    tag: "div",
    window: { title: "Cypher XP — GM Dashboard", icon: "fa-solid fa-user-shield", resizable: true },
    position: { width: 920, height: 700 },
    actions: {
      approveRequest: GmDevelopmentDashboard.onApproveRequest,
      rejectRequest: GmDevelopmentDashboard.onRejectRequest,
      awardXP: GmDevelopmentDashboard.onAwardXP,
      advanceTier: GmDevelopmentDashboard.onAdvanceTier,
      openActorApp: GmDevelopmentDashboard.onOpenActorApp,
      changeTab: GmDevelopmentDashboard.onChangeTab
    }
  };

  static PARTS = { body: { template: `modules/${MODULE_ID}/templates/gm-development-dashboard.hbs` } };

  constructor() {
    super();
    this.activeTab = "party";
    this._updateHook = Hooks.on("updateActor", (actor) => {
      if (actor.type === "pc" && this.rendered) this.render();
    });
  }

  async close(options = {}) {
    Hooks.off("updateActor", this._updateHook);
    if (GmDevelopmentDashboard._instance === this) GmDevelopmentDashboard._instance = null;
    return super.close(options);
  }

  getPartyActors() {
    return game.actors.filter(a => a.type === "pc" && a.hasPlayerOwner);
  }

  async _prepareContext() {
    const rows = this.getPartyActors().map(actor => {
      const data = DevelopmentService.getData(actor);
      const tier = actor.system?.basic?.tier ?? 1;
      const threshold = DevelopmentService.getNextThreshold(tier);
      const pendingRequests = data.requests.filter(r => r.status === "pending");
      return {
        actorId: actor.id, name: actor.name, img: actor.img,
        tier, xp: actor.system?.basic?.xp ?? 0,
        progress: data.progress.lifetime, threshold,
        tierReady: DevelopmentService.isTierReady(data, tier),
        pendingCount: pendingRequests.length,
        pendingRequests: pendingRequests.map(r => ({ ...r, actorId: actor.id }))
      };
    });
    return { rows, allPending: rows.flatMap(r => r.pendingRequests), activeTab: this.activeTab };
  }

  static onChangeTab(event, target) {
    this.activeTab = target.dataset.tab;
    this.render();
  }

  static async onApproveRequest(event, target) {
    const actor = game.actors.get(target.dataset.actorId);
    if (!actor) return ui.notifications.error("Cypher XP: actor no longer exists.");
    const request = DevelopmentService.getData(actor).requests.find(r => r.id === target.dataset.requestId);
    if (!request) return;

    const finalCost = await GmDevelopmentDashboard.promptFinalCost(request.requestedCost, request.label);
    if (finalCost === null) return;

    try {
      const result = await DevelopmentService.applyApprovedRequest(actor, target.dataset.requestId, { finalCost });
      let message = `Approved "${request.label}" for ${actor.name} (${finalCost} XP).`;
      if (result.tierReady) message += ` ${actor.name} is ready to advance — use the Advance button.`;
      ui.notifications.info(message);
    } catch (err) {
      console.error(`${MODULE_ID} | approval failed`, err);
    }
    this.render();
  }

  static async onRejectRequest(event, target) {
    const actor = game.actors.get(target.dataset.actorId);
    if (!actor) return;
    const reason = await foundry.applications.api.DialogV2.prompt({
      window: { title: "Rejection Reason" },
      content: `<textarea name="reason" rows="3" style="width:100%;" placeholder="Explain why this request was rejected..."></textarea>`,
      ok: { callback: (event, button, dialog) => dialog.element.querySelector("textarea[name='reason']").value }
    }).catch(() => "");
    await DevelopmentService.rejectRequest(actor, target.dataset.requestId, reason ?? "");
    ui.notifications.warn(`Cypher XP: rejected request for ${actor.name}.`);
    this.render();
  }

  static async onAwardXP(event, target) {
    const actor = game.actors.get(target.dataset.actorId);
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
    this.render();
  }

  static async onAdvanceTier(event, target) {
    const actor = game.actors.get(target.dataset.actorId);
    if (!actor) return;

    const options = Object.entries(BREAKTHROUGH_BENEFITS)
      .map(([key, label]) => `<option value="${key}">${label}</option>`).join("");

    const benefit = await foundry.applications.api.DialogV2.prompt({
      window: { title: `Tier Breakthrough: ${actor.name}` },
      content: `<p>Choose the Breakthrough Benefit:</p><select name="benefit" style="width:100%;">${options}</select>`,
      ok: { callback: (event, button, dialog) => dialog.element.querySelector("select[name='benefit']").value }
    }).catch(() => null);
    if (!benefit) return;

    let poolKey = null;
    if (benefit === "hardened-potential") {
      poolKey = await foundry.applications.api.DialogV2.prompt({
        window: { title: "Hardened Potential — Choose Pool" },
        content: `
          <label><input type="radio" name="pool" value="might" checked> Might</label><br>
          <label><input type="radio" name="pool" value="speed"> Speed</label><br>
          <label><input type="radio" name="pool" value="intellect"> Intellect</label><br>
          <label><input type="radio" name="pool" value="additional"> Additional</label>`,
        ok: { callback: (event, button, dialog) => dialog.element.querySelector("input[name='pool']:checked")?.value ?? null }
      }).catch(() => null);
      if (!poolKey) return;
    }

    const result = await DevelopmentService.applyTierBreakthrough(actor, { benefit, poolKey });
    if (result) {
      ui.notifications.info(`Cypher XP: ${actor.name} advanced to Tier ${result.toTier}!`);
      this.render();
    }
  }

  static async onOpenActorApp(event, target) {
    const actor = game.actors.get(target.dataset.actorId);
    if (!actor) return;
    const { PlayerDevelopmentApp } = await import("./player-app.js");
    PlayerDevelopmentApp.show(actor);
  }

  static async promptFinalCost(requestedCost, label) {
    return foundry.applications.api.DialogV2.prompt({
      window: { title: `Approve: ${label}` },
      content: `
        <p>Requested cost: <strong>${requestedCost} XP</strong></p>
        <label>Final approved cost: <input type="number" name="finalCost" value="${requestedCost}" min="0" step="1"></label>`,
      ok: { callback: (event, button, dialog) => Number(dialog.element.querySelector("input[name='finalCost']").value) }
    }).catch(() => null);
  }
}
