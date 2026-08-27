//pageRoutes.js
const express = require('express');
const router = express.Router();
const path = require('path');

router.get('/test', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'test.html'));
});

router.get('/emotion-test', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'emotion-test.html'));
});


router.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

module.exports = router;

