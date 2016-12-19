'use strict';

const Reflect = require('harmony-reflect');
const stringify = require('json-stringify-safe');

const MAX_INT_HIGH = Math.pow(2, 21);
const MAX_REQUEST_ID = Math.pow(2, 30); // avoid write big integer

let id = 0;

function nextId() {
  id += 1;
  if (id >= MAX_REQUEST_ID) {
    id = 1;
  }
  return id;
}

/**
 * generate requestId
 *
 * @return {Number} requestId
 */
exports.nextId = nextId;

function delegateEvents(from, to, eventName) {
  function ___delegateEvent___() {
    const args = Array.from(arguments);
    args.unshift(eventName);
    to.emit.apply(to, args);
  }

  if (!eventName) {
    const events = to.eventNames ? to.eventNames() : Reflect.ownKeys(to._events);
    for (const name of events) {
      delegateEvents(from, to, name);
    }
  } else {
    const listeners = from.listeners(eventName) || [];
    for (const listener of listeners) {
      if (listener.name === '___delegateEvent___') {
        return;
      }
    }
    from.on(eventName, ___delegateEvent___);
  }
}

/**
 * event delegate
 *
 * @param {EventEmitter} from - from object
 * @param {EventEmitter} to - to object
 * @param {String} [eventName] - event name
 * @return {void}
 */
exports.delegateEvents = delegateEvents;

function formatKey(reg) {
  return stringify(reg);
}

/**
 * normalize object to string
 *
 * @param {Object} reg - reg object
 * @return {String} key
 */
exports.formatKey = formatKey;

/**
 * transfer Long type to number or string safely
 *
 * @param {Long} val - the long val
 * @return {Number|String} - result
 */
exports.handleLong = function(val) {
  const notSafeInt = val.high > MAX_INT_HIGH || // bigger than 2^54
    val.high === MAX_INT_HIGH && val.low > 0 || // between 2^53 ~ 2^54
    val.high < -1 * MAX_INT_HIGH || // smaller than -2^54
    val.high === -1 * MAX_INT_HIGH && val.low < 0; // between -2^54 ~ -2^53

  if (notSafeInt) {
    return val.toString();
  }
  return val.toNumber();
};
