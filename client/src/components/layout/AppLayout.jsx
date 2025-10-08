// client/src/components/layout/AppLayout.jsx

import React from 'react';
import Sidebar from './Sidebar';
import MainContent from './MainContent';
import PropTypes from 'prop-types';

function AppLayout({
  currentUser,
  searchQuery,
  searchResults,
  searchNotFound,
  contacts,
  socketStatus,
  activeTab,
  onSearchChange,
  onSearchSubmit,
  onAddContact,
  onCallUser,
  onLogout,
  onReconnect,
  children // для модалок или уведомлений
}) {
  return (
    <div className="app-layout">
      <Sidebar
        currentUser={currentUser}
        searchQuery={searchQuery}
        searchResults={searchResults}
        searchNotFound={searchNotFound}
        contacts={contacts}
        socketStatus={socketStatus}
        onSearchChange={onSearchChange}
        onSearchSubmit={onSearchSubmit}
        onAddContact={onAddContact}
        onCallUser={onCallUser}
        onLogout={onLogout}
        onReconnect={onReconnect}
      />
      <MainContent activeTab={activeTab} />
      {children}
    </div>
  );
}

AppLayout.propTypes = {
  currentUser: PropTypes.shape({ id: PropTypes.number, username: PropTypes.string }).isRequired,
  searchQuery: PropTypes.string.isRequired,
  searchResults: PropTypes.array.isRequired,
  searchNotFound: PropTypes.bool.isRequired,
  contacts: PropTypes.array.isRequired,
  socketStatus: PropTypes.string.isRequired,
  activeTab: PropTypes.string.isRequired,
  onSearchChange: PropTypes.func.isRequired,
  onSearchSubmit: PropTypes.func.isRequired,
  onAddContact: PropTypes.func.isRequired,
  onCallUser: PropTypes.func.isRequired,
  onLogout: PropTypes.func.isRequired,
  onReconnect: PropTypes.func.isRequired,
  children: PropTypes.node
};

export default AppLayout;