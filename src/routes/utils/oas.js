const path = require('node:path');
const swaggerJsdoc = require('swagger-jsdoc');

const definition = require('./api-definition.json');
const options = {
  definition,
  apis: [path.join(__dirname, '*.js')],
};

const openapiSpecification = swaggerJsdoc(options);
module.exports = openapiSpecification;
