const express = require('express');
const createHttpError = require('http-errors');
const getMetadata = require('metadata-scraper');

const debug = require('debug')('app:routes/metadata-scraper');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    if (!req.query.url) throw createHttpError(400);

    const metadata = await getMetadata(req.query.url);
    res.json(metadata);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
debug('exported metadata route');
