/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * High-Resolution Pipeline Execution Tracer & Logger
 * Tracks every millisecond from navigation start to render completion.
 * Stripped in production.
 */

class PerformanceLogger {
  private isDev = process.env.NODE_ENV !== 'production';
  private navStartMs: number = performance.now();
  private activeRpcCalls: Map<string, number> = new Map();
  private pageRpcCount: number = 0;
  private pageQueryCount: number = 0;
  private duplicateReadsCount: number = 0;
  private nPlusOneCount: number = 0;
  private sequentialCount: number = 0;
  private totalFirestoreReads: number = 0;
  private traceLogs: Array<{ elapsed: string; event: string }> = [];

  public logNavigationStart(route: string) {
    if (!this.isDev) return;
    this.navStartMs = performance.now();
    this.pageRpcCount = 0;
    this.pageQueryCount = 0;
    this.duplicateReadsCount = 0;
    this.nPlusOneCount = 0;
    this.sequentialCount = 0;
    this.totalFirestoreReads = 0;
    this.traceLogs = [];
    this.trace(`[0.00 ms] Route navigation started: ${route}`);
  }

  public trace(eventMessage: string) {
    if (!this.isDev) return;
    const elapsed = (performance.now() - this.navStartMs).toFixed(2);
    const logLine = `[${elapsed} ms] ${eventMessage}`;
    this.traceLogs.push({ elapsed, event: eventMessage });
    console.log(`⏱️ [TRACE] ${logLine}`);
  }

  public logPageSummary(pageName: string) {
    if (!this.isDev) return;
    const loadTimeSeconds = ((performance.now() - this.navStartMs) / 1000).toFixed(2);

    console.group(`📊 [TRACE REPORT] ${pageName} Execution Pipeline`);
    this.traceLogs.forEach(t => console.log(`[${t.elapsed} ms] ${t.event}`));
    console.log(
`\n${pageName} Page Performance Summary
--------------------
Firestore Queries: ${this.pageQueryCount}
Firestore RPCs: ${this.pageRpcCount}
Duplicate Reads: ${this.duplicateReadsCount}
N+1 Queries: ${this.nPlusOneCount}
Sequential Requests: ${this.sequentialCount}
Total Firestore Reads: ${this.totalFirestoreReads}
Total Page Load Time: ${loadTimeSeconds} s\n`
    );
    console.groupEnd();
  }

  public logRpcStart(actionName: string, id?: string) {
    if (!this.isDev) return;
    const key = id ? `${actionName}_${id}` : actionName;
    this.activeRpcCalls.set(key, performance.now());
    this.pageRpcCount++;
    this.trace(`Firestore RPC started: ${actionName} (Request #${this.pageRpcCount})`);
  }

  public logRpcEnd(actionName: string, estimatedReadCount: number = 1, queryCount: number = 1, id?: string) {
    if (!this.isDev) return;
    const key = id ? `${actionName}_${id}` : actionName;
    const startTime = this.activeRpcCalls.get(key);
    const duration = startTime ? (performance.now() - startTime).toFixed(2) : 'unknown';
    this.activeRpcCalls.delete(key);
    this.pageQueryCount += queryCount;
    this.totalFirestoreReads += estimatedReadCount;
    this.trace(`Firestore RPC completed: ${actionName} (${duration} ms | ~${estimatedReadCount} reads)`);
  }

  public logRenderStart(componentName: string) {
    if (!this.isDev) return;
    this.trace(`${componentName} render started`);
  }

  public logRenderEnd(componentName: string) {
    if (!this.isDev) return;
    this.trace(`${componentName} render completed`);
  }

  public logEffect(componentName: string, effectName: string) {
    if (!this.isDev) return;
    this.trace(`useEffect executed: ${componentName} -> ${effectName}`);
  }

  public logMemo(componentName: string, memoName: string) {
    if (!this.isDev) return;
    this.trace(`useMemo recomputed: ${componentName} -> ${memoName}`);
  }
}

export const perfLogger = new PerformanceLogger();
