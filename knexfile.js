/**
 * @type { Object.<string, import("knex").Knex.Config> }
 */
module.exports = {
  development: {
    client: 'sqlite3',
    connection: {
      filename: './storage/sqlite/collection.sqlite3',
    },
    useNullAsDefault: true,
  },
};
