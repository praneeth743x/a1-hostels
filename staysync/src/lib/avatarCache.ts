/**
 * Persistent Client Avatar Cache
 * Prevents avatar re-downloading and flickering during navigation.
 */

class AvatarCacheManager {
  private memoryCache: Map<string, string> = new Map();

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('raliving_avatar_cache');
        if (stored) {
          const parsed = JSON.parse(stored);
          Object.entries(parsed).forEach(([url, cachedUrl]) => {
            this.memoryCache.set(url, cachedUrl as string);
          });
        }
      } catch (e) {
        // Fallback gracefully
      }
    }
  }

  public get(url: string | null | undefined): string | null {
    if (!url) return null;
    return this.memoryCache.get(url) || url;
  }

  public set(url: string, cachedUrl: string): void {
    if (!url) return;
    this.memoryCache.set(url, cachedUrl);
    if (typeof window !== 'undefined') {
      try {
        const obj: Record<string, string> = {};
        this.memoryCache.forEach((val, key) => {
          obj[key] = val;
        });
        sessionStorage.setItem('raliving_avatar_cache', JSON.stringify(obj));
      } catch (e) {
        // Ignore quota limits gracefully
      }
    }
  }
}

export const avatarCache = new AvatarCacheManager();
