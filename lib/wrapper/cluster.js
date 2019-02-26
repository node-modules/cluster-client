'use strict';

const debug = require('debug')('cluster-client');
const is = require('is-type-of');
const Base = require('sdk-base');
const assert = require('assert');
const utils = require('../utils');
const Leader = require('../leader');
const Follower = require('../follower');
const ClusterServer = require('../server');
const {
  init,
  logger,
  isReady,
  innerClient,
  subscribe,
  unSubscribe,
  publish,
  invoke,
  subInfo,
  pubInfo,
  closeHandler,
  close,
  singleMode,
} = require('../symbol');

class ClusterClient extends Base {
  /**
   * Share Connection among Multi-Process Mode
   *
   * @param {Object} options
   *  - {Number} port - the port
   *  - {Transcode} transcode - serialze / deseriaze methods
   *  - {Boolean} isLeader - wehether is leader or follower
   *  - {Number} maxWaitTime - leader startup max time (ONLY effective on isLeader is true)
   *  - {Function} createRealClient - to create the real client instance
   * @constructor
   */
  constructor(options) {
    super(options);
    this[subInfo] = new Map();
    this[pubInfo] = new Map();
    this[singleMode] = false;

    this[closeHandler] = () => {
      this[logger].warn('[ClusterClient:%s] %s closed, and try to init it again', this.options.name, this[innerClient].isLeader ? 'leader' : 'follower');
      this[isReady] = false;
      this.ready(false);
      this[init]().catch(err => { this.ready(err); });
    };
    this[init]().catch(err => { this.ready(err); });

    // avoid warning message
    this.setMaxListeners(100);
  }

  get isClusterClientLeader() {
    return this[innerClient] && this[innerClient].isLeader;
  }

  /**
   * log instance
   * @property {Logger} ClusterClient#[logger]
   */
  get [logger]() {
    return this.options.logger;
  }

  /**
   * initialize, to  leader or follower
   *
   * @return {void}
   */
  async [init]() {
    const name = this.options.name;
    const port = this.options.port;
    let server;
    if (this.options.isLeader === true) {
      server = await ClusterServer.create(name, port);
      if (!server) {
        throw new Error(`create "${name}" leader failed, the port:${port} is occupied by other`);
      }
    } else if (this.options.isLeader === false) {
      // wait for leader active
      await ClusterServer.waitFor(port, this.options.maxWaitTime);
    } else {
      debug('[ClusterClient:%s] init cluster client, try to seize the leader on port:%d', name, port);
      server = await ClusterServer.create(name, port);
    }

    if (server) {
      this[innerClient] = new Leader(Object.assign({ server }, this.options));
      debug('[ClusterClient:%s] has seized port %d, and serves as leader client.', name, port);
    } else {
      this[innerClient] = new Follower(this.options);
      debug('[ClusterClient:%s] gives up seizing port %d, and serves as follower client.', name, port);
    }

    // events delegate
    utils.delegateEvents(this[innerClient], this);

    // re init when connection is close
    this[innerClient].on('close', this[closeHandler]);

    // wait leader/follower ready
    await this[innerClient].ready();

    // subscribe all
    for (const key of this[subInfo].keys()) {
      const info = this[subInfo].get(key);
      const reg = info.reg;
      this[innerClient].subscribe(reg, data => {
        this[subInfo].set(key, {
          reg,
          inited: true,
          data,
        });
        this.emit(key, data);
      });
    }
    // publish all
    for (const reg of this[pubInfo].values()) {
      this[innerClient].publish(reg);
    }

    if (!this[isReady]) {
      this[isReady] = true;
      this.ready(true);
    }
  }

  /**
   * do subscribe
   *
   * @param {Object} reg - subscription info
   * @param {Function} listener - callback function
   * @return {void}
   */
  [subscribe](reg, listener) {
    assert(is.function(listener), `[ClusterClient:${this.options.name}] subscribe(reg, listener) listener should be a function`);

    debug('[ClusterClient:%s] subscribe %j', this.options.name, reg);
    const key = this.options.formatKey(reg);
    this.on(key, listener);

    const info = this[subInfo].get(key);
    if (!info) {
      this[subInfo].set(key, {
        reg,
        inited: false,
        data: null,
      });
      if (this[isReady]) {
        this[innerClient].subscribe(reg, data => {
          this[subInfo].set(key, {
            reg,
            inited: true,
            data,
          });
          this.emit(key, data);
        });
      }
    } else if (info.inited) {
      process.nextTick(() => {
        listener(info.data);
      });
    }
  }

  /**
   * do unSubscribe
   *
   * @param {Object} reg - subscription info
   * @param {Function} listener - callback function
   * @return {void}
   */
  [unSubscribe](reg, listener) {
    debug('[ClusterClient:%s] unSubscribe %j', this.options.name, reg);
    const key = this.options.formatKey(reg);
    if (listener) {
      this.removeListener(key, listener);
    } else {
      this.removeAllListeners(key);
    }
    if (this.listenerCount(key) === 0) {
      this[subInfo].delete(key);
      if (this[isReady]) {
        this[innerClient].unSubscribe(reg);
      }
    }
  }

  /**
   * do publish
   *
   * @param {Object} reg - publish info
   * @return {void}
   */
  [publish](reg) {
    debug('[ClusterClient:%s] publish %j', this.options.name, reg);
    const key = this.options.formatKey(reg);
    this[pubInfo].set(key, reg);

    if (this[isReady]) {
      this[innerClient].publish(reg);
    }
  }

  /**
   * invoke a method asynchronously
   *
   * @param {String} method - the method name
   * @param {Array} args - the arguments list
   * @param {Function} callback - callback function
   * @return {void}
   */
  [invoke](method, args, callback) {
    if (!this[isReady]) {
      this.ready(err => {
        if (err) {
          callback && callback(err);
          return;
        }
        this[innerClient].invoke(method, args, callback);
      });
      return;
    }

    debug('[ClusterClient:%s] invoke method: %s, args: %j', this.options.name, method, args);
    this[innerClient].invoke(method, args, callback);
  }

  async [close]() {
    try {
      // close after ready, in case of innerClient is initializing
      await this.ready();
    } catch (err) {
      // ignore
    }

    const client = this[innerClient];
    if (client) {
      // prevent re-initializing
      client.removeListener('close', this[closeHandler]);
      if (client.close) {
        await utils.callFn(client.close.bind(client));
      }
    }
  }
}

module.exports = ClusterClient;
