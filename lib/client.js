const fetch = require('node-fetch');

class Client {
  #url

  constructor(url) {
    this.#url = url;
  }

  async query(path) {
    let url = `${this.#url}/query`;
    if (path) {
      url = `${url}/${path}`;
    }
    const response = await fetch(url);
    if (response.status != 200) {
      throw Error(`${response.status} ${response.statusText}`);
    }
    return await response.text();
  }

  async update(path, value) {
    const url = `${this.#url}/update/${path}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(value),
    });
    if (response.status != 200) {
      throw Error(`${response.status} ${response.statusText}`);
    }
    return await this.query(path);
  }
}

module.exports = Client;
