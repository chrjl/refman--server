const express = require('express');
const debug = require('debug')('app:routes/v0');

const router = express.Router();

const itemsApi = require('./json-storage-api');
const apiDocs = require('./api-docs');

router.route('/').get((req, res) => res.send('hello v0'));
router.use('/api-docs', apiDocs);
router.use('/items', itemsApi);

module.exports = router;
