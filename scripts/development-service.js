import { MODULE_ID, TIER_THRESHOLDS, MAX_TIER, NON_PROGRESS_TYPES, PURCHASE_CATALOG, SPEND_TYPES } from "./constants.js";
import { ActorAdapter } from "./actor-adapter.js";
import { ItemService } from "./item-service.js";

function uuid() { return foundry.utils.randomID(16); }

function defaultData() {
  return {
    version: 1,
    progress: { lifetime: 0 },
    transactions: [],
    purchases: [],
    assets: [],
    tierHistory: [],
    requests: []
  };
}

export class DevelopmentService {

  static getData(actor) {
    return new ActorAdapter(actor).getDevelopmentFlags() ?? defaultData();
  }

  static async ensureInitialized(actor) {
    const adapter = new ActorAdapter(actor);
    if (!adapter.getDevelopmentFlags()) await adapter.setDevelopmentFlags(defaultData());
    return DevelopmentService.getData(actor);
  }

  static async save(actor, data) {
    await new ActorAdapter(actor).setDevelopmentFlags(data);
  }

  static getNextThreshold(tier) {
    if (tier >= MAX_TIER) return null;
    return TIER_THRESHOLDS[tier + 1] ?? null;
  }

  static isTierReady(data, currentTier) {
    const threshold = DevelopmentService.getNextThreshold(currentTier);
    return threshold !== null && data.progress.lifetime >= threshold;
  }

  static computeCatalogCost(catalogKey, { abilityTier = 0 } = {}) {
    const entry = PURCHASE_CATALOG[catalogKey];
    if (!entry) throw new Error(`Unknown catalog key: ${catalogKey}`);
    if (entry.costBase !== undefined && entry.tierScaled !== undefined) {
      return entry.costBase + entry.tierScaled * Number(abilityTier);
    }
    return entry.cost ?? null;
  }

  static validateRequest(actor, data, { category, requestedCost }) {
    const entry = PURCHASE_CATALOG[category];
    if (!entry) return { ok: false, reason: `Unknown purchase category: ${category}` };

    const cost = Number(requestedCost);
    if (!Number.isInteger(cost) || cost < 0) return { ok: false, reason: "Invalid XP cost." };

    const tier = new ActorAdapter(actor).getTier();

    if (entry.oncePerTier) {
      const boughtThisTier = data.purchases.some(p => p.category === category && p.purchasedAtTier === tier);
      if (boughtThisTier) return { ok: false, reason: `"${entry.label}" can only be purchased once per tier.` };
      const pendingSame = data.requests.some(r => r.status === "pending" && r.category === category);
      if (pendingSame) return { ok: false, reason: `A "${entry.label}" request is already pending.` };
    }

    if (entry.maxTimes) {
      const bought = data.purchases.filter(p => p.category === category).length;
      if (bought >= entry.maxTimes) return { ok: false, reason: `"${entry.label}" has reached its lifetime limit (${entry.maxTimes}).` };
    }

    const available = new ActorAdapter(actor).getXP();
    const pendingTotal = data.requests
      .filter(r => r.status === "pending")
      .reduce((sum, r) => sum + Number(r.requestedCost ?? 0), 0);

    if (pendingTotal + cost > available) {
      return { ok: false, reason: `Not enough XP. Available: ${available}, reserved by pending requests: ${pendingTotal}, this request: ${cost}.` };
    }

    return { ok: true };
  }

  static async createRequest(actor, payload) {
    const data = await DevelopmentService.ensureInitialized(actor);
    const check = DevelopmentService.validateRequest(actor, data, payload);
    if (!check.ok) {
      ui.notifications.warn(`Cypher XP: ${check.reason}`);
      return null;
    }
    const request = {
      id: uuid(),
      timestamp: Date.now(),
      status: "pending",
      actorUuid: actor.uuid,
      submittedBy: game.user.id,
      ...payload,
      requestedCost: Number(payload.requestedCost)
    };
    data.requests.push(request);
    await DevelopmentService.save(actor, data);
    Hooks.callAll(`${MODULE_ID}.requestCreated`, { actor, request });
    return request;
  }

  static async updateRequestStatus(actor, requestId, status, extra = {}) {
    const data = await DevelopmentService.ensureInitialized(actor);
    const request = data.requests.find(r => r.id === requestId);
    if (!request) throw new Error("Request not found");
    request.status = status;
    Object.assign(request, extra);
    await DevelopmentService.save(actor, data);
    Hooks.callAll(`${MODULE_ID}.requestUpdated`, { actor, request });
    return request;
  }

  static async cancelRequest(actor, requestId) {
    const data = await DevelopmentService.ensureInitialized(actor);
    const request = data.requests.find(r => r.id === requestId);
    if (!request) return null;
    if (request.status !== "pending") {
      ui.notifications.warn("Cypher XP: only pending requests can be cancelled.");
      return null;
    }
    return DevelopmentService.updateRequestStatus(actor, requestId, "cancelled", { cancelledAt: Date.now() });
  }

  static async applyApprovedRequest(actor, requestId, gmOverrides = {}) {
    if (!game.user.isGM) throw new Error("Only a GM can apply approved requests.");
    if (!actor) throw new Error("Actor no longer exists.");

    const data = await DevelopmentService.ensureInitialized(actor);
    const request = data.requests.find(r => r.id === requestId);
    if (!request) throw new Error("Request not found");
    if (request.status !== "pending" && request.status !== "approved") {
      throw new Error(`Request cannot be applied from status: ${request.status}`);
    }

    const adapter = new ActorAdapter(actor);
    const finalCost = Number(gmOverrides.finalCost ?? request.requestedCost);
    if (!Number.isInteger(finalCost) || finalCost < 0) throw new Error("Invalid final cost.");

    const available = adapter.getXP();
    if (available < finalCost) {
      ui.notifications.error(`Cypher XP: ${actor.name} has only ${available} XP — cannot apply a ${finalCost} XP purchase.`);
      throw new Error("Insufficient XP at approval time.");
    }

    const grantsProgress = !NON_PROGRESS_TYPES.has(request.category);
    const progressGranted = grantsProgress ? finalCost : 0;

    await adapter.spendXP(finalCost);

    let itemResult = null;

    switch (request.category) {
      case "pool-increase": {
        const dist = request.poolDistribution ?? { [request.poolKey]: request.poolAmount ?? 4 };
        for (const [poolKey, amount] of Object.entries(dist)) {
          if (Number(amount) > 0) await adapter.increasePoolMax(poolKey, amount);
        }
        break;
      }
      case "edge-increase":       await adapter.increaseEdge(request.poolKey, 1); break;
      case "effort-increase":     await adapter.increaseEffort(1); break;
      case "recovery-improvement":await adapter.improveRecoveryRoll(2); break;
      case "armor-improvement":   await adapter.improveArmorUse(); break;
      case "skill-training":
        itemResult = await ItemService.applySkillTraining(actor, request.skillName);
        break;
      case "skill-specialization":
        itemResult = await ItemService.applySkillSpecialization(actor, request.skillId);
        break;
      case "remove-inability":
        itemResult = await ItemService.applyRemoveInability(actor, request.skillId);
        break;
      case "type-ability":
      case "off-list-ability":
        itemResult = await ItemService.createAbility(actor, {
          name: request.abilityName ?? request.label,
          cost: request.abilityCost ?? "0",
          pool: request.abilityPool ?? "Intellect"
        });
        break;
      case "permanent-asset":
        data.assets.push({
          id: uuid(),
          name: request.assetName ?? request.label,
          cost: finalCost,
          description: request.notes ?? "",
          acquiredAt: Date.now(),
          improvements: []
        });
        break;
      case "asset-improvement": {
        const asset = data.assets.find(a => a.id === request.assetId);
        if (asset) (asset.improvements ??= []).push({ label: request.notes || request.label, cost: finalCost, at: Date.now() });
        break;
      }
      default:
        break;
    }

    data.progress.lifetime += progressGranted;

    const transaction = DevelopmentService.buildTransaction({
      type: "development-purchase",
      label: gmOverrides.label ?? request.label,
      xpDelta: -finalCost,
      progressDelta: progressGranted,
      actorUuid: actor.uuid,
      source: "gm-approval",
      metadata: { requestId: request.id, category: request.category, itemResult }
    });
    data.transactions.push(transaction);

    if (progressGranted > 0) {
      data.purchases.push({
        id: uuid(),
        category: request.category,
        label: transaction.label,
        cost: finalCost,
        progressGranted,
        purchasedAtTier: actor.system?.basic?.tier ?? 1,
        acquiredAt: Date.now(),
        itemId: itemResult?.itemId ?? null,
        notes: gmOverrides.notes ?? request.notes ?? ""
      });
    }

    request.status = "applied";
    request.appliedCost = finalCost;
    request.appliedAt = Date.now();
    await DevelopmentService.save(actor, data);

    const currentTier = actor.system?.basic?.tier ?? 1;
    const tierReady = DevelopmentService.isTierReady(data, currentTier);
    if (tierReady) Hooks.callAll(`${MODULE_ID}.tierReady`, { actor, tier: currentTier });

    Hooks.callAll(`${MODULE_ID}.purchaseApplied`, { actor, request, transaction, tierReady, itemResult });
    return { request, transaction, tierReady, itemResult };
  }

  static async rejectRequest(actor, requestId, reason = "") {
    if (!game.user.isGM) throw new Error("Only a GM can reject requests.");
    return DevelopmentService.updateRequestStatus(actor, requestId, "rejected", { rejectionReason: reason, rejectedAt: Date.now() });
  }

  static async applyTierBreakthrough(actor, { benefit = null, poolKey = null } = {}) {
    if (!game.user.isGM) throw new Error("Only a GM can apply a tier breakthrough.");
    const data = await DevelopmentService.ensureInitialized(actor);
    const adapter = new ActorAdapter(actor);
    const currentTier = adapter.getTier();
    if (currentTier >= MAX_TIER) {
      ui.notifications.warn("Cypher XP: actor is already at the maximum tier.");
      return null;
    }
    if (!DevelopmentService.isTierReady(data, currentTier)) {
      ui.notifications.warn("Cypher XP: Development Progress threshold not reached.");
      return null;
    }

    const newTier = currentTier + 1;
    await adapter.setTier(newTier);

    if (benefit === "hardened-potential" && poolKey) {
      await adapter.increasePoolMax(poolKey, 2);
    }

    data.tierHistory.push({
      id: uuid(),
      fromTier: currentTier,
      toTier: newTier,
      progressAtBreakthrough: data.progress.lifetime,
      benefit,
      poolKey,
      timestamp: Date.now()
    });
    await DevelopmentService.save(actor, data);

    Hooks.callAll(`${MODULE_ID}.tierBreakthrough`, { actor, fromTier: currentTier, toTier: newTier, benefit });
    return { fromTier: currentTier, toTier: newTier, benefit };
  }

  static async recordIntrusion(actor, { xpDelta, type, label, metadata = {} }) {
    if (!game.user.isGM) throw new Error("Only a GM can record an intrusion event.");
    if (!actor) return null;
    const data = await DevelopmentService.ensureInitialized(actor);
    const adapter = new ActorAdapter(actor);
    if (xpDelta > 0) await adapter.grantXP(xpDelta);
    else if (xpDelta < 0) await adapter.spendXP(Math.abs(xpDelta));
    const transaction = DevelopmentService.buildTransaction({
      type, label, xpDelta, progressDelta: 0,
      actorUuid: actor.uuid, source: "cypher-gm-taskbar", metadata
    });
    data.transactions.push(transaction);
    await DevelopmentService.save(actor, data);
    Hooks.callAll(`${MODULE_ID}.intrusionRecorded`, { actor, transaction });
    return transaction;
  }

  static async gmAward(actor, amount, reason = "") {
    if (!game.user.isGM) throw new Error("Only a GM can award XP.");
    if (!actor) throw new Error("Actor not found.");
    const value = Number(amount);
    if (!Number.isInteger(value) || value <= 0) throw new Error("Invalid XP amount.");
    const data = await DevelopmentService.ensureInitialized(actor);
    await new ActorAdapter(actor).grantXP(value);
    const transaction = DevelopmentService.buildTransaction({
      type: "gm-award", label: reason || "GM Award",
      xpDelta: value, progressDelta: 0,
      actorUuid: actor.uuid, source: "gm-manual"
    });
    data.transactions.push(transaction);
    await DevelopmentService.save(actor, data);
    Hooks.callAll(`${MODULE_ID}.xpAwarded`, { actor, transaction });
    return transaction;
  }

  static async recordImmediateSpend(actor, { spendType = "reroll", amount = 1, note = "" } = {}) {
    if (!actor) throw new Error("Actor not found.");
    const value = Number(amount);
    if (!Number.isInteger(value) || value <= 0) throw new Error("Invalid XP amount.");
    if (!SPEND_TYPES[spendType]) spendType = "other";

    const adapter = new ActorAdapter(actor);
    if (adapter.getXP() < value) {
      ui.notifications.warn(`Cypher XP: ${actor.name} has only ${adapter.getXP()} XP — cannot log a ${value} XP spend.`);
      return null;
    }

    await adapter.spendXP(value);
    const data = await DevelopmentService.ensureInitialized(actor);
    const transaction = DevelopmentService.buildTransaction({
      type: "immediate-spend",
      label: note || SPEND_TYPES[spendType].label,
      xpDelta: -value,
      progressDelta: 0,
      actorUuid: actor.uuid,
      source: "player-log",
      metadata: { spendType }
    });
    data.transactions.push(transaction);
    await DevelopmentService.save(actor, data);
    Hooks.callAll(`${MODULE_ID}.immediateSpend`, { actor, transaction });
    return transaction;
  }

  static buildTransaction({ type, label, xpDelta = 0, progressDelta = 0, actorUuid, source = "cypher-xp", status = "applied", metadata = {} }) {
    return { id: uuid(), timestamp: Date.now(), type, label, xpDelta, progressDelta, actorUuid, source, status, metadata };
  }
}
