const fs = require('fs').promises;
const pathModule = require('path');
const os = require('os');
const Storage = require('./storage');

class FilesystemStorage extends Storage {
  #path;

  constructor(path, namespace = '') {
    super(namespace);
    let resolved = path;
    if (resolved === '~') {
      resolved = os.homedir();
    } else if (resolved &&
               (resolved.startsWith('~/') || resolved.startsWith('~\\'))) {
      resolved = pathModule.join(os.homedir(), resolved.slice(2));
    }
    this.#path = pathModule.resolve(resolved);
  }

  async getChild(namespace) {
    return new FilesystemStorage(
        pathModule.join(this.#path, namespace), namespace);
  }

  async removeChild(namespace) {}

  async getParent() {}

  async write(json) {
    const dir = pathModule.dirname(this.#path);
    if (dir && dir !== '.') {
      await fs.mkdir(dir, {recursive: true});
    }
    await fs.writeFile(this.#path, JSON.stringify(json), 'utf8');
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
