# Changelog

## [3.6.0](https://github.com/node-modules/cluster-client/compare/v3.5.0...v3.6.0) (2024-01-24)


### Features

* set ClusterServer default maximum listeners up to 20 ([#66](https://github.com/node-modules/cluster-client/issues/66)) ([384b7b4](https://github.com/node-modules/cluster-client/commit/384b7b48c9a79203a1b7639fa4b7475434cfa8b4))

## [3.5.0](https://github.com/node-modules/cluster-client/compare/v3.4.1...v3.5.0) (2023-08-30)


### Features

* add tips for tcp-base ([#64](https://github.com/node-modules/cluster-client/issues/64)) ([f3068e0](https://github.com/node-modules/cluster-client/commit/f3068e0b6900b595e91a630e0f4e3bea7e84c3de))

## [3.4.1](https://github.com/node-modules/cluster-client/compare/v3.4.0...v3.4.1) (2023-06-20)


### Bug Fixes

* avoid serialize-json encoder error ([#63](https://github.com/node-modules/cluster-client/issues/63)) ([73c44d2](https://github.com/node-modules/cluster-client/commit/73c44d235c3bc6015263c98a4c5bf961af08cb55))

## [3.4.0](https://github.com/node-modules/cluster-client/compare/v3.3.3...v3.4.0) (2023-01-11)


### Features

* throw error when create server port is missing ([#62](https://github.com/node-modules/cluster-client/issues/62)) ([eb890c3](https://github.com/node-modules/cluster-client/commit/eb890c3607d118f6c8493fc99e3cd74c46d3fd79))

## [3.3.3](https://github.com/node-modules/cluster-client/compare/v3.3.2...v3.3.3) (2023-01-10)


### Bug Fixes

* add more debug log ([#61](https://github.com/node-modules/cluster-client/issues/61)) ([698105f](https://github.com/node-modules/cluster-client/commit/698105f8016d8cb4f127cfb46aa01ac64c185453))

## [3.3.2](https://github.com/node-modules/cluster-client/compare/v3.3.1...v3.3.2) (2022-12-17)


### Bug Fixes

* Auto release on action ([#59](https://github.com/node-modules/cluster-client/issues/59)) ([eb1655e](https://github.com/node-modules/cluster-client/commit/eb1655e196aa196413e3a169f9ff636cbf83d2c9))

---


3.3.1 / 2022-11-23
==================

**fixes**
  * [[`9d9b965`](http://github.com/node-modules/cluster-client/commit/9d9b965a50e148bff78c8763bcd4dea7e2998e57)] - fix: should not emit timeout when has cache (#58) (killa <<killa123@126.com>>)

3.3.0 / 2022-11-14
==================

**features**
  * [[`8ed198d`](http://github.com/node-modules/cluster-client/commit/8ed198db8d64eb76e018699093faed7c88f8c412)] - feat: add options isCheckHeartbeat of whether check heartbeat (#57) (sinkhaha <<1468709106@qq.com>>)

3.2.0 / 2022-10-18
==================

**features**
  * [[`c9f389d`](http://github.com/node-modules/cluster-client/commit/c9f389d277abf75a5b3274626b326b6642b208f1)] - feat: impl subscribeTimeout (#56) (killa <<killa123@126.com>>)

3.1.1 / 2022-06-22
==================

**fixes**
  * [[`f4cc11b`](http://github.com/node-modules/cluster-client/commit/f4cc11bb539f58cc4926f1ce10db6b4ae1e7769c)] - fix: subscribe is not working on single thread mode (#51) (钟典 Desmond <<z@limme.net>>)

3.1.0 / 2021-11-21
==================

**features**
  * [[`a21dde4`](http://github.com/node-modules/cluster-client/commit/a21dde4e7e20b232fe62c44266a0391b4eb4e46a)] - feat: connectTimeout support env, default 10s (#55) (mansonchor.github.com <<mansonchor1987@gmail.com>>)

3.0.1 / 2019-03-01
==================

**fixes**
  * [[`6f9bf8e`](http://github.com/node-modules/cluster-client/commit/6f9bf8e300386f28c2a208aa8c394d441045c03c)] - fix: single mode bugs (#49) (zōng yǔ <<gxcsoccer@users.noreply.github.com>>)

3.0.0 / 2019-02-26
==================

**features**
  * [[`7f3765d`](http://github.com/node-modules/cluster-client/commit/7f3765ded8877758c9a0bf0c1b23ab4e2c932c21)] - feat: support cpu single mode (#48) (zōng yǔ <<gxcsoccer@users.noreply.github.com>>)

2.1.2 / 2018-11-23
==================

**others**
  * [[`4c5093b`](http://github.com/node-modules/cluster-client/commit/4c5093b878ee8018524b1b0a514865e647a8f38c)] - chore: upgrade deps (#47) (zōng yǔ <<gxcsoccer@users.noreply.github.com>>)

2.1.1 / 2018-06-12
==================

**fixes**
  * [[`9fe3849`](http://github.com/node-modules/cluster-client/commit/9fe38494d41afca76491c78cf54b2717508f94b9)] - fix: follower should not retry register channel if socket already disconnected (#43) (zōng yǔ <<gxcsoccer@users.noreply.github.com>>)

2.1.0 / 2018-03-26
==================

**features**
  * [[`dce3fee`](http://github.com/node-modules/cluster-client/commit/dce3fee89a5c3d617b09e129f3ee68214fa90ccd)] - feat: response with whole error object instead of only stack, message (#38) (killa <<killa123@126.com>>)

2.0.0 / 2018-03-06
==================

**others**
  * [[`2574eae`](http://github.com/node-modules/cluster-client/commit/2574eae6fdbe603b74a3c27a57e3b545aec54314)] - [BREAKING] feat: migrating from generators to async/await (#36) (zōng yǔ <<gxcsoccer@users.noreply.github.com>>)
  * [[`e32f0ef`](http://github.com/node-modules/cluster-client/commit/e32f0eff5fe5dfb4187386d928b2fa8cdc65cfa5)] - chore: release 1.7.1 (xiaochen.gaoxc <<xiaochen.gaoxc@alibaba-inc.com>>),

1.7.1 / 2017-09-21
==================

  * fix: error occured while calling invokeOneway method if ready failed (#33)

1.7.0 / 2017-08-18
==================

  * feat: support custom port by env NODE_CLUSTER_CLIENT_PORT (#31)

1.6.8 / 2017-08-18
==================

  * fix: make sure leader ready before follower in egg (#32)

1.6.7 / 2017-07-31
==================

  * fix: only close server when server exists (#30)

1.6.6 / 2017-07-28
==================

  * fix: set exclusive to true on listen (#29)

1.6.5 / 2017-06-24
==================

  * fix: ignore error after close & register channel issue (#28)

1.6.4 / 2017-05-08
==================

  * chore: remove unnecessary log, using debug instead (#27)

1.6.3 / 2017-04-25
==================

  * fix: make sure follower test socket end (#25)

1.6.2 / 2017-04-25
==================

  * fix: ignore ECONNRESET error (#24)

1.6.1 / 2017-04-20
==================

  * fix: invoke before client ready issue (#23)
  * fix: fix symbol property error (#22)

1.6.0 / 2017-04-18
==================

  * feat: make clustClient method writable to support mock or spy (#21)

1.5.4 / 2017-04-12
==================

  * fix: avoid event memory leak warning (#20)

1.5.3 / 2017-03-17
==================

  * fix: make sure subscribe listener triggered asynchronized (#19)

1.5.2 / 2017-03-14
==================

  * fix: event delegate & leader ready bug (#18)

1.5.1 / 2017-03-13
==================

  * fix: don't auto ready when initMethod exists (#17)

1.5.0 / 2017-03-10
==================

  * feat: add APIClientBase to help you create your api client (#16)

1.4.0 / 2017-03-08
==================

  * feat: support unSubscribe, invokeOneway & close self (#14)

1.3.2 / 2017-03-08
==================

  * fix: fix leader subscribe issue & heartbeat timeout issue (#15)

1.3.1 / 2017-03-07
==================

  * chore: better notice (#13)
  * test: fix failed case (#12)

1.3.0 / 2017-02-22
==================

  * fix: block all remote connection (#11)

1.2.0 / 2017-02-20
==================

  * feat: use serialize-json to support encode/decode buffer, date, undef… (#10)

1.1.0 / 2017-02-07
==================

  * feat: close (#7)
  * fix: no more need harmony-reflect on node >= 6 (#8)
  * refactor: improve utils.delegateEvents() (#6)

1.0.3 / 2017-02-04
==================

  * fix: adjust serialize algorithm for invoke arguments (#3)

1.0.2 / 2017-01-25
==================

  * fix: log error if error exist (#5)
  * docs: fix typo subsribe -> subscribe (#4)

1.0.1 / 2016-12-26
==================

  * fix: fix shared memory issue (#2)

1.0.0 / 2016-12-22
==================

  * feat: implement cluster-client
