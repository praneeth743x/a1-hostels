"use client";

import React, { useState, useEffect } from 'react';
import { ShieldAlert, LogOut, Home, ArrowRight, Lock, UserCheck, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { auth, db } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

interface AccessDeniedCardProps {
  title?: string;
  subtitle?: string;
  reason?: 'unauthenticated' | 'unauthorized_role' | 'account_disabled' | 'permission_denied';
  currentRole?: string;
  requiredRole?: string;
  redirectUrl?: string;
}

export default function AccessDeniedCard({
  title,
  subtitle,
  reason = 'unauthorized_role',
  currentRole,
  requiredRole,
  redirectUrl
}: AccessDeniedCardProps) {

  const [logoUrl, setLogoUrl] = useState<string>(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('cachedLogoUrl')) {
      return localStorage.getItem('cachedLogoUrl')!;
    }
    return '/himalaya_logo.png';
  });

  useEffect(() => {
    getDoc(doc(db, 'system_settings', 'landing')).then((snap) => {
      if (snap.exists() && snap.data()?.logoUrl) {
        const url = snap.data().logoUrl;
        setLogoUrl(url);
        if (typeof window !== 'undefined') localStorage.setItem('cachedLogoUrl', url);
      }
    }).catch(() => {});
  }, []);

  const handleSignOut = async () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      await signOut(auth);
    } catch (e) {
      console.error("Sign out error:", e);
    } finally {
      window.location.href = '/login';
    }
  };

  const getTitle = () => {
    if (title) return title;
    if (reason === 'unauthenticated') return 'Authentication Required';
    if (reason === 'account_disabled') return 'Account Suspended';
    if (reason === 'permission_denied') return '403 - Permission Denied';
    return '403 - Access Denied';
  };

  const getSubtitle = () => {
    if (subtitle) return subtitle;
    if (reason === 'unauthenticated') {
      return 'Please sign in with an authorized account to access this portal.';
    }
    if (reason === 'account_disabled') {
      return 'Your account or hostel subscription has been disabled by the administrator. Please contact support for assistance.';
    }
    if (currentRole === 'tenant' && requiredRole === 'pg_owner') {
      return 'You are currently signed in as a Tenant. This section is restricted to PG Owners & Property Staff.';
    }
    if ((currentRole === 'pg_owner' || currentRole === 'owner') && requiredRole === 'tenant') {
      return 'You are currently signed in as a PG Owner. This portal is reserved for Tenants.';
    }
    return 'You do not have the required permissions or role to view this page.';
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 50%, #0F172A 100%)',
      padding: '24px',
      boxSizing: 'border-box',
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Background Radial Glow */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '500px',
        height: '500px',
        background: reason === 'account_disabled' 
          ? 'radial-gradient(circle, rgba(239, 68, 68, 0.15) 0%, transparent 70%)'
          : 'radial-gradient(circle, rgba(99, 102, 241, 0.18) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />

      <div style={{
        width: '100%',
        maxWidth: '460px',
        background: 'rgba(30, 41, 59, 0.75)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '28px',
        padding: '36px 28px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Website Logo */}
        <img
          src={logoUrl}
          alt="Logo"
          style={{
            width: '72px',
            height: '72px',
            objectFit: 'contain',
            borderRadius: '18px',
            marginBottom: '24px',
            boxShadow: reason === 'account_disabled'
              ? '0 12px 28px rgba(239, 68, 68, 0.25)'
              : '0 12px 28px rgba(99, 102, 241, 0.25)'
          }}
        />

        {/* Badge */}
        <span style={{
          fontSize: '0.72rem',
          fontWeight: 800,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          padding: '4px 12px',
          borderRadius: '20px',
          background: reason === 'account_disabled' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(99, 102, 241, 0.2)',
          color: reason === 'account_disabled' ? '#FCA5A5' : '#A5B4FC',
          border: `1px solid ${reason === 'account_disabled' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(165, 180, 252, 0.3)'}`,
          marginBottom: '12px'
        }}>
          {reason === 'account_disabled' ? 'ACCOUNT DISABLED' : 'RESTRICTED ACCESS'}
        </span>

        <h1 style={{
          fontSize: '1.6rem',
          fontWeight: 800,
          color: '#FFFFFF',
          margin: '0 0 10px 0',
          letterSpacing: '-0.02em'
        }}>
          {getTitle()}
        </h1>

        <p style={{
          fontSize: '0.92rem',
          color: 'rgba(226, 232, 240, 0.8)',
          margin: '0 0 28px 0',
          lineHeight: '1.55',
          maxWidth: '380px'
        }}>
          {getSubtitle()}
        </p>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          width: '100%'
        }}>
          {currentRole === 'tenant' && (
            <Link
              href="/tenant"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                padding: '14px 20px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #4F46E5, #3B82F6)',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '0.95rem',
                textDecoration: 'none',
                boxShadow: '0 8px 20px rgba(79, 70, 229, 0.4)',
                transition: 'all 0.2s ease'
              }}
            >
              <UserCheck size={18} /> Go to Tenant Portal <ArrowRight size={16} />
            </Link>
          )}

          {(currentRole === 'pg_owner' || currentRole === 'owner' || currentRole === 'team_member') && (
            <Link
              href="/pgowner/dashboard"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                padding: '14px 20px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #4F46E5, #3B82F6)',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '0.95rem',
                textDecoration: 'none',
                boxShadow: '0 8px 20px rgba(79, 70, 229, 0.4)',
                transition: 'all 0.2s ease'
              }}
            >
              <UserCheck size={18} /> Go to PG Owner Dashboard <ArrowRight size={16} />
            </Link>
          )}

          {reason === 'unauthenticated' ? (
            <Link
              href="/login"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                padding: '14px 20px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '0.95rem',
                textDecoration: 'none',
                boxShadow: '0 8px 20px rgba(99, 102, 241, 0.35)'
              }}
            >
              Sign In to Account <ArrowRight size={16} />
            </Link>
          ) : (
            <button
              onClick={handleSignOut}
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                padding: '14px 20px',
                borderRadius: '14px',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#E2E8F0',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <LogOut size={18} /> Sign Out & Switch Account
            </button>
          )}

          <Link
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px 20px',
              borderRadius: '14px',
              color: '#94A3B8',
              fontSize: '0.88rem',
              fontWeight: 600,
              textDecoration: 'none'
            }}
          >
            <Home size={16} /> Return to Home Page
          </Link>
        </div>
      </div>
    </div>
  );
}
