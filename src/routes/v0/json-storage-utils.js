const path = require('node:path');
const fs = require('node:fs/promises');
const debug = require('debug')('app:routes/json-storage-utils');

const dbRoot = process.env.DB_ROOT;
const dbTrash = process.env.DB_TRASH;

function PathNames(itemKey) {
  this.item = path.format({
    dir: dbRoot,
    name: itemKey,
    ext: '.json',
  });

  this.trash = path.format({
    dir: dbTrash,
    name: `${itemKey}-${Date.now()}`,
    ext: '.json',
  });
}

async function deleteItemToTrash(itemKey) {
  const pathname = new PathNames(itemKey);

  try {
    await fs.link(pathname.item, pathname.trash);
    await fs.unlink(pathname.item);
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}

module.exports = {
  deleteItemToTrash,
};
