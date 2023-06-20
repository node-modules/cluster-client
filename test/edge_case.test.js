const mm = require('mm');
const assert = require('assert');
const detect = require('detect-port');
const { sleep } = require('../lib/utils');
const ApiClient = require('./supports/case_1/api_client');

describe('test/edge_case.test.js', () => {
  afterEach(mm.restore);

  [
    'single',
    'cluster',
  ].forEach(scene => {
    describe(scene, () => {
      beforeEach(async () => {
        mm(process.env, 'NODE_CLUSTER_CLIENT_PORT', await detect());
        mm(process.env, 'NODE_CLUSTER_CLIENT_SINGLE_MODE', scene === 'single' ? '1' : '0');
      });

      it('should not side effect', async () => {
        const client1 = new ApiClient();
        await client1.ready();

        assert.deepEqual(client1.foo, { bar: 'bar', xxx: 'yyy' });

        const client2 = new ApiClient();
        await client2.ready();

        assert.deepEqual(client2.foo, { bar: 'bar', xxx: 'yyy' });

        await client1.close();
        await client2.close();
      });

      it('should trigger event ok', async () => {
        const client1 = new ApiClient();
        await client1.ready();

        assert.deepEqual(client1.foo, { bar: 'bar', xxx: 'yyy' });

        mm(ApiClient.prototype, '_setFoo', () => {
          throw new Error('mock error');
        });

        const errors = [];
        const client2 = new ApiClient();
        client2.on('error', err => {
          errors.push(err);
        });
        await sleep(100);

        assert(errors.length === 1);
        assert(errors[0].message === 'mock error');

        await client1.close();
        await client2.close();
      });
    });
  });

  it('should delegate events', async () => {
    mm(process.env, 'NODE_CLUSTER_CLIENT_SINGLE_MODE', '1');
    const client1 = new ApiClient();
    await client1.ready();

    client1.publish(null);
    try {
      await client1.await('error');
    } catch (err) {
      assert(err.name === 'EmptyRegError');
    }

    const client2 = new ApiClient();
    await client2.ready();

    client2.publish(null);
    try {
      await client2.await('error');
    } catch (err) {
      assert(err.name === 'EmptyRegError');
    }

    client1.publish(null);
    try {
      await client2.await('error');
    } catch (err) {
      assert(err.name === 'EmptyRegError');
    }

    client2.publish(null);
    try {
      await client1.await('error');
    } catch (err) {
      assert(err.name === 'EmptyRegError');
    }

    await client1.close();
    await client2.close();
  });
});
