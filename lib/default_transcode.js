'use strict';

exports.encode = function encode(obj) {
  return new Buffer(JSON.stringify(obj));
};

exports.decode = function decode(buf) {
  return JSON.parse(buf);
};
