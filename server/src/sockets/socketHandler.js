// server/src/sockets/socketHandler.js
const userService = require('../services/userService');

const setupSocketHandlers = (io, onlineUsers) => {
  io.on('connection', (socket) => {
    console.log('✅ Новое подключение:', socket.id);

    socket.on('get_online_users', () => {
      const onlineUserIds = Object.keys(onlineUsers).map(id => parseInt(id));
      socket.emit('online_users_list', onlineUserIds);
    });

    socket.on('user_online', async (userId) => {
      try {
        const user = await userService.findById(userId);
        if (user) {
          onlineUsers[userId] = socket;
          socket.userId = userId;
          io.emit('user_status_change', { userId, isOnline: true });
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
        io.emit('user_status_change', { userId, isOnline: false });
      }
    });

    socket.on('user_status_sync', (data) => {
      const { userId } = data;
      io.emit('user_status_change', { userId, isOnline: true });
    });

    socket.on('room:create', (data) => {
      const { roomId, targetId, initiatorId, initiatorName } = data;
      
      if (!socket.userId || socket.userId !== initiatorId) {
        return;
      }

      // 🔥 Проверяем, что получатель онлайн
      const targetSocket = onlineUsers[targetId];
      if (targetSocket) {
        targetSocket.emit('room:create', {
          roomId,
          initiatorId,
          initiatorName
        });
      } else {
        // 🔥 Отправляем ошибку инициатору
        socket.emit('room:create:failed', { roomId, reason: 'user_offline' });
        // И уведомляем инициатора, что пользователь оффлайн
        socket.emit('user_status_change', { userId: targetId, isOnline: false });
      }
    });

    socket.on('room:close', (data) => {
      const { roomId, userId } = data;
      console.log(`Комната ${roomId} закрыта пользователем ${userId}`);
    });

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

    socket.on('room:disconnect', (data) => {
      const { roomId, userId } = data;
      console.log(`Пользователь ${userId} отключился от комнаты ${roomId}`);
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