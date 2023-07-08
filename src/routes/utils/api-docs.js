const path = require('path');
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const definition = require('./api-definition.json');

const options = {
  definition,
  apis: [path.join(__dirname, '*.js')],
};

const openapiSpecification = swaggerJsdoc(options);

const router = express.Router();

router.use('/', swaggerUi.serveFiles(openapiSpecification));
router.get('/', swaggerUi.setup(openapiSpecification));

router.get('/oas3.json', (req, res) => {
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="refman--server_utils.oas3.json"'
  );
  res.json(openapiSpecification);
});

module.exports = router;
