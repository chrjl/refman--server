const express = require('express');
const debug = require('debug')('app:routes/utils');

const router = express.Router();

const apiDocs = require('./api-docs');
const metadata = require('./metadata');
const oas = require('./oas');

const oasFilename = 'refman--server-utils.oas3.json';

router.route('/').get((req, res) => res.send('hello utils'));

router
  .get('/oas3.json', (req, res) => {
    res
      .setHeader('Content-Disposition', `inline; filename=${oasFilename}`)
      .json(oas);
  })
  .use('/api-docs', apiDocs)
  .use('/metadata', metadata);

module.exports = router;
debug('exported /utils route');
