'use strict';

const assert = require('assert');
const sleep = require('mz-modules/sleep');
const ApiClient = require('./supports/sub_timeout/api_client');

describe('test/subscrib.test.js', () => {
  describe('timeout case', () => {
    it('should timeout', async () => {
      const leader = new ApiClient({
        singleMode: false,
        isLeader: true,
      });
      const follower = new ApiClient({
        clusterOptions: {
          subscribeTimeout: 1000,
        },
        singleMode: false,
        isLeader: false,
      });
      await follower.ready();
      const errors = [];
      const values = [];
      follower.on('error', err => {
        errors.push(err);
      });
      follower.subscribe({
        key: 'timeout:500',
      }, value => {
        values.push(value);
      });
      follower.subscribe({
        key: 'timeout:1500',
      }, value => {
        values.push(value);
      });
      await sleep(2000);
      assert.deepStrictEqual(values, [
        'hello:500',
        'hello:1500',
      ]);
      assert(errors.length === 1);
      assert(/subscribe timeout for/.test(errors[0]));
      await follower.close();
      await leader.close();
    });
  });
});
