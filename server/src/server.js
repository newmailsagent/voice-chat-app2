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
  origin: ['https://pobesedka.ru'],
  credentials: true
}));
app.use(express.json());

// Хранилище онлайн-пользователей
const onlineUsers = {};
app.set('onlineUsers', onlineUsers);

// API routes
app.use('/api/auth', authRoutes);

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: "https://pobesedka.ru",
    methods: ["GET", "POST"],
    credentials: true
  }
});

setupSocketHandlers(io, onlineUsers);

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});