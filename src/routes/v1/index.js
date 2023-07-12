const path = require('node:path');
const debug = require('debug')('app:routes/v1');

const express = require('express');
const swaggerJsdoc = require('swagger-jsdoc');

const itemsApi = require('./items');
const keywordsApi = require('./keywords');

const router = express.Router();

router.route('/').get((req, res) => res.send('hello v1'));

router
  .get('/openapi.json', (req, res) => {
    const definition = require('./openapi/definition.json');
    const options = {
      definition,
      apis: [path.join(__dirname, 'openapi/*.yaml')],
    };

    const openapiSpecification = swaggerJsdoc(options);
    const oasFilename = 'refman--server-v1.openapi.json';

    res.setHeader('Content-Disposition', `inline; filename=${oasFilename}`);
    res.json(openapiSpecification);
  })
  .use('/items', itemsApi)
  .use('/keywords', keywordsApi);

module.exports = router;
debug('exported /v1 route');
