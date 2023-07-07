const express = require('express');
const debug = require('debug')('app:routes/utils');

const router = express.Router();

const apiDocs = require('./api-docs');

router.route('/').get((req, res) => res.send('hello utils'));
router.use('/api-docs', apiDocs);

/**
  * @openapi
  * /:
  *   get:
  *     description: hello utils
*/

module.exports = router;
debug('exported utils route');
