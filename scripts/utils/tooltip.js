import { PURCHASE_CATALOG } from "../constants.js";

export class TooltipManager {
  static _el = null;
  static _visibleFor = null;

  static _getEl() {
    if (!TooltipManager._el || !document.body.contains(TooltipManager._el)) {
      TooltipManager._el = document.createElement("div");
      TooltipManager._el.className = "cxp-tooltip";
      TooltipManager._el.style.display = "none";
      document.body.appendChild(TooltipManager._el);
    }
    return TooltipManager._el;
  }

  static bind(root, selector = "[data-cxp-tooltip]") {
    if (!root?.querySelectorAll) return;
    for (const el of root.querySelectorAll(selector)) {
      if (el.dataset.cxpTooltipBound) continue;
      el.dataset.cxpTooltipBound = "1";
      el.addEventListener("mouseenter", (event) => TooltipManager.show(el, event));
      el.addEventListener("mouseleave", () => TooltipManager.hide());
      el.addEventListener("mousedown", () => TooltipManager.hide());
    }
  }

  static costText(entry) {
    if (entry.cost !== undefined) return `${entry.cost} XP`;
    if (entry.costBase !== undefined) return `from ${entry.costBase} XP`;
    if (entry.costRange) return `${entry.costRange[0]}–${entry.costRange[1]} XP`;
    return "";
  }

  static show(el, event) {
    const key = el.dataset.cxpTooltip;
    const entry = PURCHASE_CATALOG[key];
    if (!entry?.tooltip) return;

    const tip = TooltipManager._getEl();
    tip.innerHTML = `
      <div class="cxp-tooltip-header">
        <i class="fa-solid ${entry.icon ?? "fa-circle-info"}"></i>
        <span class="cxp-tooltip-title">${entry.label}</span>
        <span class="cxp-tooltip-cost">${TooltipManager.costText(entry)}</span>
      </div>
      <div class="cxp-tooltip-body">${entry.tooltip}</div>
      ${entry.limit ? `<div class="cxp-tooltip-limit"><i class="fa-solid fa-triangle-exclamation"></i> ${entry.limit}</div>` : ""}
      <div class="cxp-tooltip-footer">Development Progress equal to XP spent · Requires GM approval</div>`;

    tip.style.display = "block";
    tip.style.visibility = "hidden";
    const tipRect = tip.getBoundingClientRect();
    const row = el.getBoundingClientRect();

    const margin = 10;
    let left = (event?.clientX ?? (row.left + row.width / 2)) - tipRect.width / 2;
    left = Math.min(Math.max(margin, left), window.innerWidth - tipRect.width - margin);

    let top = row.top - tipRect.height - margin;
    let below = false;
    if (top < margin) {
      top = row.bottom + margin;
      below = true;
    }
    if (top + tipRect.height > window.innerHeight - margin) {
      top = Math.max(margin, window.innerHeight - tipRect.height - margin);
    }

    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
    tip.classList.toggle("cxp-tooltip-below", below);
    tip.style.visibility = "visible";
    TooltipManager._visibleFor = el;
  }

  static hide() {
    if (TooltipManager._el) TooltipManager._el.style.display = "none";
    TooltipManager._visibleFor = null;
  }
}
