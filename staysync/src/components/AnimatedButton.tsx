"use client";

import React, { type ComponentProps } from 'react';
import { motion } from 'framer-motion';
import './AnimatedButton.css';
import { clsx } from 'clsx';

interface AnimatedButtonProps extends ComponentProps<typeof motion.button> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'outline' | 'ghost';
  isLoading?: boolean;
}

export const AnimatedButton: React.FC<AnimatedButtonProps> = React.memo(({ 
  children, 
  variant = 'primary', 
  isLoading, 
  className = '', 
  onPointerDown,
  onTouchStart,
  ...props 
}) => {
  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      onPointerDown={(e) => {
        if (onPointerDown) onPointerDown(e);
      }}
      onTouchStart={(e) => {
        if (onTouchStart) onTouchStart(e);
      }}
      style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent', transform: 'translateZ(0)', ...(props.style || {}) }}
      className={clsx(`animated-button btn-${variant}`, isLoading && 'loading', className)}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <div className="spinner"></div>
      ) : (
        children
      )}
    </motion.button>
  );
});

AnimatedButton.displayName = 'AnimatedButton';
