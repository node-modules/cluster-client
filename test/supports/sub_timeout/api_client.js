'use strict';

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
      singleMode: false,
      subscribeTimeout: 1000,
    };
  }

  async _init() {
    await this._client.ready();
  }

  subscribe(config, listener) {
    this._client.subscribe(config, listener);
  }

  publish(reg) {
    this._client.publish(reg);
  }

  close() {
    return this._client.close();
  }
}

module.exports = ApiClient;
