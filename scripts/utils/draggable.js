import { MODULE_ID } from "../constants.js";

export function makeDraggable(wrapper, handle, settingKey, { onReset } = {}) {
  let dragState = null;
  handle.style.touchAction = "none";

  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const rect = wrapper.getBoundingClientRect();
    dragState = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      moved: false
    };
    try { handle.setPointerCapture(event.pointerId); } catch (_) { /* not supported */ }
  });

  handle.addEventListener("pointermove", (event) => {
    if (!dragState) return;
    if (!dragState.moved) {
      dragState.moved = true;
      const rect = wrapper.getBoundingClientRect();
      wrapper.classList.add("cxp-user-positioned", "cxp-dragging");
      wrapper.style.left = `${rect.left}px`;
      wrapper.style.top = `${rect.top}px`;
      document.body.appendChild(wrapper);
    }
    const left = Math.min(Math.max(0, event.clientX - dragState.offsetX), window.innerWidth - wrapper.offsetWidth);
    const top = Math.min(Math.max(0, event.clientY - dragState.offsetY), window.innerHeight - wrapper.offsetHeight);
    wrapper.style.left = `${left}px`;
    wrapper.style.top = `${top}px`;
  });

  const endDrag = async (event) => {
    if (!dragState) return;
    const wasDrag = dragState.moved;
    dragState = null;
    wrapper.classList.remove("cxp-dragging");
    if (!wasDrag) return;
    const rect = wrapper.getBoundingClientRect();
    await game.settings.set(MODULE_ID, settingKey, { left: Math.round(rect.left), top: Math.round(rect.top) });
    wrapper.dataset.justDragged = "1";
    event.stopPropagation();
    event.preventDefault();
  };

  handle.addEventListener("pointerup", endDrag);
  handle.addEventListener("pointercancel", () => { dragState = null; wrapper.classList.remove("cxp-dragging"); });

  handle.addEventListener("click", (event) => {
    if (wrapper.dataset.justDragged) {
      delete wrapper.dataset.justDragged;
      event.stopPropagation();
      event.preventDefault();
    }
  }, true);

  handle.addEventListener("contextmenu", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await game.settings.set(MODULE_ID, settingKey, null);
    wrapper.classList.remove("cxp-user-positioned");
    wrapper.style.left = "";
    wrapper.style.top = "";
    onReset?.();
  });
}

export function applySavedPosition(wrapper, settingKey) {
  const saved = game.settings.get(MODULE_ID, settingKey);
  if (!saved || !Number.isFinite(saved.left) || !Number.isFinite(saved.top)) return false;
  const left = Math.min(Math.max(0, saved.left), Math.max(0, window.innerWidth - wrapper.offsetWidth));
  const top = Math.min(Math.max(0, saved.top), Math.max(0, window.innerHeight - wrapper.offsetHeight));
  wrapper.classList.add("cxp-user-positioned");
  wrapper.style.left = `${left}px`;
  wrapper.style.top = `${top}px`;
  document.body.appendChild(wrapper);
  return true;
}
