import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CustomMonthPickerProps {
  value: string; // Format: "YYYY-MM"
  onChange: (value: string) => void;
  className?: string;
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const FULL_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function CustomMonthPicker({ value, onChange, className }: CustomMonthPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse initial year & month
  const parseVal = (valStr: string) => {
    if (!valStr || !valStr.includes('-')) {
      const d = new Date();
      return { year: d.getFullYear(), monthIdx: d.getMonth() };
    }
    const [y, m] = valStr.split('-').map(Number);
    return { 
      year: isNaN(y) ? new Date().getFullYear() : y, 
      monthIdx: isNaN(m) ? new Date().getMonth() : Math.max(0, Math.min(11, m - 1)) 
    };
  };

  const { year: selectedYear, monthIdx: selectedMonthIdx } = parseVal(value);
  const [viewYear, setViewYear] = useState<number>(selectedYear);

  useEffect(() => {
    setViewYear(selectedYear);
  }, [selectedYear]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectMonth = (mIdx: number) => {
    const monthStr = String(mIdx + 1).padStart(2, '0');
    onChange(`${viewYear}-${monthStr}`);
    setIsOpen(false);
  };

  const handleSelectCurrentMonth = () => {
    const d = new Date();
    const currentVal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setViewYear(d.getFullYear());
    onChange(currentVal);
    setIsOpen(false);
  };

  const formattedDisplay = `${FULL_MONTH_NAMES[selectedMonthIdx]}, ${selectedYear}`;

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }} className={className}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          borderRadius: '10px',
          border: isOpen ? '1.5px solid #4F46E5' : '1px solid #CBD5E1',
          backgroundColor: '#FFFFFF',
          color: '#0F172A',
          fontSize: '0.82rem',
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: isOpen ? '0 0 0 3px rgba(79, 70, 229, 0.12)' : '0 1px 2px rgba(0, 0, 0, 0.04)',
          transition: 'all 0.18s ease',
          userSelect: 'none',
          whiteSpace: 'nowrap'
        }}
      >
        <Calendar size={14} color="#4F46E5" />
        <span>{formattedDisplay}</span>
        <ChevronDown size={14} color="#64748B" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: '260px',
              backgroundColor: '#FFFFFF',
              borderRadius: '18px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 16px 36px rgba(15, 23, 42, 0.15), 0 4px 12px rgba(0, 0, 0, 0.05)',
              padding: '16px',
              zIndex: 1000,
              userSelect: 'none'
            }}
          >
            {/* Year Switcher Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid #F1F5F9' }}>
              <button
                type="button"
                onClick={() => setViewYear(prev => prev - 1)}
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  background: '#F8FAFC',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#EFF6FF'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#F8FAFC'}
              >
                <ChevronLeft size={16} />
              </button>

              <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.01em' }}>
                {viewYear}
              </span>

              <button
                type="button"
                onClick={() => setViewYear(prev => prev + 1)}
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  background: '#F8FAFC',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#EFF6FF'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#F8FAFC'}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* 12 Month Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
              {MONTH_NAMES.map((name, idx) => {
                const isSelected = viewYear === selectedYear && idx === selectedMonthIdx;
                const isCurrentMonth = new Date().getFullYear() === viewYear && new Date().getMonth() === idx;

                return (
                  <motion.button
                    key={name}
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleSelectMonth(idx)}
                    style={{
                      padding: '8px 4px',
                      borderRadius: '10px',
                      border: isSelected ? 'none' : isCurrentMonth ? '1.5px solid #818CF8' : '1px solid transparent',
                      background: isSelected 
                        ? 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' 
                        : 'transparent',
                      color: isSelected ? '#FFFFFF' : isCurrentMonth ? '#4F46E5' : '#1E293B',
                      fontSize: '0.82rem',
                      fontWeight: isSelected || isCurrentMonth ? 700 : 500,
                      cursor: 'pointer',
                      boxShadow: isSelected ? '0 4px 12px rgba(79, 70, 229, 0.3)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = '#F1F5F9';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    {name}
                  </motion.button>
                );
              })}
            </div>

            {/* Quick Footer Action */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid #F1F5F9' }}>
              <button
                type="button"
                onClick={handleSelectCurrentMonth}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#4F46E5',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '2px 4px'
                }}
              >
                This month
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  background: '#F1F5F9',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#64748B',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '4px 10px'
                }}
              >
                Done
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
