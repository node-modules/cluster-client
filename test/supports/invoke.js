'use strict';

const co = require('co');
const is = require('is-type-of');
const assert = require('assert');
const cluster = require('../../');
const NotifyClient = require('./notify_client');

const client = cluster(NotifyClient, {
  port: 6789,
  transcode: {
    encode(obj) {
      if (is.date(obj)) {
        return Buffer.from(JSON.stringify({
          type: 'date',
          data: obj.getTime(),
        }));
      } else if (is.buffer(obj)) {
        return Buffer.from(JSON.stringify({
          type: 'buffer',
          data: obj.toString('hex'),
        }));
      }
      return Buffer.from(JSON.stringify(obj));
    },
    decode(buf) {
      const obj = JSON.parse(buf);
      if (obj.type === 'date') {
        return new Date(obj.data);
      } else if (obj.type === 'buffer') {
        return Buffer.from(obj.data, 'hex');
      }
      return obj;
    },
  },
})
  .delegate('publish', 'invoke')
  .create();

co(function* () {

  let ret = yield client.commit('123', new Date());
  assert(is.date(ret));
  ret = yield client.commit('123', Buffer.from('hello'));
  assert(is.buffer(ret) && ret.toString() === 'hello');
  ret = yield client.commit('123', { name: 'peter' });
  assert(is.object(ret) && ret.name === 'peter');

  console.log('success');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
