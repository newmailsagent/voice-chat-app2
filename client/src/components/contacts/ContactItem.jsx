// client/src/components/contacts/ContactItem.jsx
import React from 'react';
import Avatar from '../ui/Avatar';

export default function ContactItem({ contact, onCall }) {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center',
      padding: '10px 0',
      borderBottom: '1px solid #f0f0f0'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Avatar username={contact.username} size={40} />
        <div>
          <div>{contact.username}</div>
          <div style={{ 
            fontSize: '12px', 
            color: contact.isOnline ? '#28a745' : '#6c757d'
          }}>
            {contact.isOnline ? 'в сети' : 'не в сети'}
          </div>
        </div>
      </div>
      <button
        onClick={() => onCall(contact.username)}
        disabled={!contact.isOnline}
        style={{
          padding: '6px 10px',
          backgroundColor: contact.isOnline ? '#007bff' : '#6c757d',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: contact.isOnline ? 'pointer' : 'not-allowed'
        }}
      >
        📞
      </button>
    </div>
  );
}