// client/src/services/webrtcService.js

// ❌ УДАЛЕН СИНГЛТОН — каждый звонок получает СВОЙ инстанс WebRTCManager
// let webrtcManager = null;

/**
 * Создаёт НОВЫЙ инстанс WebRTCManager для каждого подключения.
 * Важно: не переиспользуйте инстанс после close()!
 */

import { WebRTCManager } from '../webrtc';

export const createWebRTCManager = (socket, userId) => {
  return new WebRTCManager(socket, userId);
};

/**
 * Сброс не требуется — управление жизненным циклом
 * происходит в компоненте App.jsx через вызов .close()
 */
export const resetWebRTCManager = () => {
  // Пусто. Все инстансы управляются локально в App.jsx.
  // Это предотвращает конфликты при нескольких комнатах.
};