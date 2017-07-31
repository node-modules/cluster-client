'use strict';

const fs = require('fs');
const net = require('net');
const path = require('path');
const cluster = require('../');
const Base = require('sdk-base');
const assert = require('assert');
const CloseClient = require('./supports/close_client');
const RegistyClient = require('./supports/registry_client');

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

  it('should APIClient has default close', function* () {
    class APIClient extends cluster.APIClientBase {
      get DataClient() {
        return CloseClient;
      }

      get clusterOptions() {
        return { port };
      }
    }

    let client = new APIClient();
    yield client.ready();
    yield client.close();

    class APIClient2 extends cluster.APIClientBase {
      get DataClient() {
        return RegistyClient;
      }

      get clusterOptions() {
        return { port };
      }
    }

    client = new APIClient2();
    yield client.ready();
    yield client.close();
  });

  it('should handle error event after closed', function* () {
    class DataClient extends Base {
      constructor(options) {
        super(options);
        this.ready(true);
      }

      close() {
        setTimeout(() => {
          this.emit('error', new Error('mock error'));
        }, 2000);
      }
    }

    const leader = cluster(DataClient, { port })
      .create();

    yield leader.ready();
    yield leader.close();

    try {
      yield leader.await('error');
    } catch (err) {
      assert(err.message === 'mock error');
    }

    // close again should work
    yield leader.close();
  });
});
