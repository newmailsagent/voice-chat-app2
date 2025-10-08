// server/src/sockets/socketHandler.js
const userService = require('../services/userService');

const setupSocketHandlers = (io, onlineUsers) => {
  io.on('connection', (socket) => {
    console.log('✅ Новое подключение:', socket.id);

    socket.on('user_online', async (userId) => {
      try {
        const user = await userService.findById(userId);
        if (user) {
          onlineUsers[userId] = socket;
          socket.userId = userId;
          socket.broadcast.emit('user_status_change', { userId, isOnline: true });
          socket.emit('auth:success', { user: { id: userId, username: user.username } });
        } else {
          socket.emit('auth:failed', { message: 'Invalid user ID' });
        }
      } catch (error) {
        console.error('Ошибка авторизации:', error);
        socket.emit('auth:failed', { message: 'Ошибка сервера' });
      }
    });

    socket.on('user_offline', () => {
      if (socket.userId) {
        const userId = socket.userId;
        delete onlineUsers[userId];
        console.log(`🔴 ${userId} вышел`);
        socket.broadcast.emit('user_status_change', { userId, isOnline: false });
      }
    });

    // === НОВАЯ ЛОГИКА: КОМНАТЫ ===
    socket.on('room:create', (data) => {
      const { roomId, targetId, initiatorId, initiatorName } = data;
      
      if (!socket.userId || socket.userId !== initiatorId) {
        return;
      }

      const targetSocket = onlineUsers[targetId];
      if (targetSocket) {
        // Отправляем событие целевому пользователю
        targetSocket.emit('room:create', {
          roomId,
          initiatorId,
          initiatorName
        });
      } else {
        // Если пользователь оффлайн — уведомляем инициатора
        socket.emit('room:create:failed', { roomId, reason: 'user_offline' });
      }
    });

    socket.on('room:close', (data) => {
      const { roomId, userId } = data;
      // Просто логируем — клиенты сами управляют комнатами
      console.log(`Комната ${roomId} закрыта пользователем ${userId}`);
    });

    // === WebRTC ретрансляция (без привязки к комнатам) ===
    socket.on('webrtc:offer', (data) => {
      const { to, offer } = data;
      const targetSocket = onlineUsers[to];
      if (targetSocket && socket.userId) {
        targetSocket.emit('webrtc:offer', { 
          roomId: data.roomId, 
          offer, 
          from: socket.userId 
        });
      }
    });

    socket.on('webrtc:answer', (data) => {
      const { to, answer } = data;
      const targetSocket = onlineUsers[to];
      if (targetSocket && socket.userId) {
        targetSocket.emit('webrtc:answer', { 
          roomId: data.roomId, 
          answer, 
          from: socket.userId 
        });
      }
    });

    socket.on('webrtc:ice-candidate', (data) => {
      const { to, candidate } = data;
      const targetSocket = onlineUsers[to];
      if (targetSocket && socket.userId) {
        targetSocket.emit('webrtc:ice-candidate', { 
          candidate, 
          from: socket.userId 
        });
      }
    });

    socket.on('disconnect', () => {
      if (socket.userId) {
        const userId = socket.userId;
        delete onlineUsers[userId];
        console.log(`🔴 ${userId} отключился`);
        io.emit('user_status_change', { userId, isOnline: false });
      }
    });
  });
};

module.exports = setupSocketHandlers;