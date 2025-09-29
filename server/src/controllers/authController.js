// server/src/controllers/authController.js
const userService = require('../services/userService');
const bcrypt = require('bcrypt');

const register = async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password || username.length < 3 || password.length < 6) {
    return res.status(400).json({ 
      success: false, 
      message: 'Имя от 3 символов, пароль от 6' 
    });
  }

  try {
    const existingUser = await userService.findByUsername(username);
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Имя занято' });
    }

    const user = await userService.createUser(username, password);
    res.json({ success: true, user });
  } catch (error) {
    console.error('Ошибка регистрации:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

const login = async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const user = await userService.findByUsername(username);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Пользователь не найден' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Неверный пароль' });
    }

    res.json({ success: true, user: { id: user.id, username: user.username } });
  } catch (error) {
    console.error('Ошибка входа:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

// Новый эндпоинт для проверки онлайн-статуса
const checkUserOnline = async (req, res) => {
  const { query } = req.query;
  
  try {
    let user = await userService.findByUsername(query);
    if (!user) {
      user = await userService.findById(query);
    }
    
    if (!user) {
      return res.status(404).json({ isOnline: false });
    }
    
    // onlineUsers будет передан из server.js
    const onlineUsers = req.app.get('onlineUsers');
    const isOnline = onlineUsers[user.id] !== undefined;
    res.json({ isOnline, userId: user.id });
  } catch (error) {
    console.error('Ошибка проверки онлайн:', error);
    res.status(500).json({ isOnline: false });
  }
};

module.exports = { register, login, checkUserOnline };