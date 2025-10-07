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
        <Button variant="success" onClick={onAccept} style={{ flex: 1 }}>
  ✅ Принять
</Button>
<Button variant="danger" onClick={onReject} style={{ flex: 1 }}>
  ❌ Отклонить
</Button>
      </div>
    </div>
  );
}