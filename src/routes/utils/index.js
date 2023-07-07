const express = require('express');
const debug = require('debug')('app:routes/utils')

const router = express.Router();

router.route('/').get((req, res) => res.send('hello utils'))

module.exports = router;
debug('exported utils route')