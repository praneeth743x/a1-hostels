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
}

export function CustomSelect({ value, onChange, options, placeholder = 'Select an option', disabled = false, icon, iconOnly = false }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

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
          padding: iconOnly ? '12px' : '12px 16px', 
          paddingLeft: (icon && !iconOnly) ? '40px' : (iconOnly ? '12px' : '16px'),
          borderRadius: '8px', 
          border: iconOnly ? 'none' : (isOpen ? '1px solid #3b82f6' : '1px solid #cbd5e1'), 
          backgroundColor: disabled ? '#f8fafc' : (isOpen ? '#f8fafc' : '#fff'), 
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: iconOnly ? '0 8px 24px rgba(15,23,42,0.1)' : (isOpen ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : 'none'),
          transition: 'all 0.2s ease',
          color: selectedOption ? '#0f172a' : '#94a3b8',
          fontSize: '0.9rem',
          fontWeight: 400
        }}
      >
        {icon && (
          <div style={{ position: iconOnly ? 'static' : 'absolute', left: iconOnly ? 'auto' : '12px', color: (iconOnly && (value !== 'All' && value !== '')) ? '#3b82f6' : '#64748b', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
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
            color="#94a3b8" 
            style={{ 
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', 
              transition: 'transform 0.2s ease' 
            }} 
          />
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scaleY: 0.95 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -10, scaleY: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: iconOnly ? 0 : 'auto',
              left: iconOnly ? 'auto' : 0,
              minWidth: iconOnly ? '200px' : '100%',
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              zIndex: 50,
              overflow: 'hidden',
              transformOrigin: 'top'
            }}
          >
            <div style={{ maxHeight: '250px', overflowY: 'auto', padding: '4px' }}>
              {options.length === 0 ? (
                <div style={{ padding: '8px 12px', color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center' }}>
                  No options available
                </div>
              ) : (
                options.map((opt) => (
                  <div
                    key={opt.value}
                    onClick={() => {
                      if (opt.disabled) return;
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: opt.disabled ? 'not-allowed' : 'pointer',
                      backgroundColor: value === opt.value ? '#eff6ff' : 'transparent',
                      color: value === opt.value ? '#1d4ed8' : '#334155',
                      fontSize: '0.9rem',
                      fontWeight: value === opt.value ? 500 : 400,
                      opacity: opt.disabled ? 0.4 : 1,
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!opt.disabled && value !== opt.value) e.currentTarget.style.backgroundColor = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      if (!opt.disabled && value !== opt.value) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {opt.label}
                    {value === opt.value && <Check size={16} color="#3b82f6" strokeWidth={3} />}
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
