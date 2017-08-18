'use strict';

const APIClientBase = require('../../').APIClientBase;

class APIClient extends APIClientBase {
  get DataClient() {
    return require('./data_client');
  }

  get clusterOptions() {
    return {
      name: 'api_client_test',
      responseTimeout: 100,
    };
  }

  * echo(str) {
    return yield this._client.echo(str);
  }
}

module.exports = APIClient;
