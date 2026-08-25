import { MODULE_ID, PURCHASE_CATALOG } from "../constants.js";
import { DevelopmentService } from "../development-service.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class PlayerDevelopmentApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static _instances = new Map();

  /** Singleton per actor: focuses the existing window instead of duplicating it. */
  static show(actor) {
    const existing = PlayerDevelopmentApp._instances.get(actor.id);
    if (existing?.rendered) {
      existing.bringToFront?.();
      return existing;
    }
    const app = new PlayerDevelopmentApp({ actor });
    PlayerDevelopmentApp._instances.set(actor.id, app);
    app.render(true);
    return app;
  }

  static DEFAULT_OPTIONS = {
    id: "cypher-xp-player-app",
    tag: "div",
    window: { title: "Cypher XP — Development Track", icon: "fa-solid fa-chart-line", resizable: true },
    position: { width: 640, height: 660 },
    actions: {
      submitPurchase: PlayerDevelopmentApp.onSubmitPurchase,
      cancelRequest: PlayerDevelopmentApp.onCancelRequest,
      changeTab: PlayerDevelopmentApp.onChangeTab
    }
  };

  static PARTS = { body: { template: `modules/${MODULE_ID}/templates/player-development-app.hbs` } };

  constructor({ actor } = {}) {
    super();
    this.actor = actor;
    this.activeTab = "overview";
    this._updateHook = Hooks.on("updateActor", (updated) => {
      if (updated.id === this.actor?.id && this.rendered) this.render();
    });
  }

  async close(options = {}) {
    Hooks.off("updateActor", this._updateHook);
    PlayerDevelopmentApp._instances.delete(this.actor?.id);
    return super.close(options);
  }

  async _prepareContext() {
    const data = await DevelopmentService.ensureInitialized(this.actor);
    const tier = this.actor.system?.basic?.tier ?? 1;
    const xp = this.actor.system?.basic?.xp ?? 0;
    const threshold = DevelopmentService.getNextThreshold(tier);
    const remaining = threshold ? Math.max(0, threshold - data.progress.lifetime) : 0;
    const percent = threshold ? Math.min(100, Math.round((data.progress.lifetime / threshold) * 100)) : 100;

    return {
      actor: this.actor, tier, xp,
      progress: data.progress.lifetime, threshold, remaining, percent,
      tierReady: DevelopmentService.isTierReady(data, tier),
      catalog: Object.entries(PURCHASE_CATALOG).map(([key, entry]) => ({ key, ...entry })),
      requests: data.requests.slice().sort((a, b) => b.timestamp - a.timestamp),
      transactions: data.transactions.slice().sort((a, b) => b.timestamp - a.timestamp).slice(0, 50),
      assets: data.assets.map(a => ({
        ...a,
        improvementsText: (a.improvements ?? []).map(i => i.label).join("; ")
      })),
      activeTab: this.activeTab
    };
  }

  static onChangeTab(event, target) {
    this.activeTab = target.dataset.tab;
    this.render();
  }

  static async onSubmitPurchase(event, target) {
    const catalogKey = target.dataset.catalogKey;
    const entry = PURCHASE_CATALOG[catalogKey];
    if (!entry) return;

    const payload = { category: catalogKey, label: entry.label };

    if (catalogKey === "pool-increase") {
      const dist = await PlayerDevelopmentApp.promptPoolDistribution();
      if (!dist) return;
      payload.poolDistribution = dist;
      payload.requestedCost = entry.cost;
    } else if (catalogKey === "edge-increase") {
      const poolKey = await PlayerDevelopmentApp.promptPoolChoice();
      if (!poolKey) return;
      payload.poolKey = poolKey;
      payload.requestedCost = entry.cost;
    } else if (entry.tierScaled !== undefined) {
      const abilityTier = await PlayerDevelopmentApp.promptAbilityTier();
      if (abilityTier === null) return;
      payload.abilityTier = abilityTier;
      payload.requestedCost = entry.costBase + entry.tierScaled * abilityTier;
      payload.label = `${entry.label} (Tier ${abilityTier})`;
    } else if (catalogKey === "permanent-asset") {
      const name = await PlayerDevelopmentApp.promptText("Asset Name", "e.g. Safehouse, Mentor, Guild Standing");
      if (!name) return;
      const cost = await PlayerDevelopmentApp.promptCustomCost(entry.costRange);
      if (cost === null) return;
      payload.assetName = name;
      payload.label = `${entry.label}: ${name}`;
      payload.requestedCost = cost;
    } else if (catalogKey === "asset-improvement") {
      const data = DevelopmentService.getData(this.actor);
      if (!data.assets.length) {
        ui.notifications.warn("Cypher XP: no permanent assets to improve yet.");
        return;
      }
      const assetId = await PlayerDevelopmentApp.promptAssetChoice(data.assets);
      if (!assetId) return;
      const cost = await PlayerDevelopmentApp.promptCustomCost(entry.costRange);
      if (cost === null) return;
      payload.assetId = assetId;
      payload.requestedCost = cost;
    } else {
      payload.requestedCost = entry.cost;
    }

    payload.notes = await PlayerDevelopmentApp.promptNotes(payload.label);

    const request = await DevelopmentService.createRequest(this.actor, payload);
    if (request) {
      ui.notifications.info(`Cypher XP: "${payload.label}" submitted for GM approval.`);
      this.render();
    }
  }

  static async onCancelRequest(event, target) {
    await DevelopmentService.cancelRequest(this.actor, target.dataset.requestId);
    this.render();
  }

  // ---------- Dialog helpers ----------

  static async promptPoolDistribution() {
    return foundry.applications.api.DialogV2.prompt({
      window: { title: "Increase Capabilities — Distribute 4 Points" },
      content: `
        <p>Distribute exactly 4 points among your Pools.</p>
        <label>Might <input type="number" name="might" value="0" min="0" max="4"></label>
        <label>Speed <input type="number" name="speed" value="0" min="0" max="4"></label>
        <label>Intellect <input type="number" name="intellect" value="0" min="0" max="4"></label>
        <label>Additional <input type="number" name="additional" value="0" min="0" max="4"></label>`,
      ok: {
        callback: (event, button, dialog) => {
          const el = dialog.element;
          const dist = {
            might: Number(el.querySelector("input[name='might']").value),
            speed: Number(el.querySelector("input[name='speed']").value),
            intellect: Number(el.querySelector("input[name='intellect']").value),
            additional: Number(el.querySelector("input[name='additional']").value)
          };
          const total = Object.values(dist).reduce((s, v) => s + v, 0);
          if (total !== 4) {
            ui.notifications.warn(`Cypher XP: Pool points must total exactly 4 (you entered ${total}).`);
            return null;
          }
          return Object.fromEntries(Object.entries(dist).filter(([, v]) => v > 0));
        }
      }
    }).catch(() => null);
  }

  static async promptPoolChoice() {
    return foundry.applications.api.DialogV2.prompt({
      window: { title: "Choose Pool" },
      content: `
        <label><input type="radio" name="pool" value="might" checked> Might</label><br>
        <label><input type="radio" name="pool" value="speed"> Speed</label><br>
        <label><input type="radio" name="pool" value="intellect"> Intellect</label><br>
        <label><input type="radio" name="pool" value="additional"> Additional</label>`,
      ok: { callback: (event, button, dialog) => dialog.element.querySelector("input[name='pool']:checked")?.value ?? null }
    }).catch(() => null);
  }

  static async promptAbilityTier() {
    return foundry.applications.api.DialogV2.prompt({
      window: { title: "Ability Tier" },
      content: `<label>Ability Tier: <input type="number" name="tier" min="1" max="6" value="1" step="1"></label>`,
      ok: { callback: (event, button, dialog) => Number(dialog.element.querySelector("input[name='tier']").value) }
    }).catch(() => null);
  }

  static async promptCustomCost(range) {
    const [min, max] = range;
    return foundry.applications.api.DialogV2.prompt({
      window: { title: "Requested Cost" },
      content: `<label>Requested XP cost (${min}–${max}): <input type="number" name="cost" min="${min}" max="${max}" value="${min}" step="1"></label>`,
      ok: { callback: (event, button, dialog) => Number(dialog.element.querySelector("input[name='cost']").value) }
    }).catch(() => null);
  }

  static async promptText(title, placeholder = "") {
    return foundry.applications.api.DialogV2.prompt({
      window: { title },
      content: `<input type="text" name="text" style="width:100%;" placeholder="${placeholder}">`,
      ok: { callback: (event, button, dialog) => dialog.element.querySelector("input[name='text']").value.trim() || null }
    }).catch(() => null);
  }

  static async promptAssetChoice(assets) {
    const options = assets.map(a => `<option value="${a.id}">${a.name}</option>`).join("");
    return foundry.applications.api.DialogV2.prompt({
      window: { title: "Choose Asset to Improve" },
      content: `<label>Asset: <select name="assetId">${options}</select></label>`,
      ok: { callback: (event, button, dialog) => dialog.element.querySelector("select[name='assetId']").value }
    }).catch(() => null);
  }

  static async promptNotes(label) {
    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: `Notes: ${label}` },
      content: `<textarea name="notes" rows="4" style="width:100%;" placeholder="Describe the purchase, source, or justification..."></textarea>`,
      ok: { callback: (event, button, dialog) => dialog.element.querySelector("textarea[name='notes']").value }
    }).catch(() => "");
    return result ?? "";
  }
}
