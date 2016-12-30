'use strict';

const cluster = require('../../');
const NotifyClient = require('./notify_client');

const exit = process.argv[2] === 'true';

const client = cluster(NotifyClient, { port: 6789 })
  .delegate('publish', 'invoke')
  .create();

client.subscribe({
  dataId: 'test-id',
}, val => {
  console.log('receive val', val);

  if (exit) {
    process.exit(0);
  }

  if (process.send) {
    process.send(process.pid);
  }
});
