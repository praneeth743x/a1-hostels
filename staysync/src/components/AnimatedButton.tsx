"use client";

import React, { type ComponentProps } from 'react';
import { motion } from 'framer-motion';
import './AnimatedButton.css';
import { clsx } from 'clsx';

interface AnimatedButtonProps extends ComponentProps<typeof motion.button> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'outline' | 'ghost';
  isLoading?: boolean;
}

export const AnimatedButton: React.FC<AnimatedButtonProps> = ({ 
  children, 
  variant = 'primary', 
  isLoading, 
  className = '', 
  ...props 
}) => {
  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.96, y: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
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
};

