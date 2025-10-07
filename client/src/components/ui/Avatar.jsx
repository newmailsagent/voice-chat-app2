// client/src/components/ui/Avatar.jsx
import React from 'react';

// Светло-серый по умолчанию
const getAvatarColor = () => '#cccccc';

export default function Avatar({ username, size = 40 }) {
  return (
    <div style={{
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '50%',
      backgroundColor: getAvatarColor(),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#666',
      fontWeight: 'bold'
    }}>
      {username?.[0]?.toUpperCase()}
    </div>
  );
}