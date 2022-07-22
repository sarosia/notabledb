function walkJson(json, paths) {
  let item = json;
  for (const token of paths) {
    if (!(item instanceof Object)) {
      return null;
    }
    item = item[token];
  }
  return item === undefined ? null : item;
}

class Database {
  #storage

  constructor(storage) {
    this.#storage = storage;
  }

  async query(path) {
    const json = await this.#storage.read();
    return walkJson(json, path);
  }

  async update(path, item) {
    const json = await this.#storage.read();
    const parentPath = path.slice(0, path.length - 1);
    const parent = walkJson(json, parentPath);
    if (parent == null || parent.constructor != Object) {
      throw new Error(`Path ${parentPath} does not resolve to an Object.`);
    }
    parent[path[path.length - 1]] = item;
    await this.#storage.write(json);
  }
}

module.exports = Database;
