const express = require('express');
const createHttpError = require('http-errors');
const debug = require('debug')('app:routes/sqlite');
const _ = require('lodash');

const db = require('../db/config');
const queries = require('../db/queries');

const router = express.Router();
router.use(express.json());

router.route('/entries')
  .get(async (req, res) => {
    const query = await queries.getEntries.allHeads();
    res.json(query);
  })
  .post(async (req, res) => {
    const ids = await queries.postEntry(req.body);
    res.status(201).json(ids);
  });

router.route('/dump')
  .get(async (req, res) => {
    const query = await queries.getEntries.dump();
    res.json(query);
  });

router.route('/keywords')
  .get(async (req, res) => {
    res.send(await queries.getKeywords.all());
  });

router.route('/entries/:id')
  .get(async (req, res) => {
    const entry = await queries.getEntries.byId(req.params.id);
    res.send(_.pickBy(entry));
  })
  .delete(async (req, res) => {
    const { id } = req.params;

    await queries.deleteEntry(id);

    res.status(204).end();
  });

router.route('/keywords/prune')
  .delete(async (req, res) => {
    await queries.deleteKeywords.prune();
    res.status(204).end();
  });

router.route('/keywords/rename')
  .patch(async (req, res) => {
    const { from, to } = req.query;

    if ([from, to].includes(undefined)) {
      res.status(400).send('Missing query field ("from", "to")');
      return false;
    }

    const updateCount = await queries.updateKeyword(from, to);

    const statusCode = updateCount ? 200 : 204;
    res.status(statusCode).end();
  });

router.route('/keywords/:entryId')
  .get(async (req, res) => {
    const entry = await queries.getKeywords.byEntryId(req.params.entryId);
    res.send(entry);
  })
  .delete(async (req, res) => {
    if (_.isEmpty(req.query)) {
      await queries.deleteKeywords.byEntryId(req.params.entryId);
    } else {
      // generate array of keywords
      const keywords = _.compact(_.concat(req.query.keyword));

      await queries.deleteKeywords.byKeyword(req.params.entryId, keywords);
    }

    res.status(204).end();
  })
  .patch(async (req, res) => {
    const keywords = req.query.keyword;
    debug(keywords);

    if (keywords === undefined) {
      res.status(400).send('no keywords received');
    } else {
      const query = await queries.postKeywords(req.params.entryId, _.concat(keywords));

      const statusCode = !query ? 204 : 201;
      res.status(statusCode).end();
    }
  });

router.route('/search')
  .get(async (req, res) => {
    if (_.isEmpty(req.query)) {
      res.send('supported search fields: keywords, author');
      return;
    }

    const query = {};

    if (req.query.keyword) {
      query.keywords = await queries.getEntries.byKeyword(req.query.keyword);
    }

    if (req.query.author) {
      query.author = await queries.getEntries.byAuthorSearch(req.query.author);
    }

    res.send(_.compact(_.concat(query.keywords, query.author)));
  });

module.exports = router;
