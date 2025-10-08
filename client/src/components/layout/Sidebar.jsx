// client/src/components/layout/Sidebar.jsx

import React from 'react';
import { Button, Input } from 'reactstrap';

// Вспомогательная функция (можно вынести в utils позже)
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
        <Button variant="secondary" size="sm" onClick={onLogout} className="logout-btn">
          Выйти
        </Button>
      </div>

      {/* Поиск */}
      <div className="search-section">
        <div className="search-input-group">
          <Input
            placeholder="Поиск пользователя..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit()}
          />
          <Button variant="secondary" onClick={onSearchSubmit} className="search-btn">
            🔍
          </Button>
        </div>

        <div className="search-results">
          {searchResults.map(user => (
            <div key={user.id} className="search-result-item">
              <div className="user-avatar" style={{ backgroundColor: getAvatarColor(user.username) }}>
                {user.username[0]?.toUpperCase()}
              </div>
              <span>{user.username}</span>
              <Button
                variant="success"
                onClick={() => onAddContact(user.id, user.username)}
                className="add-contact-btn"
              >
                +
              </Button>
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
              <Button
                variant={contact.isOnline ? 'primary' : 'secondary'}
                disabled={!contact.isOnline}
                onClick={() => onCallUser(contact.username)}
                className="call-btn"
              >
                📞
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

Sidebar.propTypes = {
  currentUser: PropTypes.shape({ id: PropTypes.number, username: PropTypes.string }).isRequired,
  searchQuery: PropTypes.string.isRequired,
  searchResults: PropTypes.array.isRequired,
  searchNotFound: PropTypes.bool.isRequired,
  contacts: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number,
      username: PropTypes.string,
      isOnline: PropTypes.bool
    })
  ).isRequired,
  socketStatus: PropTypes.string.isRequired,
  onSearchChange: PropTypes.func.isRequired,
  onSearchSubmit: PropTypes.func.isRequired,
  onAddContact: PropTypes.func.isRequired,
  onCallUser: PropTypes.func.isRequired,
  onLogout: PropTypes.func.isRequired,
  onReconnect: PropTypes.func.isRequired
};

export default Sidebar;