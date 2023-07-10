const environment = process.env.NODE_ENV || 'development';
const configuration = require('../../knexfile');
const debug = require('debug')('app:config/knex');

const knex = require('knex');

module.exports = knex(configuration[environment]);
debug('exported knex connection');
