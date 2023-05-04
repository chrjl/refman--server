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
  .get(async (req, res, next) => {
    let query;

    if (_.isEmpty(req.query)) {
      // query = await q.getAllEntries();
      query = await q.dump();
    } else if (req.query.id) {
      query = await q.getEntriesById(req.query.id);
    } else {
      return next(createHttpError(400, 'bad query'));
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
  })
  .put(async (req, res) => {
    const { keywords, ...entry } = req.body;

    const trx = await knex.transaction();
    const queries = new Transaction(trx);

    // update entry
    const didUpdate = await queries.overwriteEntry(req.params.id, entry);

    // diff keywords
    const previousKeywords = await queries.getKeywordsByEntryId(req.params.id);
    const extraneousKeywords = _.difference(previousKeywords, keywords);

    // update keywords
    await queries.deleteKeywordsFromEntry(req.params.id, extraneousKeywords);
    await queries.insertKeywords(req.params.id, keywords);

    await trx.commit();

    if (didUpdate === 0) {
      res.status(404).end();
    } else {
      res.status(200).end();
    }
  })
  .patch(async (req, res, next) => {
    if (_.isEmpty(req.query)) {
      return next(createHttpError(400, 'no update query received'));
    }

    if (_.isEmpty(await q.getEntriesById(req.params.id))) {
      return next(createHttpError(404));
    }

    // replace empty query values with null (to delete)
    const entry = _.mapValues(req.query, (value) => value || null);

    if (entry.author) {
      entry.author = _.concat(entry.author);
    }

    const trx = await knex.transaction();
    const queries = new Transaction(trx);

    await queries.updateEntryFields(req.params.id, entry);

    await trx.commit();

    res.status(200).end();
  });

router.route('/entries/:id/keywords')
  .get(async (req, res) => {
    const entry = await q.getKeywordsByEntryId(req.params.id);
    res.send(entry);
  })
  .delete(async (req, res, next) => {
    if (_.isEmpty(req.query)) {
      await q.deleteAllKeywordsFromEntry(req.params.id);
    } else if (_.isEmpty(req.query.keyword)) {
      return next(createHttpError(400, 'no keywords received'));
    } else {
      // generate array of keywords
      const keywords = _.compact(_.concat(req.query.keyword));

      await q.deleteKeywordsFromEntry(req.params.id, keywords);
    }

    res.status(204).end();
  })
  .patch(async (req, res, next) => {
    const keywords = req.query.keyword;

    if (_.isEmpty(keywords)) {
      return next(createHttpError(400, 'no usable keywords received'));
    }

    const query = await q.insertKeywords(req.params.id, _.concat(keywords));

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

    const trx = await knex.transaction();
    const queries = new Transaction(trx);

  const updateCount = await queries.renameKeyword(from, to);
    
  trx.commit();
    
    const statusCode = updateCount ? 200 : 204;
    res.status(statusCode).end();
  });

module.exports = router;
