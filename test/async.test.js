'use strict';

const assert = require('assert');
const APIClient = require('./supports/async_api_client');

describe('test/async.test.js', () => {
  it('should support auto delegate async function', async function() {
    const leader = new APIClient();
    const follower = new APIClient();

    await Promise.all([
      leader.ready(),
      follower.ready(),
    ]);

    let ret = await follower.echo('hello');
    assert(ret === 'hello');

    ret = await leader.echo('hello');
    assert(ret === 'hello');

    await Promise.all([
      follower.close(),
      leader.close(),
    ]);
  });
});
