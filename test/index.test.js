'use strict';

const Base = require('sdk-base');
const is = require('is-type-of');
const pedding = require('pedding');
const assert = require('power-assert');
const URL = require('url');
const cluster = require('../');
const RegistryClient = require('./registry_client');
const portDelta = Number(process.versions.node.slice(0, 1));

describe('test/index.test.js', () => {

  describe('RegistryClient', () => {
    const port = 8880 + portDelta;
    const leader = cluster(RegistryClient, { port, isLeader: true })
      .delegate('subscribe', 'subscribe')
      .delegate('publish', 'publish')
      .override('foo', 'bar')
      .create();
    const follower = cluster(RegistryClient, { port, isLeader: false }).create();

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
        console.log(err);
        assert(err);
        assert(/client no response in \d+ms, maybe the connection is close on other side\./.test(err.message));
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
    }

    const port = 6660 + portDelta;
    const leader = cluster(MockClient, { port })
      .delegate('get')
      .delegate('getCallback')
      .delegate('getPromise')
      .create();
    const follower = cluster(MockClient, { port })
      .delegate('get')
      .delegate('getCallback')
      .delegate('getPromise')
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
        return new Buffer(JSON.stringify(urls.map(url => url.href)));
      },
      decode(buf) {
        return JSON.parse(buf).map(url => URL.parse(url, true));
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
    const leader = cluster(RegistryClient, { isLeader: true, port, isBroadcast: false }).create(4322, '224.5.6.9');
    const follower = cluster(RegistryClient, { isLeader: false, port, isBroadcast: false }).create(4322, '224.5.6.9');
    const follower2 = cluster(RegistryClient, { isLeader: false, port, isBroadcast: false }).create(4322, '224.5.6.9');

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
    const client_1 = cluster(RegistryClient, { port }).create(4323, '224.5.6.10');
    const client_2 = cluster(RegistryClient, { port }).create(4323, '224.5.6.10');
    const client_3 = cluster(RegistryClient, { port }).create(4323, '224.5.6.10');
    const innerClient = Symbol.for('ClusterClient#innerClient');

    it('should re subscribe / publish ok', done => {
      done = pedding(done, 3);
      let trigger_1 = false;
      let trigger_2 = false;
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

    it('should subscribe ok', done => {
      const follower = cluster(RegistryClient, { port, isLeader: false, maxWaitTime: 3000 }).create(4322, '224.5.6.9');
      follower.once('error', err => {
        assert(err.message === `[ClusterClient] leader dose not be active in 3000ms on port:${port}`);
        done();
      });
    });
  });
});
