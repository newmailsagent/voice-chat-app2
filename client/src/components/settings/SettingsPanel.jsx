// client/src/components/settings/SettingsPanel.jsx

import React from 'react';
import PropTypes from 'prop-types';

function SettingsPanel({ audioInputs = [], onMicrophoneChange }) {
  return (
    <div className="settings-panel">
      <h2>Настройки</h2>
      <div className="setting-group">
        <label htmlFor="mic-select">Микрофон:</label>
        {audioInputs.length > 0 ? (
          <select
            id="mic-select"
            onChange={(e) => onMicrophoneChange(e.target.value)}
            className="mic-select"
          >
            {audioInputs.map(device => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Микрофон ${device.deviceId.slice(0, 5)}`}
              </option>
            ))}
          </select>
        ) : (
          <p>Микрофоны не найдены</p>
        )}
      </div>
    </div>
  );
}

SettingsPanel.propTypes = {
  audioInputs: PropTypes.arrayOf(
    PropTypes.shape({
      deviceId: PropTypes.string.isRequired,
      label: PropTypes.string
    })
  ),
  onMicrophoneChange: PropTypes.func.isRequired
};

SettingsPanel.defaultProps = {
  audioInputs: []
};

export default SettingsPanel;