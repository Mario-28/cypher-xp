import { MODULE_ID } from "../constants.js";
import { OverflowWatcher } from "../utils/overflow.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class RulesApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static _instance = null;

  static show() {
    if (RulesApp._instance?.rendered) {
      RulesApp._instance.bringToFront?.();
      return RulesApp._instance;
    }
    const app = new RulesApp();
    RulesApp._instance = app;
    app.render(true);
    return app;
  }

  static DEFAULT_OPTIONS = {
    id: "cypher-xp-rules",
    tag: "div",
    classes: ["cypher-xp-rules-window"],
    window: { title: "Cypher XP — Experience Rules", icon: "fa-solid fa-book-open", resizable: true },
    position: { width: 780, height: 720 },
    actions: {
      jumpToSection: RulesApp.onJumpToSection
    }
  };

  static PARTS = { body: { template: `modules/${MODULE_ID}/templates/rules-panel.hbs` } };

  async close(options = {}) {
    if (RulesApp._instance === this) RulesApp._instance = null;
    return super.close(options);
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    OverflowWatcher.enable(this.element);
  }

  static onJumpToSection(event, target) {
    const id = target.dataset.section;
    const panel = this.element?.querySelector(".cxp-rules-app");
    const section = this.element?.querySelector(`#cxp-rules-${id}`);
    if (!panel || !section) return;
    panel.scrollTo({ top: section.offsetTop - panel.offsetTop - 8, behavior: "smooth" });
  }
}
