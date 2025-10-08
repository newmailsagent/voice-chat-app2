// client/src/components/call/CallModal.jsx

import React, { useState, useEffect, useRef } from 'react';

export default function CallModal({ callWindow, onEndCall, onRetryCall }) {
  const modalRef = useRef(null);
  const [position, setPosition] = useState({ x: window.innerWidth / 2 - 150, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Обработчик начала перетаскивания
  const handleMouseDown = (e) => {
    // Перетаскиваем только за заголовок
    if (e.target.closest('.call-modal-header')) {
      const rect = modalRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsDragging(true);
    }
    // Клик по крестику не должен начинать перетаскивание
    if (e.target.classList.contains('modal-close')) {
      return;
    }
  };

  // Обработчик движения мыши
  const handleMouseMove = (e) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    }
  };

  // Обработчик отпускания мыши
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Подписка на события мыши при перетаскивании
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
        <span>Вызов: {callWindow.targetName}</span>
        <button className="modal-close" onClick={onEndCall} aria-label="Закрыть">
          &times;
        </button>
      </div>

      <div className="call-modal-body">
        {callWindow.status === 'calling' && (
          <div className="call-status calling">📞 Звонок...</div>
        )}
        {callWindow.status === 'offline' && (
          <div className="call-status offline">Пользователь не в сети</div>
        )}
        {callWindow.status === 'missed' && (
          <div className="call-status missed">Вызов не отвечен</div>
        )}
      </div>

      <div className="call-modal-footer">
        {callWindow.status === 'calling' ? (
          <button className="call-modal-btn call-modal-btn--danger" onClick={onEndCall}>
            📵 Сбросить вызов
          </button>
        ) : (
          <button className="call-modal-btn call-modal-btn--success" onClick={onRetryCall}>
            📞 Повторить вызов
          </button>
        )}
      </div>
    </div>
  );
}