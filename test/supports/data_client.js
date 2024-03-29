const Base = require('sdk-base');
const { sleep } = require('../../lib/utils');

class DataClient extends Base {
  constructor() {
    super({ initMethod: '_init' });
  }

  * _init() {
    yield sleep(5000);
  }

  * echo(str) {
    return str;
  }
}

module.exports = DataClient;
