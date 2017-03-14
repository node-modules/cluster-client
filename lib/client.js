'use strict';

const debug = require('debug')('cluster-client');
const co = require('co');
const is = require('is-type-of');
const Base = require('sdk-base');
const assert = require('assert');
const utils = require('./utils');
const Leader = require('./leader');
const Follower = require('./follower');
const ClusterServer = require('./server');
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
} = require('./symbol');


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

    this[closeHandler] = () => {
      this[logger].warn('[ClusterClient#%s] %s closed, and try to init it again', this.options.name, this[innerClient].isLeader ? 'leader' : 'follower');
      this[isReady] = false;
      this.ready(false);
      this[init]();
    };
    this[init]();
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
  [init]() {
    co(function* () {
      const name = this.options.name;
      const port = this.options.port;
      let server;
      if (this.options.isLeader === true) {
        server = yield ClusterServer.create(name, port);
        if (!server) {
          throw new Error(`create "${name}" leader failed, the port:${port} is occupied by other`);
        }
      } else if (this.options.isLeader === false) {
        // wait for leader active
        yield ClusterServer.waitFor(port, this.options.maxWaitTime);
      } else {
        this[logger].info('[ClusterClient#%s] init cluster client, try to seize the leader on port:%d', name, port);
        server = yield ClusterServer.create(name, port);
      }

      if (server) {
        this[innerClient] = new Leader(Object.assign({ server }, this.options));
        this[logger].info('[ClusterClient#%s] has seized port %d, and serves as leader client.', name, port);
      } else {
        this[innerClient] = new Follower(this.options);
        this[logger].info('[ClusterClient#%s] gives up seizing port %d, and serves as follower client.', name, port);
      }

      // events delegate
      utils.delegateEvents(this[innerClient], this);

      // re init when connection is close
      this[innerClient].on('close', this[closeHandler]);

      // wait leader/follower ready
      yield this[innerClient].ready();

      // subscribe all
      for (const registrations of this[subInfo].values()) {
        for (const args of registrations) {
          this[innerClient].subscribe(args[0], args[1]);
        }
      }
      // publish all
      for (const reg of this[pubInfo].values()) {
        this[innerClient].publish(reg);
      }

      if (!this[isReady]) {
        this[isReady] = true;
        this.ready(true);
      }
    }.bind(this)).catch(err => {
      this.ready(err);
    });
  }

  /**
   * do subscribe
   *
   * @param {Object} reg - subscription info
   * @param {Function} listener - callback function
   * @return {void}
   */
  [subscribe](reg, listener) {
    assert(is.function(listener), `[ClusterClient#${this.options.name}] subscribe(reg, listener) listener should be a function`);

    this[logger].info('[ClusterClient#%s] subscribe %j', this.options.name, reg);
    const key = this.options.formatKey(reg);
    const registrations = this[subInfo].get(key) || [];
    registrations.push([ reg, listener ]);
    this[subInfo].set(key, registrations);

    if (this[isReady]) {
      this[innerClient].subscribe(reg, listener);
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
    this[logger].info('[ClusterClient#%s] unSubscribe %j', this.options.name, reg);
    const key = this.options.formatKey(reg);
    const registrations = this[subInfo].get(key) || [];
    const newRegistrations = [];
    if (listener) {
      for (const arr of registrations) {
        if (arr[1] !== listener) {
          newRegistrations.push(arr);
        }
      }
    }
    this[subInfo].set(key, newRegistrations);

    if (this[isReady]) {
      this[innerClient].unSubscribe(reg, listener);
    }
  }

  /**
   * do publish
   *
   * @param {Object} reg - publish info
   * @return {void}
   */
  [publish](reg) {
    this[logger].info('[ClusterClient#%s] publish %j', this.options.name, reg);
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
      this.ready(() => this[invoke](method, args, callback));
      return;
    }

    debug('[ClusterClient#%s] invoke method: %s, args: %j', this.options.name, method, args);
    return this[innerClient].invoke(method, args, callback);
  }

  [close]() {
    return co(function* () {
      // close after ready, in case of innerClient is initializing
      yield this.ready();

      const client = this[innerClient];
      // prevent re-initializing
      client.removeListener('close', this[closeHandler]);

      if (client.close) {
        yield utils.callFn(client.close.bind(client));
      }
      this.removeAllListeners();
    }.bind(this));
  }
}

module.exports = ClusterClient;
