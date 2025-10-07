// server/src/server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const setupSocketHandlers = require('./sockets/socketHandler');

const app = express();
const server = http.createServer(app);

// Настройка CORS
app.use(cors({
  origin: 'https://pobesedka.ru',
  credentials: true
}));
app.use(express.json());

// Хранилище онлайн-пользователей
const onlineUsers = {};
app.set('onlineUsers', onlineUsers);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactRoutes);

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: "https://pobesedka.ru",
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
  },
    pingTimeout: 60000,
    pingInterval: 25000
});

setupSocketHandlers(io, onlineUsers);

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});

// Обработчик 404
app.use((req, res, next) => {
  console.log('🔍 404 на путь:', req.method, req.url);
  res.status(404).json({ error: 'Not Found' });
});

// Глобальный обработчик ошибок
app.use((err, req, res, next) => {
  console.error('💥 Глобальная ошибка:', err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});