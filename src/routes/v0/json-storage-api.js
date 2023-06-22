// depends: process.env.DB_ROOT, process.env.DB_TRASH

const express = require('express');
const createHttpError = require('http-errors');

const path = require('node:path');
const fs = require('node:fs/promises');

const debug = require('debug')('app:routes/json-storage-api');

const router = express.Router();
const dbRoot = process.env.DB_ROOT;
const dbTrash = process.env.DB_TRASH;

/**
 * @openapi
 * /items:
 *   get:
 *     summary: All items in the collection, excluding trashed items.
 *     description: |
 *       Reads file list (`fs.readdir`) of storage directory, filtering in files with `.json` extname.
 *
 *       Then generates an item for each file: assigns file name (without extname) to `id` field, reads file (`fs.readFile`) and parses (`JSON.parse`) fields.
 *     tags: [items]
 *     responses:
 *       '200':
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *       '404':
 *         description: Not Found (ENOENT storage directory)
 */

router
  .route('/')
  .get([
    async (req, res, next) => {
      // get file list from storage root
      try {
        const fileNames = await fs.readdir(dbRoot);
        res.locals.fileNames = fileNames.filter(
          (fileName) => path.extname(fileName) === '.json'
        );

        next();
      } catch (err) {
        if (err.code === 'ENOENT') {
          return next(createHttpError(404));
        }
        next(err);
      }
    },
    async (req, res, next) => {
      // parse files and return response
      const parseFiles = res.locals.fileNames.map(async (fileName) => {
        try {
          const filePath = path.join(dbRoot, fileName);
          const fileContent = JSON.parse(await fs.readFile(filePath));

          const id = path.basename(fileName, '.json');
          return { id, ...fileContent };
        } catch (err) {
          debug(`Error parsing ${fileName}`);
          throw err;
        }
      });

      const data = await Promise.allSettled(parseFiles);
      const items = data
        .filter((result) => result.status === 'fulfilled')
        .map((result) => result.value);

      res.json(items);
    },
  ])
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

router
  .route('/DUMP')
  .get(async (req, res, next) => {
    try {
      const fileNames = await fs.readdir(dbRoot);

      const readFileContents = fileNames
        .filter((file) => path.extname(file) === '.json')
        .map(async (fileName) => {
          const content = await fs.readFile(
            path.join(dbRoot, fileName),
            'utf8'
          );
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

/**
 * @openapi
 * /items/{id}:
 *   get:
 *     tags: [items]
 *     summary: A specific item in the collection.
 *     description: |
 *       Sends file (`res.sendFile`) with file name `id`, extname `.json`, from storage root directory
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The item's primary key (in `json-storage` it corresponds to the file name, without extname)
 *         example: eloquent-javascript
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       404:
 *         description: Not found (ENOENT item file)
 */

router
  .route('/:id')
  .all((req, res, next) => {
    req.pathname = `${path.join(dbRoot, req.params.id)}.json`;
    next();
  })
  .get(async (req, res, next) => {
    res.sendFile(`${req.params.id}.json`, { root: dbRoot }, (err) => {
      console.log(err);
      if (err) {
        if (err.code === 'ENOENT') return next(createHttpError(404));
        next(err);
      }
    });
  })
  .delete(async (req, res, next) => {
    try {
      const trashPath = `${path.join(
        dbTrash,
        req.params.id
      )}.json-${Date.now()}`;

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
