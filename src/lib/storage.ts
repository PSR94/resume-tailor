const KEY = "rt_session";
const PROFILE_KEY = "rt_profile";

export function saveSession(data: object) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
}

export function loadSession(): Record<string, unknown> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; }
}

export function clearSession() {
  localStorage.removeItem(KEY);
}

export function saveProfile(data: object) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(data)); } catch {}
}

export function loadProfile(): Record<string, unknown> {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "{}"); } catch { return {}; }
}
