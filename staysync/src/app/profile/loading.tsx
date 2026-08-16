"use client";

import React, { useEffect } from 'react';
import { navTracer } from '@/lib/navTracer';

export default function ProfileLoading() {
  useEffect(() => {
    navTracer.mark('t7_loadingMount', 'profile/loading.tsx');
  }, []);

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%' }}>
      <div style={{ width: '90px', height: '90px', borderRadius: '50%', backgroundColor: '#cbd5e1', animation: 'pulse 1.2s infinite ease-in-out' }} />
      <div style={{ width: '160px', height: '22px', backgroundColor: '#e2e8f0', borderRadius: '6px', animation: 'pulse 1.2s infinite ease-in-out' }} />
      <div style={{ width: '110px', height: '14px', backgroundColor: '#e2e8f0', borderRadius: '4px', animation: 'pulse 1.2s infinite ease-in-out' }} />
      <div style={{ width: '100%', height: '200px', backgroundColor: '#f8fafc', borderRadius: '20px', border: '1px solid #e2e8f0', animation: 'pulse 1.2s infinite ease-in-out' }} />
    </div>
  );
}
