const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: ['https://pobesedka.ru'],
  credentials: true
}));

app.use(express.json());

// Секретный ключ для JWT (в продакшене — из .env)
const JWT_SECRET = 'your_strong_secret_key_here_change_in_production';

// "База данных" пользователей (в реальном проекте — PostgreSQL/MongoDB)
let users = [
  { id: '1', username: 'Алексей', email: 'alex@example.com', passwordHash: '$2b$10$XqYqJ5V5q5q5q5q5q5q5q5q5q5q5q5q5q5q5q5q5q5q5q5q5q' }, // pass1
  { id: '2', username: 'Мария', email: 'maria@example.com', passwordHash: '$2b$10$XqYqJ5V5q5q5q5q5q5q5q5q5q5q5q5q5q5q5q5q5q5q5q5q5q' }, // pass2
  { id: '3', username: 'Джон', email: 'john@example.com', passwordHash: '$2b$10$XqYqJ5V5q5q5q5q5q5q5q5q5q5q5q5q5q5q5q5q5q5q5q5q5q' }  // pass3
];

// Хешируем пароли один раз (для демо)
// В реальном проекте — при регистрации
if (!users[0].passwordHash) {
  users = users.map(u => ({
    ...u,
    passwordHash: bcrypt.hashSync(u.password, 10)
  }));
}

// Онлайн пользователи: { userId: socket }
const onlineUsers = {};

// Middleware для проверки JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.sendStatus(401);
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Роут: вход по email и паролю
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  
  const user = users.find(u => u.email === email);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Пользователь не найден' });
  }
  
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    return res.status(401).json({ success: false, message: 'Неверный пароль' });
  }
  
  // Создаём JWT токен
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
  
  res.json({ 
    success: true, 
    user: { id: user.id, username: user.username, email: user.email },
    token 
  });
});

// Роут: получить всех пользователей (только для авторизованных)
app.get('/api/users', authenticateToken, (req, res) => {
  // Возвращаем пользователей без паролей
  const safeUsers = users.map(u => ({ id: u.id, username: u.username, email: u.email }));
  res.json(safeUsers);
});

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: "https://pobesedka.ru",
    methods: ["GET", "POST"],
    credentials: true
  }
});

io.on('connection', (socket) => {
  console.log('✅ Новое подключение:', socket.id);

  // Авторизация через JWT
  socket.on('auth', (token) => {
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        socket.emit('auth:failed', { message: 'Неверный токен' });
        return;
      }
      
      onlineUsers[user.id] = socket;
      socket.userId = user.id;
      socket.user = user;
      
      console.log(`🟢 ${user.username} вошёл в систему`);
      socket.emit('auth:success', { user });
    });
  });

  // Звонок
  socket.on('call:start', (data) => {
    const caller = socket.user;
    const targetId = data.targetUserId;
    const offer = data.offer;

    if (!caller) {
      return socket.emit('call:failed', { reason: 'not_authenticated' });
    }

    const targetSocket = onlineUsers[targetId];
    if (targetSocket) {
      targetSocket.emit('call:incoming', {
        from: caller.id,
        fromUsername: caller.username,
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
    if (targetSocket) {
      targetSocket.emit('webrtc:offer', { offer: data.offer, from: socket.userId });
    }
  });

  socket.on('webrtc:answer', (data) => {
    const targetSocket = onlineUsers[data.to];
    if (targetSocket) {
      targetSocket.emit('webrtc:answer', { answer: data.answer, from: socket.userId });
    }
  });

  socket.on('webrtc:ice-candidate', (data) => {
    const targetSocket = onlineUsers[data.to];
    if (targetSocket) {
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

  // Отключение
  socket.on('disconnect', () => {
    if (socket.userId) {
      delete onlineUsers[socket.userId];
      console.log(`🔴 ${socket.user?.username} отключился`);
    }
  });
});

const PORT = 8080;
server.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});