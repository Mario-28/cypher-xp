import { MODULE_ID, PURCHASE_CATALOG, ABILITY_POOLS, SPEND_TYPES, CHART_COLORS } from "../constants.js";
import { DevelopmentService } from "../development-service.js";
import { ItemService } from "../item-service.js";
import { OverflowWatcher } from "../utils/overflow.js";
import { TooltipManager } from "../utils/tooltip.js";
import { RulesLauncher } from "../utils/rules-launcher.js";
import { summarizeTransactions } from "../utils/chart-data.js";
import { barChart, donutChart } from "../utils/svg-charts.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class PlayerDevelopmentApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static _instances = new Map();

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
    position: { width: 680, height: 700 },
    actions: {
      submitPurchase: PlayerDevelopmentApp.onSubmitPurchase,
      cancelRequest: PlayerDevelopmentApp.onCancelRequest,
      changeTab: PlayerDevelopmentApp.onChangeTab,
      logSpend: PlayerDevelopmentApp.onLogSpend
    }
  };

  static PARTS = { body: { template: `modules/${MODULE_ID}/templates/player-development-app.hbs` } };

  constructor({ actor } = {}) {
    super();
    this.actor = actor;
    this.activeTab = "chart";
    this._updateHook = Hooks.on("updateActor", (updated) => {
      if (updated.id === this.actor?.id && this.rendered) this.render();
    });
  }

  async close(options = {}) {
    Hooks.off("updateActor", this._updateHook);
    PlayerDevelopmentApp._instances.delete(this.actor?.id);
    TooltipManager.hide();
    return super.close(options);
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    OverflowWatcher.enable(this.element);
    TooltipManager.bind(this.element);
    RulesLauncher.attach(this.element);
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
      charts: PlayerDevelopmentApp.buildCharts(data),
      activeTab: this.activeTab
    };
  }

  static buildCharts(data) {
    const summary = summarizeTransactions(data.transactions);
    const sessions = summary.sessions;

    const earnedPerSession = barChart(sessions.map(s => ({ label: s.date, value: s.earned })));
    const progressPerSession = barChart(sessions.map(s => ({ label: s.date, value: s.progress })));
    const intrusionPerSession = barChart(sessions.map(s => ({ label: s.date, value: s.intrusion })));
    const immediatePerSession = barChart(sessions.map(s => ({ label: s.date, value: s.immediate })));
    const categoryDonut = donutChart(summary.byCategory);

    const sessionTable = sessions.slice().reverse().slice(0, 12).map(s => ({
      ...s,
      net: s.earned - s.spent
    }));

    return {
      hasData: summary.hasData,
      totals: summary.totals,
      earnedPerSession,
      progressPerSession,
      intrusionPerSession,
      immediatePerSession,
      categoryDonut,
      sessionTable,
      hasCategoryData: summary.byCategory.length > 0,
      hasIntrusionData: summary.totals.intrusionEarned > 0,
      hasImmediateData: summary.totals.spentImmediate > 0
    };
  }

  static onChangeTab(event, target) {
    this.activeTab = target.dataset.tab;
    this.render();
  }

  static async onLogSpend() {
    const typeOptions = Object.entries(SPEND_TYPES)
      .map(([key, t]) => `<option value="${key}">${t.label}</option>`).join("");

    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: "Log Immediate Spend" },
      content: `
        <p class="cxp-hint">For table spends: rerolls, player intrusions, insights. GM intrusions are recorded automatically.</p>
        <label>Type: <select name="spendType" style="width:100%;">${typeOptions}</select></label><br>
        <label>XP amount: <input type="number" name="amount" value="1" min="1" step="1"></label><br>
        <label>Note: <input type="text" name="note" style="width:100%;" placeholder="optional"></label>`,
      ok: {
        callback: (event, button, dialog) => {
          const el = dialog.element;
          return {
            spendType: el.querySelector("select[name='spendType']").value,
            amount: Number(el.querySelector("input[name='amount']").value),
            note: el.querySelector("input[name='note']").value.trim()
          };
        }
      }
    }).catch(() => null);
    if (!result) return;

    const transaction = await DevelopmentService.recordImmediateSpend(this.actor, result);
    if (transaction) {
      ui.notifications.info(`Cypher XP: logged ${result.amount} XP spend (${SPEND_TYPES[result.spendType]?.label ?? "other"}).`);
      this.render();
    }
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

    } else if (catalogKey === "skill-training") {
      const name = await PlayerDevelopmentApp.promptText("Skill Name", "e.g. Navigation, Persuasion, Numenera");
      if (!name) return;
      payload.skillName = name;
      payload.label = `${entry.label}: ${name}`;
      payload.requestedCost = entry.cost;

    } else if (catalogKey === "skill-specialization") {
      const skillId = await PlayerDevelopmentApp.promptSkillChoice(this.actor, "Trained", "Specialize — choose a Trained skill");
      if (!skillId) return;
      const skill = this.actor.items.get(skillId);
      payload.skillId = skillId;
      payload.label = `${entry.label}: ${skill?.name ?? "?"}`;
      payload.requestedCost = entry.cost;

    } else if (catalogKey === "remove-inability") {
      const skillId = await PlayerDevelopmentApp.promptSkillChoice(this.actor, "Inability", "Remove Inability — choose a skill");
      if (!skillId) return;
      const skill = this.actor.items.get(skillId);
      payload.skillId = skillId;
      payload.label = `${entry.label}: ${skill?.name ?? "?"}`;
      payload.requestedCost = entry.cost;

    } else if (catalogKey === "lore-language-trade") {
      const name = await PlayerDevelopmentApp.promptText("Language, Lore, or Trade", "e.g. Old Imperial, Alchemy, Cartography");
      if (!name) return;
      payload.skillName = name;
      payload.label = `${entry.label}: ${name}`;
      payload.requestedCost = entry.cost;

    } else if (entry.tierScaled !== undefined) {
      const details = await PlayerDevelopmentApp.promptAbilityDetails(catalogKey, entry);
      if (!details) return;
      Object.assign(payload, details);
      payload.requestedCost = entry.costBase + entry.tierScaled * details.abilityTier;
      payload.label = `${entry.label}: ${details.abilityName} (Tier ${details.abilityTier})`;

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

  static async promptSkillChoice(actor, rating, title) {
    const skills = ItemService.skillsByRating(actor, rating);
    if (!skills.length) {
      ui.notifications.warn(`Cypher XP: no skills with rating "${rating}" found on ${actor.name}.`);
      return null;
    }
    const options = skills.map(s => `<option value="${s.id}">${s.name}</option>`).join("");
    return foundry.applications.api.DialogV2.prompt({
      window: { title },
      content: `<label>Skill: <select name="skillId">${options}</select></label>`,
      ok: { callback: (event, button, dialog) => dialog.element.querySelector("select[name='skillId']").value }
    }).catch(() => null);
  }

  static async promptAbilityDetails(catalogKey, entry) {
    const poolOptions = ABILITY_POOLS.map(p => `<option value="${p}">${p}</option>`).join("");
    return foundry.applications.api.DialogV2.prompt({
      window: { title: entry.label },
      content: `
        <label>Ability name: <input type="text" name="abilityName" style="width:100%;" placeholder="e.g. Fleet of Foot"></label><br>
        <label>Ability tier: <input type="number" name="abilityTier" min="1" max="6" value="1" step="1"></label><br>
        <label>Pool point cost: <input type="number" name="abilityCost" min="0" value="0" step="1"></label><br>
        <label>Pool: <select name="abilityPool">${poolOptions}</select></label>`,
      ok: {
        callback: (event, button, dialog) => {
          const el = dialog.element;
          const name = el.querySelector("input[name='abilityName']").value.trim();
          if (!name) {
            ui.notifications.warn("Cypher XP: ability name is required.");
            return null;
          }
          return {
            abilityName: name,
            abilityTier: Number(el.querySelector("input[name='abilityTier']").value),
            abilityCost: String(el.querySelector("input[name='abilityCost']").value),
            abilityPool: el.querySelector("select[name='abilityPool']").value
          };
        }
      }
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
