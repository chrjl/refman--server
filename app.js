// depends: process.env.HTTP_PORT

const debug = require('debug')('app:main');

const server = require('./src/server');

const port = process.env.HTTP_PORT;

server.listen(port);
debug(`${process.env.npm_package_name} server listening on port ${port}`);
