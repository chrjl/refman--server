// depends: process.env.DB_ROOT, process.env.DB_TRASH

const express = require('express');
const createHttpError = require('http-errors');

const path = require('node:path');
const fs = require('node:fs/promises');

const debug = require('debug')('app:routes/json-storage-api');

const {
  generateFilePathFromItemKey,
  deleteItemToTrash,
} = require('./json-storage-utils');

const router = express.Router();
const dbRoot = process.env.DB_ROOT;
const dbTrash = process.env.DB_TRASH;

/**
 * @openapi
 * components:
 *   schemas:
 *     Item:
 *       type: object
 *       required:
 *         - key
 *         - aliases
 *         - url
 *       properties:
 *         key:
 *           type: string
 *           description: name of file in collection (not a BibLaTeX field)
 *         ids:
 *           type: list
 *           description: BibLaTeX ids
 *         url:
 *           type: uri
 *         keywords:
 *           type: list
 *         type:
 *           type: string
 *         entrysubtype:
 *           type: string
 *           description: for use with @online type
 *         author:
 *           type: list
 *         publisher:
 *           type: list
 *         title:
 *           type: string
 *         date:
 *           type: string
 *         urldate:
 *           type: string
 *           description: access date
 *       example:
 *         value:
 *           key: example
 *           title: Express web framework (Node.js/JavaScript)
 *           author:
 *             - MDN
 *           publisher:
 *             - MDN
 *           url: https://developer.mozilla.org/en-US/docs/Learn/Server-side/Express_Nodejs
 *           type: online
 *           entrysubtype: collection
 *           date: "2022-09-09"
 *           urldate: "2023-01-11"
 *           ids:
 *             - MDN_express
 */

/**
 * @openapi
 * /items:
 *   get:
 *     summary: All items in the collection, excluding trashed items.
 *     description: |
 *       Reads file list (`fs.readdir`) of storage directory, filtering in files with `.json` extname.
 *
 *       Then, generate an item for each file and return an array of item objects:
 *
 *       - Assign file name (without extname) to `key` field.
 *       - Read file (`fs.readFile`) and parse (`JSON.parse`) fields.
 *     tags: [items]
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *       404:
 *         description: '`ENOENT` storage directory (Not Found)'
 *   delete:
 *     summary: Delete multiple items
 *     tags: [items]
 *     description: See `DELETE /items/{itemKey}`
 *     parameters:
 *       - name: itemKey
 *         in: query
 *         description: Comma-separated list of `key`s of items to delete (to trash).
 *         required: true
 *         example: 'example1,example2,example3'
 *         allowReserved: true
 *     responses:
 *       204:
 *         description: The items were deleted (No Content)
 *       400:
 *         description: 'No `itemKeys` were provided (Bad Request)'
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
      // parse files and respond with a single JSON array
      const parseFiles = res.locals.fileNames.map(async (fileName) => {
        try {
          const filePath = path.join(dbRoot, fileName);
          const fileContent = await fs.readFile(filePath);
          const item = JSON.parse(fileContent);

          const key = path.basename(fileName, '.json');
          return { key, ...item };
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
  .delete(async (req, res, next) => {
    if (!('itemKey' in req.query)) return next(createHttpError(400));

    const { itemKey } = req.query;

    const keys = itemKey.split(',');
    const trashOperations = keys.map(async (key) => {
      await deleteItemToTrash(key);
    });

    await Promise.all(trashOperations);

    res.status(204).send();
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

/**
 * @openapi
 * components:
 *   parameters:
 *     itemKey:
 *       in: path
 *       name: itemKey
 *       required: true
 *       schema:
 *         type: string
 *       description: The item's primary key (in `json-storage` it corresponds to the file name, without extname)
 *       examples:
 *         example-OK:
 *           value: example
 *         example-404:
 *           value: 404
 */

/**
 * @openapi
 * /items/{itemKey}:
 *   get:
 *     tags: [items]
 *     summary: A specific item in the collection.
 *     description: |
 *       Sends file (`res.sendFile`) with file name `id`, extname `.json`, from storage root directory
 *     parameters:
 *       - $ref: '#/components/parameters/itemKey'
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       404:
 *         description: '`ENOENT` item file (Not Found)'
 *   delete:
 *     tags: [items]
 *     summary: Delete an item.
 *     description: |
 *       Link (`fs.link`) file to trash directory, then remove (`fs.unlink`) from collection directory
 *     parameters:
 *       - $ref: '#/components/parameters/itemKey'
 *     responses:
 *       204:
 *         description: The item was deleted (No Content)
 *     responses:
 *       204:
 *         description: No Content
 */

router
  .route('/:key')
  .all((req, res, next) => {
    res.locals.pathname = generateFilePathFromItemKey(req.params.key);
    next();
  })
  .get(async (req, res, next) => {
    res.sendFile(res.locals.pathname.item, (err) => {
      if (err) {
        if (err.code === 'ENOENT') return next(createHttpError(404));
        next(err);
      }
    });
  })
  .delete(async (req, res, next) => {
    try {
      await deleteItemToTrash(req.params.key);
    } catch (e) {
      return next(e);
    }

    res.status(204).send();
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
