'use strict';

const Base = require('sdk-base');

class NotifyClient extends Base {
  constructor() {
    super();
    this._registered = new Map();
    this.ready(true);
  }

  /**
   * subscribe
   *
   * @param {Object} reg
   *   - {String} dataId - the dataId
   * @param {Function}  listener - the listener
   */
  subscribe(reg, listener) {
    const key = reg.dataId;
    this.on(key, listener);
  }

  /**
   * publish
   *
   * @param {Object} reg
   *   - {String} dataId - the dataId
   *   - {String} publishData - the publish data
   * @return {Boolean} result
   */
  * publish(reg) {
    const key = reg.dataId;
    this.emit(key, reg.publishData);
    return true;
  }

  * commit(id, data) {
    console.log(id, data);
    return data;
  }
}

module.exports = NotifyClient;
