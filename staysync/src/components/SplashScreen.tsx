"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Building, Loader2, ShieldCheck } from 'lucide-react';

export const SplashScreen: React.FC = () => {
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null);
  const [siteName, setSiteName] = React.useState<string>('A1 Hostels');

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const cachedLogo = localStorage.getItem('cachedLogoUrl');
      const cachedName = localStorage.getItem('cachedSiteName');
      if (cachedLogo) setLogoUrl(cachedLogo);
      if (cachedName) setSiteName(cachedName);
    }
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 50%, #31103F 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#FFFFFF',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: '24px',
        overflow: 'hidden',
      }}
    >
      {/* Background Ambient Glow */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          top: '-10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.25) 0%, rgba(0,0,0,0) 70%)',
          pointerEvents: 'none',
        }}
      />

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: '420px',
          width: '100%',
          textAlign: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* App Logo */}
        <div
          style={{
            position: 'relative',
            marginBottom: '20px',
          }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
            style={{
              width: '88px',
              height: '88px',
              borderRadius: '26px',
              border: '2px dashed rgba(168, 85, 247, 0.4)',
              position: 'absolute',
              top: '-4px',
              left: '-4px',
            }}
          />
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '22px',
              background: 'linear-gradient(135deg, #6366F1 0%, #A855F7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 20px 40px rgba(99, 102, 241, 0.4)',
              overflow: 'hidden'
            }}
          >
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }} />
            ) : (
              <Building size={42} color="#FFFFFF" />
            )}
          </div>
        </div>

        {/* App Title */}
        <h1
          style={{
            fontSize: '2rem',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            margin: '0 0 4px 0',
            background: 'linear-gradient(135deg, #FFFFFF 0%, #E2E8F0 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {siteName}
        </h1>
        <p
          style={{
            fontSize: '0.85rem',
            color: '#94A3B8',
            fontWeight: 500,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            marginBottom: '28px',
          }}
        >
          Smart PG Management System
        </p>

        {/* Simple Loader */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            background: 'rgba(15, 23, 42, 0.6)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(12px)',
            gap: '12px'
          }}
        >
          <Loader2 size={24} style={{ color: '#6366F1', animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: '0.9rem', color: '#F1F5F9', fontWeight: 600 }}>Loading Workspace...</span>
        </div>

        {/* Security Badge */}
        <div
          style={{
            marginTop: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.75rem',
            color: '#64748B',
          }}
        >
          <ShieldCheck size={14} color="#10B981" />
          <span>Encrypted Multi-Tenant Environment</span>
        </div>
      </motion.div>
    </div>
  );
};
