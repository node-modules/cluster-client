'use strict';

const path = require('path');
const coffee = require('coffee');
const pedding = require('pedding');

describe('test/cluster.test.js', () => {
  it('should subscibe & publish ok', commit => {
    const count = 4;
    const pub = coffee.fork(path.join(__dirname, 'supports/pub.js'));
    pub.end((err, meta) => {
      if (err) {
        commit(err);
      }
      console.log(meta);
      console.log('publish finish');
    });

    setTimeout(() => {
      const done = pedding(err => {
        console.log('all subscibe finish');
        pub.proc.kill();
        commit(err);
      }, count);

      for (let i = 0; i < count; ++i) {
        coffee.fork(path.join(__dirname, 'supports/sub.js'), [ true ])
          .expect('stdout', /receive val/)
          .end(err => {
            console.log('subscribe finish');
            done(err);
          });
      }
    }, 1000);
  });

  it('should subscibe & publish ok after leader die', done => {
    done = pedding(done, 2);
    const leader = coffee.fork(path.join(__dirname, 'supports/sub.js'), [ false ]);
    leader.end();

    setTimeout(() => {
      const pub = coffee.fork(path.join(__dirname, 'supports/pub.js'));
      pub.end();

      let received = false;
      const follower = coffee.fork(path.join(__dirname, 'supports/sub.js'), [ false ]);
      follower
        .expect('stdout', /receive val/)
        .end(done);

      setImmediate(() => {
        follower.proc.on('message', () => {
          if (received) {
            follower.proc.kill();
            pub.proc.kill();
            done();
          } else {
            leader.proc.kill();
            received = true;
          }
        });
      });
    }, 1000);
  });

  it('should invoke with special arguments', done => {
    coffee.fork(path.join(__dirname, 'supports/invoke'))
      .expect('stdout', /success/)
      .end(done);
  });

  it('should work on cluster module', () => {
    return coffee.fork(path.join(__dirname, 'supports/cluster_server.js'))
      // .debug(0)
      // make sure leader and follower exists
      .expect('stdout', /, leader: true/)
      .expect('stdout', /, leader: false/)
      .expect('stdout', /client get val: bar/)
      .expect('code', 0)
      .end();
  });
});
