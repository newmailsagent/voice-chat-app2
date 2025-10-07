// client/src/components/ui/Button.jsx
import React from 'react';

const variantStyles = {
  primary: {
    backgroundColor: 'var(--color-primary)',
    color: 'white',
    borderColor: 'var(--color-primary)'
  },
  secondary: {
    backgroundColor: 'transparent',
    color: 'var(--color-text)',
    borderColor: 'var(--color-border)'
  },
  success: {
    backgroundColor: 'var(--color-success)',
    color: 'white',
    borderColor: 'var(--color-success)'
  },
  danger: {
    backgroundColor: 'var(--color-danger)',
    color: 'white',
    borderColor: 'var(--color-danger)'
  },
  warning: {
    backgroundColor: 'var(--color-warning)',
    color: 'white',
    borderColor: 'var(--color-warning)'
  }
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  type = 'button',
  style = {},
  ...props
}) {
  const baseStyle = {
    padding: size === 'sm' ? '6px 12px' : size === 'lg' ? '12px 24px' : '8px 16px',
    fontSize: size === 'sm' ? 'var(--font-size-sm)' : 'var(--font-size-base)',
    fontWeight: 'var(--font-weight-medium)',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    transition: 'background-color 0.2s, opacity 0.2s',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...variantStyles[variant],
    ...style
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={baseStyle}
      {...props}
    >
      {children}
    </button>
  );
}