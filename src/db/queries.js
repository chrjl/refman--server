const _ = require('lodash');
const debug = require('debug')('app:db/queries');

function preprocess(data, defaultNull = false) {
  // defaultNull: replace undefined fields with null (will overwrite fields)
  // otherwise omit undefined fields

  const { title, author, publisher, url, keywords, ...details } = data;

  if ('id' in details) {
    if (!('label' in details)) {
      details.label = details.id;
    }

    delete details.id;
  }

  let entry = {
    title,
    author: author ? author.join(',') : author, // can be undefined or null
    publisher,
    url,
    details: JSON.stringify(details),
  };

  if (defaultNull) {
    entry = _.mapValues(entry, (value) => value || null);
  } else {
    entry = _.omitBy(entry, (v) => v === undefined);
  }

  return {
    entry,
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
      .leftOuterJoin('keywords', 'keywords.entry_id', 'entries.id')
      .groupBy('entries.id')
      .whereIn('entries.id', _.concat(ids));

    const entries = query
      .map(squashDetails)
      .map((entry) => _.omit(entry, 'id'));

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

    return entryId[0].id;
  }

  async overwriteEntry(id, data = {}) {
    // replace undefined fields with null (to overwrite)
    const { entry } = preprocess(data, true);

    return this.knex('entries')
      .where('id', id)
      .update(entry);
  }

  async updateEntryFields(id, data = {}) {
    const updates = preprocess(data, false).entry;

    // update non-JSON fields
    const head = _.omit(updates, ['details']);

    if (!_.isEmpty(head)) {
      await this.knex('entries')
        .where('id', id)
        .update(head);
    }

    // update details JSON
    updates.details = JSON.parse(updates.details);

    // perform updates in series
    // eslint-disable-next-line no-restricted-syntax
    for await (const [key, value] of Object.entries(updates.details)) {
      let updatedDetails;

      if (value === null) { // remove fields explicitly set to null
        updatedDetails = await this.knex('entries')
          .where('id', id)
          .jsonRemove('details', `$.${key}`, 'details')
          .select()
          .first();
      } else {
        updatedDetails = await this.knex('entries')
          .where('id', id)
          .jsonSet('details', `$.${key}`, `${value}`, 'details')
          .select()
          .first();
      }

      await this.knex('entries')
        .where('id', id)
        .update(updatedDetails);
    }
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
    const entryIds = {};
    entryIds.allMatches = await this.getEntriesByKeyword(from);

    // check which entries already have the new keyword, to avoid duplicates
    const keywordExists = await this.knex('keywords')
      .whereIn('entry_id', entryIds.allMatches)
      .andWhere('keyword', to)
      .select('entry_id');

    entryIds.keywordExists = keywordExists.map((entry) => entry['entry_id']);

    // for all matches that already have the new keyword: delete keyword record
    await Promise.all(
      entryIds.keywordExists.map(async (id) => this.deleteKeywordsFromEntry(id, [from]))
    );

    // for other matches, update keyword records: from => to
    return this.knex('keywords')
      .where('keyword', from)
      .update('keyword', to);
  }
}

module.exports = {
  Transaction,
  preprocess,
};
