// server/src/services/userService.js
const bcrypt = require('bcrypt');
const db = require('../db/database');
const SALT_ROUNDS = 10;

const createUser = (username, password) => {
  return new Promise((resolve, reject) => {
    const userId = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS);
    
    db.run('INSERT INTO users (id, username, passwordHash) VALUES (?, ?, ?)', 
      [userId, username, passwordHash],
      function(err) {
        if (err) reject(err);
        else resolve({ id: userId, username });
      }
    );
  });
};

const findByUsername = (username) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const findById = (id) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

module.exports = { createUser, findByUsername, findById };