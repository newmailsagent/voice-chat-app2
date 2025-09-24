const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcrypt'); // ✅ Для хеширования паролей

const app = express();
const server = http.createServer(app);

// ✅ Обнови CORS для продакшена
app.use(cors({
  origin: ['https://pobesedka.ru'], // ← твой домен
  credentials: true
}));
app.use(express.json());

// Установи bcrypt (выполни на сервере: npm install bcrypt)
const SALT_ROUNDS = 10;

// Пользователи с хешированными паролями
const users = [
  { id: 'alex', username: 'Алексей', passwordHash: bcrypt.hashSync('pass1', SALT_ROUNDS) },
  { id: 'maria', username: 'Мария', passwordHash: bcrypt.hashSync('pass2', SALT_ROUNDS) },
  { id: 'john', username: 'Джон', passwordHash: bcrypt.hashSync('pass3', SALT_ROUNDS) },
];

// Онлайн пользователи: { userId: socket }
const onlineUsers = {};

// API: вход по ID и паролю (новый метод)
app.post('/api/login', async (req, res) => {
  const { userId, password } = req.body;
  
  const user = users.find(u => u.id === userId);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Пользователь не найден' });
  }

  // ✅ Проверяем пароль
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    return res.status(401).json({ success: false, message: 'Неверный пароль' });
  }

  // Возвращаем пользователя без пароля
  res.json({ 
    success: true, 
    user: { id: user.id, username: user.username } 
  });
});

// API: список пользователей (без паролей!)
app.get('/api/users', (req, res) => {
  const safeUsers = users.map(u => ({ id: u.id, username: u.username }));
  res.json(safeUsers);
});

const io = new Server(server, {
  cors: {
    origin: "https://pobesedka.ru", // ← твой домен
    methods: ["GET", "POST"],
    credentials: true
  }
});

io.on('connection', (socket) => {
  console.log('✅ Новое подключение:', socket.id);

  // Авторизация по ID (оставляем для совместимости)
  socket.on('user_online', (userId) => {
    const userExists = users.find(u => u.id === userId);
    if (userExists) {
      onlineUsers[userId] = socket;
      socket.userId = userId;
      console.log(`🟢 ${userId} вошёл в систему`);
      socket.emit('auth:success', { user: { id: userId, username: userExists.username } });
    } else {
      socket.emit('auth:failed', { message: 'Invalid user ID' });
    }
  });

  socket.on('user_offline', () => {
  if (socket.userId) {
    delete onlineUsers[socket.userId];
    console.log(`🔴 ${socket.userId} вышел`);
  }
});

  //Обработка окончания звонка
  socket.on('call:end', (data) => {
  const targetSocket = onlineUsers[data.target];
  if (targetSocket) {
    targetSocket.emit('call:end');
  }
});

  // Старт звонка
  socket.on('call:start', (data) => {
    const callerId = socket.userId;
    const targetId = data.targetUserId;
    const offer = data.offer;

    if (!callerId) {
      return socket.emit('call:failed', { reason: 'not_authenticated' });
    }

    console.log(`📞 ${callerId} звонит ${targetId}`);
    const targetSocket = onlineUsers[targetId];

    if (targetSocket) {
      targetSocket.emit('call:incoming', {
        from: callerId,
        fromUsername: users.find(u => u.id === callerId)?.username || callerId,
        offer
      });
      socket.emit('call:initiated', { targetUserId: targetId });
    } else {
      socket.emit('call:failed', { reason: 'user_offline' });
    }
  });

  // WebRTC ретрансляция (без изменений)
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

  // Принять/отклонить вызов
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
      delete onlineUsers[socket.userId];
      console.log(`🔴 ${socket.userId} отключился`);
    }
  });
});

const PORT = 8080;
server.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});