'use strict';

const is = require('is-type-of');
const symbols = require('./symbol');
const logger = require('./default_logger');
const transcode = require('./default_transcode');
const ClusterClient = require('./client');
const formatKey = require('./utils').formatKey;

const defaultOptions = {
  port: 7777,
  maxWaitTime: 30000,
  responseTimeout: 3000,
  heartbeatInterval: 10000,
  autoGenerate: true,
  isBroadcast: true,
  logger,
  transcode,
  formatKey,
};

class ClientWrapper {
  /**
   * Cluster Client Wrapper
   *
   * @param {Function} clientClass - the client class
   * @param {Object} options
   *  - {Number} responseTimeout - response timeout, default is 3000
   *  - {Boolean} autoGenerate - whether generate delegate rule automatically, default is true
   *  - {Boolean} isBroadcast - whether broadcast subscrption result to all followers or just one, default is true
   *  - {Logger} logger - log instance
   *  - {Transcode} [transcode|JSON.stringify/parse]
   *    - {Function} encode - custom serialize method
   *    - {Function} decode - custom deserialize method
   *  - {Boolean} [isLeader|null] - specify whether current instance is leader
   *  - {Number} [maxWaitTime|30000] - leader startup max time (ONLY effective on isLeader is true)
   * @constructor
   */
  constructor(clientClass, options) {
    this._clientClass = clientClass;
    this._options = Object.assign({
      name: clientClass.prototype.constructor.name,
    }, defaultOptions, options);

    // wrapper descptions
    this._descriptors = new Map();
  }

  /**
   * override the property
   *
   * @param {String} name - property name
   * @param {Object} value - property value
   * @return {ClientWrapper} self
   */
  override(name, value) {
    this._descriptors.set(name, {
      type: 'override',
      value,
    });
    return this;
  }

  /**
   * delegate methods
   *
   * @param {String} from - method name
   * @param {String} to - delegate to subscribe|publish|invoke
   * @return {ClientWrapper} self
   */
  delegate(from, to) {
    to = to || 'invoke';
    this._descriptors.set(from, {
      type: 'delegate',
      to,
    });
    return this;
  }

  /**
   * create cluster client instance
   *
   * @return {Object} instance
   */
  create() {
    const args = Array.from(arguments);
    const clientClass = this._clientClass;
    const proto = clientClass.prototype;
    const descriptors = this._descriptors;

    // auto generate description
    if (this._options.autoGenerate) {
      this._generateDescriptors();
    }

    function createRealClient() {
      return Reflect.construct(clientClass, args);
    }

    const client = new ClusterClient(Object.assign({
      createRealClient,
      descriptors: this._descriptors,
    }, this._options));

    for (const name of descriptors.keys()) {
      let value;
      const descriptor = descriptors.get(name);
      switch (descriptor.type) {
        case 'override':
          value = descriptor.value;
          break;
        case 'delegate':
          if (descriptor.to === 'invoke') {
            if (is.generatorFunction(proto[name])) {
              value = function* () {
                const args = Array.from(arguments);
                return yield callback => client[Symbol.for(`ClusterClient#${descriptor.to}`)](name, args, callback);
              };
            } else if (is.function(proto[name])) {
              value = function() {
                const args = Array.from(arguments);
                let callback;
                if (is.function(args[args.length - 1])) {
                  callback = args.pop();
                }
                // whether callback or promise
                if (callback) {
                  client[Symbol.for(`ClusterClient#${descriptor.to}`)](name, args, callback);
                } else {
                  return new Promise((resolve, reject) => {
                    client[Symbol.for(`ClusterClient#${descriptor.to}`)](name, args, function(err) {
                      if (err) {
                        reject(err);
                      } else {
                        resolve.apply(null, Array.from(arguments).slice(1));
                      }
                    });
                  });
                }
              };
            } else {
              throw new Error(`api: ${name} not implement in client`);
            }
          } else {
            value = client[Symbol.for(`ClusterClient#${descriptor.to}`)];
          }
          break;
        default:
          break;
      }
      Object.defineProperty(client, name, {
        enumerable: true,
        value,
      });
    }

    return client;
  }

  _generateDescriptors() {
    const clientClass = this._clientClass;
    const proto = clientClass.prototype;

    let needSub = true;
    let needPub = true;
    for (const entry of this._descriptors.entries()) {
      const key = entry[0];
      const value = entry[1];
      if (key === 'subscribe' || (value.type === 'delegate' && value.to === 'subscribe')) {
        needSub = false;
      }
      if (key === 'publish' || (value.type === 'delegate' && value.to === 'publish')) {
        needPub = false;
      }
    }

    if (needSub && is.function(proto.subscribe)) {
      this.delegate('subscribe', 'subscribe');
    }
    if (needPub && is.function(proto.publish)) {
      this.delegate('publish', 'publish');
    }

    const keys = Reflect.ownKeys(proto)
      .filter(key => !key.startsWith('_') &&
        !this._descriptors.has(key));

    for (const key of keys) {
      const descriptor = Reflect.getOwnPropertyDescriptor(proto, key);
      if (descriptor.value && is.generatorFunction(descriptor.value)) {
        this.delegate(key);
      }
    }
  }
}

/**
 * Create an Wrapper
 *
 * @param {Function} clientClass - client class
 * @param {Object} options - wrapper options
 * @return {ClientWrapper} wrapper
 */
module.exports = function createWrapper(clientClass, options) {
  return new ClientWrapper(clientClass, options);
};

/**
 * Close a ClusterClient
 *
 * @param {Object} client - ClusterClient instance to be closed
 * @return {Promise} returns a promise which will be resolved after fully closed
 */
module.exports.close = function(client) {
  return client[symbols.close]();
};
