const express = require('express');
const morgan = require('morgan');
const cors = require('cors');

const debug = require('debug')('app:server');

const routes = require('./routes');

const app = express();

app.use(morgan('dev'));
app.use(cors());

app.use(express.json());

app.use('/api-docs', routes.apiDocs);
app.use('/utils', routes.utils);
app.use('/v0', routes.v0);
app.use('/v1', routes.v1);

// error handler
// use express default

module.exports = app;
debug('exported express server');
