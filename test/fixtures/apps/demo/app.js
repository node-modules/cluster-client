'use strict';

const cluster = require('../../../../lib');
const RegistryClient = require('./lib/registry_client');

module.exports = function(app) {
  const done = app.readyCallback('register_client', {
    isWeakDep: app.config.runMode === 0,
  });
  app.mockClient = cluster(RegistryClient, { port: 9999 })
    .delegate('returnUndefined', 'invoke')
    .create();
  app.mockClient.ready(done);

  app.mockClient.subscribe({
    dataId: 'com.alibaba.dubbo.demo.DemoService',
  }, val => {
    app.val = val;
  });
};
