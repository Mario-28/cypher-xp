import { SKILL_RATINGS } from "./constants.js";

export class ItemService {

  static findSkill(actor, name) {
    const needle = String(name).trim().toLowerCase();
    return actor.items.find(i => i.type === "skill" && i.name.trim().toLowerCase() === needle) ?? null;
  }

  static getSkillRating(item) {
    return item?.system?.basic?.rating ?? "Practiced";
  }

  static skillsByRating(actor, rating) {
    return actor.items.filter(i => i.type === "skill" && ItemService.getSkillRating(i) === rating);
  }

  static async applySkillTraining(actor, skillName) {
    const existing = ItemService.findSkill(actor, skillName);
    if (existing) {
      const rating = ItemService.getSkillRating(existing);
      if (rating === "Trained" || rating === "Specialized") {
        return { action: "none", itemId: existing.id, note: `Skill is already ${rating}.` };
      }
      await existing.update({ "system.basic.rating": "Trained" });
      return { action: "updated", itemId: existing.id, from: rating, to: "Trained" };
    }
    const created = await actor.createEmbeddedDocuments("Item", [{
      name: skillName,
      type: "skill",
      system: { basic: { rating: "Trained" } }
    }]);
    return { action: "created", itemId: created[0]?.id ?? null, to: "Trained" };
  }

  static async applySkillSpecialization(actor, skillId) {
    const item = actor.items.get(skillId);
    if (!item || item.type !== "skill") throw new Error("Skill not found on actor.");
    const rating = ItemService.getSkillRating(item);
    if (rating !== "Trained") {
      ui.notifications.warn(`Cypher XP: "${item.name}" is ${rating}, not Trained — specialization skipped.`);
      return { action: "none", itemId: item.id, note: `Rating was ${rating}.` };
    }
    await item.update({ "system.basic.rating": "Specialized" });
    return { action: "updated", itemId: item.id, from: "Trained", to: "Specialized" };
  }

  static async applyRemoveInability(actor, skillId) {
    const item = actor.items.get(skillId);
    if (!item || item.type !== "skill") throw new Error("Skill not found on actor.");
    const rating = ItemService.getSkillRating(item);
    if (rating !== "Inability") {
      ui.notifications.warn(`Cypher XP: "${item.name}" is ${rating}, not an Inability — removal skipped.`);
      return { action: "none", itemId: item.id, note: `Rating was ${rating}.` };
    }
    await item.update({ "system.basic.rating": "Practiced" });
    return { action: "updated", itemId: item.id, from: "Inability", to: "Practiced" };
  }

  static async createAbility(actor, { name, cost = "0", pool = "Intellect" }) {
    const created = await actor.createEmbeddedDocuments("Item", [{
      name,
      type: "ability",
      system: { basic: { cost: String(cost), pool } }
    }]);
    return { action: "created", itemId: created[0]?.id ?? null };
  }
}
