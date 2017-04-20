'use strict';

const net = require('net');
const assert = require('assert');
const Base = require('sdk-base');
const APIClientBase = require('..').APIClientBase;

describe('test/ready.test.js', () => {
  let port;
  before(done => {
    const server = net.createServer();
    server.listen(0, () => {
      const address = server.address();
      port = address.port;
      console.log('using port =>', port);
      server.close();
      done();
    });
  });

  class ErrorClient extends Base {
    constructor() {
      super();
      setImmediate(() => {
        this.ready(new Error('mock error'));
      });
    }

    * getData() {
      return '123';
    }

    close() {}
  }

  class APIClient extends APIClientBase {
    get DataClient() {
      return ErrorClient;
    }

    get clusterOptions() {
      return {
        port,
      };
    }

    * getData() {
      return yield this._client.getData();
    }

    close() {
      return this._client.close();
    }
  }

  it('should ready failed', function* () {
    const client = new APIClient();
    try {
      yield client.ready();
      assert(false, 'should not run here');
    } catch (err) {
      assert(err.message === 'mock error');
    }
    yield client.close();
  });

  it('should invoke with error while client ready failed', function* () {
    const client_1 = new APIClient();
    try {
      yield client_1.getData();
      assert(false, 'should not run here');
    } catch (err) {
      assert(err && err.message === 'mock error');
    }
    const client_2 = new APIClient();
    try {
      yield client_2.getData();
      assert(false, 'should not run here');
    } catch (err) {
      assert(err && err.message === 'mock error');
    }
    yield client_2.close();
    yield client_1.close();
  });
});
