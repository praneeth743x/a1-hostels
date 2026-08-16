"use client";

import React from 'react';

// Single shimmering line / box component
export function SkeletonBlock({ width = '100%', height = '16px', borderRadius = '8px', className = '', style = {} }: {
  width?: string;
  height?: string;
  borderRadius?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`skeleton-shimmer ${className}`}
      style={{
        width,
        height,
        borderRadius,
        background: 'linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%)',
        backgroundSize: '200% 100%',
        animation: 'skeletonShimmer 1.5s infinite ease-in-out',
        ...style
      }}
    />
  );
}

// Skeleton for Cards / Items Feed (Complaints, Notifications, Dues, Tenants)
export function SkeletonListCards({ count = 4 }: { count?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', padding: '4px' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '16px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-start'
          }}
        >
          {/* Avatar / Icon Placeholder */}
          <SkeletonBlock width="42px" height="42px" borderRadius="12px" />
          
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <SkeletonBlock width="45%" height="16px" borderRadius="6px" />
              <SkeletonBlock width="60px" height="20px" borderRadius="10px" />
            </div>
            <SkeletonBlock width="85%" height="14px" borderRadius="6px" />
            <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
              <SkeletonBlock width="80px" height="12px" borderRadius="4px" />
              <SkeletonBlock width="90px" height="12px" borderRadius="4px" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Skeleton for Chat Box Page (/pgowner/chat)
export function SkeletonChatPage() {
  return (
    <div style={{ display: 'flex', gap: '16px', height: 'calc(100vh - 120px)', width: '100%', padding: '4px' }}>
      {/* Left Chat Threads Sidebar */}
      <div style={{ width: '320px', background: '#ffffff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <SkeletonBlock width="100%" height="36px" borderRadius="10px" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '8px', background: '#F8FAFC', borderRadius: '12px' }}>
              <SkeletonBlock width="40px" height="40px" borderRadius="50%" />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <SkeletonBlock width="60%" height="14px" borderRadius="4px" />
                <SkeletonBlock width="85%" height="12px" borderRadius="4px" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Conversation View */}
      <div style={{ flex: 1, background: '#ffffff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '12px', borderBottom: '1px solid #F1F5F9' }}>
          <SkeletonBlock width="40px" height="40px" borderRadius="50%" />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <SkeletonBlock width="120px" height="16px" borderRadius="4px" />
            <SkeletonBlock width="80px" height="12px" borderRadius="4px" />
          </div>
        </div>

        {/* Message Bubbles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 0' }}>
          <div style={{ alignSelf: 'flex-start', maxWidth: '65%' }}>
            <SkeletonBlock width="220px" height="48px" borderRadius="16px" />
          </div>
          <div style={{ alignSelf: 'flex-end', maxWidth: '65%' }}>
            <SkeletonBlock width="180px" height="40px" borderRadius="16px" />
          </div>
          <div style={{ alignSelf: 'flex-start', maxWidth: '65%' }}>
            <SkeletonBlock width="260px" height="54px" borderRadius="16px" />
          </div>
        </div>

        {/* Input Bar */}
        <div style={{ display: 'flex', gap: '10px', paddingTop: '12px', borderTop: '1px solid #F1F5F9' }}>
          <SkeletonBlock width="100%" height="42px" borderRadius="10px" />
          <SkeletonBlock width="80px" height="42px" borderRadius="10px" />
        </div>
      </div>
    </div>
  );
}

// Page Shell Skeleton Fallback for Layout Suspense
export function SkeletonPageShell() {
  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
      <SkeletonBlock width="100%" height="90px" borderRadius="20px" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        <SkeletonBlock width="100%" height="64px" borderRadius="16px" />
        <SkeletonBlock width="100%" height="64px" borderRadius="16px" />
        <SkeletonBlock width="100%" height="64px" borderRadius="16px" />
      </div>
      <SkeletonListCards count={3} />
    </div>
  );
}

// Global CSS Shimmer Keyframe injector
if (typeof document !== 'undefined') {
  const styleId = 'skeleton-shimmer-styles';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.innerHTML = `
      @keyframes skeletonShimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
    `;
    document.head.appendChild(styleEl);
  }
}
