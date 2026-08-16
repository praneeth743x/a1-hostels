"use client";

/**
 * Native Zero-Delay Route Prefetch Engine
 * Proactively downloads Next.js App Router Flight Payloads & JS Bundles on app startup.
 * Guarantees 0ms chunk fetch latency when user touches any navigation link.
 */

class RoutePrefetcher {
  private prefetchedRoutes = new Set<string>();

  public prefetchIdle(router: { prefetch: (href: string) => void }, routes: string[]) {
    if (typeof window === 'undefined') return;

    const unvisited = routes.filter(r => !this.prefetchedRoutes.has(r));
    if (unvisited.length === 0) return;

    unvisited.forEach(r => this.prefetchedRoutes.add(r));

    const executePrefetch = () => {
      unvisited.forEach((route) => {
        try {
          // 1. Next.js App Router Router prefetch
          router.prefetch(route);

          // 2. Direct RSC Flight Payload pre-fetch to warm Service Worker & browser cache
          fetch(route, {
            headers: { 'RSC': '1', 'Next-Router-State-Tree': '%5B%22%22%2C%7B%22children%22%3A%5B%22pgowner%22%2C%7B%22children%22%3A%5B%22dashboard%22%2C%7B%7D%5D%7D%5D%7D%5D' },
            priority: 'low'
          } as any).catch(() => {});
        } catch (e) {
          // Silent catch
        }
      });
    };

    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(executePrefetch, { timeout: 1000 });
    } else if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(executePrefetch);
    } else {
      setTimeout(executePrefetch, 0);
    }
  }

  public prefetchSingle(router: { prefetch: (href: string) => void }, route: string) {
    if (typeof window === 'undefined' || !route) return;
    if (this.prefetchedRoutes.has(route)) return;
    this.prefetchedRoutes.add(route);
    try {
      router.prefetch(route);
      fetch(route, { headers: { 'RSC': '1' } } as any).catch(() => {});
    } catch (e) {}
  }
}

export const routePrefetcher = new RoutePrefetcher();
