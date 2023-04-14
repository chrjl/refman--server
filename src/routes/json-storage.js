// depends: process.env.DB_ROOT, process.env.DB_TRASH

const express = require('express');
const createHttpError = require('http-errors');

const path = require('node:path');
const fs = require('node:fs/promises');

const debug = require('debug')('app:routes/json-storage');

const router = express.Router();
const dbRoot = process.env.DB_ROOT;
const dbTrash = process.env.DB_TRASH;

router.route('/')
  .get(async (req, res, next) => {
    try {
      const files = await fs.readdir(dbRoot);

      const parseFiles = files.map(async (file) => {
        const filePath = path.join(dbRoot, file);

        const { id, url, URL } = JSON.parse(await fs.readFile(filePath));

        const links = [
          {
            href: `/entries/${path.basename(file, '.json')}`,
            rel: 'self',
            method: 'GET',
          },
        ];

        if (url || URL) {
          links.push({
            href: url || URL,
            rel: 'source',
            method: 'GET',
          });
        }

        return { id, links };
      });

      const data = await Promise.all(parseFiles);
      res.json(data);
    } catch (err) {
      switch (err.code) {
        case 'ENOENT':
          next(createHttpError(404));
          break;
        default:
          next(createHttpError(500));
      }
    }
  })
  .post(async (req, res, next) => {
    const { id } = req.body;
    try {
      const filePath = `${path.join(dbRoot, id)}.json`;

      await fs.writeFile(filePath, JSON.stringify(req.body), { flag: 'wx' });

      res.status(201);
      res.json({ message: 'POST success' });
    } catch (err) {
      switch (err.code) {
        case 'ERR_INVALID_ARG_TYPE':
          next(createHttpError(400));
          break;
        case 'EEXIST':
          next(createHttpError(409));
          break;
        case 'EACCES':
          next(createHttpError(403));
          break;
        default:
          next(createHttpError(500));
      }
    }
  });

router.route('/DUMP')
  .get(async (req, res, next) => {
    try {
      const fileNames = await fs.readdir(dbRoot);

      const readFileContents = fileNames
        .filter((file) => path.extname(file) === '.json')
        .map(async (fileName) => {
          const content = await fs.readFile(path.join(dbRoot, fileName), 'utf8');
          return JSON.parse(content);
        });

      const archive = await Promise.all(readFileContents);
      res.json(archive);
    } catch (err) {
      if (err instanceof SyntaxError) {
        next(createHttpError(500, 'bad file in db'));
      }
      next(err);
    }
  })
  .all((req, res, next) => next(createHttpError(405)));

router.route('/:id')
  .all((req, res, next) => {
    req.pathname = `${path.join(dbRoot, req.params.id)}.json`;
    next();
  })
  .get(async (req, res, next) => {
    res.sendFile(`${req.params.id}.json`, { root: dbRoot }, (err) => {
      if (err) {
        switch (err.code) {
          case 'ENOENT':
            next(createHttpError(404));
            break;
          default:
            next(createHttpError(500));
        }
      }
    });
  })
  .delete(async (req, res, next) => {
    try {
      const trashPath = `${path.join(dbTrash, req.params.id)}.json-${Date.now()}`;

      await fs.link(req.pathname, trashPath);
      await fs.unlink(req.pathname);

      res.status(204);
      res.json({ message: 'DELETE success' });
    } catch (err) {
      next(createHttpError(500));
    }
  })
  .put(async (req, res, next) => {
    try {
      if (req.params.id !== req.body.id) next(createHttpError(400));

      await fs.access(req.pathname);
      await fs.writeFile(req.pathname, JSON.stringify(req.body));

      res.status(200);
      res.json({ message: 'PUT success' });
    } catch (err) {
      switch (err.code) {
        case 'ENOENT':
          next(createHttpError(404));
          break;
        default:
          next(createHttpError(500));
      }
    }
  });

module.exports = router;
debug('exported entries route');
