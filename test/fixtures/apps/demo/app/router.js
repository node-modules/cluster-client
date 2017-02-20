'use strict';

module.exports = function(app) {
  app.get('/', function*() {
    this.body = 'ok';
  });

  app.get('/get', function*() {
    this.body = app.val && app.val.map(url => url.host).join(',');
  });

  app.post('/publish', function*() {
    const val = this.request.body.value;
    app.mockClient.publish({
      dataId: 'com.alibaba.dubbo.demo.DemoService',
      publishData: `dubbo://${val}:20880/com.alibaba.dubbo.demo.DemoService?anyhost=true&application=demo-provider&dubbo=2.0.0&generic=false&interface=com.alibaba.dubbo.demo.DemoService&loadbalance=roundrobin&methods=sayHello&owner=william&pid=81281&side=provider&timestamp=1481613276143`,
    });
    this.body = 'ok';
  });

  app.get('/kill_agent', function*() {
    app.messenger.sendToAgent('die');
    this.body = 'ok';
  });

  app.get('/return/undefined', function* () {
    const ret = yield app.mockClient.returnUndefined();
    this.body = ret === undefined;
  });

  app.get('/return/date', function* () {
    const ret = yield app.mockClient.returnDate();
    this.body = ret instanceof Date;
  });

  app.get('/return/buffer', function* () {
    const ret = yield app.mockClient.returnBuffer();
    this.body = Buffer.isBuffer(ret);
  });
};
