'use strict';

const assert = require('assert');
const DataClient = require('./data_client');
const APIClientBase = require('../../../lib/api_client');

class ApiClient extends APIClientBase {
  constructor(options = {}) {
    super(Object.assign({}, options, { initMethod: '_init' }));
  }

  get DataClient() {
    return DataClient;
  }

  get clusterOptions() {
    return {
      port: parseInt(process.env.NODE_CLUSTER_CLIENT_PORT || 7777),
      singleMode: process.env.NODE_CLUSTER_CLIENT_SINGLE_MODE === '1',
    };
  }

  async _init() {
    await this._client.ready();
    this._client.subscribe({
      dataId: 'foo',
    }, val => {
      try {
        this._setFoo(val);
        this.foo = val;
        this.emit('foo', val);
      } catch (err) {
        this.emit('error', err);
        this.emit('foo', val);
      }
    });
    await this.await('foo');
    // await this.awaitFirst([ 'foo', 'error' ]);
  }

  _setFoo(val) {
    assert(typeof val === 'object');
    assert.deepEqual(Object.keys(val), [ 'bar' ]);

    val.xxx = 'yyy';
  }

  publish(reg) {
    this._client.publish(reg);
  }

  close() {
    return this._client.close();
  }
}

module.exports = ApiClient;
