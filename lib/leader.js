'use strict';

const debug = require('debug')('cluster-client#leader');
const co = require('co');
const is = require('is-type-of');
const Base = require('sdk-base');
const utils = require('./utils');
const random = require('utility').random;
const ClusterServer = require('./server');
const Connection = require('./connection');
const Request = require('./protocol/request');

class Leader extends Base {
  /**
   * The Leader hold the real client
   *
   * @param {Object} options
   *  - {String} name - client name, default is the class name
   *  - {ClusterServer} server - the cluster server
   *  - {Boolean} isBroadcast - whether broadcast subscrption result to all followers or just one, default is true
   *  - {Number} heartbeatInterval - the heartbeat interval
   *  - {Function} createRealClient - to create the real client
   * @constructor
   */
  constructor(options) {
    super(options);
    this._options = options;
    this._connections = new Map();
    this._subListeners = new Map(); // subscribe key => listener
    this._subConnMap = new Map(); // subscribe key => conn key
    this._subData = new Map();
    // local socket server
    this._server = options.server;
    this._transcode = options.transcode;
    // the real client
    this._realClient = options.createRealClient();
    this._subscribeMethodName = this._findMethodName('subscribe');
    this._publishMethodName = this._findMethodName('publish');

    // event delegate
    utils.delegateEvents(this._realClient, this);

    if (is.function(this._realClient.ready)) {
      this._realClient.ready(() => this.ready(true));
    }

    this._handleClose = this._handleClose.bind(this);
    this._handleConnection = this._handleConnection.bind(this);

    // subscribe its own channel
    this._server.on(`${this._options.name}_connection`, this._handleConnection);
    this._server.once('close', this._handleClose);

    this._heartbeatTimer = setInterval(() => {
      const now = Date.now();
      for (const conn of this._connections.values()) {
        const dur = now - conn.lastActiveTime;
        if (dur > this._options.heartbeatInterval) {
          const err = new Error(`client no response in ${dur}ms, maybe the connection is close on other side.`);
          err.name = 'ClusterClientNoResponseError';
          conn.close(err);
        }
      }
    }, this._options.heartbeatInterval);
  }

  get isLeader() {
    return true;
  }

  get logger() {
    return this._options.logger;
  }

  subscribe(reg, listener) {
    const transcode = this._transcode;
    const conn = Object.create(Base.prototype, {
      isMock: { value: true },
      key: { value: `mock_conn_${Date.now()}` },
      lastActiveTime: {
        get() {
          return Date.now();
        },
      },
      send: {
        value(req) {
          const result = transcode.decode(req.data);
          listener && listener(result);
        },
      },
      close: { value() {} },
    });

    this._connections.set(conn.key, conn);
    this.on('close', () => conn.emit('close'));

    this._doSubscribe(reg, conn);
  }

  publish(reg) {
    this._realClient[this._publishMethodName](reg);
  }

  invoke(methodName, args, callback) {
    let method = this._realClient[methodName];
    // compatible with generatorFunction
    if (is.generatorFunction(method)) {
      method = co.wrap(method);
    }
    args.push(callback);
    const ret = method.apply(this._realClient, args);
    if (callback && is.promise(ret)) {
      ret.then(result => callback(null, result), err => callback(err))
        // to avoid uncaught exception in callback function, then cause unhandledRejection
        .catch(err => this.logger.error(err));
    }
  }

  _doSubscribe(reg, conn) {
    const key = this._options.formatKey(reg);
    const callback = err => {
      if (err) {
        this.logger.error(err);
      }
    };
    const isBroadcast = this._options.isBroadcast;
    const timeout = this._options.responseTimeout;

    const map = this._subConnMap.get(key) || new Map();
    map.set(conn.key, true);
    this._subConnMap.set(key, map);

    // only subscribe once in cluster mode, and broadcast to all followers
    if (!this._subListeners.has(key)) {
      const listener = result => {
        const data = this._transcode.encode(result);
        this._subData.set(key, data);

        const map = this._subConnMap.get(key);
        if (!map) {
          return;
        }

        let keys = Array.from(map.keys());
        // if isBroadcast equal to false, random pick one to notify
        if (!isBroadcast) {
          keys = [ keys[random(keys.length)] ];
        }

        for (const connKey of keys) {
          const conn = this._connections.get(connKey);
          if (conn) {
            this.logger.info('[Leader#%s] push subscribe data to cluster client#%s', this._options.name, connKey);
            conn.send(new Request({
              timeout,
              connObj: {
                type: 'subscribe_result',
                key,
              },
              data,
            }), callback);
          }
        }
      };
      this._subListeners.set(key, listener);
      this._realClient[this._subscribeMethodName](reg, listener);
    } else if (this._subData.has(key) && isBroadcast) {
      conn.send(new Request({
        timeout,
        connObj: {
          type: 'subscribe_result',
          key,
        },
        data: this._subData.get(key),
      }), callback);
    }
  }

  _findMethodName(type) {
    for (const method of this._options.descriptors.keys()) {
      const descriptor = this._options.descriptors.get(method);
      if (descriptor.type === 'delegate' && descriptor.to === type) {
        return method;
      }
    }
    return null;
  }

  // handle new socket connect
  _handleConnection(socket) {
    this.logger.info('[Leader#%s] socket connected, port: %d', this._options.name, socket.remotePort);

    const conn = new Connection({
      socket,
      name: this._options.name,
      logger: this._options.logger,
      transcode: this._options.transcode,
      requestTimeout: this._options.requestTimeout,
    });
    this._connections.set(conn.key, conn);
    conn.once('close', () => {
      this._connections.delete(conn.key);
      for (const map of this._subConnMap.values()) {
        map.delete(conn.key);
      }
    });
    conn.on('error', err => this._errorHandler(err));
    conn.on('request', (req, res) => this._handleRequest(req, res, conn));
  }

  _handleSubscribe(req, conn) {
    const connObj = req.connObj || {};
    this._doSubscribe(connObj.reg, conn);
  }

  // handle request from followers
  _handleRequest(req, res, conn) {
    const connObj = req.connObj || {};
    // update last active time to make sure not kick out by leader
    conn.lastActiveTime = Date.now();

    switch (connObj.type) {
      case 'subscribe':
        this.logger.info('[Leader#%s] received subscribe request from follower, req: %j, conn: %s', this._options.name, req, conn.key);
        this._handleSubscribe(req, conn);
        break;
      case 'invoke':
        {
          debug('[Leader#%s] received invoke request from follower, req: %j, conn: %s', this._options.name, req, conn.key);
          const argLength = connObj.argLength;
          const args = [];
          if (argLength > 0) {
            const data = req.data;
            for (let i = 0, offset = 0; i < argLength; ++i) {
              const len = data.readUInt32BE(offset);
              const arg = this._transcode.decode(data.slice(offset + 4, offset + 4 + len));
              args.push(arg);
              offset += (4 + len);
            }
          }

          if (connObj.oneway) {
            this.invoke(connObj.method, args);
          } else {
            const startTime = Date.now();
            this.invoke(connObj.method, args, (err, result) => {
              // no response if processing timeout, just record error
              if (req.timeout && Date.now() - startTime > req.timeout) {
                const err = new Error(`[Leader#${this._options.name}] invoke method:${connObj.method} timeout for req#{req.id}`);
                err.name = 'ClusterLeaderTimeoutError';
                err.method = connObj.method;
                err.args = connObj.args;
                this.logger.error(err);
                return;
              }

              if (err) {
                err.method = connObj.method;
                err.args = connObj.args;
                this.logger.error(err);

                res.connObj = {
                  type: 'invoke_result',
                  success: false,
                  message: err.message,
                  stack: err.stack,
                };
              } else {
                debug('[Leader#%s] send method:%s result to follower, result: %j', this._options.name, connObj.method, result);
                const data = this._transcode.encode(result);
                res.connObj = {
                  type: 'invoke_result',
                  success: true,
                };
                res.data = data;
              }
              conn.send(res);
            });
          }
          break;
        }
      case 'heartbeat':
        debug('[Leader#%s] received heartbeat request from follower, req: %j, conn: %s', this._options.name, req, conn.key);
        res.connObj = { type: 'heartbeat_res' };
        conn.send(res);
        break;
      default:
        {
          const err = new Error(`unsupport data type: ${connObj.type}`);
          err.name = 'ClusterRequestTypeError';
          this.logger.error(err);
          break;
        }
    }
  }

  // emit error asynchronously
  _errorHandler(err) {
    setImmediate(() => this.emit('error', err));
  }

  * _handleClose() {
    this.logger.info('[Loader:%s] leader server is closed', this._options.name);
    // close the real client
    if (this._realClient && is.function(this._realClient.close)) {
      // support common function, generatorFunction, and function returning a promise
      yield utils.callFn(this._realClient.close.bind(this._realClient));
    }
    clearInterval(this._heartbeatTimer);
    this._heartbeatTimer = null;
    this.emit('close');
  }

  close() {
    return co(function* () {
      // 1. stop listening to server channel
      this._server.removeListener(`${this._options.name}_connection`, this._handleConnection);

      // 2. close all mock connections
      for (const [ key, conn ] of this._connections.entries()) {
        if (conn.isMock) this._connections.delete(key);
      }

      // 3. wait all followers close
      yield new Promise((resolve, reject) => {
        if (this._connections.size === 0) return resolve();

        for (const conn of this._connections.values()) {
          conn.once('close', () => {
            if (this._connections.size === 0) return resolve();
          });
        }

        setTimeout(() => {
          reject(new Error(`[Leader#${this._options.name}] close failed: follower connections are still not closed after 30s`));
        }, 30000);
      });

      // 4. close server
      //    CANNOT close server directly by server.close(), other cluster clients may be using it
      this._server.removeListener('close', this._handleClose);
      yield ClusterServer.close(this._options.name, this._server);

      // 5. close real client
      yield this._handleClose();

      this.removeAllListeners();
    }.bind(this));
  }
}

module.exports = Leader;
