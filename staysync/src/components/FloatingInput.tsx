"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import './FloatingInput.css';

interface FloatingInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const FloatingInput: React.FC<FloatingInputProps> = ({ label, ...props }) => {
  const [focused, setFocused] = useState(false);

  return (
    <div className="floating-input-container">
      <motion.label
        className="floating-label"
        initial={false}
        animate={{
          y: focused || props.value ? -24 : 0,
          scale: focused || props.value ? 0.85 : 1,
          color: focused ? 'var(--primary-indigo)' : 'var(--text-muted)'
        }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        {label}
      </motion.label>
      <input
        className="floating-input"
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        {...props}
      />
    </div>
  );
};
