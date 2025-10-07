// client/src/components/call/IncomingCallBanner.jsx
import React from 'react';

export default function IncomingCallBanner({ incomingCall, onAccept, onReject }) {
  return (
    <div style={{
      background: '#fff3cd',
      border: '2px solid #ffeaa7',
      padding: '20px',
      borderRadius: '8px',
      marginTop: '20px'
    }}>
      <h3>📞 Входящий вызов!</h3>
      <p><strong>От:</strong> {incomingCall.fromUsername} (ID: {incomingCall.from})</p>
      <div>
        <button
          onClick={onAccept}
          style={{
            padding: '10px 20px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '10px'
          }}
        >
          ✅ Принять
        </button>
        <button
          onClick={onReject}
          style={{
            padding: '10px 20px',
            backgroundColor: '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          ❌ Отклонить
        </button>
      </div>
    </div>
  );
}