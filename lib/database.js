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
  #storage;

  constructor(storage) {
    this.#storage = storage;
  }

  async query(path = []) {
    const json = await this.#storage.read();
    return walkJson(json, path);
  }

  async update(path, item) {
    if (!path || path.length === 0) {
      await this.#storage.write(item);
      return item;
    }
    const json = await this.#storage.read();
    const parentPath = path.slice(0, path.length - 1);
    const parent = walkJson(json, parentPath);
    if (parent == null ||
        (parent.constructor !== Object && !Array.isArray(parent))) {
      throw new Error(`Path ${parentPath} does not resolve to an Object.`);
    }
    parent[path[path.length - 1]] = item;
    await this.#storage.write(json);
    return item;
  }

  async remove(path) {
    if (!path || path.length === 0) {
      await this.#storage.write({});
      return {};
    }
    const json = await this.#storage.read();
    const parentPath = path.slice(0, path.length - 1);
    const parent = walkJson(json, parentPath);
    if (parent == null ||
        (parent.constructor !== Object && !Array.isArray(parent))) {
      throw new Error(`Path ${parentPath} does not resolve to an Object.`);
    }
    const key = path[path.length - 1];
    if (Array.isArray(parent)) {
      const idx = parseInt(key, 10);
      if (!isNaN(idx) && idx >= 0 && idx < parent.length) {
        parent.splice(idx, 1);
      }
    } else {
      delete parent[key];
    }
    await this.#storage.write(json);
    return json;
  }
}

module.exports = Database;
