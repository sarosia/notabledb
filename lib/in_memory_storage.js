const Storage = require('./storage');

class InMemoryStorage extends Storage {
  #json = "{}"
  #parent = null
  #children = {}

  constructor(parent = null) {
    super();
    this.#parent = parent;
  }

  async getChild(namespace) {
    if (!this.#children[namespace]) {
      this.#children[namespace] = new InMemoryStorage(this);
    }
    return this.#children[namespace];
  }

  async removeChild(namespace) {
    if (this.#children[namespace]) {
      delete this.#children[namespace];
    }
  }

  async getParent() {
    return this.#parent;
  }

  async write(json) {
    this.#json = JSON.stringify(json);
  }

  async read() {
    return JSON.parse(this.#json);
  }
}

module.exports = InMemoryStorage;
