export const MODULE_ID = "cypher-xp";

export const TIER_THRESHOLDS = { 2: 24, 3: 60, 4: 112, 5: 184, 6: 280 };
export const MAX_TIER = 6;

export const REQUEST_STATES = {
  DRAFT: "draft", PENDING: "pending", APPROVED: "approved",
  REJECTED: "rejected", CANCELLED: "cancelled", APPLIED: "applied"
};

export const PURCHASE_CATALOG = {
  "skill-training":      { label: "Skill Training", cost: 3, category: "skills", repeatable: true },
  "skill-specialization":{ label: "Skill Specialization", cost: 4, category: "skills", repeatable: true },
  "remove-inability":    { label: "Remove Inability", cost: 3, category: "skills", repeatable: true },
  "lore-language-trade": { label: "Language, Lore, or Trade", cost: 2, category: "skills", repeatable: true },
  "pool-increase":       { label: "Increase Capabilities (+4 Pool points)", cost: 4, category: "core", repeatable: true },
  "edge-increase":       { label: "Increase Edge", cost: 5, category: "core", oncePerTier: true },
  "effort-increase":     { label: "Increase Effort", cost: 5, category: "core", oncePerTier: true },
  "recovery-improvement":{ label: "Improve Recovery (+2)", cost: 4, category: "core", maxTimes: 2 },
  "armor-improvement":   { label: "Improve Armor Use", cost: 4, category: "core", repeatable: true },
  "type-ability":        { label: "Additional Type Ability", costBase: 5, tierScaled: 1, category: "abilities", repeatable: true },
  "off-list-ability":    { label: "Off-List Ability", costBase: 8, tierScaled: 2, category: "abilities", oncePerTier: true },
  "permanent-asset":     { label: "Permanent Asset", costRange: [3, 10], custom: true, category: "assets", repeatable: true },
  "asset-improvement":   { label: "Asset Improvement", costRange: [2, 8], custom: true, category: "assets", repeatable: true }
};

// Transaction/request categories that never grant Development Progress.
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
