"use client";

/**
 * Native Zero-Delay Route Prefetch Engine
 * Uses Next.js App Router's native router.prefetch() to pre-warm client route chunks safely.
 */

class RoutePrefetcher {
  private prefetchedRoutes = new Set<string>();

  public prefetchIdle(router: { prefetch: (href: string) => void }, routes: string[]) {
    if (typeof window === 'undefined' || !router?.prefetch) return;

    const unvisited = routes.filter(r => !this.prefetchedRoutes.has(r));
    if (unvisited.length === 0) return;

    unvisited.forEach(r => this.prefetchedRoutes.add(r));

    const executePrefetch = () => {
      unvisited.forEach((route) => {
        try {
          router.prefetch(route);
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
    if (typeof window === 'undefined' || !route || !router?.prefetch) return;
    if (this.prefetchedRoutes.has(route)) return;
    this.prefetchedRoutes.add(route);
    try {
      router.prefetch(route);
    } catch (e) {}
  }
}

export const routePrefetcher = new RoutePrefetcher();

