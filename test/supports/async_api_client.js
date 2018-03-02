'use strict';

const APIClientBase = require('../../').APIClientBase;

class APIClient extends APIClientBase {
  get DataClient() {
    return require('./async_data_client');
  }

  get clusterOptions() {
    return {
      name: 'api_client_test',
      responseTimeout: 100,
    };
  }

  async echo(str) {
    return await this._client.echo(str);
  }
}

module.exports = APIClient;
