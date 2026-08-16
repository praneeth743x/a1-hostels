import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Option {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconOnly?: boolean;
  searchable?: boolean;
}

export function CustomSelect({ value, onChange, options, placeholder = 'Select an option', disabled = false, icon, iconOnly = false, searchable = false }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    if (isOpen && searchable) {
      setSearchQuery('');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, searchable]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: iconOnly ? 'center' : 'flex-start',
          width: '100%', 
          padding: iconOnly ? '10px' : '10px 14px', 
          paddingLeft: (icon && !iconOnly) ? '38px' : (iconOnly ? '10px' : '14px'),
          borderRadius: '14px', 
          border: iconOnly ? 'none' : (isOpen ? '1px solid #4F6DFF' : '1px solid #E2E8F0'), 
          backgroundColor: disabled ? '#F8FAFC' : '#FFFFFF', 
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: iconOnly ? '0 6px 20px rgba(15,23,42,0.08)' : (isOpen ? '0 0 0 3.5px rgba(79, 109, 255, 0.15)' : '0 1px 3px rgba(0, 0, 0, 0.04)'),
          transition: 'all 0.18s ease',
          color: selectedOption ? '#0F172A' : '#94A3B8',
          fontSize: '0.88rem',
          fontWeight: 500
        }}
      >
        {icon && (
          <div style={{ position: iconOnly ? 'static' : 'absolute', left: iconOnly ? 'auto' : '12px', color: (iconOnly && (value !== 'All' && value !== '')) ? '#4F6DFF' : '#64748B', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
            {icon}
          </div>
        )}
        
        {!iconOnly && (
          <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', userSelect: 'none' }}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        )}
        
        {!iconOnly && (
          <ChevronDown 
            size={16} 
            color="#64748B" 
            style={{ 
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', 
              transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)' 
            }} 
          />
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: iconOnly ? 0 : 'auto',
              left: iconOnly ? 'auto' : 0,
              minWidth: iconOnly ? '200px' : '100%',
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14), 0 2px 6px rgba(0, 0, 0, 0.04)',
              zIndex: 100,
              overflow: 'hidden',
              transformOrigin: 'top'
            }}
          >
            <div style={{ 
                maxHeight: '260px', 
                overflowY: 'auto', 
                scrollbarWidth: 'thin',
                WebkitOverflowScrolling: 'touch',
                overscrollBehavior: 'contain'
              }}
            >
              {searchable && (
                <div style={{ padding: '8px' }}>
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      outline: 'none',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>
              )}
              {options
                .filter(opt => !searchable || (opt.label?.toString() || '').toLowerCase().includes(searchQuery.toLowerCase()))
                .length === 0 ? (
                <div style={{ padding: '10px 14px', color: '#94A3B8', fontSize: '0.85rem', textAlign: 'center' }}>
                  No options available
                </div>
              ) : (
                options
                .filter(opt => !searchable || (opt.label?.toString() || '').toLowerCase().includes(searchQuery.toLowerCase()))
                .map((opt) => (
                  <div
                    key={opt.value}
                    onClick={() => {
                      if (opt.disabled) return;
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    style={{
                      padding: '9px 12px',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: opt.disabled ? 'not-allowed' : 'pointer',
                      backgroundColor: value === String(opt.value) ? '#EFF6FF' : 'transparent',
                      color: value === String(opt.value) ? '#2563EB' : '#1E293B',
                      fontSize: '0.88rem',
                      fontWeight: value === String(opt.value) ? 600 : 450,
                      opacity: opt.disabled ? 0.4 : 1,
                      transition: 'all 0.12s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!opt.disabled && value !== String(opt.value)) e.currentTarget.style.backgroundColor = '#F8FAFC';
                    }}
                    onMouseLeave={(e) => {
                      if (!opt.disabled && value !== String(opt.value)) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {opt.label}
                    {value === String(opt.value) && <Check size={16} color="#2563EB" strokeWidth={2.5} />}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
