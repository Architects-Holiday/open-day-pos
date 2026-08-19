import { createInitialState, validateState } from "./pos-domain.js";

const KEY = "architects-holiday.open-day-pos.v2";

function newDeviceId() {
  if (globalThis.crypto?.randomUUID) return "ipad-" + globalThis.crypto.randomUUID();
  return "ipad-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

export function loadLocalState() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return { state: createInitialState({ deviceId: newDeviceId() }), recovered: false };
  try {
    const state = JSON.parse(raw);
    validateState(state);
    return { state, recovered: false };
  } catch (error) {
    const recoveryKey = KEY + ".unreadable." + new Date().toISOString();
    localStorage.setItem(recoveryKey, raw);
    return { state: createInitialState({ deviceId: newDeviceId() }), recovered: true, error };
  }
}

export function saveLocalState(state) {
  validateState(state);
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function downloadFile(name, contents, type) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
