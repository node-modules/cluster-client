'use strict';

const net = require('net');
const cluster = require('..');
const is = require('is-type-of');
const assert = require('assert');
const Client = require('./supports/client');

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

  it('should work ok', function* () {
    const client_1 = cluster(Client, { responseTimeout: 1000, port })
      .delegate('unPublish', 'invokeOneway')
      .create();
    const client_2 = cluster(Client, { responseTimeout: 1000, port })
      .delegate('unPublish', 'invokeOneway')
      .create();

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

    // publish
    client_2.publish({ key: 'foo', value: 'bar' });

    let rs = yield [
      client_1.await('foo_received'),
      client_2.await('foo_received'),
    ];
    assert(is.array(rs[0]) && rs[0].length === 1);
    assert(rs[0][0] === 'bar');
    assert(is.array(rs[1]) && rs[1].length === 1);
    assert(rs[1][0] === 'bar');

    // unPublish
    client_2.unPublish({ key: 'foo', value: 'bar' });

    rs = yield [
      client_1.await('foo_received_1'),
      client_2.await('foo_received_2'),
    ];
    assert(is.array(rs[0]) && rs[0].length === 0);
    assert(is.array(rs[1]) && rs[1].length === 0);

    // unSubscribe
    client_1.unSubscribe({ key: 'foo' }, listener_1);
    client_2.unSubscribe({ key: 'foo' }, listener_2);

    // publish again
    client_2.publish({ key: 'foo', value: 'bar_1' });

    yield [
      function* () {
        yield new Promise((resolve, reject) => {
          setTimeout(resolve, 3000);
          client_1.once('foo_received_1', () => { reject(new Error('should not run here')); });
        });
      },
      function* () {
        yield new Promise((resolve, reject) => {
          setTimeout(resolve, 3000);
          client_2.once('foo_received_2', () => { reject(new Error('should not run here')); });
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
          client_1.once('foo_received', () => { reject(new Error('should not run here')); });
        });
      },
      function* () {
        yield new Promise((resolve, reject) => {
          setTimeout(resolve, 3000);
          client_2.once('foo_received', () => { reject(new Error('should not run here')); });
        });
      },
    ];

    client_1.close();
    client_2.close();
  });
});
