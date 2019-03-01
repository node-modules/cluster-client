'use strict';

const Base = require('sdk-base');

class DataClient extends Base {
  constructor(options = {}) {
    super(options);

    this._cache = new Map();
  }

  async _init() {
    this._cache.set('foo', {
      bar: 'bar',
    });
  }

  subscribe(reg, listener) {
    const key = reg.dataId;

    process.nextTick(() => {
      listener(this._cache.get(key));
    });

    this.on(key, listener);
  }

  publish(reg) {
    process.nextTick(() => {
      if (!reg) {
        const err = new Error('empty reg');
        err.name = 'EmptyRegError';
        this.emit('error', err);
        return;
      }
      this._cache.set(reg.dataId, reg.data);
      this.emit(reg.dataId, this._cache.get(reg.dataId));
    });
  }

  close() {
    this._cache.clear();
  }
}

module.exports = DataClient;
