const dgram = require('dgram');
const { format: URLFormat } = require('url');
const Base = require('sdk-base');

const pid = process.pid;
const localIp = require('address').ip();

class RegistryClient extends Base {
  constructor(multicastPort, multicastAddress) {
    super();

    this.multicastPort = multicastPort || 1234;
    this.multicastAddress = multicastAddress || '224.5.6.7';

    this._registered = new Map();
    this._subscribed = new Map();

    this._socket = dgram.createSocket({
      reuseAddr: true,
      type: 'udp4',
    });

    this._socket.on('error', err => this.emit('error', err));
    this._socket.on('message', buf => {
      const msg = buf.toString();

      if (msg.startsWith('register ')) {
        const url = msg.substring(9);
        const parsed = new URL(url);
        const key = parsed.searchParams.get('interface');
        if (this._subscribed.has(key)) {
          const subData = this._subscribed.get(key);
          const category = parsed.searchParams.get('category') || 'providers';
          // const enabled = parsed.query.enabled || true;

          if (subData.urlObj.query.category.split(',').indexOf(category) >= 0) {
            subData.value = subData.value || new Map();
            if (!subData.value.has(parsed.host)) {
              subData.value.set(parsed.host, { host: parsed.host });
              this.emit(key, Array.from(subData.value.values()));
            }
          }
        }
      } else if (msg.startsWith('unregister ')) {
        // TODO:
      } else if (msg.startsWith('subscribe ')) {
        const consumerUrl = msg.substring(10);
        const parsed = new URL(consumerUrl);
        const key = parsed.searchParams.get('interface');

        if (this._registered.has(key)) {
          const urls = this._registered.get(key);

          for (const url of urls) {
            const obj = new URL(url);
            const category = obj.searchParams.get('category') || 'providers';
            // const enabled = obj.query.enabled || true;
            if (parsed.searchParams.get('category').split(',').indexOf(category) >= 0) {
              this._broadcast(`register ${url}`);
            }
          }
        }
      }
    });

    this._socket.bind(this.multicastPort, () => {
      this._socket.addMembership(this.multicastAddress);
      setTimeout(() => {
        this.ready(true);
      }, 500);
    });

    this._inited = false;
    this.ready(() => {
      this._inited = true;
    });
  }

  _broadcast(msg) {
    if (!this._inited) {
      this.ready(() => {
        this._broadcast(msg);
      });
      return;
    }

    const buf = Buffer.from(msg);
    this._socket.send(
      buf,
      0,
      buf.length,
      this.multicastPort,
      this.multicastAddress,
      err => {
        if (err) {
          this.emit('error', err);
        }
      }
    );
  }

  /**
   * subscribe
   *
   * @param {Object} reg
   *   - {String} dataId - the dataId
   * @param {Function}  listener - the listener
   */
  subscribe(reg, listener) {
    const key = reg.dataId;
    const subData = this._subscribed.get(key);
    this.on(key, listener);

    if (!subData) {
      const urlObj = {
        protocol: 'consumer:',
        slashes: true,
        auth: null,
        host: `${localIp}:20880`,
        port: '20880',
        hash: null,
        query: {
          application: 'demo-consumer',
          category: 'consumers',
          check: false,
          dubbo: '2.0.0',
          generic: 'false',
          interface: key, // 'com.alibaba.dubbo.demo.DemoService',
          loadbalance: 'roundrobin',
          methods: 'sayHello',
          pid,
          side: 'consumer',
          timestamp: Date.now(),
        },
        pathname: `/${key}`,
      };
      this._broadcast(`register ${URLFormat(urlObj)}`);

      urlObj.query = {
        application: 'demo-consumer',
        category: 'providers,configurators,routers',
        dubbo: '2.0.0',
        generic: 'false',
        interface: key, // 'com.alibaba.dubbo.demo.DemoService',
        loadbalance: 'roundrobin',
        methods: 'sayHello',
        pid,
        side: 'consumer',
        timestamp: Date.now(),
      };
      this._broadcast(`subscribe ${URLFormat(urlObj)}`);

      this._subscribed.set(key, {
        urlObj,
        value: null,
      });
    } else if (subData.value) {
      process.nextTick(() => listener(Array.from(subData.value.values())));
    }
  }

  /**
   * publish
   *
   * @param {Object} reg
   *   - {String} dataId - the dataId
   *   - {String} publishData - the publish data
   */
  publish(reg) {
    // register dubbo://30.20.78.300:20880/com.alibaba.dubbo.demo.DemoService?anyhost=true&application=demo-provider&dubbo=2.0.0&generic=false&interface=com.alibaba.dubbo.demo.DemoService&loadbalance=roundrobin&methods=sayHello&owner=william&pid=81281&side=provider&timestamp=1481613276143
    this._broadcast(`register ${reg.publishData}`);
    const urlObject = new URL(reg.publishData);
    const key = urlObject.searchParams.get('interface');

    if (this._registered.has(key)) {
      this._registered.get(key).push(reg.publishData);
    } else {
      this._registered.set(key, [ reg.publishData ]);
    }

    urlObject.protocol = 'provider:';
    urlObject.search = null;
    urlObject.searchParams.set('category', 'configurators');
    urlObject.searchParams.set('check', 'fase');
    const providerUrl = urlObject.toString();
    console.log(providerUrl);
    this._broadcast(`subscribe ${providerUrl}`);
  }

  close() {
    return new Promise(resolve => {
      setTimeout(() => {
        this.closed = true;
        resolve();
      }, 100);
    });
  }
}

module.exports = RegistryClient;
