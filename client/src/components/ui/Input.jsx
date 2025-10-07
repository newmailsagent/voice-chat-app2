// client/src/components/ui/Input.jsx
import React from 'react';

export default function Input({ placeholder, value, onChange, onKeyPress, disabled, style = {}, ...props }) {
  return (
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      onKeyPress={onKeyPress}
      disabled={disabled}
      style={{
        width: '100%',
        padding: 'var(--space-sm)',
        fontSize: 'var(--font-size-base)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'white',
        color: 'var(--color-text)',
        ...style
      }}
      {...props}
    />
  );
}