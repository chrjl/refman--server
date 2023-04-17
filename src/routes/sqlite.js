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
    const query = await queries.getAllEntries.heads();
    res.json(query);
  })
  .post(async (req, res) => {
    const ids = await queries.createEntry(req.body);
    res.status(201).json(ids);
  });

router.route('/dump')
  .get(async (req, res) => {
    const query = await queries.getAllEntries.dump();
    res.json(query);
  });

router.route('/keywords')
  .get(async (req, res) => {
    res.send(await queries.getAllKeywords());
  });

router.route('/entries/:id')
  .get(async (req, res) => {
    const entry = await queries.getEntries.byId(req.params.id);
    res.send(entry);
  })
  .delete(async (req, res) => {
    const { id } = req.params;

    await queries.deleteEntry(id);
    await queries.deleteKeywords(id);

    res.status(204).end();
  });

router.route('/keywords/:entryId')
  .get(async (req, res) => {
    const entry = await queries.getKeywords.byEntryId(req.params.entryId);
    res.send(entry);
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
