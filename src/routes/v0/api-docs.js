const path = require('node:path');
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const definition = require('./api-definition.json');

const options = {
  definition,
  apis: [path.join(__dirname, '*.js')]
}

const openapiSpecification = swaggerJsdoc(options);

const router = express.Router();

/**
 * @openapi
 * /:
 *   get:
 *     description: Welcome to swagger-jsdoc!
 *     responses:
 *       200:
 *         description: Returns a mysterious string.
 */
router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(openapiSpecification));

module.exports = router;
