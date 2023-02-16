// depends on process.env.STORAGE_BACKEND

const entries = require('./flat-file-json');
const metadataScraper = require('./metadata-scraper');
const archives = require('./archives');

module.exports = {
  entries,
  archives,
  metadata: metadataScraper,
};
