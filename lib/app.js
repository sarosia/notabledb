const Apper = require('@sarosia/apper');
const Database = require('./database');
const FilesystemStorage = require('./filesystem_storage');
const path = require('path');

const app = new Apper('notabledb', (ctx) => {
  const storage = new FilesystemStorage(ctx.config.storage.path);
  ctx.database = new Database(storage);
}, {
  port: 8964,
  staticPaths: [
    path.resolve(`${__dirname}/../static`),
    path.resolve(`${__dirname}/../node_modules/@sarosia/e/src`),
  ],
});

app.get('/query', async (ctx, req, res) => {
  res.send(await ctx.database.query([]));
});

app.get('/query/:path', async (ctx, req, res) => {
  res.send(await ctx.database.query(req.params.path.split('.')));
});

app.post('/update/:path', async (ctx, req, res) => {
  try {
    res.send(await ctx.database.update(req.params.path.split('.'), req.body));
  } catch (e) {
    res.status(404).json({
      message: e.message,
    });
  }
});

module.exports = function() {
  app.start();
};
