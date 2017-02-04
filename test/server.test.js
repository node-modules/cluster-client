'use strict';

const mm = require('mm');
const path = require('path');
const coffee = require('coffee');

describe('test/server.test', () => {
  afterEach(mm.restore);

  it('should create different type of server in one process', done => {
    coffee.fork(path.join(__dirname, 'supports/get_server'))
      .expect('stdout', 'success\n')
      .end(done);
  });
});
