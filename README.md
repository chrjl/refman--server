refman/server
=============

> [`refman` project wiki](https://github.com/chrjl/reference-manager--project/wiki)

REST API server: `expressjs`

Storage backend: flat file JSON

Dev server
----------

```sh
> npx nodemon -r dotenv-expand/config app.js
```

Configuration
-------------

Environment variables resolved via preloaded `dotenv-expand`

- `HTTP_PORT`
- `STORAGE_BACKEND` (`[json|sqlite|mongodb]`)

For `STORAGE_BACKEND=json`

- `DB_ROOT` (path)
- `DB_TRASH` (path)

APIs
----

- entries (`node:fs`)
- archives (via `tar` package)
- metadata (via `metadata-scraper` package)

Todo
----

- [ ] API caching

Storage backends:

- [ ] `mongodb` &times; `mongoose`
- [ ] `sqlite` &times; `knexjs`
