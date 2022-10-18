'use strict';

const Base = require('sdk-base');

class DataClient extends Base {
  constructor(options = {}) {
    super(options);
  }

  async _init() {
    // ...
  }

  subscribe(reg, listener) {
    const { key } = reg;
    const match = key.match(/timeout:(\d+)/);
    if (!match) {
      throw new Error('not a timeout key');
    }
    setTimeout(() => {
      listener('hello:' + match[1]);
    }, +match[1]);
  }

  close() {
  }
}

module.exports = DataClient;
