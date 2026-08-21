"use client";

import React, { useEffect } from 'react';
import { ShieldAlert, RefreshCw, Home } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function RootErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error('[ROOT ERROR BOUNDARY]', error);
  }, [error]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '80vh',
        padding: '32px 20px',
        textAlign: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          width: '68px',
          height: '68px',
          borderRadius: '50%',
          background: '#FEF2F2',
          color: '#EF4444',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px',
          border: '1px solid #FECACA',
        }}
      >
        <ShieldAlert size={34} />
      </div>

      <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>
        Something Went Wrong
      </h2>

      <p
        style={{
          fontSize: '0.95rem',
          color: '#64748B',
          maxWidth: '440px',
          lineHeight: 1.5,
          marginBottom: '16px',
        }}
      >
        An unexpected issue occurred while loading this page. Please try again or return to the home screen.
      </p>

      {/* Developer Context / Error Details */}
      <div
        style={{
          background: '#F1F5F9',
          border: '1px solid #E2E8F0',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '28px',
          width: '100%',
          maxWidth: '500px',
          textAlign: 'left',
          overflowX: 'auto'
        }}
      >
        <div style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, marginBottom: '4px' }}>Error Details:</div>
        <div style={{ fontSize: '0.75rem', color: '#EF4444', fontFamily: 'monospace' }}>
          {error.message || 'Unknown Error'}
        </div>
        {error.digest && (
          <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '4px', fontFamily: 'monospace' }}>
            Digest: {error.digest}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={() => reset()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            background: '#4F46E5',
            color: '#FFFFFF',
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: '0.92rem',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)',
          }}
        >
          <RefreshCw size={16} />
          <span>Retry</span>
        </button>

        <button
          onClick={() => {
            window.location.href = '/';
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            background: '#F8FAFC',
            color: '#334155',
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: '0.92rem',
            border: '1px solid #CBD5E1',
            cursor: 'pointer',
          }}
        >
          <Home size={16} />
          <span>Home</span>
        </button>
      </div>
    </div>
  );
}
