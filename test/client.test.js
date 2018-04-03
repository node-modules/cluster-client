'use strict';

const net = require('net');
const Base = require('sdk-base');
const APIClientBase = require('..').APIClientBase;
const is = require('is-type-of');
const assert = require('assert');
const sleep = require('mz-modules/sleep');

describe('test/client.test.js', () => {
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

  class ClusterClient extends APIClientBase {
    get DataClient() {
      return require('./supports/client');
    }

    get delegates() {
      return {
        unPublish: 'invokeOneway',
      };
    }

    get clusterOptions() {
      return {
        responseTimeout: 1000,
        port,
      };
    }

    subscribe(...args) {
      return this._client.subscribe(...args);
    }

    unSubscribe(...args) {
      return this._client.unSubscribe(...args);
    }

    publish(...args) {
      return this._client.publish(...args);
    }

    unPublish(...args) {
      return this._client.unPublish(...args);
    }

    close() {
      return this._client.close();
    }
  }

  it('should work ok', function* () {
    const client_1 = new ClusterClient();
    const client_2 = new ClusterClient();

    const listener_1 = val => {
      client_1.emit('foo_received_1', val);
    };
    const listener_2 = val => {
      client_2.emit('foo_received_2', val);
    };

    // subscribe
    client_1.subscribe({ key: 'foo' }, val => {
      client_1.emit('foo_received', val);
    });
    client_1.subscribe({ key: 'foo' }, listener_1);

    let ret = yield client_1.await('foo_received');
    assert(is.array(ret) && ret.length === 0);

    client_2.subscribe({ key: 'foo' }, val => {
      client_2.emit('foo_received', val);
    });
    client_2.subscribe({ key: 'foo' }, listener_2);
    ret = yield client_2.await('foo_received');
    assert(is.array(ret) && ret.length === 0);

    client_2.subscribe({ key: 'foo' }, val => {
      client_2.emit('foo_received_again', val);
    });
    ret = yield client_2.await('foo_received_again');
    assert(is.array(ret) && ret.length === 0);

    // publish
    client_2.publish({ key: 'foo', value: 'bar' });

    let rs = yield [
      client_1.await('foo_received'),
      client_2.await('foo_received'),
    ];
    assert(is.array(rs[ 0 ]) && rs[ 0 ].length === 1);
    assert(rs[ 0 ][ 0 ] === 'bar');
    assert(is.array(rs[ 1 ]) && rs[ 1 ].length === 1);
    assert(rs[ 1 ][ 0 ] === 'bar');

    // unPublish
    client_2.unPublish({ key: 'foo', value: 'bar' });

    rs = yield [
      client_1.await('foo_received_1'),
      client_2.await('foo_received_2'),
    ];
    assert(is.array(rs[ 0 ]) && rs[ 0 ].length === 0);
    assert(is.array(rs[ 1 ]) && rs[ 1 ].length === 0);

    // unSubscribe
    client_1.unSubscribe({ key: 'foo' }, listener_1);
    client_2.unSubscribe({ key: 'foo' }, listener_2);

    // publish again
    client_2.publish({ key: 'foo', value: 'bar_1' });

    yield [
      function* () {
        yield new Promise((resolve, reject) => {
          setTimeout(resolve, 3000);
          client_1.once('foo_received_1', () => {
            reject(new Error('should not run here'));
          });
        });
      },
      function* () {
        yield new Promise((resolve, reject) => {
          setTimeout(resolve, 3000);
          client_2.once('foo_received_2', () => {
            reject(new Error('should not run here'));
          });
        });
      },
    ];

    client_1.unSubscribe({ key: 'foo' });
    client_2.unSubscribe({ key: 'foo' });

    client_2.publish({ key: 'foo', value: 'bar_2' });

    yield [
      function* () {
        yield new Promise((resolve, reject) => {
          setTimeout(resolve, 3000);
          client_1.once('foo_received', () => {
            reject(new Error('should not run here'));
          });
        });
      },
      function* () {
        yield new Promise((resolve, reject) => {
          setTimeout(resolve, 3000);
          client_2.once('foo_received', () => {
            reject(new Error('should not run here'));
          });
        });
      },
    ];

    client_1.close();
    client_2.close();
  });

  it('should subscribe for second time', function* () {
    const client = new ClusterClient();
    client.publish({ key: 'foo', value: 'bar' });

    client.subscribe({ key: 'foo' }, val => {
      client.emit('foo_received_1', val);
    });

    let ret = yield client.await('foo_received_1');
    assert.deepEqual(ret, [ 'bar' ]);

    client.subscribe({ key: 'foo' }, val => {
      client.emit('foo_received_2', val);
    });
    ret = yield client.await('foo_received_2');
    assert.deepEqual(ret, [ 'bar' ]);

    yield client.close();
  });

  class ErrorClient extends Base {
    constructor() {
      super({ initMethod: '_init' });
      this.data = '';
    }

    * _init() {
      yield sleep(1000);
      const error = new Error('mock error');
      error.code = 'ERROR_CODE';
      throw error;
    }

    send(data) {
      console.log('send', data);
    }

    * getData() {
      return this.data;
    }
  }

  class APIClient extends APIClientBase {
    get DataClient() {
      return ErrorClient;
    }

    get delegates() {
      return {
        send: 'invokeOneway',
      };
    }

    get clusterOptions() {
      return {
        name: 'test_invokeOneway_ready_error',
        port,
      };
    }

    * _init() {
      throw new Error('mock error');
    }

    send(data) {
      this._client.send(data);
    }

    * getData() {
      return yield this._client.getData();
    }
  }

  it('should invoke with ready err', function* () {
    const leader = new APIClient();
    try {
      yield leader.getData();
      assert(false);
    } catch (err) {
      assert(err && err.message === 'mock error');
      assert.strictEqual(err.code, 'ERROR_CODE');
    }

    const follower = new APIClient();

    try {
      yield follower.getData();
      assert(false);
    } catch (err) {
      assert(err && err.message === 'mock error');
      assert.strictEqual(err.code, 'ERROR_CODE');
    }

    yield follower.close();
    yield follower.close();
  });

  it('invokeOneway + ready error', function* () {
    const client = new APIClient();
    client.send(123);
    try {
      yield client.ready();
    } catch (err) {
      assert(err.message === 'mock error');
    }

    const client2 = new APIClient();
    client2.send(321);
    try {
      yield client2.ready();
    } catch (err) {
      assert(err.message === 'mock error');
    }

    client.send(123);
    client2.send(321);

    yield sleep(2000);

    yield client.close();
    yield client2.close();
  });
});
