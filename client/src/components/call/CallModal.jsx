// client/src/components/call/CallModal.jsx
import React, { useRef } from 'react';

export default function CallModal({ callWindow, onEndCall, onRetryCall, onDragStart }) {
  const modalRef = useRef(null);

  return (
    <div 
      ref={modalRef}
      onMouseDown={onDragStart}
      style={{
        position: 'fixed',
        top: '100px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'white',
        border: '2px solid #007bff',
        borderRadius: '8px',
        padding: '15px',
        width: '300px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 1000,
        cursor: 'move'
      }}
    >
      <div className="call-window-header" style={{ 
        fontWeight: 'bold', 
        marginBottom: '10px',
        cursor: 'move'
      }}>
        Вызов: {callWindow.targetName}
      </div>
      
      <div style={{ marginBottom: '15px' }}>
        {callWindow.status === 'calling' && (
          <div style={{ color: '#007bff' }}>📞 Звонок...</div>
        )}
        {callWindow.status === 'offline' && (
          <div style={{ color: '#6c757d' }}>Пользователь не в сети</div>
        )}
        {callWindow.status === 'missed' && (
          <div style={{ color: '#dc3545' }}>Вызов не отвечен</div>
        )}
      </div>

      {callWindow.status === 'calling' ? (
        <Button
  variant="danger"
  onClick={onEndCall}
  style={{ width: '100%' }}
>
  📵 Сбросить вызов
</Button>
      ) : (
        <Button
  variant="success"
  onClick={onRetryCall}
  style={{ width: '100%' }}
>
  📞 Повторить вызов
</Button>
      )}
    </div>
  );
}