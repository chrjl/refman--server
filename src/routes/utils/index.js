const express = require('express');
const debug = require('debug')('app:routes/utils');

const router = express.Router();

const apiDocs = require('./api-docs');
const metadata = require('./metadata');

router.route('/').get((req, res) => res.send('hello utils'));
router.use('/api-docs', apiDocs);
router.use('/metadata', metadata);

module.exports = router;
debug('exported utils route');
