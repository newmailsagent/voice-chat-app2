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
    <Button
  variant={contact.isOnline ? 'primary' : 'secondary'}
  disabled={!contact.isOnline}
  onClick={() => onCall(contact.username)}
  style={{ padding: '4px 10px', minWidth: 'auto' }}
>
  📞
</Button>
    </div>
  );
}