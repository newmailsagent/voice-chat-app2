// client/src/components/contacts/SearchResultItem.jsx
import React from 'react';
import Avatar from '../ui/Avatar';

export default function SearchResultItem({ user, onAdd }) {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center',
      padding: '8px 0',
      borderBottom: '1px solid #f0f0f0'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Avatar username={user.username} size={32} />
        <span>{user.username}</span>
      </div>
      <Button
  variant="success"
  onClick={() => onAdd(user.id, user.username)}
  style={{ padding: '4px 8px', minWidth: 'auto' }}
>
  +
</Button>
    </div>
  );
}