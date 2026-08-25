import { MODULE_ID } from "./constants.js";
import { registerSettings, registerHandlebarsHelpers, log } from "./settings.js";
import { DevelopmentService } from "./development-service.js";
import { TaskbarIntegration } from "./taskbar-integration.js";
import { GmTaskbarIntegration } from "./gm-taskbar-integration.js";

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing (Foundry v14+)`);
  registerSettings();
  registerHandlebarsHelpers();
});

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | Ready`);

  const api = {
    DevelopmentService,
    openPlayerApp: async (actor) => {
      const target = actor ?? game.user.character ?? canvas?.tokens?.controlled?.[0]?.actor;
      if (!target) return ui.notifications.warn("Cypher XP: select or assign a character first.");
      const { PlayerDevelopmentApp } = await import("./apps/player-app.js");
      PlayerDevelopmentApp.show(target);
    },
    openGmDashboard: async (options = {}) => {
      if (!game.user.isGM) return ui.notifications.warn("Cypher XP: only the GM can open this dashboard.");
      const { GmDevelopmentDashboard } = await import("./apps/gm-app.js");
      GmDevelopmentDashboard.show(options);
    },
    openRules: async () => {
      const { RulesApp } = await import("./apps/rules-app.js");
      RulesApp.show();
    },
    logSpend: async (actor, options) => {
      return DevelopmentService.recordImmediateSpend(actor, options);
    }
  };

  game.modules.get(MODULE_ID).api = api;
  Hooks.callAll(`${MODULE_ID}.ready`, api);

  Hooks.on(`${MODULE_ID}.logSpend`, ({ actor, spendType, amount, note }) => {
    if (!actor) return null;
    return DevelopmentService.recordImmediateSpend(actor, { spendType, amount, note });
  });

  TaskbarIntegration.init();
  GmTaskbarIntegration.init();

  log("API registered; integrations initialized.");
});

Hooks.on("getSceneControlButtons", (controls) => {
  const tokenControl = controls.tokens ?? Object.values(controls)[0];
  if (!tokenControl?.tools) return;

  tokenControl.tools.cypherXp = {
    name: "cypherXp",
    title: game.user.isGM ? "Cypher XP — GM Dashboard" : "Cypher XP — Development Track",
    icon: "fa-solid fa-chart-line",
    order: Object.keys(tokenControl.tools).length,
    button: true,
    onClick: () => {
      const api = game.modules.get(MODULE_ID).api;
      if (game.user.isGM) api.openGmDashboard();
      else api.openPlayerApp();
    }
  };
});
