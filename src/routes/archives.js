// depends: process.env.DB_ROOT, process.env.STORAGE_BACKEND

const express = require('express');
const createHttpError = require('http-errors');
const tar = require('tar');
const path = require('path');

const debug = require('debug')('app:routes/archive');

const router = express.Router(['strict']);
const dbRoot = process.env.DB_ROOT;

router.get('/generate', (req, res) => res.redirect('generate-tgz'));

router.route('/generate-tgz')
  .get((req, res) => {
    switch (process.env.STORAGE_BACKEND) {
      case 'json':
        res.setHeader('Content-Type', 'application/x-tar-gz');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${
            path.format({
              name: `db_${new Date().toISOString().replaceAll(':', '_')}`,
              ext: '.tgz',
            })
          }"`,
        );

        tar.create({
          cwd: dbRoot,
          gzip: true,
        }, ['.']).pipe(res);
        break;

      default:
        throw createHttpError(500);
    }
  });

module.exports = router;
debug('exported archive route');
