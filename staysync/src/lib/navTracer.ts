"use client";

interface NavTimings {
  targetRoute: string;
  t0_userClick?: number;
  t1_onClickStart?: number;
  t2_routerPushCalled?: number;
  t3_routerTransitionStart?: number;
  t4_rootLayoutRender?: number;
  t5_nestedLayoutRender?: number;
  t6_pageComponentRender?: number;
  t7_loadingMount?: number;
  t8_skeletonFirstPaint?: number;
  t9_firstAsyncStart?: number;
  t10_firstAsyncFinish?: number;
  t11_pageCommitted?: number;
}

class NavigationTracer {
  private currentTiming: NavTimings | null = null;
  private activeRoute: string = '';

  public startNavigation(route: string) {
    const now = performance.now();
    this.activeRoute = route;
    this.currentTiming = {
      targetRoute: route,
      t0_userClick: now,
    };
    console.log(`\n====================================================`);
    console.log(`⏱️ [NAV TRACER] Navigation Started to: ${route} at T0 = 0.00ms`);
  }

  public mark(step: keyof Omit<NavTimings, 'targetRoute'>, details?: string) {
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';

    if (!this.currentTiming) {
      // Create fresh timing session for current route
      this.currentTiming = {
        targetRoute: currentPath || 'unknown',
        t0_userClick: performance.now()
      };
    } else if (currentPath && !this.currentTiming.targetRoute.includes(currentPath) && !currentPath.includes(this.currentTiming.targetRoute)) {
      // Route has changed -- start fresh timing for current route
      this.currentTiming = {
        targetRoute: currentPath,
        t0_userClick: performance.now()
      };
    }

    const now = performance.now();
    const t0 = this.currentTiming.t0_userClick || now;
    const elapsedMs = now - t0;
    this.currentTiming[step] = now;

    const stepLabels: Record<string, string> = {
      t0_userClick: 'T0: User Click',
      t1_onClickStart: 'T1: Sidebar/Nav onClick starts',
      t2_routerPushCalled: 'T2: router.push() called',
      t3_routerTransitionStart: 'T3: Router transition starts',
      t4_rootLayoutRender: 'T4: Root layout begins rendering',
      t5_nestedLayoutRender: 'T5: Nested layout begins rendering',
      t6_pageComponentRender: 'T6: Page component begins rendering',
      t7_loadingMount: 'T7: loading.tsx mounts',
      t8_skeletonFirstPaint: 'T8: Skeleton first paint',
      t9_firstAsyncStart: 'T9: First async operation starts',
      t10_firstAsyncFinish: 'T10: First async operation finishes',
      t11_pageCommitted: 'T11: Page committed',
    };

    console.log(`⏱️ [NAV TRACER] +${elapsedMs.toFixed(2)}ms -> ${stepLabels[step] || step} ${details ? `(${details})` : ''}`);

    if (step === 't7_loadingMount' || step === 't11_pageCommitted') {
      this.printSummary();
    }
  }

  public printSummary() {
    if (!this.currentTiming) return;
    const t = this.currentTiming;
    const t0 = t.t0_userClick || 0;

    const diff = (a?: number, b?: number) => {
      if (a === undefined || b === undefined) return 'N/A';
      return `${(b - a).toFixed(2)} ms`;
    };

    console.group(`📊 [NAV TRACER SUMMARY] ${t.targetRoute}`);
    console.log(`Click (T0) -> onClick (T1):           ${diff(t0, t.t1_onClickStart)}`);
    console.log(`onClick (T1) -> router.push (T2):     ${diff(t.t1_onClickStart, t.t2_routerPushCalled)}`);
    console.log(`router.push (T2) -> transition (T3):  ${diff(t.t2_routerPushCalled, t.t3_routerTransitionStart)}`);
    console.log(`transition (T3) -> Root Layout (T4):  ${diff(t.t3_routerTransitionStart, t.t4_rootLayoutRender)}`);
    console.log(`Root Layout (T4) -> Nested (T5):      ${diff(t.t4_rootLayoutRender, t.t5_nestedLayoutRender)}`);
    console.log(`Nested Layout (T5) -> loading (T7):   ${diff(t.t5_nestedLayoutRender, t.t7_loadingMount)}`);
    console.log(`loading.tsx (T7) -> Page Mount (T6):  ${diff(t.t7_loadingMount, t.t6_pageComponentRender)}`);
    console.log(`Page Mount (T6) -> Skeleton (T8):    ${diff(t.t6_pageComponentRender, t.t8_skeletonFirstPaint)}`);
    console.log(`Skeleton (T8) -> Async Finish (T10): ${diff(t.t8_skeletonFirstPaint, t.t10_firstAsyncFinish)}`);
    console.log(`Async Finish -> Page Commit (T11):   ${diff(t.t10_firstAsyncFinish, t.t11_pageCommitted)}`);
    console.log(`----------------------------------------------------`);
    console.log(`🔥 TOTAL T0 -> T7 (Delay to loading.tsx): ${diff(t0, t.t7_loadingMount)}`);
    console.log(`🔥 TOTAL T0 -> T11 (Delay to full page):   ${diff(t0, t.t11_pageCommitted)}`);
    console.groupEnd();

    // Auto-clear session to prevent stale timing retention
    setTimeout(() => {
      this.currentTiming = null;
    }, 1000);
  }
}

export const navTracer = new NavigationTracer();
