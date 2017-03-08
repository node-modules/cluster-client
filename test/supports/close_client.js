'use strict';

const fs = require('fs');
const path = require('path');
const Base = require('sdk-base');

class CloseClient extends Base {
  constructor(options) {
    super(options);

    fs.writeFileSync(path.join(__dirname, `${process.version}.bin`), 'ok');
    this.ready(true);
  }

  destroy() {
    fs.unlinkSync(path.join(__dirname, `${process.version}.bin`));
  }
}

module.exports = CloseClient;
