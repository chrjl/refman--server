const express = require('express');
const router = express.Router();

const swaggerUi = require('swagger-ui-express');

const options = {
  explorer: true,
  swaggerOptions: {
    defaultModelsExpandDepth: 3,
    tryItOutEnabled: true,
    urls: [
      {
        url: '/utils/openapi.json',
        name: 'utils',
      },
      {
        url: '/v0/openapi.json',
        name: 'API v0',
      },
      {
        url: '/v1/openapi.json',
        name: 'API v1',
      },
    ],
  },
};

router
  .use('/', swaggerUi.serveFiles(null, options))
  .get('/', swaggerUi.setup(null, options));

module.exports = router;
