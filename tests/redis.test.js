// Point the app at Redis before any app module loads (jest isolates modules per file)
const url = process.env.TEST_REDIS_URL;
if (url) process.env.REDIS_URL = url;

const http = require('http');
const { io: connect } = require('socket.io-client');
const initializeSocketIO = require('../src/sockets');
const { getRedis, closeRedis } = require('../src/shared/config/redis');
const { cached } = require('../src/shared/utils/cache');
const { api, registerUser } = require('./helpers');

const describeWithRedis = url ? describe : describe.skip;

describeWithRedis('with Redis (two API instances)', () => {
  const instances = [];
  const sockets = [];

  // a second, independent Socket.IO server sharing the same Redis
  const startInstance = () =>
    new Promise((resolve) => {
      const server = http.createServer();
      const io = initializeSocketIO(server);
      server.listen(0, () => {
        instances.push(io);
        resolve(`http://localhost:${server.address().port}`);
      });
    });

  const connectTo = (instanceUrl, user) =>
    new Promise((resolve, reject) => {
      const socket = connect(instanceUrl, { auth: { token: user.token }, transports: ['websocket'] });
      sockets.push(socket);
      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', reject);
    });

  let urls;

  beforeAll(async () => {
    await getRedis().flushdb();
    urls = await Promise.all([startInstance(), startInstance()]);
  });

  afterEach(async () => {
    sockets.splice(0).forEach((s) => s.close());
    await new Promise((r) => setTimeout(r, 200));
  });

  afterAll(async () => {
    instances.forEach((io) => io.close());
    await closeRedis();
  });

  it('reports Redis as up in /health', async () => {
    const res = await api().get('/health');
    expect(res.body.checks.redis).toBe('up');
  });

  it('delivers chat messages between users on different instances', async () => {
    const [alice, bob] = await Promise.all([registerUser(), registerUser()]);
    const a = await connectTo(urls[0], alice);
    const b = await connectTo(urls[1], bob);

    const received = new Promise((resolve) => b.once('chat:message', resolve));
    a.emit('chat:message', { receiverId: bob.id, content: 'across instances' });

    expect((await received).message.content).toBe('across instances');
  });

  it('sees presence of users connected to another instance', async () => {
    const [alice, bob] = await Promise.all([registerUser(), registerUser()]);
    const a = await connectTo(urls[0], alice);
    const b = await connectTo(urls[1], bob);

    const [status] = await a.emitWithAck('presence:query', { userIds: [bob.id] });
    expect(status.status).toBe('online');

    const offline = new Promise((resolve) => a.once('presence:update', resolve));
    b.close();
    expect(await offline).toMatchObject({ userId: bob.id, status: 'offline' });
  });

  it('caches computed values with a TTL', async () => {
    let calls = 0;
    const compute = async () => ({ calls: ++calls });

    expect(await cached('test:value', 30, compute)).toEqual({ calls: 1 });
    expect(await cached('test:value', 30, compute)).toEqual({ calls: 1 });
    expect(calls).toBe(1);
    expect(await getRedis().ttl('test:value')).toBeGreaterThan(0);
  });
});
