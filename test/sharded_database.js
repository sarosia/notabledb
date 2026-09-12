const ShardedDatabase = require('../lib/sharded_database');
const chai = require('chai');
const expect = chai.expect;
const { withDir } = require('tmp-promise');
const fs = require('fs').promises;
const path = require('path');

describe('ShardedDatabase (Pattern 1: Path-based Sharding)', () => {
  describe('In-Memory Mode', () => {
    let db;

    beforeEach(() => {
      db = new ShardedDatabase({
        shards: { days: true },
      });
    });

    it('shards updates and queries by path token', async () => {
      await db.update(['days', '2026-09-12'], [{ id: 1, battery: 100 }]);
      await db.update(['days', '2026-09-11'], [{ id: 2, battery: 90 }]);

      const d12 = await db.query(['days', '2026-09-12']);
      expect(d12).to.deep.equal([{ id: 1, battery: 100 }]);

      const d11 = await db.query(['days', '2026-09-11']);
      expect(d11).to.deep.equal([{ id: 2, battery: 90 }]);
    });

    it('returns null for non-existing shard', async () => {
      const res = await db.query(['days', '2099-01-01']);
      expect(res).to.equal(null);
    });

    it('aggregates all shards when querying partition root', async () => {
      await db.update(['days', '2026-09-11'], [{ id: 1 }]);
      await db.update(['days', '2026-09-12'], [{ id: 2 }]);

      const allDays = await db.query(['days']);
      expect(allDays).to.deep.equal({
        '2026-09-11': [{ id: 1 }],
        '2026-09-12': [{ id: 2 }],
      });
    });

    it('lists shards', async () => {
      await db.update(['days', '2026-09-11'], []);
      await db.update(['days', '2026-09-12'], []);

      const list = await db.listShards('days');
      expect(list).to.deep.equal(['2026-09-11', '2026-09-12']);
    });

    it('updates subpath within a shard', async () => {
      await db.update(['days', '2026-09-12'], { metadata: { status: 'ok' }, count: 1 });
      await db.update(['days', '2026-09-12', 'count'], 2);

      const res = await db.query(['days', '2026-09-12', 'count']);
      expect(res).to.equal(2);
    });

    it('removes an individual shard', async () => {
      await db.update(['days', '2026-09-11'], ['keep']);
      await db.update(['days', '2026-09-10'], ['delete']);

      await db.remove(['days', '2026-09-10']);

      expect(await db.query(['days', '2026-09-10'])).to.equal(null);
      expect(await db.listShards('days')).to.deep.equal(['2026-09-11']);
    });

    it('routes unsharded paths to root storage', async () => {
      await db.update(['settings', 'threshold'], 5);
      expect(await db.query(['settings', 'threshold'])).to.equal(5);

      // Root query merges root + sharded partitions
      await db.update(['days', '2026-09-12'], [{ status: 'online' }]);
      const full = await db.query([]);
      expect(full.settings).to.deep.equal({ threshold: 5 });
      expect(full.days['2026-09-12']).to.deep.equal([{ status: 'online' }]);
    });
  });

  describe('Filesystem Mode (Real Disk Shards)', () => {
    it('creates individual .json files in partition subdirectories', async () => {
      await withDir(async ({ path: tmpDir }) => {
        const db = new ShardedDatabase({
          baseDir: tmpDir,
          shards: ['days'],
        });

        await db.update(['days', '2026-09-11'], [{ v: 1 }]);
        await db.update(['days', '2026-09-12'], [{ v: 2 }]);

        // Verify files on disk
        const file11 = path.join(tmpDir, 'days', '2026-09-11.json');
        const file12 = path.join(tmpDir, 'days', '2026-09-12.json');

        const content11 = await fs.readFile(file11, 'utf8');
        expect(JSON.parse(content11)).to.deep.equal([{ v: 1 }]);

        const content12 = await fs.readFile(file12, 'utf8');
        expect(JSON.parse(content12)).to.deep.equal([{ v: 2 }]);

        // List shards from disk
        const shards = await db.listShards('days');
        expect(shards).to.deep.equal(['2026-09-11', '2026-09-12']);

        // Querying single day reads only that file
        const queryRes = await db.query(['days', '2026-09-12']);
        expect(queryRes).to.deep.equal([{ v: 2 }]);

        // Remove single day deletes the file from disk
        await db.remove(['days', '2026-09-11']);
        let exists = true;
        try {
          await fs.access(file11);
        } catch {
          exists = false;
        }
        expect(exists).to.be.false;

        // Still retains day 12
        expect(await db.listShards('days')).to.deep.equal(['2026-09-12']);
      }, { unsafeCleanup: true });
    });

    it('supports custom shardRule function', async () => {
      await withDir(async ({ path: tmpDir }) => {
        const db = new ShardedDatabase({
          baseDir: tmpDir,
          shardRule: (p) => {
            if (p[0] === 'metrics' && p[1]) {
              return {
                type: 'shard',
                partition: 'metrics',
                shardKey: p[1],
                subPath: p.slice(2),
              };
            }
            return null;
          }
        });

        await db.update(['metrics', 'device-abc'], { cpu: 20 });
        const metricFile = path.join(tmpDir, 'metrics', 'device-abc.json');
        const content = await fs.readFile(metricFile, 'utf8');
        expect(JSON.parse(content)).to.deep.equal({ cpu: 20 });

        expect(await db.query(['metrics', 'device-abc'])).to.deep.equal({ cpu: 20 });
      }, { unsafeCleanup: true });
    });
  });
});
