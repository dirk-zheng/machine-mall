export const PRIVACY_PREFERENCES_KEY = 'aurelia_privacy_preferences_v1';
export const VISITOR_ID_KEY = 'aurelia_beauty_guest_id';
export const SESSION_VISITOR_ID_KEY = 'aurelia_beauty_session_id';
export const PRIVACY_EVENT = 'aurelia:privacy-change';

export const defaultPrivacyPreferences = Object.freeze({
  decided: false,
  analytics: true,
  version: '2026-09-09',
});

export function getPrivacyPreferences() {
  if (typeof window === 'undefined') return defaultPrivacyPreferences;
  try {
    const saved = JSON.parse(localStorage.getItem(PRIVACY_PREFERENCES_KEY) || 'null');
    return saved?.decided ? { ...defaultPrivacyPreferences, ...saved } : defaultPrivacyPreferences;
  } catch {
    return defaultPrivacyPreferences;
  }
}

export function getOrCreateVisitorId() {
  if (typeof window === 'undefined') return '';
  let visitorId = localStorage.getItem(VISITOR_ID_KEY) || sessionStorage.getItem(SESSION_VISITOR_ID_KEY);
  if (!visitorId) {
    visitorId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(SESSION_VISITOR_ID_KEY, visitorId);
  }
  return visitorId;
}

export function savePrivacyPreferences({ analytics }) {
  const preferences = {
    decided: true,
    analytics: Boolean(analytics),
    version: defaultPrivacyPreferences.version,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(PRIVACY_PREFERENCES_KEY, JSON.stringify(preferences));
  const visitorId = getOrCreateVisitorId();
  localStorage.setItem(VISITOR_ID_KEY, visitorId);
  sessionStorage.removeItem(SESSION_VISITOR_ID_KEY);
  window.dispatchEvent(new CustomEvent(PRIVACY_EVENT, { detail: preferences }));
  return preferences;
}

export function clearOptionalLocalData() {
  localStorage.removeItem('aurelia_beauty_support_clicked');
}
