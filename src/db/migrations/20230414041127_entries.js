/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable('entries', (table) => {
    table.increments('id').primary();
    table.string('author');
    table.string('publisher');
    table.string('title');
    table.string('url');
    table.string('details');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTable('entries');
};
