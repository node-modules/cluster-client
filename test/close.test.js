'use strict';

const fs = require('fs');
const net = require('net');
const path = require('path');
const cluster = require('../');
const assert = require('assert');
const CloseClient = require('./supports/close_client');

describe('test/close.test.js', () => {
  let port;
  before(done => {
    const server = net.createServer();
    server.listen(0, () => {
      port = server.address().port;
      server.close();
      done();
    });
  });

  it('should delegate close ok', function* () {
    const leader = cluster(CloseClient, { port })
      .delegate('destroy', 'close')
      .create();

    yield leader.ready();
    assert(fs.existsSync(path.join(__dirname, `supports/${process.version}.bin`)));
    yield leader.destroy();
    assert(!fs.existsSync(path.join(__dirname, `supports/${process.version}.bin`)));
  });

});
