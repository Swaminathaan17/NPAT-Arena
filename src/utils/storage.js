const LEGACY_SETTINGS = 'npat-phase-one';
export const KEYS = {
  SETTINGS: 'npat-arena:settings',
  HISTORY: 'npat-arena:history',
  SOUND: 'npat-arena:sound',
  ACHIEVEMENTS: 'npat-arena:achievements',
};

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* no-op */
  }
}

export function loadSettings(fallback) {
  const fresh = load(KEYS.SETTINGS, null);
  if (fresh) return fresh;
  const legacy = load(LEGACY_SETTINGS, null);
  if (legacy && legacy.settings) {
    const migrated = legacy.settings;
    save(KEYS.SETTINGS, migrated);
    return migrated;
  }
  return fallback;
}