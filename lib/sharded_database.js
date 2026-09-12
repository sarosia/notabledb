const pathModule = require('path');
const fs = require('fs').promises;
const os = require('os');
const Database = require('./database');
const FilesystemStorage = require('./filesystem_storage');
const InMemoryStorage = require('./in_memory_storage');

function resolveHome(p) {
  if (!p) return p;
  if (p === '~') return os.homedir();
  if (p.startsWith('~/') || p.startsWith('~\\')) {
    return pathModule.join(os.homedir(), p.slice(2));
  }
  return pathModule.resolve(p);
}

class ShardedDatabase {
  #baseDir;
  #shardsConfig = new Set();
  #shardRule;
  #createStorage;
  #customListShards;
  #customRemoveShard;
  #shardDatabases = new Map(); // key -> Database instance
  #inMemoryStore = new Map();  // partition -> Map(shardKey -> InMemoryStorage)
  #rootDb;

  constructor(options = {}) {
    if (options.baseDir) {
      this.#baseDir = resolveHome(options.baseDir);
    }

    if (options.shardRule && typeof options.shardRule === 'function') {
      this.#shardRule = options.shardRule;
    }

    // Configure sharded partitions (e.g. { days: true } or ['days'])
    if (options.shards) {
      if (Array.isArray(options.shards)) {
        for (const s of options.shards) this.#shardsConfig.add(String(s));
      } else if (typeof options.shards === 'object') {
        for (const [k, v] of Object.entries(options.shards)) {
          if (v) this.#shardsConfig.add(String(k));
        }
      }
    }

    this.#createStorage = options.createStorage;
    this.#customListShards = options.listShards;
    this.#customRemoveShard = options.removeShard;
  }

  #isShardedPartition(partition) {
    if (!partition) return false;
    return this.#shardsConfig.has(partition);
  }

  #getShardKey(partition, shardKey) {
    return `${partition}:${shardKey}`;
  }

  _route(path = []) {
    if (!path || path.length === 0) {
      return { type: 'root', path: [] };
    }

    // Custom shard rule provided
    if (this.#shardRule) {
      const custom = this.#shardRule(path);
      if (custom) return custom;
    }

    // Path-based rule: if first token is a registered sharded partition
    const partition = String(path[0]);
    if (this.#isShardedPartition(partition)) {
      if (path.length === 1) {
        return {
          type: 'partition_root',
          partition,
        };
      }
      return {
        type: 'shard',
        partition,
        shardKey: String(path[1]),
        subPath: path.slice(2),
      };
    }

    // Default: unsharded root path
    return {
      type: 'root',
      path,
    };
  }

  #getOrCreateStorage(partition, shardKey) {
    if (this.#createStorage) {
      return this.#createStorage(partition, shardKey);
    }

    if (this.#baseDir) {
      const fileName = `${shardKey}.json`;
      const fullPath = partition
        ? pathModule.join(this.#baseDir, partition, fileName)
        : pathModule.join(this.#baseDir, fileName);
      return new FilesystemStorage(fullPath);
    }

    // Default in-memory
    if (!this.#inMemoryStore.has(partition)) {
      this.#inMemoryStore.set(partition, new Map());
    }
    const partMap = this.#inMemoryStore.get(partition);
    if (!partMap.has(shardKey)) {
      partMap.set(shardKey, new InMemoryStorage());
    }
    return partMap.get(shardKey);
  }

  getShardDatabase(partition, shardKey) {
    const key = this.#getShardKey(partition, shardKey);
    if (!this.#shardDatabases.has(key)) {
      const storage = this.#getOrCreateStorage(partition, shardKey);
      this.#shardDatabases.set(key, new Database(storage));
    }
    return this.#shardDatabases.get(key);
  }

  getRootDatabase() {
    if (!this.#rootDb) {
      const storage = this.#getOrCreateStorage('', '_root');
      this.#rootDb = new Database(storage);
    }
    return this.#rootDb;
  }

  async listShards(partition) {
    if (this.#customListShards) {
      return await this.#customListShards(partition);
    }

    if (this.#baseDir) {
      const dirPath = pathModule.join(this.#baseDir, partition);
      try {
        const entries = await fs.readdir(dirPath);
        return entries
          .filter(f => f.endsWith('.json'))
          .map(f => f.slice(0, -5))
          .sort();
      } catch (e) {
        return [];
      }
    }

    const partMap = this.#inMemoryStore.get(partition);
    if (!partMap) return [];
    return Array.from(partMap.keys()).sort();
  }

  async hasShard(partition, shardKey) {
    if (this.#customListShards) {
      const list = await this.listShards(partition);
      return list.includes(shardKey);
    }

    if (this.#baseDir) {
      const filePath = pathModule.join(this.#baseDir, partition, `${shardKey}.json`);
      try {
        await fs.access(filePath);
        return true;
      } catch {
        return false;
      }
    }

    const partMap = this.#inMemoryStore.get(partition);
    return !!(partMap && partMap.has(shardKey));
  }

  async query(path = []) {
    const route = this._route(path);

    if (route.type === 'shard') {
      const exists = await this.hasShard(route.partition, route.shardKey);
      if (!exists && route.subPath.length === 0) {
        return null;
      }
      const db = this.getShardDatabase(route.partition, route.shardKey);
      return await db.query(route.subPath);
    }

    if (route.type === 'partition_root') {
      const shards = await this.listShards(route.partition);
      const result = {};
      await Promise.all(
        shards.map(async (sk) => {
          const db = this.getShardDatabase(route.partition, sk);
          result[sk] = await db.query([]);
        })
      );
      return result;
    }

    if (route.type === 'root') {
      if (!route.path || route.path.length === 0) {
        const rootData = (await this.getRootDatabase().query([])) || {};
        for (const p of this.#shardsConfig) {
          rootData[p] = await this.query([p]);
        }
        return rootData;
      }
      return await this.getRootDatabase().query(route.path);
    }

    return null;
  }

  async #ensureIntermediatePath(db, targetPath) {
    if (!targetPath || targetPath.length <= 1) return;
    for (let i = 1; i < targetPath.length; i++) {
      const sub = targetPath.slice(0, i);
      const existing = await db.query(sub);
      if (existing == null) {
        await db.update(sub, {});
      }
    }
  }

  async update(path, item) {
    const route = this._route(path);

    if (route.type === 'shard') {
      const db = this.getShardDatabase(route.partition, route.shardKey);
      await this.#ensureIntermediatePath(db, route.subPath);
      return await db.update(route.subPath, item);
    }

    if (route.type === 'partition_root') {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        await Promise.all(
          Object.entries(item).map(([sk, val]) => {
            const db = this.getShardDatabase(route.partition, sk);
            return db.update([], val);
          })
        );
        return item;
      }
      throw new Error(`Cannot update partition root ${route.partition} with non-object.`);
    }

    if (route.type === 'root') {
      await this.#ensureIntermediatePath(this.getRootDatabase(), route.path);
      return await this.getRootDatabase().update(route.path, item);
    }

    return item;
  }

  async remove(path = []) {
    const route = this._route(path);

    if (route.type === 'shard') {
      // Removing entire shard
      if (route.subPath.length === 0) {
        return await this.#deleteShard(route.partition, route.shardKey);
      }
      // Removing nested item within shard
      const db = this.getShardDatabase(route.partition, route.shardKey);
      return await db.remove(route.subPath);
    }

    if (route.type === 'partition_root') {
      const shards = await this.listShards(route.partition);
      await Promise.all(shards.map(sk => this.#deleteShard(route.partition, sk)));
      return {};
    }

    if (route.type === 'root') {
      return await this.getRootDatabase().remove(route.path);
    }

    return {};
  }

  async #deleteShard(partition, shardKey) {
    const cacheKey = this.#getShardKey(partition, shardKey);
    this.#shardDatabases.delete(cacheKey);

    if (this.#customRemoveShard) {
      return await this.#customRemoveShard(partition, shardKey);
    }

    if (this.#baseDir) {
      const filePath = pathModule.join(this.#baseDir, partition, `${shardKey}.json`);
      try {
        await fs.unlink(filePath);
      } catch (e) {
        // ignore if already deleted
      }
      return {};
    }

    const partMap = this.#inMemoryStore.get(partition);
    if (partMap) {
      partMap.delete(shardKey);
    }
    return {};
  }
}

module.exports = ShardedDatabase;
