import { MODULE_ID, MENU_ICON_SIZES } from "./constants.js";

export function registerSettings() {
  game.settings.register(MODULE_ID, "requireApprovalForAll", {
    name: "Require GM approval for all purchases",
    hint: "Every permanent development purchase must be approved by the GM before it takes effect.",
    scope: "world", config: true, type: Boolean, default: true
  });

  game.settings.register(MODULE_ID, "enableTaskbarIntegration", {
    name: "Enable Cypher Taskbar integration",
    hint: "Adds the player launcher button with flyout to the players' side.",
    scope: "world", config: true, type: Boolean, default: true
  });

  game.settings.register(MODULE_ID, "enableGmTaskbarIntegration", {
    name: "Enable Cypher GM Taskbar integration",
    hint: "Adds the Cypher XP icon with flyout menu next to Actor Visibility in the Cypher GM Taskbar.",
    scope: "world", config: true, type: Boolean, default: true
  });

  game.settings.register(MODULE_ID, "gmMenuIconSize", {
    name: "GM Taskbar icon size",
    hint: "Size of the Cypher XP launcher icon on the Cypher GM Taskbar.",
    scope: "client", config: true, type: String,
    choices: Object.fromEntries(Object.entries(MENU_ICON_SIZES).map(([k, v]) => [k, v.label])),
    default: "medium",
    onChange: () => Hooks.callAll(`${MODULE_ID}.menuIconSizeChanged`)
  });

  game.settings.register(MODULE_ID, "playerIconSize", {
    name: "Player launcher icon size",
    hint: "Size of the Cypher XP launcher icon on the players' side.",
    scope: "client", config: true, type: String,
    choices: Object.fromEntries(Object.entries(MENU_ICON_SIZES).map(([k, v]) => [k, v.label])),
    default: "medium",
    onChange: () => Hooks.callAll(`${MODULE_ID}.playerIconSizeChanged`)
  });

  game.settings.register(MODULE_ID, "gmIconPosition", {
    name: "GM icon position", hint: "Stored drag position of the GM launcher icon.",
    scope: "client", config: false, type: Object, default: null
  });

  game.settings.register(MODULE_ID, "playerWidgetPosition", {
    name: "Player launcher position", hint: "Stored drag position of the player launcher icon.",
    scope: "client", config: false, type: Object, default: null
  });

  game.settings.register(MODULE_ID, "debugLogging", {
    name: "Enable debug logging",
    hint: "Logs Cypher XP integration attempts and lifecycle events to the console.",
    scope: "client", config: true, type: Boolean, default: false
  });
}

export function log(...args) {
  try {
    if (game.settings.get(MODULE_ID, "debugLogging")) console.log(`${MODULE_ID} |`, ...args);
  } catch (_) { /* settings not yet registered */ }
}

export function registerHandlebarsHelpers() {
  const helpers = {
    eq:  (a, b) => a === b,
    ne:  (a, b) => a !== b,
    gt:  (a, b) => a > b,
    lt:  (a, b) => a < b,
    gte: (a, b) => a >= b,
    lte: (a, b) => a <= b,
    and: (a, b) => a && b,
    or:  (a, b) => a || b,
    not: (a) => !a
  };
  for (const [name, fn] of Object.entries(helpers)) {
    if (!Handlebars.helpers[name]) Handlebars.registerHelper(name, fn);
  }
}
