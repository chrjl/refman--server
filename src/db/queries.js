const _ = require('lodash');
const debug = require('debug')('app:db/queries');

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

class Transaction {
  constructor(knex) {
    // accepts either an open knex connection or transaction
    this.knex = knex;
  }

  headFields = ['id', 'title', 'author', 'publisher', 'url'];

  async dump() {
    // note: GROUP_CONCAT is sqlite-specific

    const query = await this.knex('entries')
      .select(this.knex.raw('entries.*, GROUP_CONCAT(keywords.keyword) AS keywords'))
      .join('keywords', 'keywords.entry_id', 'entries.id')
      .groupBy('id');

    return query
      .map(squashDetails)
      .map((entry) => _.pickBy(entry));
  }

  async getAllEntries() {
    const query = await this.knex('entries').select(this.headFields);
    return query.map((entry) => _.pickBy(entry));
  }

  async getEntriesById(ids) {
    // note: GROUP_CONCAT is sqlite-specific

    const query = await this.knex('entries')
      .select(this.knex.raw('entries.*, GROUP_CONCAT(keywords.keyword) AS keywords'))
      .join('keywords', 'keywords.entry_id', 'entries.id')
      .groupBy('entries.id')
      .whereIn('entries.id', _.concat(ids));

    const entries = query
      .map(squashDetails)
      .map((entry) => _.omitBy(entry, (v, k) => k === 'id'));

    return entries;
  }

  async getEntriesByKeyword(keywords) {
    // accepts array or string (converts to array with _.concat)

    const recordIds = await this.knex('keywords')
      .select('entry_id')
      .distinct()
      .whereIn('keyword', _.concat(keywords));

    return recordIds.map((record) => record.entry_id);
  }

  async getEntriesByAuthor(author) {
    const recordIds = await this.knex('entries')
      .select('id')
      .whereLike('author', `%${author}%`)
      .orWhereLike('publisher', `%${author}%`);

    return recordIds.map((record) => record.id);
  }

  async createEntry(data = {}) {
    const { entry, keywords } = preprocess(data);

    const entryId = await this.knex('entries')
      .insert(entry, ['id']);

    await this.insertKeywords(entryId[0].id, keywords);

    return entryId;
  }

  async deleteEntries(ids) {
    return this.knex('entries')
      .whereIn('id', _.concat(ids))
      .del();
  }

  async getAllKeywords() {
    const query = await this.knex('keywords')
      .select('keyword')
      .distinct();

    return query.map((res) => res.keyword).sort((a, b) => (a > b ? 1 : -1));
  }

  async getKeywordsByEntryId(entryId) {
    // note: GROUP_CONCAT is sqlite-specific

    const query = await this.knex('keywords')
      .select(this.knex.raw('GROUP_CONCAT(keyword) AS keywords'))
      .groupBy('entry_id')
      .where('entry_id', entryId)
      .first();

    const keywords = query?.keywords.split(',');
    return keywords;
  }

  async insertKeywords(entryId, keywords = []) {
    const existing = await this.getKeywordsByEntryId(entryId);
    const newKeywords = _.difference(keywords, existing);

    if (_.isEmpty(newKeywords)) {
      return false;
    }

    return this.knex('keywords')
      .insert(newKeywords.map((keyword) => ({
        entry_id: entryId,
        keyword,
      })))
      .whereNotIn('keyword', existing);
  }

  async deleteAllKeywordsFromEntry(entryId) {
    // delete all keyword records corresponding to entryId

    return this.knex('keywords')
      .where('entry_id', entryId)
      .del();
  }

  async deleteKeywordsFromEntry(entryId, keywords = []) {
    // delete specific keyword records corresponding to entryId

    return this.knex('keywords')
      .where('entry_id', entryId)
      .andWhere('keyword', 'in', keywords)
      .del();
  }

  async pruneKeywords() {
    const entrySubQuery = await this.knex('entries')
      .select('id');

    const allEntryIds = entrySubQuery.map(((rec) => rec.id));

    return this.knex('keywords')
      .whereNotIn('entry_id', allEntryIds)
      .del();
  }

  async renameKeyword(from, to) {
    return this.knex('keywords')
      .where('keyword', from)
      .update('keyword', to);
  }
}

module.exports = {
  Transaction,
  preprocess,
};
