const _ = require('lodash');
const debug = require('debug')('app:db/queries');

const db = require('./config');

const headFields = ['id', 'title', 'author', 'publisher', 'url'];

function preprocess(data) {
  const { title, author, publisher, url, keywords, ...details } = data;

  if ('id' in details) {
    if (!('label' in details)) {
      details.label = details.id;
    }

    delete details.id;
  }

  return {
    entry: {
      title,
      author: author?.join(','),
      publisher,
      url,
      details,
    },
    keywords,
  };
}

function squashDetails(entry) {
  const { details, keywords, ...head } = entry;
  return ({
    ...JSON.parse(details),
    ...head,
    author: head.author?.split(','),
    keywords: keywords?.split(','),
  });
}

const getAllEntries = {
  async heads() {
    const query = await db('entries').select(headFields);
    return query.map((entry) => _.pickBy(entry));
  },

  async dump() {
    // note: GROUP_CONCAT is sqlite-specific

    const query = await db('entries')
      .select(db.raw('entries.*, GROUP_CONCAT(keywords.keyword) AS keywords'))
      .join('keywords', 'keywords.entry_id', 'entries.id')
      .groupBy('id');

    return query
      .map(squashDetails)
      .map((entry) => _.pickBy(entry));
  },
};

const getEntries = {
  async byId(ids) {
    // note: GROUP_CONCAT is sqlite-specific

    const query = await db('entries')
      .select(db.raw('entries.*, GROUP_CONCAT(keywords.keyword) AS keywords'))
      .join('keywords', 'keywords.entry_id', 'entries.id')
      .groupBy('entries.id')
      .whereIn('entries.id', _.concat(ids));

    const entries = query
      .map(squashDetails)
      .map((entry) => _.omitBy(entry, (v, k) => k === 'id'));

    if (entries.length === 1) return _.head(entries);
    return entries;
  },

  async byKeyword(keywords) {
    // accepts array or string (converts to array with _.concat)

    const recordIds = await db('keywords')
      .select('entry_id')
      .distinct()
      .whereIn('keyword', _.concat(keywords));

    return recordIds.map((record) => record.entry_id);
    // return this.byId(ids);
  },

  async byAuthorSearch(author) {
    const recordIds = await db('entries')
      .select('id')
      .whereLike('author', `%${author}%`)
      .orWhereLike('publisher', `%${author}%`);

    return recordIds.map((record) => record.id);
    // return this.byId(ids);
  },
};

async function createEntry(data) {
  const { entry, keywords } = preprocess(data);

  const entryId = await db('entries')
    .insert(entry, ['id']);

  await db('keywords')
    .insert(keywords.map((keyword) => ({
      entry_id: entryId[0].id,
      keyword,
    })));

  return entryId;
}

async function deleteEntry(id) {
  await db('entries')
    .where('id', id)
    .del();
}

async function deleteKeywords(entryId) {
  await db('keywords')
    .where('entry_id', entryId)
    .del();
}

async function getAllKeywords() {
  const query = await db('keywords')
    .select('keyword')
    .distinct();

  return query.map((res) => res.keyword).sort((a, b) => (a > b ? 1 : -1));
}

const getKeywords = {
  async byEntryId(entryId) {
    // note: GROUP_CONCAT is sqlite-specific

    const keywordsQuery = await db('keywords')
      .select(db.raw('GROUP_CONCAT(keyword) AS keywords'))
      .first()
      .groupBy('entry_id')
      .where('entry_id', entryId);

    const keywords = keywordsQuery.keywords.split(',');
    return keywords;
  },
};

module.exports = {
  preprocess,
  getAllEntries,
  getAllKeywords,
  getKeywords,
  getEntries,
  createEntry,
  deleteEntry,
  deleteKeywords,
};
