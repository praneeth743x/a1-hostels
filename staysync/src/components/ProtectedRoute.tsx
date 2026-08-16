"use client";

import React, { useState, useEffect } from 'react';
import { usePermissions, useHostel } from '@/context/HostelContext';
import type { TeamMemberPermissions } from '@/permissions';
import { ShieldAlert, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface ProtectedRouteProps {
  permission?: keyof TeamMemberPermissions;
  children: React.ReactNode;
  fallbackText?: string;
}

export default function ProtectedRoute({ permission, children, fallbackText }: ProtectedRouteProps) {
  const { hasPermission, isOwner, isStaff } = usePermissions();
  const { authStatus, userProfile, currentUser } = useHostel();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // During SSR / initial mount / owner role / cached permissions, render children immediately (instant UI mount)
  if (!isMounted || !permission || isOwner) {
    return <>{children}</>;
  }

  // Check if permissions are available in context or localStorage cache
  const hasCachedPermissions = typeof window !== 'undefined' && (!!localStorage.getItem('cachedUserPermissions') || !!userProfile);

  // If auth is still booting and no cached credentials exist, render children so loading.tsx / Skeleton mounts
  if ((authStatus === 'BOOTING' || authStatus === 'RESTORE_AUTH') && !hasCachedPermissions) {
    return <>{children}</>;
  }

  const isAllowed = hasPermission(permission);

  if (!isAllowed && isStaff) {
    return (
      <div style={{
        minHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        textAlign: 'center',
        background: '#F8FAFC',
        borderRadius: '16px',
        margin: '16px',
        border: '1px solid #E2E8F0'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: '#FEE2E2',
          color: '#EF4444',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px'
        }}>
          <ShieldAlert size={32} />
        </div>
        
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1E293B', marginBottom: '8px' }}>
          Access Denied (403)
        </h2>
        
        <p style={{ fontSize: '0.95rem', color: '#64748B', maxWidth: '420px', marginBottom: '24px', lineHeight: '1.5' }}>
          {fallbackText || `You do not have permission (${String(permission)}) to access this section. Please contact your property owner if you need access.`}
        </p>

        <Link href="/pgowner/dashboard" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 20px',
          background: '#4F46E5',
          color: 'white',
          borderRadius: '10px',
          fontWeight: 600,
          fontSize: '0.9rem',
          textDecoration: 'none',
          boxShadow: '0 2px 8px rgba(79, 70, 229, 0.25)'
        }}>
          <ArrowLeft size={16} /> Return to Dashboard
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
