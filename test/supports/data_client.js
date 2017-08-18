'use strict';

const Base = require('sdk-base');
const sleep = require('mz-modules/sleep');

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
