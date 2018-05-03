'use strict';

const spy = require('spy');
const net = require('net');
const URL = require('url');
const mm = require('egg-mock');
const cluster = require('../');
const is = require('is-type-of');
const Base = require('sdk-base');
const assert = require('assert');
const pedding = require('pedding');
const serverMap = global.serverMap;
const symbols = require('../lib/symbol');
const ClusterServer = require('../lib/server');
const NotifyClient = require('./supports/notify_client');
const RegistryClient = require('./supports/registry_client');
const portDelta = Number(process.versions.node.slice(0, 1));

describe('test/index.test.js', () => {

  afterEach(mm.restore);

  describe('RegistryClient', () => {
    const port = 8880 + portDelta;
    let leader;
    let follower;
    beforeEach(() => {
      leader = cluster(RegistryClient, { port, isLeader: true })
        .delegate('subscribe', 'subscribe')
        .delegate('publish', 'publish')
        .override('foo', 'bar')
        .create();
      follower = cluster(RegistryClient, { port, isLeader: false }).create();
    });

    afterEach(function* () {
      assert(serverMap.has(port) === true);
      yield Promise.race([
        cluster.close(follower),
        follower.await('error'),
      ]);
      yield Promise.race([
        cluster.close(leader),
        leader.await('error'),
      ]);
      assert(leader[symbols.innerClient]._realClient.closed === true); // make sure real client is closed
      assert(serverMap.has(port) === false); // make sure net.Server is closed
    });

    it('should have subscribe/publish method', () => {
      assert(is.function(leader.subscribe));
      assert(is.function(leader.publish));
      assert(is.function(follower.subscribe));
      assert(is.function(follower.publish));
      assert(leader.foo === 'bar');
    });

    it('should subscribe ok', done => {
      done = pedding(done, 3);
      let leader_trigger = false;
      let follower_trigger = false;
      let follower_trigger_2 = false;

      leader.subscribe({
        dataId: 'com.alibaba.dubbo.demo.DemoService',
      }, val => {
        assert(val && val.length > 0);
        if (val.length === 2 && !leader_trigger) {
          assert(val.some(url => url.host === '30.20.78.299:20880'));
          assert(val.some(url => url.host === '30.20.78.300:20880'));
          leader_trigger = true;
          done();
        }
      });

      follower.subscribe({
        dataId: 'com.alibaba.dubbo.demo.DemoService',
      }, val => {
        assert(val && val.length > 0);
        if (val.length === 2 && !follower_trigger) {
          assert(val.some(url => url.host === '30.20.78.299:20880'));
          assert(val.some(url => url.host === '30.20.78.300:20880'));
          follower_trigger = true;
          done();
        }
      });

      setTimeout(() => {
        // double subscribe
        follower.subscribe({
          dataId: 'com.alibaba.dubbo.demo.DemoService',
        }, val => {
          assert(val && val.length > 0);
          if (val.length === 2 && !follower_trigger_2) {
            assert(val.some(url => url.host === '30.20.78.299:20880'));
            assert(val.some(url => url.host === '30.20.78.300:20880'));
            follower_trigger_2 = true;
            done();
          }
        });
      }, 3000);

      leader.publish({
        dataId: 'com.alibaba.dubbo.demo.DemoService',
        publishData: 'dubbo://30.20.78.299:20880/com.alibaba.dubbo.demo.DemoService?anyhost=true&application=demo-provider&dubbo=2.0.0&generic=false&interface=com.alibaba.dubbo.demo.DemoService&loadbalance=roundrobin&methods=sayHello&owner=william&pid=81281&side=provider&timestamp=1481613276143',
      });
      follower.publish({
        dataId: 'com.alibaba.dubbo.demo.DemoService',
        publishData: 'dubbo://30.20.78.300:20880/com.alibaba.dubbo.demo.DemoService?anyhost=true&application=demo-provider&dubbo=2.0.0&generic=false&interface=com.alibaba.dubbo.demo.DemoService&loadbalance=roundrobin&methods=sayHello&owner=william&pid=81281&side=provider&timestamp=1481613276143',
      });
    });

    it('should should not close net.Server if other client is using same port', function* () {
      class AnotherClient extends Base {
        constructor() {
          super();
          this.ready(true);
        }
      }
      const anotherleader = cluster(AnotherClient, { port, isLeader: true }).create();
      yield anotherleader.ready();

      // assert has problem with global scope virable
      // assert(serverMap.has(port) === true);
      if (!serverMap.has(port)) throw new Error();
      yield cluster.close(anotherleader);

      // leader is using the same port, so anotherleader.close should not close the net.Server
      if (!serverMap.has(port)) throw new Error();
    });

    it('should realClient.close be a generator function ok', function* () {
      class RealClientWithGeneratorClose extends Base {
        constructor() {
          super();
          this.ready(true);
        }

        * close() {
          this.closed = true;
        }
      }
      const anotherleader = cluster(RealClientWithGeneratorClose, { port, isLeader: true }).create();
      yield anotherleader.ready();
      yield cluster.close(anotherleader);
      // make sure real client is closed;
      // assert has problem with global scope virable
      if (anotherleader[symbols.innerClient]._realClient.closed !== true) {
        throw new Error();
      }
    });

    it('should realClient.close be a normal function ok', function* () {
      class RealClientWithNormalClose extends Base {
        constructor() {
          super();
          this.ready(true);
        }
        close() {
          this.closed = true;
        }
      }
      const anotherleader = cluster(RealClientWithNormalClose, { port, isLeader: true }).create();
      yield anotherleader.ready();
      yield cluster.close(anotherleader);
      // make sure real client is closed;
      // assert has problem with global scope virable
      if (anotherleader[symbols.innerClient]._realClient.closed !== true) {
        throw new Error();
      }
    });

    it('should realClient.close be a function returning promise ok', function* () {
      class RealClientWithCloseReturningPromise extends Base {
        constructor() {
          super();
          this.ready(true);
        }
        close() {
          this.closed = true;
        }
      }
      const anotherleader = cluster(RealClientWithCloseReturningPromise, { port, isLeader: true }).create();
      yield anotherleader.ready();
      yield cluster.close(anotherleader);
      // make sure real client is closed;
      // assert has problem with global scope virable
      if (anotherleader[symbols.innerClient]._realClient.closed !== true) {
        throw new Error();
      }
    });
  });

  describe('heartbeat', () => {
    it('should close connection if long time no heartbeat', done => {
      done = pedding(done, 2);
      const port = 7770 + portDelta;
      const leader = cluster(RegistryClient, {
        port,
        isLeader: true,
        heartbeatInterval: 3000,
      }).create();
      const follower = cluster(RegistryClient, {
        port,
        isLeader: false,
        heartbeatInterval: 30000,
      }).create();
      cluster(RegistryClient, {
        port,
        isLeader: false,
        heartbeatInterval: 2000,
      }).create();

      const start = Date.now();
      leader.once('error', err => {
        assert(err);
        assert(/client no response in \d+ms exceeding maxIdleTime \d+ms, maybe the connection is close on other side\./.test(err.message));
        assert(err.name === 'ClusterClientNoResponseError');
        done();
      });
      follower.once('close', () => {
        console.log('follower closed');
        const dur = Date.now() - start;
        assert(dur > 3000);
        done();
      });
    });
  });

  describe('invoke', () => {
    const SYMBOL_FN = Symbol('MockClient#symbolFN');

    class MockClient extends Base {
      constructor() {
        super();
        this.ready(true);
      }

      * get(id) {
        return yield cb => this.getCallback(id, cb);
      }

      getCallback(id, cb) {
        setTimeout(() => {
          if (id === 'error') {
            cb(new Error('mock error'));
          } else if (id === 'timeout') {
            // do nothing
          } else {
            cb(null, id);
          }
        }, 500);
      }

      getPromise(id) {
        return new Promise((resolve, reject) => {
          this.getCallback(id, (err, data) => {
            if (err) {
              reject(err);
            } else {
              resolve(data);
            }
          });
        });
      }

      [SYMBOL_FN]() {
        return 'symboFn!';
      }

      timeout(cb) {
        setTimeout(cb, 6000);
      }
    }

    const port = 6660 + portDelta;
    const leader = cluster(MockClient, { port })
      .delegate('get')
      .delegate('getCallback')
      .delegate('getPromise')
      .delegate('timeout')
      .create();
    const follower = cluster(MockClient, { port })
      .delegate('get')
      .delegate('getCallback')
      .delegate('getPromise')
      .delegate('timeout')
      .create();

    it('should invoke generator function ok', function* () {
      let ret = yield leader.get('123');
      assert(ret === '123');
      ret = yield follower.get('123');
      assert(ret === '123');

      try {
        yield leader.get('error');
      } catch (err) {
        assert(err.message === 'mock error');
      }

      try {
        yield follower.get('error');
      } catch (err) {
        assert(err.message === 'mock error');
      }
    });

    it('should symbol function not delegated', function* () {
      assert(!leader[SYMBOL_FN]);
      assert(!follower[SYMBOL_FN]);
    });

    it('should be mocked', function* () {
      mm(leader, 'get', function* () {
        return '456';
      });
      mm(follower, 'get', function* () {
        return '456';
      });

      let ret = yield leader.get('123');
      assert(ret === '456');
      ret = yield follower.get('123');
      assert(ret === '456');

    });

    it('should be spied', function* () {
      const leaderGet = spy(leader, 'get');
      const followerGet = spy(follower, 'get');

      yield leader.get('123');
      yield follower.get('123');
      assert(leaderGet.callCount === 1);
      assert(followerGet.callCount === 1);
    });

    it('should invoke callback function ok', done => {
      done = pedding(done, 5);
      leader.getCallback('123', (err, data) => {
        assert.ifError(err);
        assert(data === '123');
        done();
      });
      follower.getCallback('123', (err, data) => {
        assert.ifError(err);
        assert(data === '123');
        done();
      });
      leader.getCallback('error', err => {
        assert(err.message === 'mock error');
        done();
      });
      follower.getCallback('error', err => {
        assert(err.message === 'mock error');
        done();
      });

      follower.getCallback('timeout', err => {
        assert(err.message.startsWith('Server no response in 3000ms, address#127.0.0.1'));
        done();
      });
    });

    it('should invoke promise function ok', done => {
      done = pedding(done, 4);
      leader.getPromise('123').then(data => {
        assert(data === '123');
        done();
      });
      follower.getPromise('123').then(data => {
        assert(data === '123');
        done();
      });
      leader.getPromise('error').catch(err => {
        assert(err.message === 'mock error');
        done();
      });
      follower.getPromise('error').catch(err => {
        assert(err.message === 'mock error');
        done();
      });
    });

    it('should invoke timeout ok', done => {
      follower.timeout(err => {
        assert(err && err.name === 'ResponseTimeoutError');
        done();
      });
    });
  });

  describe('event delegate', () => {

    class MockClient extends Base {
      constructor() {
        super();
        this.ready(true);

        setTimeout(() => {
          this.emit('foo', 'bar');
        }, 2000);

        setTimeout(() => {
          this.emit('ready');
        }, 500);
      }
    }

    it('should delegate all events', done => {
      done = pedding(done, 2);
      const port = 5550 + portDelta;
      const leader = cluster(MockClient, { port }).create();

      leader.ready(() => {
        leader.on('ready', done)
          .once('foo', bar => {
            assert(bar === 'bar');
            done();
          });
      });
    });
  });

  describe('Custom Transcode', () => {
    const port = 5550 + portDelta;
    const transcode = {
      encode(urls) {
        if (Array.isArray(urls)) {
          return new Buffer(JSON.stringify(urls.map(url => url.href)));
        }
        return new Buffer(JSON.stringify(urls));
      },
      decode(buf) {
        const arr = JSON.parse(buf);
        if (Array.isArray(arr)) {
          return arr.map(url => URL.parse(url, true));
        }
        return arr;
      },
    };
    const leader = cluster(RegistryClient, { port, transcode }).create(4321, '224.5.6.8');
    const follower = cluster(RegistryClient, { port, transcode }).create(4321, '224.5.6.8');

    it('should subscribe ok', done => {
      done = pedding(done, 2);

      leader.subscribe({
        dataId: 'com.alibaba.dubbo.demo.DemoService',
      }, val => {
        assert(val && val.length > 0);
        if (val.length === 2) {
          assert(val.every(url => url instanceof URL.Url));
          assert(val.some(url => url.host === '30.20.78.299:20880'));
          assert(val.some(url => url.host === '30.20.78.300:20880'));
          done();
        }
      });

      follower.subscribe({
        dataId: 'com.alibaba.dubbo.demo.DemoService',
      }, val => {
        assert(val && val.length > 0);
        if (val.length === 2) {
          assert(val.every(url => url instanceof URL.Url));
          assert(val.some(url => url.host === '30.20.78.299:20880'));
          assert(val.some(url => url.host === '30.20.78.300:20880'));
          done();
        }
      });

      leader.publish({
        dataId: 'com.alibaba.dubbo.demo.DemoService',
        publishData: 'dubbo://30.20.78.299:20880/com.alibaba.dubbo.demo.DemoService?anyhost=true&application=demo-provider&dubbo=2.0.0&generic=false&interface=com.alibaba.dubbo.demo.DemoService&loadbalance=roundrobin&methods=sayHello&owner=william&pid=81281&side=provider&timestamp=1481613276143',
      });
      follower.publish({
        dataId: 'com.alibaba.dubbo.demo.DemoService',
        publishData: 'dubbo://30.20.78.300:20880/com.alibaba.dubbo.demo.DemoService?anyhost=true&application=demo-provider&dubbo=2.0.0&generic=false&interface=com.alibaba.dubbo.demo.DemoService&loadbalance=roundrobin&methods=sayHello&owner=william&pid=81281&side=provider&timestamp=1481613276143',
      });
    });
  });

  describe('not broadcast', () => {
    const port = 4440 + portDelta;
    let leader;
    let follower;
    let follower2;
    before(function* () {
      leader = cluster(RegistryClient, { isLeader: true, port, isBroadcast: false }).create(4322, '224.5.6.9');
      follower = cluster(RegistryClient, { isLeader: false, port, isBroadcast: false }).create(4322, '224.5.6.9');
      follower2 = cluster(RegistryClient, { isLeader: false, port, isBroadcast: false }).create(4322, '224.5.6.9');
    });
    after(function* () {
      yield follower.close();
      yield follower2.close();
      yield leader.close();
    });


    it('should subscribe ok', done => {
      let trigger = false;

      leader.subscribe({
        dataId: 'com.alibaba.dubbo.demo.DemoService',
      }, val => {
        assert(!trigger);
        trigger = true;
        assert(val && val.length > 0);
        assert(val.some(url => url.host === '30.20.78.299:20880'));
        done();
      });

      follower.subscribe({
        dataId: 'com.alibaba.dubbo.demo.DemoService',
      }, val => {
        assert(!trigger);
        trigger = true;
        assert(val && val.length > 0);
        assert(val.some(url => url.host === '30.20.78.299:20880'));
        done();
      });

      follower2.subscribe({
        dataId: 'com.alibaba.dubbo.demo.DemoService',
      }, val => {
        assert(!trigger);
        trigger = true;
        assert(val && val.length > 0);
        assert(val.some(url => url.host === '30.20.78.299:20880'));
        done();
      });

      leader.publish({
        dataId: 'com.alibaba.dubbo.demo.DemoService',
        publishData: 'dubbo://30.20.78.299:20880/com.alibaba.dubbo.demo.DemoService?anyhost=true&application=demo-provider&dubbo=2.0.0&generic=false&interface=com.alibaba.dubbo.demo.DemoService&loadbalance=roundrobin&methods=sayHello&owner=william&pid=81281&side=provider&timestamp=1481613276143',
      });
    });
  });

  describe('server close', () => {
    const port = 3330 + portDelta;
    const innerClient = Symbol.for('ClusterClient#innerClient');
    let client_1;
    let client_2;
    let client_3;
    before(function* () {
      client_1 = cluster(RegistryClient, { port }).create(4323, '224.5.6.10');
      client_2 = cluster(RegistryClient, { port }).create(4323, '224.5.6.10');
      client_3 = cluster(RegistryClient, { port }).create(4323, '224.5.6.10');
      yield client_1.ready();
      yield client_2.ready();
      yield client_3.ready();
    });

    after(() => {
      cluster.close(client_1);
      cluster.close(client_2);
      cluster.close(client_3);
    });

    it('should re subscribe / publish ok', done => {
      done = pedding(done, 3);
      let trigger_1 = false;
      let trigger_2 = false;
      let trigger_3 = false;
      client_1.subscribe({
        dataId: 'com.alibaba.dubbo.demo.DemoService',
      }, val => {
        assert(val && val.length > 0);
        console.log('1', val.map(url => url.host));
        assert(val.some(url => url.host === '30.20.78.299:20880'));
        if (!trigger_1) {
          trigger_1 = true;
          done();
        }
      });

      client_2.subscribe({
        dataId: 'com.alibaba.dubbo.demo.DemoService',
      }, val => {
        assert(val && val.length > 0);
        console.log('2', val.map(url => url.host));
        assert(val.some(url => url.host === '30.20.78.299:20880'));
        if (!trigger_2) {
          trigger_2 = true;
          done();
        }
      });

      client_2.publish({
        dataId: 'com.alibaba.dubbo.demo.DemoService',
        publishData: 'dubbo://30.20.78.299:20880/com.alibaba.dubbo.demo.DemoService?anyhost=true&application=demo-provider&dubbo=2.0.0&generic=false&interface=com.alibaba.dubbo.demo.DemoService&loadbalance=roundrobin&methods=sayHello&owner=william&pid=81281&side=provider&timestamp=1481613276143',
      });

      setTimeout(() => {
        let master;
        for (const client of [ client_1, client_2, client_3 ]) {
          if (client[innerClient].isLeader) {
            if (master) {
              done(new Error('should only one leader'));
              return;
            }
            master = client;
          }
        }
        if (!master) {
          done(new Error('should have leader'));
          return;
        }
        // close inner server
        master[innerClient]._server.close();

        client_3.subscribe({
          dataId: 'com.alibaba.dubbo.demo.DemoService',
        }, val => {
          if (trigger_3) return;

          trigger_3 = true;
          assert(val && val.length > 0);
          console.log('3', val.map(url => url.host));
          if (val.length === 2) {
            assert(val.some(url => url.host === '30.20.78.300:20880'));
          }
          done();
        });

        master.publish({
          dataId: 'com.alibaba.dubbo.demo.DemoService',
          publishData: 'dubbo://30.20.78.300:20880/com.alibaba.dubbo.demo.DemoService?anyhost=true&application=demo-provider&dubbo=2.0.0&generic=false&interface=com.alibaba.dubbo.demo.DemoService&loadbalance=roundrobin&methods=sayHello&owner=william&pid=81281&side=provider&timestamp=1481613276143',
        });
      }, 5000);
    });
  });

  describe('wait for Leader', () => {
    const port = 2220 + portDelta;

    it('should follower ready failed for can not connect to leader', done => {
      const follower = cluster(RegistryClient, { port, isLeader: false, maxWaitTime: 3000, connectTimeout: 1000 }).create(4322, '224.5.6.9');
      follower.once('error', err => {
        assert(err.message === `[ClusterClient:RegistryClient] follower try to connect leader failed, cause by connect ECONNREFUSED 127.0.0.1:${port}`);
        follower.close();
        done();
      });
    });
  });

  describe('connect timeout', () => {
    it('should connect timeout', function* () {
      const orginalConnect = net.connect;
      mm(net, 'connect', function(port) {
        return orginalConnect.call(net, port, '2.2.2.2');
      });
      try {
        yield ClusterServer.tryToConnect(30000);
        assert(false);
      } catch (err) {
        assert(err.name === 'ClusterClientConnectTimeoutError');
        assert(err.message === 'socket#127.0.0.1:30000 connect timeout(5000ms)');
      }
      try {
        yield ClusterServer.tryToConnect(30000, 1000);
        assert(false);
      } catch (err) {
        assert(err.name === 'ClusterClientConnectTimeoutError');
        assert(err.message === 'socket#127.0.0.1:30000 connect timeout(1000ms)');
      }
    });
  });

  describe('leader subscribe', () => {
    let port;
    before(done => {
      const server = net.createServer();
      server.listen(0, () => {
        port = server.address().port;
        console.log('using port =>', port);
        server.close();
        done();
      });
    });

    it('should subscribe mutli data at same time', function* () {
      const client = cluster(NotifyClient, { port })
        .delegate('publish', 'invoke')
        .create();
      client.subscribe({ dataId: 'foo' }, val => {
        client.emit('foo_1', val);
      });
      client.subscribe({ dataId: 'foo' }, val => {
        client.emit('foo_2', val);
      });
      client.subscribe({ dataId: 'bar' }, val => {
        client.emit('bar_1', val);
      });

      let result = yield [
        client.publish({ dataId: 'foo', publishData: 'xxx' }),
        client.await('foo_1'),
        client.await('foo_2'),
      ];
      assert(result && result.length === 3);
      assert(result[1] === 'xxx');
      assert(result[2] === 'xxx');

      result = yield [
        client.publish({ dataId: 'bar', publishData: 'yyy' }),
        client.await('bar_1'),
      ];
      assert(result && result.length === 2);
      assert(result[1] === 'yyy');

      cluster.close(client);
    });
  });

  describe('error', () => {
    it('should throw error if delegate to not implement method', () => {
      assert.throws(() => {
        cluster(NotifyClient)
          .delegate('not-exist')
          .create();
      }, '[ClusterClient] api: not-exist not implement in client');
    });
  });
});
