// client/src/services/socketService.js
import { io } from 'socket.io-client';

// 🔥 УБРАНЫ ЛИШНИЕ ПРОБЕЛЫ В URL!
const SOCKET_URL = 'https://pobesedka.ru';

export const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'], // ← разрешить fallback на polling
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 10000,
  withCredentials: true // ← важно для CORS + credentials
});

// Авторизация после подключения (включая переподключение)
socket.on('connect', () => {
  console.log('✅ WebSocket подключён');
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  if (currentUser?.id) {
    socket.emit('user_online', currentUser.id);
  }
});

// Обработка ошибок подключения
socket.on('connect_error', (err) => {
  console.error('❌ Ошибка WebSocket подключения:', err.message);
});

socket.on('disconnect', () => {
  console.log('🔌 WebSocket отключён');
});