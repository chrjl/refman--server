// depends on process.env.STORAGE_BACKEND

const entries = require('./json-storage');
const metadataScraper = require('./metadata-scraper');
const archives = require('./archives');
// const sqlite = require('./sqlite');

module.exports = {
  entries,
  archives,
  metadata: metadataScraper,

  // sqlite,
};
