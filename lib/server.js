'use strict';

const net = require('net');
const Base = require('sdk-base');
const Packet = require('./protocol/packet');
const Response = require('./protocol/response');

// share memory in current process
let serverMap;
if (global.serverMap) {
  serverMap = global.serverMap;
} else {
  global.serverMap = serverMap = new Map();
}
let typeSet;
if (global.typeSet) {
  typeSet = global.typeSet;
} else {
  global.typeSet = typeSet = new Set();
}

const empty = () => {};
const sleep = timeout => cb => setTimeout(cb, timeout);

function claimServer(port) {
  return cb => {
    const server = net.createServer();
    server.listen(port, '127.0.0.1');

    function onError(err) {
      if (err.code === 'EADDRINUSE') {
        server.removeAllListeners();
        cb(err);
      }
    }

    server.on('error', onError);
    server.on('listening', () => {
      server.removeAllListeners();
      cb(null, server);
    });
  };
}

function tryToConnect(port) {
  return cb => {
    const socket = net.connect(port, '127.0.0.1');
    socket.on('connect', () => {
      cb(null, true);
      // disconnect
      socket.removeAllListeners();
      socket.end();
    });
    // close event occurred after ECONNREFUSED error
    socket.on('error', empty);
    socket.on('close', () => {
      cb(null, false);
      socket.removeAllListeners();
    });
  };
}

class ClusterServer extends Base {
  /**
   * Manage all TCP Connections，assign them to proper channel
   *
   * @constructor
   * @param {Object} options
   *  - {net.Server} server - the server
   *  - {Number} port - the port
   */
  constructor(options) {
    super();

    this._sockets = new Map();
    this._server = options.server;
    this._port = options.port;
    this._isClosed = false;
    this._server.on('connection', socket => this._handleSocket(socket));
    this._server.once('close', () => {
      this._isClosed = true;
      serverMap.delete(this._port);
      this.emit('close');
      this._server.removeAllListeners();
      this.removeAllListeners();
    });
    this._server.once('error', err => {
      this.emit('error', err);
    });
  }

  get isClosed() {
    return this._isClosed;
  }

  close() {
    return new Promise((resolve, reject) => {
      if (this.isClosed) return resolve();

      this._server.close(err => {
        if (err) return reject(err);
        resolve();
      });

      // sockets must be closed manually, otherwise server.close callback will never be called
      for (const socket of this._sockets.values()) {
        socket.destroy();
      }
    });
  }

  _handleSocket(socket) {
    let header;
    let bodyLength;
    let body;
    const server = this;
    const key = socket.remotePort;
    this._sockets.set(key, socket);

    function onReadable() {
      if (!header) {
        header = socket.read(24);
        if (!header) {
          return;
        }
      }
      if (!bodyLength) {
        bodyLength = header.readInt32BE(16) + header.readInt32BE(20);
      }
      body = socket.read(bodyLength);
      if (!body) {
        return;
      }
      // first packet to register to channel
      const packet = Packet.decode(Buffer.concat([ header, body ]));
      if (packet.connObj && packet.connObj.type === 'register_channel') {
        const channelName = packet.connObj.channelName;

        socket.removeListener('readable', onReadable);

        const response = new Response({
          id: packet.id,
          timeout: packet.timeout,
          connObj: { type: 'register_channel_res' },
        });
        socket.write(response.encode());

        // assign to proper channel
        server.emit(`${channelName}_connection`, socket);
      }
    }

    socket.on('readable', onReadable);
    socket.once('close', () => this._sockets.delete(key));
  }

  /**
   * Occupy the port
   *
   * @param {String} name - the client name
   * @param {Number} port - the port
   * @return {ClusterServer} server
   */
  static* create(name, port) {
    const key = `${name}@${port}`;
    let instance = serverMap.get(port);
    if (instance && !instance.isClosed) {
      if (typeSet.has(key)) {
        return null;
      }
      typeSet.add(key);
      return instance;
    }
    // compete for the local port, if got => leader, otherwise follower
    try {
      const server = yield claimServer(port);
      instance = new ClusterServer({ server, port });
      typeSet.add(key);
      serverMap.set(port, instance);
      return instance;
    } catch (err) {
      // if exception, that mean compete for port failed, then double check
      instance = serverMap.get(port);
      if (instance && !instance.isClosed) {
        if (typeSet.has(key)) {
          return null;
        }
        typeSet.add(key);
        return instance;
      }
      return null;
    }
  }

  static* close(name, server) {
    const port = server._port;

    // remove from typeSet, so other client can occupy
    typeSet.delete(`${name}@${port}`);

    let listening = false;
    for (const key of typeSet.values()) {
      if (key.endsWith(`@${port}`)) {
        listening = true;
        break;
      }
    }

    // close server if no one is listening on this port any more
    if (!listening) {
      const server = serverMap.get(port);
      yield server && server.close();
    }
  }

  /**
   * Wait for Leader Startup
   *
   * @param {Number} port - the port
   * @param {Number} timeout - the max wait time
   * @return {void}
   */
  static* waitFor(port, timeout) {
    const start = Date.now();
    let connect = false;
    while (!connect) {
      connect = yield tryToConnect(port);

      // if timeout, throw error
      if (Date.now() - start > timeout) {
        throw new Error(`[ClusterClient] leader does not be active in ${timeout}ms on port:${port}`);
      }
      if (!connect) {
        yield sleep(3000);
      }
    }
  }
}

module.exports = ClusterServer;
