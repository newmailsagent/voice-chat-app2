// client/src/components/call/CallModal.jsx

import React, { useState, useEffect, useRef } from 'react';

export default function CallModal({
  room,
  localStream,
  remoteStream,
  isMicrophoneMuted,
  audioInputs,
  onConnect,
  onToggleMicrophone,
  onClose,
  onMicrophoneChange
}) {
  // Защита от некорректных данных
  if (!room || !room.targetName) {
    console.warn('CallModal: room is invalid', room);
    return null;
  }

  const modalRef = useRef(null);
  const [position, setPosition] = useState({ x: window.innerWidth / 2 - 150, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Обработчик начала перетаскивания
  const handleMouseDown = (e) => {
    if (e.target.closest('.call-modal-header')) {
      const rect = modalRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsDragging(true);
    }
    if (e.target.classList.contains('modal-close')) {
      return;
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  // Состояние для отображения аудио
  const isConnected = room.status === 'connected';

  return (
    <div
      ref={modalRef}
      className="call-modal"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        cursor: isDragging ? 'grabbing' : 'default'
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="call-modal-header">
        <span>Комната: {room.targetName}</span>
        <button className="modal-close" onClick={onClose} aria-label="Закрыть">
          &times;
        </button>
      </div>

      <div className="call-modal-body">
        {/* Статус комнаты */}
        <div className="room-status">
          {room.status === 'waiting' && (
            <div className="status-text waiting">Ожидание подключения...</div>
          )}
          {room.status === 'connecting' && (
            <div className="status-text connecting">Подключение...</div>
          )}
          {isConnected && (
            <div className="status-text connected">✅ В звонке</div>
          )}
        </div>

        {/* Управление микрофоном (только в звонке) */}
        {isConnected && (
          <div className="mic-controls">
            <button
              className={`mic-btn ${isMicrophoneMuted ? 'muted' : 'active'}`}
              onClick={onToggleMicrophone}
            >
              {isMicrophoneMuted ? '🔇' : '🎤'}
            </button>

            {audioInputs.length > 0 && (
              <select
                className="mic-select"
                onChange={(e) => onMicrophoneChange(e.target.value)}
                value={localStream?.getAudioTracks()[0]?.getSettings()?.deviceId || ''}
              >
                {audioInputs.map(device => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Микрофон ${device.deviceId.slice(0, 5)}`}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Аудио собеседника */}
        {isConnected && remoteStream && (
          <audio
            ref={audio => { if (audio) audio.srcObject = remoteStream; }}
            autoPlay
            playsInline
            className="remote-audio"
          />
        )}
      </div>

      <div className="call-modal-footer">
  {room.status === 'waiting' ? (
    <button className="call-modal-btn call-modal-btn--success" onClick={onConnect}>
      🔌 Подключиться
    </button>
  ) : room.status === 'connected' ? (
    <>
      <button className="call-modal-btn call-modal-btn--danger" onClick={onDisconnect}>
        📵 Отключиться
      </button>
      <button className="call-modal-btn call-modal-btn--secondary" onClick={onClose}>
        ✖ Закрыть комнату
      </button>
    </>
  ) : null}
</div>
    </div>
  );
}