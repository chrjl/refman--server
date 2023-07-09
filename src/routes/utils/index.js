const express = require('express');
const debug = require('debug')('app:routes/utils');

const router = express.Router();

const metadata = require('./metadata');
const oas = require('./oas');

const oasFilename = 'refman--server-utils.openapi.json';

router.route('/').get((req, res) => res.send('hello utils'));

router
  .get('/openapi.json', (req, res) => {
    res
      .setHeader('Content-Disposition', `inline; filename=${oasFilename}`)
      .json(oas);
  })
  .use('/metadata', metadata);

module.exports = router;
debug('exported /utils route');
