/**
 * Inserts entries from a directory of JSON formatted files
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

const dotenv = require('dotenv');
const dotenvExpand = require('dotenv-expand');

const fs = require('node:fs/promises');
const path = require('node:path');
const queries = require('../queries');

dotenvExpand.expand(dotenv.config());
const collPath = process.env.DB_ROOT;

async function seed(knex) {
  const ls = await fs.readdir(collPath);

  // Deletes ALL existing entries
  await knex('entries').del();
  await knex('keywords').del();

  const data = ls
    .filter((filename) => path.extname(filename) === '.json')
    .map(async (filename) => {
      const filePath = path.join(collPath, filename);
      const json = await fs.readFile(filePath, { encoding: 'utf8' });
      const { entry, keywords } = queries.preprocessJSON(json);

      const entryId = await knex('entries').insert(entry, ['id']);

      await knex('keywords').insert(
        keywords.map((keyword) => ({
          entry_id: entryId[0].id,
          keyword,
        })),
      );

      return true;
    });

  await Promise.all(data);
}

module.exports = { seed };
