'use strict';

const assert = require('power-assert');
const server = require('../lib/server');
const server_copy = require('./supports/server');

describe('test/server.test', () => {
  it('should create different type of server in one process', function* () {
    const instance = yield server.create('xxx', 10000);
    const instance_2 = yield server_copy.create('yyy', 10000);

    assert(instance && instance === instance_2);

    instance.close();
  });
});
