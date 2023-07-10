const path = require('node:path');
const debug = require('debug')('app:routes/v1');

const express = require('express');
const swaggerJsdoc = require('swagger-jsdoc');

const router = express.Router();

router.route('/').get((req, res) => res.send('hello v1'));

router.get('/openapi.json', (req, res) => {
  const definition = require('./api-definition.json');
  const options = {
    definition,
    apis: [path.join(__dirname, './*.js')],
  };

  const openapiSpecification = swaggerJsdoc(options);
  const oasFilename = 'refman--server-v1.openapi.json';

  res.setHeader('Content-Disposition', `inline; filename=${oasFilename}`);
  res.json(openapiSpecification);
});

module.exports = router;
debug('exported /v1 route');
