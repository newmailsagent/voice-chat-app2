// client/src/components/ui/ConnectionStatus.jsx
import React from 'react';

const getStatusConfig = (status) => {
  switch (status) {
    case 'connected':
      return {
        bg: '#d4edda',
        color: '#155724',
        border: '#c3e6cb',
        text: '🟢 Подключено'
      };
    case 'error':
      return {
        bg: '#f8d7da',
        color: '#721c24',
        border: '#f5c6cb',
        text: '🔴 Ошибка'
      };
    case 'connecting':
      return {
        bg: '#fff3cd',
        color: '#856404',
        border: '#ffeaa7',
        text: '🟡 Подключение...'
      };
    default:
      return {
        bg: '#fff3cd',
        color: '#856404',
        border: '#ffeaa7',
        text: '⚪ Отключено'
      };
  }
};

export default function ConnectionStatus({ socketStatus, onReconnect }) {
  const config = getStatusConfig(socketStatus);
  const showReconnect = socketStatus !== 'connected';

  return (
    <div style={{ 
      marginBottom: '15px', 
      padding: '8px', 
      borderRadius: '4px',
      backgroundColor: config.bg,
      color: config.color,
      border: `1px solid ${config.border}`
    }}>
      <strong>Статус подключения:</strong> {config.text}
      {showReconnect && onReconnect && (
        <button 
          onClick={onReconnect}
          style={{
            marginLeft: '10px',
            padding: '4px 8px',
            backgroundColor: '#17a2b8',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Переподключиться
        </button>
      )}
    </div>
  );
}