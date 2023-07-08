const express = require('express');
const swaggerUi = require('swagger-ui-express');

const uiOptions = {
  swaggerOptions: {
    defaultModelsExpandDepth: 3,
    tryItOutEnabled: true,
    url: '/v0/oas3.json',
  },
};

const router = express.Router();

router
  .use('/', swaggerUi.serveFiles(null, uiOptions))
  .get('/', swaggerUi.setup(null, uiOptions));

module.exports = router;
