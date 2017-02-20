'use strict';

exports.encode = function encode(obj) {
  if (obj === undefined) return;
  return new Buffer(JSON.stringify(obj));
};

exports.decode = function decode(buf) {
  return JSON.parse(buf);
};
