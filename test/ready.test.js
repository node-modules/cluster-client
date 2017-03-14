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
  }

  it('should ready failed', done => {
    const client = new APIClient();
    client.ready(err => {
      assert(err && err.message === 'mock error');
      done();
    });
  });
});
