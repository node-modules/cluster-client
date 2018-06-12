'use strict';

const net = require('net');
const assert = require('assert');
const Follower = require('../lib/follower');
const transcode = require('../lib/default_transcode');

describe('test/follower.test.js', () => {
  let port;
  let server;
  before(done => {
    server = net.createServer();
    server.on('connection', socket => {
      socket.once('data', () => {
        socket.destroy();
      });
    });
    server.listen(0, () => {
      port = server.address().port;
      done();
    });
  });

  after(done => {
    server.close(done);
  });

  it('should ready failed if socket is closed', async function() {
    let count = 0;
    const follower = new Follower({
      port,
      transcode,
      name: 'test',
      descriptors: new Map(),
      responseTimeout: 100,
      logger: {
        warn() {
          count++;
        },
      },
    });
    try {
      await follower.ready();
      assert(false);
    } catch (err) {
      assert(err && err.message.includes('The socket was closed'));
    }

    assert(count === 0);
    assert(!follower._socket);
  });
});
