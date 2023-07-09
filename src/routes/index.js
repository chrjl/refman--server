// depends on process.env.STORAGE_BACKEND

const v0 = require('./v0');
const utils = require('./utils');
const apiDocs = require('./api-docs');
const metadataScraper = require('./metadata-scraper');
const archives = require('./archives');
// const sqlite = require('./sqlite');

module.exports = {
  v0,
  utils,
  apiDocs,
  archives,
  metadata: metadataScraper,

  // sqlite,
};
