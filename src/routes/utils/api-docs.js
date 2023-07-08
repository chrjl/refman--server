const express = require('express');
const swaggerUi = require('swagger-ui-express');

const uiOptions = {
  swaggerOptions: {
    tryItOutEnabled: true,
    url: '/utils/oas3.json',
  },
};

const router = express.Router();

router
  .use('/', swaggerUi.serveFiles(null, uiOptions))
  .get('/', swaggerUi.setup(null, uiOptions));

module.exports = router;
