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

// resumeBase64 is excluded from persistence — DOCX files can exceed the ~5 MB
// localStorage quota and the failure is silent. resumeText is enough to restore
// session state; the user re-uploads the file only if they refresh.
export function saveProfile(data: object) {
  try {
    const { resumeBase64: _omit, ...safe } = data as Record<string, unknown>;
    localStorage.setItem(PROFILE_KEY, JSON.stringify(safe));
  } catch {}
}

export function loadProfile(): Record<string, unknown> {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "{}"); } catch { return {}; }
}
