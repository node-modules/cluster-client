'use strict';

const co = require('co');
const assert = require('assert');
const server_copy = require('./server');
const server = require('../../lib/server');

co(function* () {
  const instance = yield server.create('xxx', 10000);
  const instance_2 = yield server_copy.create('yyy', 10000);

  assert(instance && instance === instance_2);

  instance.close();
  console.log('success');
}).catch(err => {
  console.error(err);
});
