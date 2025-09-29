// server/src/routes/authRoutes.js
const express = require('express');
const { register, login, checkUserOnline } = require('../controllers/authController');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/user/online', checkUserOnline);

module.exports = router;