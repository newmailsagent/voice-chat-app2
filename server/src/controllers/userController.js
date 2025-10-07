// server/src/controllers/userController.js
const db = require('../db/database');

const getAllUsers = (req, res) => {
  // Исключаем пароли!
  db.all('SELECT id, username FROM users ORDER BY username', (err, rows) => {
    if (err) {
      console.error('Ошибка получения списка пользователей:', err);
      return res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
    res.json({ success: true, users: rows });
  });
};

module.exports = { getAllUsers };