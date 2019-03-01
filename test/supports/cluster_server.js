'use strict';

const cluster = require('cluster');
const http = require('http');
const net = require('net');
// let numCPUs = require('os').cpus().length;
const APIClientBase = require('../..').APIClientBase;

const numCPUs = 2;

function startServer(port) {
  class TestClient extends APIClientBase {
    get DataClient() {
      return require('./client');
    }

    get delegates() {
      return {
        unPublish: 'invokeOneway',
      };
    }

    get clusterOptions() {
      return {
        port,
        responseTimeout: 1000,
        name: `cluster-server-test-${process.version}`,
      };
    }

    subscribe(...args) {
      return this._client.subscribe(...args);
    }

    unSubscribe(...args) {
      return this._client.unSubscribe(...args);
    }

    publish(...args) {
      return this._client.publish(...args);
    }

    unPublish(...args) {
      return this._client.unPublish(...args);
    }

    close() {
      return this._client.close();
    }
  }

  if (cluster.isMaster) {
    console.log(`Master ${process.pid} is running`);
    const workerSet = new Set();

    // Fork workers.
    for (let i = 0; i < numCPUs; i++) {
      cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
      console.log(`worker ${worker.process.pid} died, code: ${code}, signal: ${signal}`);
    });
    cluster.on('message', worker => {
      workerSet.add(worker.id);
      if (workerSet.size === numCPUs) {
        process.exit(0);
      }
    });
    // setTimeout(() => {
    //   process.exit(0);
    // }, 10000);
  } else {
    const client = new TestClient();
    console.log('NODE_CLUSTER_CLIENT_SINGLE_MODE =>', process.env.NODE_CLUSTER_CLIENT_SINGLE_MODE);
    client.ready(err => {
      if (err) {
        console.log(`Worker ${process.pid} client ready failed, leader: ${client.isClusterClientLeader}, errMsg: ${err.message}`);
      } else {
        console.log(`Worker ${process.pid} client ready, leader: ${client.isClusterClientLeader}`);
      }
    });
    let latestVal;
    client.subscribe({ key: 'foo' }, val => {
      latestVal = val;
      console.log(`Worker ${process.pid} client get val: ${val}, leader: ${client.isClusterClientLeader}`);
    });

    setInterval(() => {
      client.publish({ key: 'foo', value: 'bar ' + Date() });
    }, 200);

    setTimeout(() => {
      process.send(cluster.worker.id);
    }, 5000);

    // Workers can share any TCP connection
    // In this case it is an HTTP server
    http.createServer((req, res) => {
      res.writeHead(200);
      res.end(`hello cluster client, data: ${latestVal}`);
    }).listen(port + 1);
    console.log(`Worker ${process.pid} started, listen at ${port + 1}`);
  }
}

const server = net.createServer();
server.listen(0, () => {
  const address = server.address();
  console.log('using port =>', address.port);
  server.close();
  setTimeout(() => {
    startServer(address.port);
  }, 100);
});
