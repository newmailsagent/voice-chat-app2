// client/src/components/layout/AppLayout.jsx

import React from 'react';
import Sidebar from './Sidebar';
import MainContent from './MainContent';

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

export default AppLayout;