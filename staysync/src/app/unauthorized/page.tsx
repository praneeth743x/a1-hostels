"use client";

import React from 'react';
import { ShieldAlert, ArrowLeft, MessageSquare } from 'lucide-react';
import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      textAlign: 'center',
      background: '#F8FAFC'
    }}>
      <div style={{
        width: '88px',
        height: '88px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #FEE2E2, #FECACA)',
        color: '#DC2626',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '24px',
        boxShadow: '0 8px 24px rgba(220, 38, 38, 0.15)'
      }}>
        <ShieldAlert size={44} />
      </div>
      
      <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#0F172A', marginBottom: '10px', letterSpacing: '-0.02em' }}>
        403 - Access Denied
      </h1>
      
      <p style={{ fontSize: '1rem', color: '#64748B', maxWidth: '480px', marginBottom: '32px', lineHeight: '1.6' }}>
        Your assigned team member permissions do not allow access to this feature or page. Please contact your property owner if you require elevated module permissions.
      </p>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link href="/pgowner/dashboard" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 24px',
          background: '#4F46E5',
          color: 'white',
          borderRadius: '12px',
          fontWeight: 600,
          fontSize: '0.95rem',
          textDecoration: 'none',
          boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
        }}>
          <ArrowLeft size={18} /> Return to Dashboard
        </Link>

        <a 
          href="https://wa.me/?text=Hi%2C%20I%20need%20module%20permission%20access%20updated%20in%20Raliving." 
          target="_blank" 
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            background: '#FFFFFF',
            color: '#0F172A',
            border: '1px solid #CBD5E1',
            borderRadius: '12px',
            fontWeight: 600,
            fontSize: '0.95rem',
            textDecoration: 'none',
            boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
          }}
        >
          <MessageSquare size={18} color="#10B981" /> Contact Property Owner
        </a>
      </div>
    </div>
  );
}
