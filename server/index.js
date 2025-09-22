const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // или твой фронтенд-порт
    methods: ["GET", "POST"]
  }
});

// Пользователи
const users = [
  { id: 'alex', username: 'Алексей', password: 'pass1' },
  { id: 'maria', username: 'Мария', password: 'pass2' },
  { id: 'john', username: 'Джон', password: 'pass3' },
];

// Онлайн пользователи: { userId: socketId }
const onlineUsers = {};

// API: список пользователей
app.get('/api/users', (req, res) => {
  res.json(users);
});

// API: вход по ID
app.post('/api/login', (req, res) => {
  const { userId } = req.body;
  const user = users.find(u => u.id === userId);
  
  if (user) {
    res.json({ success: true, user });
  } else {
    res.status(401).json({ success: false, message: 'User not found' });
  }
});

io.on('connection', (socket) => {
  console.log('✅ Новое подключение:', socket.id);

  // Авторизация по ID
  socket.on('user_online', (userId) => {
    const userExists = users.find(u => u.id === userId);
    
    if (userExists) {
      onlineUsers[userId] = socket.id;
      socket.userId = userId;
      console.log(`🟢 ${userId} вошёл в систему`);
      socket.emit('auth:success', { user: userExists });
    } else {
      console.log(`❌ Неверный ID: ${userId}`);
      socket.emit('auth:failed', { message: 'Invalid user ID' });
    }
  });

  // ★★★ ИСПРАВЛЕНО: call:start теперь принимает offer и передаёт его получателю ★★★
  socket.on('call:start', (data) => {
    const callerId = socket.userId;
    const targetId = data.targetUserId;
    const offer = data.offer; // ✅ Получаем offer от клиента

    if (!callerId) {
      return socket.emit('call:failed', { reason: 'not_authenticated' });
    }

    console.log(`📞 ${callerId} звонит ${targetId}`);

    const targetSocketId = onlineUsers[targetId];

    if (targetSocketId) {
      // ✅ Передаём offer вместе с вызовом!
      io.to(targetSocketId).emit('call:incoming', {
        from: callerId,
        fromUsername: users.find(u => u.id === callerId)?.username || callerId,
        offer: offer // ← вот оно, счастье!
      });

      socket.emit('call:initiated', { targetUserId: targetId });
    } else {
      socket.emit('call:failed', { reason: 'user_offline' });
    }
  });

  // WebRTC: ретрансляция offer/answer/candidate
  socket.on('webrtc:offer', (data) => {
    const targetSocketId = onlineUsers[data.to];
    if (targetSocketId && socket.userId) {
      io.to(targetSocketId).emit('webrtc:offer', {
        offer: data.offer,
        from: socket.userId
      });
    }
  });

  socket.on('webrtc:answer', (data) => {
    const targetSocketId = onlineUsers[data.to];
    if (targetSocketId && socket.userId) {
      io.to(targetSocketId).emit('webrtc:answer', {
        answer: data.answer,
        from: socket.userId
      });
    }
  });

  socket.on('webrtc:ice-candidate', (data) => {
    const targetSocketId = onlineUsers[data.to];
    if (targetSocketId && socket.userId) {
      io.to(targetSocketId).emit('webrtc:ice-candidate', {
        candidate: data.candidate,
        from: socket.userId
      });
    }
  });

  // Принять вызов
  socket.on('call:accept', (data) => {
    const callerSocketId = onlineUsers[data.from];
    if (callerSocketId) {
      io.to(callerSocketId).emit('call:accepted', { from: socket.userId });
    }
  });

  // Отклонить вызов
  socket.on('call:reject', (data) => {
    const callerSocketId = onlineUsers[data.from];
    if (callerSocketId) {
      io.to(callerSocketId).emit('call:rejected', { from: socket.userId });
    }
  });

  // Отключение
  socket.on('disconnect', () => {
    if (socket.userId) {
      delete onlineUsers[socket.userId];
      console.log(`🔴 ${socket.userId} отключился`);
    }
  });
});

const PORT = 8080;
server.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
  console.log('👥 Доступные пользователи:', users.map(u => u.id));
});