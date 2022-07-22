const fs = require('fs').promises;
const Storage = require('./storage');

class FilesystemStorage extends Storage {
  #path

  constructor(path, namespace = '') {
    super(namespace);
    this.#path = path;
  }

  async getChild(namespace) {
    new FilesystemStorage(path.joinPath(this.#path, namespace), namespace);
  }

  async removeChild(namespace) {}

  async getParent() {}

  async write(json) {
    await fs.writeFile(this.#path, JSON.stringify(json));
  }

  async read() {
    try {
      const data = await fs.readFile(this.#path, {
        encoding: 'utf8',
      });
      return JSON.parse(data);
    } catch (e) {
      return {};
    }
  }
}

module.exports = FilesystemStorage;
