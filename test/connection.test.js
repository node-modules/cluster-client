'use strict';

const net = require('net');
const assert = require('assert');
const awaitEvent = require('await-event');
const sleep = require('mz-modules/sleep');
const Connection = require('../lib/connection');
const Request = require('../lib/protocol/request');
const transcode = require('../lib/default_transcode');

describe('test/connection.test.js', () => {
  let port;
  let server;
  const conns = new Map();
  before(done => {
    server = net.createServer(socket => {
      const conn = new Connection({
        socket,
        transcode,
        name: 'test',
        logger: console,
        requestTimeout: 1000,
      });
      console.log('new connection', conn.key);
      conns.set(conn.key, conn);
      conn.once('close', () => {
        conns.delete(conn.key);
      });
    });
    server.listen(0, () => {
      port = server.address().port;
      console.log('server listen on %s', port);
      done();
    });
  });
  after(done => {
    server.close();
    for (const conn of conns.values()) {
      conn.close();
    }
    server.once('close', done);
  });

  it('should throw error if send timeout', function* () {
    const socket = net.connect(port, '127.0.0.1');
    yield awaitEvent(socket, 'connect');
    yield sleep(100);
    assert(conns.has(socket.localPort));

    const conn = conns.get(socket.localPort);
    try {
      yield cb => {
        conn.send(new Request({
          connObj: { foo: 'bar' },
          timeout: 1000,
        }), cb);
      };
      assert(false, 'no here');
    } catch (err) {
      assert(err && err.name === 'ClusterConnectionResponseTimeoutError');
      assert(err.message === `[ClusterClient] no response in 1000ms, remotePort#${socket.localPort}`);
    }
    socket.destroy();
    yield awaitEvent(socket, 'close');
    yield sleep(100);
    assert(!conns.has(socket.localPort));
  });

  it('should handle request ok', function* () {
    const socket = net.connect(port, '127.0.0.1');
    yield awaitEvent(socket, 'connect');
    yield sleep(100);
    assert(conns.has(socket.localPort));

    const conn = conns.get(socket.localPort);

    socket.write(new Request({
      connObj: { foo: 'bar' },
      timeout: 1000,
    }).encode());

    const req = yield conn.await('request');
    assert(req && !req.isResponse);
    assert(req.timeout === 1000);
    assert.deepEqual(req.connObj, { foo: 'bar' });
    assert(!req.data);

    yield Promise.all([
      conn.close(),
      conn.close(), // close second time
      awaitEvent(socket, 'close'),
    ]);
    yield sleep(100);
    assert(!conns.has(socket.localPort));
  });

  it('should close connection if decode error', function* () {
    const socket = net.connect(port, '127.0.0.1');
    yield awaitEvent(socket, 'connect');
    yield sleep(100);
    assert(conns.has(socket.localPort));

    socket.write(new Buffer('010000000000000000000001000003e80000000d000000007b22666f6f223a22626172227c', 'hex'));

    yield awaitEvent(socket, 'close');
    yield sleep(100);
    assert(!conns.has(socket.localPort));
  });
});
