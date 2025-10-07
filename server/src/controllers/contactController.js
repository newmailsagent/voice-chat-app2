// server/src/controllers/contactController.js
const db = require('../db/database');

// Вспомогательная функция: генерация цвета из строки (для аватарки)
function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xFF;
    color += ('00' + value.toString(16)).slice(-2);
  }
  return color;
}

// Добавить контакт
const addContact = (req, res) => {
  const { userId, contactId } = req.body;

  // Валидация
  if (!userId || !contactId) {
    return res.status(400).json({ success: false, message: 'userId и contactId обязательны' });
  }

  if (userId === contactId) {
    return res.status(400).json({ success: false, message: 'Нельзя добавить себя в контакты' });
  }

  // Проверяем, существует ли contactId в таблице users
  db.get('SELECT id FROM users WHERE id = ?', [contactId], (err, row) => {
    if (err) {
      console.error('Ошибка проверки пользователя:', err);
      return res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }

    if (!row) {
      return res.status(404).json({ success: false, message: 'Пользователь не найден' });
    }

    // Добавляем в контакты (IGNORE — если уже есть, не будет ошибки)
    db.run(
      'INSERT OR IGNORE INTO contacts (user_id, contact_id) VALUES (?, ?)',
      [userId, contactId],
      function (err) {
        if (err) {
          console.error('Ошибка добавления контакта:', err);
          return res.status(500).json({ success: false, message: 'Ошибка сервера' });
        }
        res.json({ success: true, message: 'Контакт добавлен' });
      }
    );
  });
};

// Получить список контактов с онлайн-статусом
const getContacts = (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ success: false, message: 'userId обязателен' });
  }

  // Получаем онлайн-пользователей из памяти (как у тебя в server.js)
  const onlineUsers = req.app.get('onlineUsers') || {};

  // Запрашиваем контакты из БД
  const query = `
    SELECT u.id, u.username
    FROM contacts c
    JOIN users u ON c.contact_id = u.id
    WHERE c.user_id = ?
  `;

  db.all(query, [userId], (err, rows) => {
    if (err) {
      console.error('Ошибка получения контактов:', err);
      return res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }

    // Добавляем онлайн-статус и цвет аватарки
    const contacts = rows.map(contact => ({
      id: contact.id,
      username: contact.username,
      isOnline: !!onlineUsers[contact.id],
      avatarColor: stringToColor(contact.username)
    }));

    res.json({ success: true, contacts });
  });
};

module.exports = { addContact, getContacts };