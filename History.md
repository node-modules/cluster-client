
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
