const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcrypt');

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: ['https://pobesedka.ru'],
  credentials: true
}));
app.use(express.json());

const SALT_ROUNDS = 10;

// Пользователи (в реальном проекте — база данных)
let users = [
  { id: 'alex', username: 'Алексей', passwordHash: bcrypt.hashSync('pass1', SALT_ROUNDS) },
  { id: 'maria', username: 'Мария', passwordHash: bcrypt.hashSync('pass2', SALT_ROUNDS) },
  { id: 'john', username: 'Джон', passwordHash: bcrypt.hashSync('pass3', SALT_ROUNDS) },
];

// Онлайн пользователи: { userId: socket }
const onlineUsers = {};

// Генерация уникального ID
const generateUserId = () => {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
};

// API: регистрация
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password || username.length < 3 || password.length < 6) {
    return res.status(400).json({ 
      success: false, 
      message: 'Имя должно быть от 3 символов, пароль от 6' 
    });
  }

  // Проверяем уникальность username
  const existingUser = users.find(u => u.username === username);
  if (existingUser) {
    return res.status(409).json({ 
      success: false, 
      message: 'Имя уже занято' 
    });
  }

  const userId = generateUserId();
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  
  const newUser = { id: userId, username, passwordHash };
  users.push(newUser);
  
  res.json({ 
    success: true, 
    message: 'Регистрация успешна',
    user: { id: userId, username }
  });
});

// API: вход по username и паролю
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  const user = users.find(u => u.username === username);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Пользователь не найден' });
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    return res.status(401).json({ success: false, message: 'Неверный пароль' });
  }

  res.json({ 
    success: true, 
    user: { id: user.id, username: user.username } 
  });
});

// API: проверка онлайн-статуса
app.get('/api/user/:id/online', (req, res) => {
  const { id } = req.params;
  const isOnline = onlineUsers[id] !== undefined;
  res.json({ isOnline });
});

const io = new Server(server, {
  cors: {
    origin: "https://pobesedka.ru",
    methods: ["GET", "POST"],
    credentials: true
  }
});

io.on('connection', (socket) => {
  console.log('✅ Новое подключение:', socket.id);

  // Авторизация по ID
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

  // Обработка окончания звонка
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