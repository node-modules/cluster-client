const Base = require('sdk-base');
const { sleep } = require('../../lib/utils');

class DataClient extends Base {
  constructor() {
    super({ initMethod: '_init' });
  }

  async _init() {
    await sleep(5000);
  }

  async echo(str) {
    await sleep(10);
    return str;
  }
}

module.exports = DataClient;
