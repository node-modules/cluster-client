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

  it('should work ok', async function() {
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

    let ret = await client_1.await('foo_received');
    assert(is.array(ret) && ret.length === 0);

    client_2.subscribe({ key: 'foo' }, val => {
      client_2.emit('foo_received', val);
    });
    client_2.subscribe({ key: 'foo' }, listener_2);
    ret = await client_2.await('foo_received');
    assert(is.array(ret) && ret.length === 0);

    client_2.subscribe({ key: 'foo' }, val => {
      client_2.emit('foo_received_again', val);
    });
    ret = await client_2.await('foo_received_again');
    assert(is.array(ret) && ret.length === 0);

    // publish
    client_2.publish({ key: 'foo', value: 'bar' });

    let rs = await Promise.all([
      client_1.await('foo_received'),
      client_2.await('foo_received'),
    ]);
    assert(is.array(rs[0]) && rs[0].length === 1);
    assert(rs[0][0] === 'bar');
    assert(is.array(rs[1]) && rs[1].length === 1);
    assert(rs[1][0] === 'bar');

    // unPublish
    client_2.unPublish({ key: 'foo', value: 'bar' });

    rs = await Promise.all([
      client_1.await('foo_received_1'),
      client_2.await('foo_received_2'),
    ]);
    assert(is.array(rs[0]) && rs[0].length === 0);
    assert(is.array(rs[1]) && rs[1].length === 0);

    // unSubscribe
    client_1.unSubscribe({ key: 'foo' }, listener_1);
    client_2.unSubscribe({ key: 'foo' }, listener_2);

    // publish again
    client_2.publish({ key: 'foo', value: 'bar_1' });

    await Promise.all([
      new Promise((resolve, reject) => {
        setTimeout(resolve, 3000);
        client_1.once('foo_received_1', () => { reject(new Error('should not run here')); });
      }),
      new Promise((resolve, reject) => {
        setTimeout(resolve, 3000);
        client_2.once('foo_received_2', () => { reject(new Error('should not run here')); });
      }),
    ]);

    client_1.unSubscribe({ key: 'foo' });
    client_2.unSubscribe({ key: 'foo' });

    client_2.publish({ key: 'foo', value: 'bar_2' });

    await Promise.all([
      new Promise((resolve, reject) => {
        setTimeout(resolve, 3000);
        client_1.once('foo_received', () => { reject(new Error('should not run here')); });
      }),
      new Promise((resolve, reject) => {
        setTimeout(resolve, 3000);
        client_2.once('foo_received', () => { reject(new Error('should not run here')); });
      }),
    ]);

    client_1.close();
    client_2.close();
  });

  it('should subscribe for second time', async function() {
    const client = new ClusterClient();
    client.publish({ key: 'foo', value: 'bar' });

    client.subscribe({ key: 'foo' }, val => {
      client.emit('foo_received_1', val);
    });

    let ret = await client.await('foo_received_1');
    assert.deepEqual(ret, [ 'bar' ]);

    client.subscribe({ key: 'foo' }, val => {
      client.emit('foo_received_2', val);
    });
    ret = await client.await('foo_received_2');
    assert.deepEqual(ret, [ 'bar' ]);

    await client.close();
  });

  class ErrorClient extends Base {
    constructor() {
      super({ initMethod: '_init' });

      this.data = '';
    }

    async _init() {
      await sleep(1000);
      throw new Error('mock error');
    }

    send(data) {
      console.log('send', data);
    }

    async getData() {
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

    async _init() {
      await sleep(1000);
      throw new Error('mock error');
    }

    send(data) {
      this._client.send(data);
    }

    async getData() {
      return await this._client.getData();
    }
  }

  it('should invoke with ready err', async function() {
    const leader = new APIClient();
    try {
      await leader.getData();
      assert(false);
    } catch (err) {
      assert(err && err.message === 'mock error');
    }

    const follower = new APIClient();

    try {
      await follower.getData();
      assert(false);
    } catch (err) {
      assert(err && err.message === 'mock error');
    }

    await follower.close();
    await follower.close();
  });

  it('invokeOneway + ready error', async function() {
    const client = new APIClient();
    client.send(123);
    try {
      await client.ready();
    } catch (err) {
      assert(err.message === 'mock error');
    }

    const client2 = new APIClient();
    client2.send(321);
    try {
      await client2.ready();
    } catch (err) {
      assert(err.message === 'mock error');
    }

    client.send(123);
    client2.send(321);

    await sleep(2000);

    await client.close();
    await client2.close();
  });
});
