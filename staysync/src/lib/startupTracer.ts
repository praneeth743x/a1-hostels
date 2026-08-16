"use client";

/**
 * Android/PWA Native Launch & Startup Performance Tracer
 * Tracks exact timing markers S0 through S10 to eliminate launch latency.
 */
interface StartupTimings {
  S0_launchTime: number;
  S1_docLoading?: number;
  S2_jsStarted?: number;
  S3_rootLayoutMount?: number;
  S4_reactAppMount?: number;
  S5_appShellRender?: number;
  S6_firstMeaningfulPaint?: number;
  S7_authRestored?: number;
  S8_firebaseInit?: number;
  S9_swRegistered?: number;
  S10_bgSyncComplete?: number;
}

class StartupTracer {
  private timings: StartupTimings;

  constructor() {
    const timeOrigin = typeof performance !== 'undefined' ? performance.timeOrigin || performance.now() : Date.now();
    this.timings = {
      S0_launchTime: timeOrigin
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('DOMContentLoaded', () => {
        this.mark('S1_docLoading', 'Document DOMContentLoaded');
      });
    }
  }

  public mark(marker: keyof Omit<StartupTimings, 'S0_launchTime'>, details?: string) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.timings[marker] = now;

    const labels: Record<string, string> = {
      S1_docLoading: 'S1: Document Begins Loading',
      S2_jsStarted: 'S2: JavaScript Execution Starts',
      S3_rootLayoutMount: 'S3: Root Layout Mount (layout.tsx)',
      S4_reactAppMount: 'S4: React Application & HostelProvider Mount',
      S5_appShellRender: 'S5: Application Shell Rendered',
      S6_firstMeaningfulPaint: 'S6: First Meaningful Paint',
      S7_authRestored: 'S7: Authentication Restoration (Frame 0)',
      S8_firebaseInit: 'S8: Firebase Initialization',
      S9_swRegistered: 'S9: Service Worker Registration',
      S10_bgSyncComplete: 'S10: Background Data Synchronization',
    };

    if (process.env.NODE_ENV === 'development') {
      console.log(`🚀 [STARTUP TRACER] +${now.toFixed(2)}ms -> ${labels[marker] || marker} ${details ? `(${details})` : ''}`);
    }

    if (marker === 'S5_appShellRender' || marker === 'S10_bgSyncComplete') {
      this.printReport();
    }
  }

  public printReport() {
    const t = this.timings;
    const fmt = (val?: number) => val !== undefined ? `${val.toFixed(2)} ms` : 'N/A';

    if (process.env.NODE_ENV === 'development') {
      console.group('🚀 [PWA ANDROID LAUNCH PERFORMANCE REPORT]');
      console.log(`S0 (Launch) -> S5 (App Shell Render):      ${fmt(t.S5_appShellRender)}`);
      console.log(`S0 (Launch) -> S6 (First Meaningful Paint): ${fmt(t.S6_firstMeaningfulPaint)}`);
      console.log(`S0 (Launch) -> S7 (Auth Restored):          ${fmt(t.S7_authRestored)}`);
      console.log(`S0 (Launch) -> S8 (Firebase Init):          ${fmt(t.S8_firebaseInit)}`);
      console.log(`S0 (Launch) -> S9 (SW Registration):        ${fmt(t.S9_swRegistered)}`);
      console.log(`S0 (Launch) -> S10 (Background Sync):       ${fmt(t.S10_bgSyncComplete)}`);
      console.groupEnd();
    }
  }
}

export const startupTracer = new StartupTracer();
