'use strict';

exports.init = Symbol.for('ClusterClient#init');
exports.logger = Symbol.for('ClusterClient#logger');
exports.isReady = Symbol.for('ClusterClient#isReady');
exports.innerClient = Symbol.for('ClusterClient#innerClient');
exports.subscribe = Symbol.for('ClusterClient#subscribe');
exports.unSubscribe = Symbol.for('ClusterClient#unSubscribe');
exports.publish = Symbol.for('ClusterClient#publish');
exports.invoke = Symbol.for('ClusterClient#invoke');
exports.subInfo = Symbol.for('ClusterClient#subInfo');
exports.pubInfo = Symbol.for('ClusterClient#pubInfo');
exports.closeHandler = Symbol.for('ClusterClient#closeHandler');
exports.close = Symbol.for('ClusterClient#close');
exports.isClosed = Symbol.for('ClusterClient#isClosed');
