const FilesystemStorage = require('../lib/filesystem_storage');
const expect = require('chai').expect;
const {
  withFile
} = require('tmp-promise');
const fs = require('fs').promises;

async function withNewStorage(func) {
  await withFile(async (file) => {
    const storage = new FilesystemStorage(file.path);
    await func(storage, file.path);
  });
}

describe('Storage', () => {
  describe('#read', () => {
    it('Reading an empty file returns empty JSON.', async () => {
      await withNewStorage(async (storage, path) => {
        const json = await storage.read();
        expect(json).to.deep.equal({});
      });
    });

    it('Reading an JSON file.', async () => {
      await withNewStorage(async (storage, path) => {
        await fs.writeFile(path, '{"i": 1, "s": "a"}', 'utf8');
        const json = await storage.read();
        expect(json).to.deep.equal({
          i: 1,
          s: 'a',
        });
      });
    });

    it('Reading an non-JSON file.', async () => {
      await withNewStorage(async (storage, path) => {
        await fs.writeFile(path, 'aaaaaaaaaaaa', 'utf8');
        const json = await storage.read();
        expect(json).to.deep.equal({});
      });
    });
  });

  describe('#write', () => {
    it('Write JSON', async () => {
      await withNewStorage(async (storage, path) => {
        await storage.write({
          'n': 1,
          'm': 'a'
        });
        expect(await fs.readFile(path, 'utf8')).to.equal('{"n":1,"m":"a"}');
      });
    });
  });
});
