'use strict';

const co = require('co');
const is = require('is-type-of');
const Base = require('sdk-base');
const assert = require('assert');
const utils = require('../utils');

const {
  logger,
  isReady,
  innerClient,
  subscribe,
  unSubscribe,
  publish,
  invoke,
  close,
  subInfo,
  subscribeMethodName,
  unSubscribeMethodName,
  publishMethodName,
  closeByUser,
  singleMode,
} = require('../symbol');
const _instances = new Map();

class SingleClient extends Base {
  constructor(options = {}) {
    super(options);

    this[isReady] = false;
    this[closeByUser] = false;
    this[singleMode] = true;
    this[subInfo] = new Map();
    if (_instances.has(options.name)) {
      this[innerClient] = _instances.get(options.name);
    } else {
      this[innerClient] = options.createRealClient();
      _instances.set(options.name, this[innerClient]);
      this[innerClient].once('close', () => {
        _instances.delete(options.name);
        this[logger].info('[cluster#SingleClient] %s is closed.', this.options.name);
      });
    }
    this[subscribeMethodName] = utils.findMethodName(options.descriptors, 'subscribe');
    this[unSubscribeMethodName] = utils.findMethodName(options.descriptors, 'unSubscribe');
    this[publishMethodName] = utils.findMethodName(options.descriptors, 'publish');

    if (is.function(this[innerClient].ready)) {
      this[innerClient].ready(err => {
        if (err) {
          this.ready(err);
        } else {
          this[isReady] = true;
          this.ready(true);
        }
      });
    } else {
      this[isReady] = true;
      this.ready(true);
    }
  }

  get isClusterClientLeader() {
    return true;
  }

  /**
   * log instance
   * @property {Logger} SingleClient#[logger]
   */
  get [logger]() {
    return this.options.logger;
  }

  /**
   * do subscribe
   *
   * @param {Object} reg - subscription info
   * @param {Function} listener - callback function
   * @return {void}
   */
  [subscribe](reg, listener) {
    if (!this[subscribeMethodName]) return;

    assert(is.function(listener), `[ClusterClient:${this.options.name}] subscribe(reg, listener) listener should be a function`);
    const key = this.options.formatKey(reg);
    this.on(key, listener);

    const info = this[subInfo].get(key);
    if (!info) {
      this[subInfo].set(key, {
        reg,
        inited: false,
        data: null,
      });
      this.ready(err => {
        if (!err) {
          this[innerClient][this[subscribeMethodName]](reg, data => {
            this[subInfo].set(key, {
              reg,
              inited: true,
              data,
            });
            this.emit(key, data);
          });
        }
      });
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
    const key = this.options.formatKey(reg);
    if (listener) {
      this.removeListener(key, listener);
    } else {
      this.removeAllListeners(key);
    }

    if (!this[unSubscribeMethodName]) return;

    if (this.listenerCount(key) === 0) {
      this[subInfo].delete(key);
      if (this[isReady]) {
        this[innerClient][this[unSubscribeMethodName]](reg);
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
    if (!this[publishMethodName]) return;

    if (!this[isReady]) {
      this.ready(err => {
        if (!err) {
          this[publish](reg);
        }
      });
      return;
    }
    this[innerClient][this[publishMethodName]](reg);
  }

  /**
   * invoke a method asynchronously
   *
   * @param {String} methodName - the method name
   * @param {Array} args - the arguments list
   * @param {Function} callback - callback function
   * @return {void}
   */
  [invoke](methodName, args, callback) {
    if (!this[isReady]) {
      this.ready(err => {
        if (err) {
          callback && callback(err);
          return;
        }
        this[invoke](methodName, args, callback);
      });
      return;
    }

    let method = this[innerClient][methodName];
    // compatible with generatorFunction
    if (is.generatorFunction(method)) {
      method = co.wrap(method);
    }
    args.push(callback);
    const ret = method.apply(this[innerClient], args);
    if (callback && is.promise(ret)) {
      ret.then(result => callback(null, result), err => callback(err))
        // to avoid uncaught exception in callback function, then cause unhandledRejection
        .catch(err => {
          setImmediate(() => {
            if (!this[closeByUser]) {
              this.emit('error', err);
            }
          });
        });
    }
  }

  async [close]() {
    this[closeByUser] = true;
    _instances.delete(this.options.name);

    try {
      // close after ready, in case of innerClient is initializing
      await this.ready();
    } catch (err) {
      // ignore
    }

    const client = this[innerClient];
    if (client && client.close) {
      await utils.callFn(client.close.bind(client));
    }
  }
}

module.exports = SingleClient;
