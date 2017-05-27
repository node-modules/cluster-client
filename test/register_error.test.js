'use strict';

const mm = require('mm');
const net = require('net');
const cluster = require('..');
const Client = require('./supports/client');
const Packet = require('../lib/protocol/packet');
const Response = require('../lib/protocol/response');

describe('test/register_error.test.js', () => {
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
  afterEach(mm.restore);

  it('should register channel util success', function* () {
    const originDecode = Packet.decode;
    mm(Packet, 'decode', function(buf) {
      const ret = originDecode(buf);
      if (ret.connObj && ret.connObj.type === 'register_channel') {
        ret.connObj.type = 'xx';
        mm.restore();
      }
      return ret;
    });

    const leader = cluster(Client, { port }).create();
    const follower = cluster(Client, { port }).create();

    yield leader.ready();
    yield follower.ready();

    yield follower.close();
    yield leader.close();
  });

  it('should handle register_channel request in leader', function* () {
    mm(Response.prototype, 'encode', function() {
      mm.restore();
      return new Buffer('01010000000000000000000000000bb80000001f000000007b2274797065223a2272656769737465725f6368616e6e656c5f726573227d', 'hex');
    });

    const leader = cluster(Client, { port }).create();
    const follower = cluster(Client, { port }).create();

    yield leader.ready();
    yield follower.ready();

    yield follower.close();
    yield leader.close();

    // subscribe after close
    follower.subscribe({ foo: 'bar' }, val => {
      console.log(val);
    });
  });
});
