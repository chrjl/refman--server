const express = require('express');
const debug = require('debug')('app:routes/v0');

const router = express.Router();

const itemsApi = require('./json-storage-api');
const oas = require('./oas');

const oasFilename = 'refman--server-v0.openapi.json';

router.route('/').get((req, res) => res.send('hello v0'));

router
  .get('/openapi.json', (req, res) => {
    res
      .setHeader('Content-Disposition', `inline; filename=${oasFilename}`)
      .json(oas);
  })
  .use('/items', itemsApi);

module.exports = router;
debug('exported /v0 route');
