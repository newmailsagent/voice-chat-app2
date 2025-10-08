// client/src/components/layout/MainContent.jsx

import React from 'react';
import SettingsPanel from '../settings/SettingsPanel';

function MainContent({ activeTab }) {
  return (
    <div className="main-content">
      {activeTab === 'settings' ? (
        <SettingsPanel />
      ) : (
        <div className="welcome-message">
          <h1>Besedka</h1>
          <p>Выберите контакт, чтобы начать звонок</p>
          {/* Позже можно добавить кнопку "Настройки" */}
        </div>
      )}
    </div>
  );
}

export default MainContent;