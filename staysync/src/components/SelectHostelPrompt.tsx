"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Building2, ChevronRight, Building } from 'lucide-react';
import { useHostel } from '@/context/HostelContext';

export const SelectHostelPrompt: React.FC<{ pageTitle?: string }> = ({ pageTitle = 'Data' }) => {
  const { properties, switchHostel } = useHostel();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: '32px 20px',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '24px',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          boxShadow: '0 20px 40px -15px rgba(99, 102, 241, 0.12), 0 4px 12px rgba(0,0,0,0.03)',
          padding: '40px 32px',
          maxWidth: '540px',
          width: '100%',
          textAlign: 'center',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '24px',
            background: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)',
            border: '1px solid #C7D2FE',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px',
            boxShadow: '0 8px 16px -4px rgba(99, 102, 241, 0.15)',
          }}
        >
          <Building2 size={36} color="#4F46E5" />
        </div>

        <h2
          style={{
            fontSize: '1.4rem',
            fontWeight: 800,
            color: '#1E293B',
            marginBottom: '8px',
            letterSpacing: '-0.02em',
          }}
        >
          Select a Hostel to View {pageTitle}
        </h2>

        <p
          style={{
            fontSize: '0.92rem',
            color: '#64748B',
            lineHeight: '1.55',
            marginBottom: '28px',
            maxWidth: '440px',
            margin: '0 auto 28px auto',
          }}
        >
          Please pick your active property from the top header dropdown or select one below to view metrics, records, and reports.
        </p>

        {isMounted && properties && properties.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
            <div style={{ textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              Your Hostels ({properties.length})
            </div>
            {properties.map((p) => (
              <motion.button
                key={p.pg_id}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => switchHostel(p.pg_id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  borderRadius: '16px',
                  border: '1px solid #E2E8F0',
                  background: '#F8FAFC',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '12px',
                      background: '#4F46E5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 10px rgba(79, 70, 229, 0.25)',
                    }}
                  >
                    <Building size={20} color="#FFFFFF" />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0F172A' }}>{p.name}</div>
                    <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '2px' }}>
                      {p.total_rooms || p.rooms?.length || 0} Rooms • {p.address || 'Active Property'}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: '#4F46E5',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                  }}
                >
                  <span>Select</span>
                  <ChevronRight size={16} />
                </div>
              </motion.button>
            ))}
          </div>
        ) : (
          <div
            style={{
              padding: '20px',
              borderRadius: '16px',
              background: '#F1F5F9',
              fontSize: '0.88rem',
              color: '#64748B',
            }}
          >
            No properties found for your account. Please add a property in the Properties menu.
          </div>
        )}
      </motion.div>
    </div>
  );
};
