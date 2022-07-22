/*
 * A Storage class provides a interface to manage storage for some JSON objects.
 *
 * Storages are hierarchical, which means that a storage can have some child
 * storages. Child storages are isolated from each other with a unique
 * namespace.
 *
 * Also note that all operations are asynchronous to support potentially remote 
 * data access.
 */
class Storage {
  #namespace

  constructor(namespace) {
    this.#namespace = namespace;
  }

  get namespace() {
    return this.#namespace;
  }

  /*
   * Returns a child storage with the given namespace. If the child does not
   * exist it will create one with an empty JSON.
   */
  async getChild(namespace) {
    throw new Error('Unimplemented');
  }

  /*
   * Deletes a child storage with the given namespace. It is a noop if the
   * child does not exist.
   */
  async removeChild(namespace) {
    throw new Error('Unimplemented');
  }

  /*
   * Returns the parent of this storage. Returns null if it does not have a
   * parent, e.g., it is the root storage or it was deleted from the parent.
   */
  async getParent() {
    throw new Error('Unimplemented');
  }

  /*
   * Writes the JSON object into the storage.
   */
  async write(json) {
    throw new Error('Unimplemented');
  }

  /*
   * Reads the JSON object from the storage.
   */
  async read() {
    throw new Error('Unimplemented');
  }
}

module.exports = Storage;
