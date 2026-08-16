"use client";

export interface AuditMetric {
  page: string;
  routeTransitionTimeMs: number;
  componentMountTimeMs: number;
  authResolutionTimeMs: number;
  hostelRetrievalTimeMs: number;
  apiRequestStartTimestamp: number;
  apiResponseTimeMs: number;
  stateUpdateTimeMs: number;
  finalRenderTimeMs: number;
  totalTimeMs: number;
  bottleneck: string;
  recommendation: string;
}

const auditLog: AuditMetric[] = [];

export function recordAuditMetric(metric: AuditMetric) {
  auditLog.push(metric);
  console.group(`⚡ [Performance Audit] Page: ${metric.page}`);
  console.log(`⏱️ Route Transition: ${metric.routeTransitionTimeMs.toFixed(2)} ms`);
  console.log(`⏱️ Component Mount: ${metric.componentMountTimeMs.toFixed(2)} ms`);
  console.log(`⏱️ Auth Resolution: ${metric.authResolutionTimeMs.toFixed(2)} ms`);
  console.log(`⏱️ Active Hostel Retrieval: ${metric.hostelRetrievalTimeMs.toFixed(2)} ms`);
  console.log(`⏱️ API Request Response Time: ${metric.apiResponseTimeMs.toFixed(2)} ms`);
  console.log(`⏱️ State Update: ${metric.stateUpdateTimeMs.toFixed(2)} ms`);
  console.log(`⏱️ Final DOM Render: ${metric.finalRenderTimeMs.toFixed(2)} ms`);
  console.log(`🚀 Total Duration: ${metric.totalTimeMs.toFixed(2)} ms`);
  console.log(`🎯 Identified Bottleneck: ${metric.bottleneck}`);
  console.log(`💡 Effective Optimization: ${metric.recommendation}`);
  console.groupEnd();
}

export function getAuditReport(): AuditMetric[] {
  return auditLog;
}
