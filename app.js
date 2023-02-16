// depends: process.env.HTTP_PORT

const debug = require('debug')('app:main');

const server = require('./src/server');

const port = process.env.HTTP_PORT;

server.listen(port);
debug(`server listening on port ${port}`);
