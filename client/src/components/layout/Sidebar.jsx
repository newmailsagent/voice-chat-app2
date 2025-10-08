// client/src/components/layout/Sidebar.jsx

import React from 'react';

const getAvatarColor = (username) => {
  const colors = ['#e2e8f0', '#cbd5e1', '#94a3b8'];
  const index = username.charCodeAt(0) % colors.length;
  return colors[index];
};

function Sidebar({
  currentUser,
  searchQuery,
  searchResults,
  searchNotFound,
  contacts,
  socketStatus,
  onSearchChange,
  onSearchSubmit,
  onAddContact,
  onCallUser,
  onLogout,
  onReconnect
}) {
  return (
    <div className="sidebar">
      {/* Профиль */}
      <div className="user-profile">
        <div>
          <div><strong>{currentUser.username}</strong></div>
          <div className="user-id">ID: {currentUser.id}</div>
        </div>
        <button onClick={onLogout} className="logout-btn">
          Выйти
        </button>
      </div>

      {/* Поиск */}
      <div className="search-section">
        <div className="search-input-group">
          <input
            type="text"
            placeholder="Поиск пользователя..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit()}
            className="search-input"
          />
          <button onClick={onSearchSubmit} className="search-btn">
            🔍
          </button>
        </div>

        <div className="search-results">
          {searchResults.map(user => (
            <div key={user.id} className="search-result-item">
              <div className="user-avatar" style={{ backgroundColor: getAvatarColor(user.username) }}>
                {user.username[0]?.toUpperCase()}
              </div>
              <span>{user.username}</span>
              <button
                onClick={() => onAddContact(user.id, user.username)}
                className="add-contact-btn"
              >
                +
              </button>
            </div>
          ))}
          {searchNotFound && searchQuery.trim() && (
            <div className="search-not-found">Пользователь не найден</div>
          )}
        </div>
      </div>

      {/* Контакты */}
      <div className="contacts-list">
        <h3>Контакты</h3>
        {contacts.length === 0 ? (
          <div className="no-contacts">Нет контактов</div>
        ) : (
          contacts.map(contact => (
            <div key={contact.id} className="contact-item">
              <div className="contact-info">
                <div className="user-avatar" style={{ backgroundColor: getAvatarColor(contact.username) }}>
                  {contact.username[0]?.toUpperCase()}
                </div>
                <div>
                  <div>{contact.username}</div>
                  <div className={`contact-status ${contact.isOnline ? 'online' : 'offline'}`}>
                    {contact.isOnline ? 'в сети' : 'не в сети'}
                  </div>
                </div>
              </div>
              <button
                disabled={!contact.isOnline}
                onClick={() => onCallUser(contact.username)}
                className={`call-btn ${contact.isOnline ? 'call-btn--online' : 'call-btn--offline'}`}
              >
                📞
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Sidebar;