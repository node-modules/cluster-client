'use strict';

const cluster = require('../../../../lib');
const RegistryClient = require('./lib/registry_client');

module.exports = function(agent) {
  const done = agent.readyCallback('register_client', {
    isWeakDep: agent.config.runMode === 0,
  });
  agent.mockClient = cluster(RegistryClient, { port: 9999 })
    .delegate('returnUndefined', 'invoke')
    .delegate('returnDate', 'invoke')
    .delegate('returnBuffer', 'invoke')
    .create();
  agent.mockClient.ready(done);

  agent.messenger.on('die', () => {
    process.exit(1);
    // throw new Error('kill myself');
  });
};
