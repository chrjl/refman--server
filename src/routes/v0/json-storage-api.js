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
 *         - ids
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
 *   post:
 *     summary: Create an item
 *     description: |
 *       Validate request:
 *
 *       - Validate request body fields (i.e. `key` is a required field).
 *       - Validate path of file to be written.
 *       - Don't overwrite an item that already exists.
 *
 *       Then write item (`fs.writeFile`) to a new file (`wx` flag).
 *     tags: [items]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Item'
 *           examples:
 *             example-201/409:
 *               value:
 *                 key: example
 *                 testField: testValue
 *             example-403:
 *               description: 'Tries to use a malformed `key` to post to a parent directory.'
 *               value:
 *                 key: ../403example
 *                 title: 403 Forbidden
 *             example-400-itemKey:
 *               description: 'Request body is missing `key`.'
 *               value:
 *                 title: 400 Bad Request
 *             example-400-content:
 *               description: 'Request body has no item fields.'
 *               value:
 *                 key: 400example
 *     responses:
 *       201:
 *         description: 'The request completed. See the response JSON for status of individual writes. (Created)'
 *         content:
 *           application/json:
 *             type: object
 *             example:
 *               key: example
 *       400:
 *         description: '`ERR_INVALID_ARG_TYPE` (Bad Request)'
 *       409:
 *         description: '`EEXIST` (Conflict)'
 *       403:
 *         description: '`EACCES` (Forbidden)'
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
    const { key, ...item } = req.body;
    debug({ item });

    // key and detail fields are both required
    if (key === undefined) {
      // if (key === undefined || !Object.keys(item).length) {
      return next(createHttpError(400));
    }

    try {
      const pathname = generateFilePathFromItemKey(key);

      await fs.writeFile(pathname.item, JSON.stringify(item), { flag: 'wx' });
      res.status(201).json({ key });
    } catch (e) {
      switch (e.code) {
        case 'EEXIST':
          return next(createHttpError(409));
          break;
        default:
          return next(e);
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
 *   put:
 *     summary: Full-item updating
 *     description: |
 *       Validate request: path of file to be written
 *
 *       - The primary key is taken from the `itemKey` request parameter, so `key` included in the request body will be silently ignored.
 *
 *       Open file for read and write (`fs.open` with `r+` flag), ensuring that the item exists before write. Then overwrite the file (`fileHandle.writeFile`).
 *     tags: [items]
 *     parameters:
 *       - $ref: '#/components/parameters/itemKey'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Item'
 *           examples:
 *             example-OK:
 *               $ref: '#/components/schemas/Item/example'
 *     responses:
 *       204:
 *         description: 'The item was successfully updated (No Content)'
 *       400:
 *         description: 'Invalid type/field; unparseable JSON (Bad Request)'
 *       404:
 *         description: '`ENOENT` (Not Found)'
 *   patch:
 *     summary: Partial-item updating
 *     tags: [items]
 *     parameters:
 *       - $ref: '#/components/parameters/itemKey'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *           example:
 *             keywords:
 *               - nodejs
 *               - expressjs
 *               - mongodb
 *     responses:
 *       204:
 *         description: 'The item was successfully updated (No Content)'
 *       400:
 *         description: 'Invalid type/field; unparseable JSON (Bad Request)'
 *       404:
 *         description: '`ENOENT` (Not Found)'
 */

router
  .route('/:key')
  .all((req, res, next) => {
    try {
      res.locals.pathname = generateFilePathFromItemKey(req.params.key);
      next();
    } catch (e) {
      next(e);
    }
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
      await fs.access(res.locals.pathname.item);

      await fs.writeFile(res.locals.pathname.item, JSON.stringify(req.body));
      res.status(204).send();
    } catch (e) {
      switch (e.code) {
        case 'ENOENT':
          next(createHttpError(404));
          break;
        default:
          next(e);
      }
    }
  })
  .patch(async (req, res, next) => {
    try {
      await fs.access(res.locals.pathname.item);

      const fileContent = await fs.readFile(res.locals.pathname.item, 'utf-8');
      const item = Object.assign(JSON.parse(fileContent), req.body);

      await fs.writeFile(res.locals.pathname.item, JSON.stringify(item));
      res.status(204).send();
    } catch (e) {
      switch (e.code) {
        case 'ENOENT':
          next(createHttpError(404));
          break;
        default:
          next(e);
      }
    }
  });

module.exports = router;
debug('exported items API');
