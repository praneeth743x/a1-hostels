export const getLocalCache = () => {
  if (typeof window === 'undefined') return {};
  try {
    const data = localStorage.getItem('raliving_app_cache');
    return data ? JSON.parse(data) : {};
  } catch (e) {
    return {};
  }
};

export const globalAppCache: Record<string, any> = getLocalCache();

export const getFromCache = (key: string): any => {
  if (globalAppCache[key] !== undefined) {
    return globalAppCache[key];
  }
  if (typeof window !== 'undefined') {
    try {
      const item = localStorage.getItem(`raliving_cache_${key}`);
      if (item) {
        const parsed = JSON.parse(item);
        globalAppCache[key] = parsed;
        return parsed;
      }
    } catch (e) {
      console.warn(`Failed to read key ${key} from localStorage`, e);
    }
  }
  return null;
};

export const saveToCache = (key: string, value: any) => {
  globalAppCache[key] = value;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`raliving_cache_${key}`, JSON.stringify(value));
      localStorage.setItem('raliving_app_cache', JSON.stringify(globalAppCache));
    } catch (e) {
      console.warn("Failed to save cache to localStorage", e);
    }
  }
};

export const clearUserCache = () => {
  if (typeof window !== 'undefined') {
    try {
      Object.keys(globalAppCache).forEach(k => delete globalAppCache[k]);
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('raliving_cache_') || k === 'raliving_app_cache') {
          localStorage.removeItem(k);
        }
      });
    } catch (e) {
      console.warn("Failed to clear cache", e);
    }
  }
};

