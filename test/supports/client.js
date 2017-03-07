'use strict';

const Base = require('sdk-base');

class Client extends Base {
  constructor(options) {
    super(options);
    this.registerInfo = new Map();
    this.ready(true);
  }

  subscribe(reg, listener) {
    if (!this.registerInfo.has(reg.key)) {
      this.registerInfo.set(reg.key, []);
    }
    process.nextTick(() => {
      listener(this.registerInfo.get(reg.key));
    });
    this.on(reg.key, listener);
  }

  unSubscribe(reg, listener) {
    if (listener) {
      this.removeListener(reg.key, listener);
    } else {
      this.removeAllListeners(reg.key);
    }
  }

  publish(reg) {
    const arr = this.registerInfo.get(reg.key) || [];
    arr.push(reg.value);
    this.registerInfo.set(reg.key, arr);
    process.nextTick(() => { this.emit(reg.key, arr); });
  }

  unPublish(reg) {
    const arr = this.registerInfo.get(reg.key) || [];
    const index = arr.indexOf(reg.value);
    if (index >= 0) {
      arr.splice(index, 1);
    }
    this.registerInfo.set(reg.key, arr);
    this.emit(reg.key, arr);
  }

  close() {
    this.registerInfo.clear();
  }
}

module.exports = Client;
