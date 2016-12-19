'use strict';

const debug = require('debug')('cluster-client');

// default logger
module.exports = {
  info() {
    debug.apply(null, arguments);
  },
  warn() {
    debug.apply(null, arguments);
  },
  error() {
    debug.apply(null, arguments);
  },
  debug() {
    debug.apply(null, arguments);
  },
};
