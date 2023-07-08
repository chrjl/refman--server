const { URL } = require('url');
const express = require('express');
const createHttpError = require('http-errors');
const debug = require('debug')('app:utils/metadata');

const getMetaData = require('metadata-scraper');

const router = express.Router();

/**
 * @openapi
 * /metadata:
 *   get:
 *     description: Scrape and parse metadata from URL using `BetaHuhn/metadata-scraper`.
 *     parameters:
 *       - in: query
 *         name: url
 *         schema:
 *           type: string
 *         required: true
 *         description: (URI encoded) path to page to scrape.
 *         example: https://developer.mozilla.org/en-US/docs/Web/JavaScript
 *       - in: query
 *         name: fields
 *         schema:
 *           type: string
 *         description: Comma-separated list of requested entry fields.
 *         examples:
 *           no query (request all fields):
 *             value:
 *           request a subset of fields:
 *             value: title,author,url
 *
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */

router
  .all('*', (req, res, next) => {
    if (req.query.url === undefined) {
      return next(createHttpError(400, 'missing "url" query parameter'));
    }

    debug(req.query.url);

    try {
      // throw error if an invalid URL was submitted
      new URL(req.query.url);
    } catch (err) {
      if (err.code === 'ERR_INVALID_URL') {
        return next(createHttpError(400, err.code));
      }

      throw err;
    }

    res.locals.url = req.query.url;
    next();
  })
  .get('/', async (req, res, next) => {
    try {
      const data = await getMetaData(res.locals.url);

      data.entrysubtype = data.type;
      delete data.type;

      data.publisher = [data.provider];
      delete data.provider;

      data.date = data.published;
      delete data.published;

      data.author = [data.author];

      if (req.query.fields) {
        // filter data to requested subset of fields

        const fields = req.query.fields.split(',').map((field) => field.trim());
        const filteredData = fields.reduce(
          (obj, field) => ({ ...obj, [field]: data[field] }),
          {}
        );

        return res.json(filteredData);
      }

      res.json(data);
    } catch (err) {
      return next(createHttpError(500, err.message));
    }
  });

module.exports = router;
