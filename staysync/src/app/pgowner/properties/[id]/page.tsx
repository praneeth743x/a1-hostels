"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PropertyIdPage({ params }: { params: any }) {
  const router = useRouter();
  const [pgId, setPgId] = useState<string | null>(null);

  useEffect(() => {
    // Unwrap params whether it is a Promise or plain object
    Promise.resolve(params).then((resolved: any) => {
      const id = resolved?.id || (typeof params === 'object' && params?.id);
      if (id) {
        setPgId(id);
      }
    }).catch(() => {
      if (params?.id) setPgId(params.id);
    });
  }, [params]);

  useEffect(() => {
    if (pgId) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('activePgId', pgId);
        window.dispatchEvent(new Event('hostelsUpdated'));
      }
      // Instant resilient navigation
      try {
        router.replace('/pgowner/dashboard');
      } catch (e) {
        window.location.href = '/pgowner/dashboard';
      }
      // Fallback timer if router.replace hangs due to RSC payload fetch failure
      const fallbackTimer = setTimeout(() => {
        window.location.href = '/pgowner/dashboard';
      }, 300);

      return () => clearTimeout(fallbackTimer);
    }
  }, [pgId, router]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', color: '#64748B', gap: '12px' }}>
      <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '3px solid #E2E8F0', borderTopColor: '#4F46E5', animation: 'spin 0.8s linear infinite' }} />
      <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Switching to hostel property...</span>
      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

