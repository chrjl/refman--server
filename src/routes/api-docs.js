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
        url: '/utils/oas3.json',
        name: 'utils',
      },
      {
        url: '/v0/oas3.json',
        name: 'API v0',
      },
    ],
  },
};

router
  .use('/', swaggerUi.serveFiles(null, options))
  .get('/', swaggerUi.setup(null, options));

module.exports = router;
