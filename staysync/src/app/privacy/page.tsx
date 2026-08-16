"use client";

import React from 'react';
import Link from 'next/link';
import { Shield, ArrowLeft, Lock, FileText, CheckCircle2, AlertCircle, Building2, UserCheck } from 'lucide-react';
import { DATA_RETENTION_POLICIES, DPDP_ROLES_CONFIG } from '@/lib/privacyConfig';

export default function PrivacyPolicyPage() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      color: '#0f172a',
      fontFamily: 'Inter, system-ui, sans-serif',
      padding: '24px 16px 60px'
    }}>
      <div style={{ maxWidth: '840px', margin: '0 auto' }}>
        
        {/* Header Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#4F46E5', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>
            <ArrowLeft size={18} /> Back to StaySync
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#EEF2FF', color: '#4F46E5', padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600 }}>
            <Shield size={16} /> DPDP Ready Policy
          </div>
        </div>

        {/* Hero Card */}
        <div style={{
          background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
          borderRadius: '24px',
          padding: '32px 24px',
          color: 'white',
          boxShadow: '0 10px 30px rgba(79, 70, 229, 0.2)',
          marginBottom: '28px'
        }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0 0 12px', letterSpacing: '-0.02em' }}>
            StaySync Privacy Notice & Data Protection Policy
          </h1>
          <p style={{ margin: 0, opacity: 0.9, fontSize: '0.95rem', lineHeight: '1.6' }}>
            Transparent guidance on how tenant and hostel management information is processed, secured, and protected across the StaySync hostel platform.
          </p>
        </div>

        {/* Section 1: Data Roles */}
        <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '24px', marginBottom: '20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b' }}>
            <UserCheck size={20} color="#4F46E5" /> Roles & Responsibilities
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div style={{ backgroundColor: '#F8FAFC', padding: '16px', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#4F46E5', display: 'block', marginBottom: '4px' }}>
                {DPDP_ROLES_CONFIG.dataFiduciary.roleName}
              </span>
              <strong style={{ fontSize: '0.95rem', display: 'block', marginBottom: '6px', color: '#0F172A' }}>
                {DPDP_ROLES_CONFIG.dataFiduciary.entity}
              </strong>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.85rem', color: '#475569', lineHeight: '1.5' }}>
                {DPDP_ROLES_CONFIG.dataFiduciary.responsibilities.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>

            <div style={{ backgroundColor: '#F8FAFC', padding: '16px', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#7C3AED', display: 'block', marginBottom: '4px' }}>
                {DPDP_ROLES_CONFIG.dataProcessor.roleName}
              </span>
              <strong style={{ fontSize: '0.95rem', display: 'block', marginBottom: '6px', color: '#0F172A' }}>
                {DPDP_ROLES_CONFIG.dataProcessor.entity}
              </strong>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.85rem', color: '#475569', lineHeight: '1.5' }}>
                {DPDP_ROLES_CONFIG.dataProcessor.responsibilities.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          </div>
        </div>

        {/* Section 2: Information Processed */}
        <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '24px', marginBottom: '20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b' }}>
            <FileText size={20} color="#4F46E5" /> Information Processed
          </h2>
          <p style={{ fontSize: '0.88rem', color: '#475569', lineHeight: '1.6', marginTop: 0 }}>
            StaySync processes only information essential for operating hostel accommodations:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            {[
              'Tenant Name & Mobile Number',
              'Email Address & Emergency Contact',
              'Hostel, Room & Bed Allocations',
              'Check-in & Booking Dates',
              'Rent Amounts & Billing Records',
              'Payment Receipts & Transaction IDs',
              'Uploaded Identity Proofs (if required)',
              'Hostel Complaints & Maintenance Logs',
              'Operational Notifications (WhatsApp/Email)',
              'Device & Security Session Tokens'
            ].map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#334155' }}>
                <CheckCircle2 size={16} color="#10B981" style={{ flexShrink: 0 }} />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Purposes */}
        <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '24px', marginBottom: '20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b' }}>
            <Building2 size={20} color="#4F46E5" /> Purposes of Processing
          </h2>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.88rem', color: '#334155', lineHeight: '1.7' }}>
            <li>Hostel account management and tenant onboarding</li>
            <li>Room allocation and bed capacity management</li>
            <li>Rent calculation, billing generation, and payment tracking</li>
            <li>Sending essential stay notifications (Rent dues, payment receipts, maintenance notices)</li>
            <li>Resolving tenant complaints and maintenance issues</li>
            <li>Security authentication, device authorization, and access control</li>
            <li>Maintaining tax and statutory financial compliance records</li>
          </ul>
        </div>

        {/* Section 4: Data Security & Retention */}
        <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '24px', marginBottom: '20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b' }}>
            <Lock size={20} color="#4F46E5" /> Financial Data & Security Commitments
          </h2>
          <div style={{ backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', padding: '14px 16px', borderRadius: '12px', marginBottom: '16px', fontSize: '0.85rem', color: '#065F46', lineHeight: '1.5' }}>
            <strong>Zero Financial Credential Storage:</strong> StaySync NEVER stores UPI PINs, Card CVVs, netbanking passwords, or payment gateway secret keys. All payment processing is securely handled via PCI-DSS compliant payment gateways.
          </div>
          
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '16px 0 10px', color: '#1e293b' }}>Data Retention Architecture</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Object.values(DATA_RETENTION_POLICIES).map((policy, idx) => (
              <div key={idx} style={{ padding: '12px 14px', backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <strong style={{ fontSize: '0.88rem', color: '#0F172A' }}>{policy.category}</strong>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', backgroundColor: policy.autoDeleteAllowed ? '#FEF3C7' : '#E0E7FF', color: policy.autoDeleteAllowed ? '#92400E' : '#3730A3' }}>
                    {typeof policy.retentionDays === 'number' ? `${policy.retentionDays} Days` : policy.retentionDays}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B' }}>{policy.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Section 5: Data Rights & Grievances */}
        <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '24px', marginBottom: '24px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b' }}>
            <AlertCircle size={20} color="#4F46E5" /> Tenant Privacy Rights & Request Workflow
          </h2>
          <p style={{ fontSize: '0.88rem', color: '#475569', lineHeight: '1.6', marginTop: 0 }}>
            Tenants can manage their privacy preferences under <strong>Tenant Profile → Settings → Privacy & Data</strong>:
          </p>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.88rem', color: '#334155', lineHeight: '1.7' }}>
            <li><strong>Request Information Correction:</strong> Submit corrections for inaccurate profile fields.</li>
            <li><strong>Safe Data Deletion Request:</strong> Submit a deletion request. Deletion requests undergo Hostel Owner review to preserve statutory rent and tax records.</li>
            <li><strong>Raise Privacy Grievance:</strong> Submit a formal grievance regarding personal data processing.</li>
          </ul>
        </div>

        {/* Footer info */}
        <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#94a3b8' }}>
          StaySync Platform &bull; DPDP Compliance Framework &bull; Updated August 2026
        </div>

      </div>
    </div>
  );
}
