const _ = require('lodash');
const express = require('express');
const createHttpError = require('http-errors');
const debug = require('debug')('app:routes/sqlite');

const { Transaction } = require('../db/queries');
const knex = require('../db/config');

const q = new Transaction(knex);

const router = express.Router();
router.use(express.json());

router.route('/entries')
  .get(async (req, res) => {
    let query;

    if (_.isEmpty(req.query)) {
      // query = await q.getAllEntries();
      query = await q.dump();
    } else {
      query = await q.getEntriesById(req.query.id);
    }

    res.json(query);
  })
  .post(async (req, res) => {
    const entries = _.concat(req.body);
    const ids = [];

    await Promise.all(entries.map(async (entry) => {
      const trx = await knex.transaction();
      const queries = new Transaction(trx);

      const id = await queries.createEntry(entry);
      await queries.insertKeywords(id, entry.keywords);

      await trx.commit();
      ids.push(id);
    }));

    res.status(201).json(ids);
  });

router.route('/dump')
  .get(async (req, res) => {
    const query = await q.dump();
    res.json(query);
  });

router.route('/keywords')
  .get(async (req, res) => {
    res.send(await q.getAllKeywords());
  });

router.route('/entries/:id')
  .get(async (req, res, next) => {
    const entry = await q.getEntriesById(req.params.id);

    if (_.isEmpty(entry)) {
      return next(createHttpError(404));
    }

    res.send(_.head(entry));
  })
  .delete(async (req, res) => {
    await q.deleteEntries(req.params.id);
    res.status(204).end();
  });

router.route('/keywords/prune')
  .delete(async (req, res) => {
    await q.pruneKeywords();
    res.status(204).end();
  });

router.route('/keywords/rename')
  .patch(async (req, res, next) => {
    const { from, to } = req.query;

    if ([from, to].includes(undefined)) {
      return next(createHttpError(400, 'Missing query field ("from", "to")'));
    }

    const updateCount = await q.renameKeyword(from, to);

    const statusCode = updateCount ? 200 : 204;
    res.status(statusCode).end();
  });

router.route('/keywords/:entryId')
  .get(async (req, res) => {
    const entry = await q.getKeywordsByEntryId(req.params.entryId);
    res.send(entry);
  })
  .delete(async (req, res, next) => {
    if (_.isEmpty(req.query)) {
      await q.deleteAllKeywordsFromEntry(req.params.entryId);
    } else if (_.isEmpty(req.query.keyword)) {
      return next(createHttpError(400, 'no keywords received'));
    } else {
      // generate array of keywords
      const keywords = _.compact(_.concat(req.query.keyword));

      await q.deleteKeywordsFromEntry(req.params.entryId, keywords);
    }

    res.status(204).end();
  })
  .patch(async (req, res, next) => {
    const keywords = req.query.keyword;

    if (_.isEmpty(keywords)) {
      return next(createHttpError(400, 'no usable keywords received'));
    }

    const query = await q.insertKeywords(req.params.entryId, _.concat(keywords));

    const statusCode = query ? 201 : 204;
    res.status(statusCode).end();
  });

router.route('/search')
  .get(async (req, res) => {
    if (_.isEmpty(req.query)) {
      res.status(400).send('no search query submitted');
      return;
    }

    const query = {};

    if (req.query.keyword) {
      query.keywords = await q.getEntriesByKeyword(req.query.keyword);
    }

    if (req.query.author) {
      query.author = await q.getEntriesByAuthor(req.query.author);
    }

    res.send(_.compact(_.concat(query.keywords, query.author)));
  });

module.exports = router;
