'use strict';

const net = require('net');
const mm = require('egg-mock');
const assert = require('assert');
const Base = require('sdk-base');
const originCluster = require('../');
const sleep = require('mz-modules/sleep');
const APIClient = require('./supports/api_client');

describe('test/lazy.test.js', () => {
  let port;
  let isLeader = false;

  function cluster(clientClass, options) {
    options = options || {};
    options.port = port;
    options.isLeader = isLeader;
    const client = originCluster(clientClass, options);
    return client;
  }

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

  afterEach(mm.restore);

  it('should support follower create before leader', function* () {
    const follower = new APIClient({ cluster });
    yield sleep(3000);

    isLeader = true;
    const leader = new APIClient({ cluster });

    yield Promise.all([
      leader.ready(),
      follower.ready(),
    ]);

    const ret = yield follower.echo('hello');
    assert(ret === 'hello');

    yield Promise.all([
      follower.close(),
      leader.close(),
    ]);
  });

  it('should follower ready failed if leader is failed', function* () {
    class ErrorClient extends Base {
      constructor() {
        super({ initMethod: '_init' });
      }

      * _init() {
        throw new Error('init failed');
      }
    }

    class APIErrorClient extends APIClient {
      get DataClient() {
        return ErrorClient;
      }

      get clusterOptions() {
        return {
          name: 'error_client_test',
        };
      }
    }

    isLeader = false;
    const follower = new APIErrorClient({ cluster });
    yield sleep(3000);

    isLeader = true;
    const leader = new APIErrorClient({ cluster });

    try {
      yield follower.ready();
      assert(false, 'should not run here');
    } catch (err) {
      assert(err.message === 'init failed');
    }

    try {
      yield leader.ready();
      assert(false, 'should not run here');
    } catch (err) {
      assert(err.message === 'init failed');
    }

    yield Promise.all([
      follower.close(),
      leader.close(),
    ]);
  });
});
