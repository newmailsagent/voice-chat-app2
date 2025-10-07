// server/src/routes/contactRoutes.js
const express = require('express');
const { addContact, getContacts } = require('../controllers/contactController');

const router = express.Router();

// POST /api/contacts — добавить контакт
router.post('/', addContact);

// GET /api/contacts/:userId — получить контакты пользователя
router.get('/:userId', getContacts);

module.exports = router;