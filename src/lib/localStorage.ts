// Generic localStorage persistence helper
// All data is stored locally AND synced to backend
// On refresh: load from localStorage first (instant), then sync with backend

const STORAGE_KEYS = {
  scores: 'choir_scores',
  voiceParts: 'choir_voiceparts',
  plans: 'choir_plans',
} as const;

function getUserId(): string {
  try {
    const u = JSON.parse(localStorage.getItem('choir_user') || '{}');
    return u.id || 'guest';
  } catch {
    return 'guest';
  }
}

function getKey(base: string): string {
  return `${base}_${getUserId()}`;
}

// Load from localStorage
export function loadLocal<T>(key: keyof typeof STORAGE_KEYS): T[] {
  try {
    const data = localStorage.getItem(getKey(STORAGE_KEYS[key]));
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// Save to localStorage
export function saveLocal<T>(key: keyof typeof STORAGE_KEYS, data: T[]): void {
  try {
    localStorage.setItem(getKey(STORAGE_KEYS[key]), JSON.stringify(data));
  } catch {
    // storage full, ignore
  }
}

// Sync helper: load from local first, then fetch from server, merge
export async function syncData<T extends { id: string | number }>(
  key: keyof typeof STORAGE_KEYS,
  fetchFn: () => Promise<T[]>,
  pushFn?: (items: T[]) => Promise<void>
): Promise<T[]> {
  // 1. Load from localStorage immediately (no wait)
  const localData = loadLocal<T>(key);

  // 2. Try fetch from server
  try {
    const serverData = await fetchFn();

    if (serverData && serverData.length > 0) {
      // Server has data → update localStorage with server data
      saveLocal(key, serverData);
      return serverData;
    }

    // Server is empty but local has data → push local data back to server
    if (localData.length > 0 && pushFn) {
      await pushFn(localData);
      return localData;
    }

    return localData;
  } catch {
    // Server error → return local data
    return localData;
  }
}

// When adding/updating an item: save to both local and server
export async function addItem<T extends { id: string | number }>(
  key: keyof typeof STORAGE_KEYS,
  item: T,
  serverAddFn: (item: T) => Promise<void>
): Promise<void> {
  // 1. Update localStorage
  const existing = loadLocal<T>(key);
  const filtered = existing.filter(e => e.id !== item.id);
  const updated = [item, ...filtered];
  saveLocal(key, updated);

  // 2. Send to server (fire and forget, but log errors)
  try {
    await serverAddFn(item);
  } catch (err) {
    console.warn('Server sync failed, item saved locally:', err);
  }
}

// When deleting an item
export async function deleteItem<T extends { id: string | number }>(
  key: keyof typeof STORAGE_KEYS,
  id: string | number,
  serverDeleteFn: (id: string | number) => Promise<void>
): Promise<void> {
  // 1. Update localStorage
  const existing = loadLocal<T>(key);
  saveLocal(key, existing.filter(e => e.id !== id));

  // 2. Send to server
  try {
    await serverDeleteFn(id);
  } catch (err) {
    console.warn('Server delete failed, removed locally:', err);
  }
}
