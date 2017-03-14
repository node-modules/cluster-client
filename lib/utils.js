'use strict';

const is = require('is-type-of');
const stringify = require('json-stringify-safe');

const MAX_INT_HIGH = Math.pow(2, 21);
const MAX_REQUEST_ID = Math.pow(2, 30); // avoid write big integer
const empty = () => {};

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

/**
 * event delegate
 *
 * @param {EventEmitter} from - from object
 * @param {EventEmitter} to - to object
 * @return {void}
 */
exports.delegateEvents = (from, to) => {
  // ignore the sdk-base defaultErrorHandler
  // https://github.com/node-modules/sdk-base/blob/master/index.js#L131
  if (from.listeners('error').length <= 1) {
    from.on('error', empty);
  }

  from.emit = new Proxy(from.emit, {
    apply(target, thisArg, args) {
      target.apply(from, args);
      to.emit.apply(to, args);
      return thisArg;
    },
  });
};

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

/**
 * call a function, support common function, generator function, or a function returning promise
 *
 * @param {Function} fn - common function, generator function, or a function returning promise
 * @param {Array} args - args as fn() paramaters
 * @return {*} data returned by fn
 */
exports.callFn = function* (fn, args) {
  args = args || [];
  if (!is.function(fn)) return;
  if (is.generatorFunction(fn)) {
    return yield fn(...args);
  }
  const r = fn(...args);
  if (is.promise(r)) {
    return yield r;
  }
  return r;
};
