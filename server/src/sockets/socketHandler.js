// server/src/sockets/socketHandler.js
const userService = require('../services/userService');

const setupSocketHandlers = (io, onlineUsers) => {
  io.on('connection', (socket) => {
    console.log('✅ Новое подключение:', socket.id);

    socket.on('user_online', async (userId) => {
      try {
        const user = await userService.findById(userId);
        if (user) {
          // Добавляем в онлайн
          onlineUsers[userId] = socket;
          socket.userId = userId;

          // Уведомляем ВСЕХ (кроме себя) о том, что пользователь онлайн
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
        // Уведомляем ВСЕХ (кроме себя) о том, что пользователь оффлайн
        socket.broadcast.emit('user_status_change', { userId, isOnline: false });
      }
    });

    socket.on('call:end', (data) => {
      const targetSocket = onlineUsers[data.target];
      if (targetSocket) {
        targetSocket.emit('call:end');
      }
    });

    socket.on('call:start', async (data) => {
      const callerId = socket.userId;
      const targetId = data.targetUserId;
      const offer = data.offer;

      if (!callerId) {
        return socket.emit('call:failed', { reason: 'not_authenticated' });
      }

      try {
        const targetUser = await userService.findById(targetId);
        if (!targetUser) {
          return socket.emit('call:failed', { reason: 'user_not_found' });
        }

        const targetSocket = onlineUsers[targetId];
        if (targetSocket) {
          targetSocket.emit('call:incoming', {
            from: callerId,
            fromUsername: targetUser.username,
            offer
          });
          socket.emit('call:initiated', { targetUserId: targetId });
        } else {
          socket.emit('call:failed', { reason: 'user_offline' });
        }
      } catch (error) {
        console.error('❌ Ошибка звонка:', error);
        socket.emit('call:failed', { reason: 'server_error' });
      }
    });

    // WebRTC ретрансляция
    socket.on('webrtc:offer', (data) => {
      const targetSocket = onlineUsers[data.to];
      if (targetSocket && socket.userId) {
        targetSocket.emit('webrtc:offer', { offer: data.offer, from: socket.userId });
      }
    });

    socket.on('webrtc:answer', (data) => {
      const targetSocket = onlineUsers[data.to];
      if (targetSocket && socket.userId) {
        targetSocket.emit('webrtc:answer', { answer: data.answer, from: socket.userId });
      }
    });

    socket.on('webrtc:ice-candidate', (data) => {
      const targetSocket = onlineUsers[data.to];
      if (targetSocket && socket.userId) {
        targetSocket.emit('webrtc:ice-candidate', { candidate: data.candidate, from: socket.userId });
      }
    });

    socket.on('call:accept', (data) => {
      const callerSocket = onlineUsers[data.from];
      if (callerSocket) {
        callerSocket.emit('call:accepted', { from: socket.userId });
      }
    });

    socket.on('call:reject', (data) => {
      const callerSocket = onlineUsers[data.from];
      if (callerSocket) {
        callerSocket.emit('call:rejected', { from: socket.userId });
      }
    });

    socket.on('disconnect', () => {
      if (socket.userId) {
        const userId = socket.userId;
        delete onlineUsers[userId];
        console.log(`🔴 ${userId} отключился`);
        // Уведомляем ВСЕХ о том, что пользователь оффлайн
        io.emit('user_status_change', { userId, isOnline: false });
      }
    });
  });
};

module.exports = setupSocketHandlers;