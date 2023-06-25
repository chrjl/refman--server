const path = require('node:path');
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const definition = require('./api-definition.json');

const options = {
  definition,
  apis: [path.join(__dirname, '*.js')],
};

const uiOptions = {
  swaggerOptions: {
    defaultModelsExpandDepth: 3,
    tryItOutEnabled: true,
  },
};

const openapiSpecification = swaggerJsdoc(options);

const router = express.Router();

router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(openapiSpecification, uiOptions));

module.exports = router;
