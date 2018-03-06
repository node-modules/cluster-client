'use strict';

const mm = require('mm');
const assert = require('assert');
const Base = require('sdk-base');
const utils = require('../lib/utils');

describe('test/utils.test.js', () => {

  it('should call nextId ok', () => {
    const id = utils.nextId();
    assert(typeof id === 'number');
    assert((id + 1) === utils.nextId());
    utils.setId(Math.pow(2, 30));
    assert(utils.nextId() === 1);
  });

  it('should callFn ok', async function() {
    await utils.callFn(null);
    const ret = await utils.callFn(function* (a, b) {
      return a + b;
    }, [ 1, 2 ]);
    assert(ret === 3);
    await utils.callFn(function(a, b) {
      return Promise.resolve(a + b);
    }, [ 1, 2 ]);
    assert(ret === 3);
    await utils.callFn(function(a, b) {
      return a + b;
    }, [ 1, 2 ]);
    assert(ret === 3);
  });

  it('should delegateEvents ok', done => {
    const from = new Base();
    const to = new Base();

    utils.delegateEvents(from, to);

    to.once('foo', val => {
      assert(val === 'bar');
      done();
    });
    from.emit('foo', 'bar');
  });

  it('should support nesting delegate', done => {
    const obj1 = new Base();
    const obj2 = new Base();
    const obj3 = new Base();
    const obj4 = new Base();

    utils.delegateEvents(obj1, obj2);
    utils.delegateEvents(obj2, obj3);
    utils.delegateEvents(obj3, obj4);

    let triggered = false;
    obj4.on('foo', val => {
      if (triggered) {
        done(new Error('should not triggered multi-times'));
      } else {
        assert(val === 'bar');
        triggered = true;
        setImmediate(done);
      }
    });
    obj1.emit('foo', 'bar');
  });

  it('should check duplcate error handler', done => {
    mm(console, 'error', () => {
      done(new Error('should not run here'));
    });

    const obj1 = new Base();
    const obj2 = new Base();
    const obj3 = new Base();
    const obj4 = new Base();

    utils.delegateEvents(obj1, obj2);
    utils.delegateEvents(obj2, obj3);
    utils.delegateEvents(obj3, obj4);

    let triggered = false;
    obj4.on('error', err => {
      if (triggered) {
        done(new Error('should not triggered multi-times'));
      } else {
        assert(err && err.message === 'mock error');
        triggered = true;
        setImmediate(done);
      }
    });
    obj1.emit('error', new Error('mock error'));
  });
});
