const path = require('node:path');
const fs = require('node:fs/promises');
const debug = require('debug')('app:routes/json-storage-utils');
const createHttpError = require('http-errors');

const dbRoot = process.env.DB_ROOT;
const dbTrash = process.env.DB_TRASH;

function generateFilePathFromItemKey(itemKey) {
  if (itemKey === undefined) {
    throw new createHttpError.BadRequest();
  }
  
  // block directory traversal
  if (path.dirname(path.normalize(itemKey)) !== '.') {
    throw new createHttpError.Forbidden();
  }

  // sanitize itemKey
  sanitizedItemKey = encodeURIComponent(itemKey);

  return {
    item: path.format({
      dir: dbRoot,
      name: sanitizedItemKey,
      ext: '.json',
    }),
    trash: path.format({
      dir: dbTrash,
      name: `${sanitizedItemKey}-${Date.now()}`,
      ext: '.json',
    }),
  };
}

async function deleteItemToTrash(itemKey) {
  const pathname = generateFilePathFromItemKey(itemKey);

  try {
    await fs.link(pathname.item, pathname.trash);
    await fs.unlink(pathname.item);
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}

module.exports = {
  generateFilePathFromItemKey,
  deleteItemToTrash,
};

debug('exported json-storage utils');
