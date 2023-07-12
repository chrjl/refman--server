const debug = require('debug')('app:routes/v1/items');

const express = require('express');
const router = express.Router();

router.get('/', (req, res) => res.send('hello /v1/items router'));

module.exports = router;
debug('exported /v1/items route');
