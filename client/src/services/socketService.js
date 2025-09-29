// client/src/services/socketService.js
import { io } from 'socket.io-client';

const SOCKET_URL = 'https://pobesedka.ru';

export const socket = io(SOCKET_URL, {
  transports: ['websocket'],
  secure: true
});

// Авторизация после переподключения
socket.on('connect', () => {
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  if (currentUser) {
    socket.emit('user_online', currentUser.id);
  }
});