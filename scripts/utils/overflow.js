export class OverflowWatcher {
  static _observed = new WeakMap();

  static enable(root, selector = "[data-cxp-scroll]") {
    if (!root?.querySelectorAll) return;
    for (const el of root.querySelectorAll(selector)) OverflowWatcher.watch(el);
    const windowContent = root.querySelector?.(".window-content");
    if (windowContent) OverflowWatcher.watch(windowContent);
  }

  static watch(el) {
    if (!el || OverflowWatcher._observed.has(el)) return;
    const observer = new ResizeObserver(() => OverflowWatcher.evaluate(el));
    observer.observe(el);
    OverflowWatcher._observed.set(el, observer);
    OverflowWatcher.evaluate(el);
  }

  static evaluate(el) {
    const hasX = el.scrollWidth > el.clientWidth + 1;
    const hasY = el.scrollHeight > el.clientHeight + 1;
    el.classList.toggle("cxp-overflow-x", hasX);
    el.classList.toggle("cxp-overflow-y", hasY);
  }
}
