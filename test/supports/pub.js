'use strict';

const co = require('co');
const cluster = require('../../');
const NotifyClient = require('./notify_client');
const sleep = timeout => cb => setTimeout(cb, timeout);

const client = cluster(NotifyClient, { port: 6789 })
  .delegate('publish', 'invoke')
  .create();

const running = true;

co(function* () {

  while (running) {
    yield client.publish({
      dataId: 'test-id',
      publishData: Date.now(),
    });

    yield sleep(2000);
  }

}).catch(err => {
  console.error(err);
  process.exit(1);
});
