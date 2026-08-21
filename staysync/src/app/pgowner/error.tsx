"use client";

import React, { useEffect } from 'react';
import { ShieldAlert, RefreshCw, LayoutDashboard } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PGOwnerErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error('[PGOWNER ERROR BOUNDARY]', error);
  }, [error]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '65vh',
        padding: '32px 20px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: '#FEF2F2',
          color: '#EF4444',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px',
          border: '1px solid #FECACA',
          boxShadow: '0 8px 20px rgba(239, 68, 68, 0.12)',
        }}
      >
        <ShieldAlert size={32} />
      </div>

      <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>
        Unable to Load Module
      </h2>

      <p
        style={{
          fontSize: '0.92rem',
          color: '#64748B',
          maxWidth: '420px',
          lineHeight: 1.5,
          marginBottom: '28px',
        }}
      >
        {error?.message && !error.message.includes('Server Components')
          ? error.message
          : 'A temporary issue occurred while loading this view. You can reload or return to the dashboard.'}
      </p>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={() => reset()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 22px',
            background: '#4F46E5',
            color: '#FFFFFF',
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: '0.9rem',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)',
          }}
        >
          <RefreshCw size={16} />
          <span>Try Again</span>
        </button>

        <button
          onClick={() => router.push('/pgowner/dashboard')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 22px',
            background: '#F8FAFC',
            color: '#334155',
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: '0.9rem',
            border: '1px solid #CBD5E1',
            cursor: 'pointer',
          }}
        >
          <LayoutDashboard size={16} />
          <span>Dashboard</span>
        </button>
      </div>
    </div>
  );
}
