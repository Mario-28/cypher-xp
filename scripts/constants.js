export const MODULE_ID = "cypher-xp";

export const TIER_THRESHOLDS = { 2: 24, 3: 60, 4: 112, 5: 184, 6: 280 };
export const MAX_TIER = 6;

export const REQUEST_STATES = {
  DRAFT: "draft", PENDING: "pending", APPROVED: "approved",
  REJECTED: "rejected", CANCELLED: "cancelled", APPLIED: "applied"
};

export const PURCHASE_CATALOG = {
  "skill-training": {
    label: "Skill Training", cost: 3, category: "skills", repeatable: true, icon: "fa-book",
    tooltip: "Become trained in one skill. Trained tasks are one step easier. May be purchased multiple times for different skills. On approval, the skill is created or upgraded to Trained on your sheet."
  },
  "skill-specialization": {
    label: "Skill Specialization", cost: 4, category: "skills", repeatable: true, icon: "fa-book-open",
    tooltip: "Become specialized in a skill you are already trained in. Specialized tasks are two steps easier. You will choose from your Trained skills.",
    limit: "Requires an existing Trained skill."
  },
  "remove-inability": {
    label: "Remove Inability", cost: 3, category: "skills", repeatable: true, icon: "fa-eraser",
    tooltip: "Remove one permanent inability. The skill returns to Practiced level — no longer hindered, but not yet trained."
  },
  "lore-language-trade": {
    label: "Language, Lore, or Trade", cost: 2, category: "skills", repeatable: true, icon: "fa-language",
    tooltip: "Gain a language, lore area, trade, or profession with a continuing place in the campaign. Recorded in your development history."
  },
  "pool-increase": {
    label: "Increase Capabilities (+4 Pool points)", cost: 4, category: "core", repeatable: true, icon: "fa-dumbbell",
    tooltip: "Add 4 points divided among your Might, Speed, Intellect, and Additional Pools as you choose. Raises both current and maximum values."
  },
  "edge-increase": {
    label: "Increase Edge", cost: 5, category: "core", oncePerTier: true, icon: "fa-scale-balanced",
    tooltip: "Increase one Edge by 1. Edge reduces the Pool cost of tasks and abilities you use.",
    limit: "Each Edge may be increased once per tier."
  },
  "effort-increase": {
    label: "Increase Effort", cost: 5, category: "core", oncePerTier: true, icon: "fa-arrow-up-right-dots",
    tooltip: "Increase your Effort by 1, letting you apply more levels of Effort to a single task.",
    limit: "Maximum once per tier."
  },
  "recovery-improvement": {
    label: "Improve Recovery (+2)", cost: 4, category: "core", maxTimes: 2, icon: "fa-heart-circle-plus",
    tooltip: "Add +2 to all of your recovery rolls.",
    limit: "Maximum twice over the character's career."
  },
  "armor-improvement": {
    label: "Improve Armor Use", cost: 4, category: "core", repeatable: true, icon: "fa-shield-halved",
    tooltip: "Reduce the additional Speed-Effort cost of wearing armor by 1."
  },
  "type-ability": {
    label: "Additional Type Ability", costBase: 5, tierScaled: 1, category: "abilities", repeatable: true, icon: "fa-bolt",
    tooltip: "Gain an additional ability from your own type, at or below your current tier. Cost scales with the ability's tier: 5 + tier XP. On approval, the ability Item is created on your sheet."
  },
  "off-list-ability": {
    label: "Off-List Ability", costBase: 8, tierScaled: 2, category: "abilities", oncePerTier: true, icon: "fa-wand-magic-sparkles",
    tooltip: "Gain an ability from outside your type's list — rare and expensive. Cost: 8 + 2 × tier XP. Requires a strong in-fiction source (mentor, ritual, artifact, faction training).",
    limit: "Maximum one off-list ability per tier."
  },
  "permanent-asset": {
    label: "Permanent Asset", costRange: [3, 10], custom: true, category: "assets", repeatable: true, icon: "fa-gem",
    tooltip: "Gain a lasting resource: a contact, home, vehicle, workshop, title, or relic. The GM sets the final cost (3–10 XP) based on scope, reliability, and impact."
  },
  "asset-improvement": {
    label: "Asset Improvement", costRange: [2, 8], custom: true, category: "assets", repeatable: true, icon: "fa-hammer",
    tooltip: "Upgrade an existing permanent asset: add defenses, staff, a workshop, a vehicle feature, or a new capability. The GM sets the final cost (2–8 XP)."
  }
};

export const NON_PROGRESS_TYPES = new Set([
  "refuse-gm-intrusion", "reroll", "player-intrusion", "insight", "temporary-benefit",
  "consumable", "cypher", "healing", "bribe", "travel", "ordinary-purchase",
  "gm-intrusion", "gm-intrusion-transfer-sent", "gm-intrusion-transfer-received",
  "gm-intrusion-refused", "gm-award", "immediate-spend", "manual-adjustment"
]);

export const BREAKTHROUGH_BENEFITS = {
  "thematic-training":   "Thematic Training (become trained in one story-appropriate skill)",
  "hardened-potential":  "Hardened Potential (+2 to one Pool)",
  "practical-expertise": "Practical Expertise (language, lore, trade, or profession)",
  "lasting-foothold":    "Lasting Foothold (modest permanent narrative asset)",
  "refined-technique":   "Refined Technique (swap one purchased type ability)"
};

export const MENU_ICON_SIZES = {
  small:  { px: 24, label: "Small (24px)" },
  medium: { px: 30, label: "Medium (30px)" },
  large:  { px: 38, label: "Large (38px)" }
};

export const SKILL_RATINGS = ["Inability", "Practiced", "Trained", "Specialized"];
export const ABILITY_POOLS = ["Might", "Speed", "Intellect", "Additional", "XP"];

export const SPEND_TYPES = {
  "reroll":             { label: "Reroll", icon: "fa-dice" },
  "player-intrusion":   { label: "Player Intrusion", icon: "fa-hand-sparkles" },
  "insight":            { label: "Insight / Clue", icon: "fa-lightbulb" },
  "temporary-benefit":  { label: "Temporary Benefit", icon: "fa-clock" },
  "other":              { label: "Other", icon: "fa-circle" }
};

export const CHART_COLORS = {
  skills:    "#4a9a8a",
  core:      "#b98328",
  abilities: "#9d3b2d",
  assets:    "#233947",
  other:     "#60707a"
};

export const PARTY_SERIES_COLORS = {
  earned:    "#b98328",
  intrusion: "#9d3b2d",
  dev:       "#4a9a8a",
  immediate: "#7a5a9d",
  progress:  "#e7c679"
};
