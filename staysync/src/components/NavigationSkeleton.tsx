"use client";

import React from 'react';

export const NavigationSkeleton = ({ path }: { path: string }) => {
  // Determine skeleton type based on path
  const isDashboard = path.includes('/dashboard');
  const isTenants = path.includes('/tenants');
  const isRooms = path.includes('/rooms');
  const isDues = path.includes('/dues') || path.includes('/expenses');
  const isReports = path.includes('/reports') || path.includes('/history');
  
  // Generic pulse animation style
  const pulseStyle = {
    animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
    background: 'rgba(203, 213, 225, 0.4)', // Slate-300 with opacity
    borderRadius: '12px',
  };

  return (
    <div style={{ padding: '24px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
      
      {/* Universal Header Skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ ...pulseStyle, width: '180px', height: '32px', borderRadius: '8px' }} />
          <div style={{ ...pulseStyle, width: '240px', height: '16px', borderRadius: '4px' }} />
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ ...pulseStyle, width: '40px', height: '40px', borderRadius: '50%' }} />
          <div style={{ ...pulseStyle, width: '120px', height: '40px' }} />
        </div>
      </div>

      {/* Dashboard Specific Skeleton */}
      {isDashboard && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ ...pulseStyle, height: '140px', borderRadius: '16px', background: 'rgba(255,255,255,0.6)' }} />
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px', flex: 1 }}>
            {[1, 2].map(i => (
              <div key={i} style={{ ...pulseStyle, height: '300px', borderRadius: '16px', background: 'rgba(255,255,255,0.6)' }} />
            ))}
          </div>
        </>
      )}

      {/* Table/List Specific Skeleton (Tenants, Dues, Reports) */}
      {(isTenants || isDues || isReports) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ ...pulseStyle, width: '300px', height: '48px', borderRadius: '12px', background: 'rgba(255,255,255,0.8)' }} />
            <div style={{ ...pulseStyle, width: '120px', height: '48px', borderRadius: '12px', background: 'rgba(255,255,255,0.8)' }} />
          </div>
          <div style={{ ...pulseStyle, flex: 1, borderRadius: '16px', background: 'rgba(255,255,255,0.5)', display: 'flex', flexDirection: 'column', padding: '20px', gap: '16px' }}>
            {/* Table Headers */}
            <div style={{ display: 'flex', gap: '20px', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '12px' }}>
              <div style={{ ...pulseStyle, width: '150px', height: '16px' }} />
              <div style={{ ...pulseStyle, width: '100px', height: '16px' }} />
              <div style={{ ...pulseStyle, width: '100px', height: '16px' }} />
              <div style={{ ...pulseStyle, width: '80px', height: '16px', marginLeft: 'auto' }} />
            </div>
            {/* Table Rows */}
            {[1, 2, 3, 4, 5, 6].map(row => (
              <div key={row} style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <div style={{ ...pulseStyle, width: '40px', height: '40px', borderRadius: '50%' }} />
                <div style={{ ...pulseStyle, width: '180px', height: '20px' }} />
                <div style={{ ...pulseStyle, width: '80px', height: '20px' }} />
                <div style={{ ...pulseStyle, width: '60px', height: '20px', marginLeft: 'auto' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rooms/Grid Specific Skeleton */}
      {isRooms && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ ...pulseStyle, width: '200px', height: '48px', borderRadius: '12px', background: 'rgba(255,255,255,0.8)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} style={{ ...pulseStyle, height: '160px', borderRadius: '16px', background: 'rgba(255,255,255,0.7)', display: 'flex', flexDirection: 'column', padding: '16px', justifyContent: 'space-between' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                   <div style={{ ...pulseStyle, width: '60px', height: '24px' }} />
                   <div style={{ ...pulseStyle, width: '80px', height: '24px', borderRadius: '12px' }} />
                 </div>
                 <div style={{ display: 'flex', gap: '8px' }}>
                   <div style={{ ...pulseStyle, width: '32px', height: '32px', borderRadius: '50%' }} />
                   <div style={{ ...pulseStyle, width: '32px', height: '32px', borderRadius: '50%' }} />
                 </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generic Fallback Skeleton */}
      {!isDashboard && !isTenants && !isDues && !isReports && !isRooms && (
        <div style={{ ...pulseStyle, flex: 1, borderRadius: '16px', background: 'rgba(255,255,255,0.6)' }} />
      )}
    </div>
  );
};
