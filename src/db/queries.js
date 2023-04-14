const debug = require('debug')('app:db/queries');

const db = require('./config');

function preprocessJSON(json) {
  const data = JSON.parse(json);
  const { title, author, publisher, url, ...details } = data;

  if (!('label' in details)) details.label = details.id;
  delete details.id;

  return {
    title,
    author: author?.join(','),
    publisher,
    url,
    details,
  };
}

module.exports = {
  preprocessJSON,
};
