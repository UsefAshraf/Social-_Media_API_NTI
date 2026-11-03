const { io: connect } = require('socket.io-client');
const { server } = require('../src/app');
const { api, registerUser, createPost } = require('./helpers');

let url;
const sockets = [];

const connectAs = (user) =>
  new Promise((resolve, reject) => {
    const socket = connect(url, { auth: { token: user.token }, transports: ['websocket'] });
    sockets.push(socket);
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });

const nextEvent = (socket, event) => new Promise((resolve) => socket.once(event, resolve));

beforeAll((done) => {
  server.listen(0, () => {
    url = `http://localhost:${server.address().port}`;
    done();
  });
});

afterEach(async () => {
  sockets.splice(0).forEach((s) => s.close());
  // let the server finish its disconnect handlers (presence writes)
  await new Promise((r) => setTimeout(r, 200));
});

afterAll((done) => {
  server.close(done);
});

describe('sockets', () => {
  it('rejects connections without a valid token', async () => {
    await expect(connectAs({ token: 'bad' })).rejects.toThrow(/Invalid token/);
  });

  it('delivers chat messages and stores them for history', async () => {
    const alice = await registerUser();
    const bob = await registerUser();
    const [a, b] = await Promise.all([connectAs(alice), connectAs(bob)]);

    const received = nextEvent(b, 'chat:message');
    a.emit('chat:message', { receiverId: bob.id, content: 'hey bob' });
    expect((await received).message.content).toBe('hey bob');

    const history = await api().get(`/api/v2/messages/${alice.id}`).set('Authorization', bob.auth);
    expect(history.body.data.map((m) => m.content)).toEqual(['hey bob']);

    const conversations = await api().get('/api/v2/messages/conversations').set('Authorization', bob.auth);
    expect(conversations.body.data[0]).toMatchObject({ unreadCount: 1, user: { username: alice.username } });

    await api().patch(`/api/v2/messages/${alice.id}/read`).set('Authorization', bob.auth);
    const after = await api().get('/api/v2/messages/conversations').set('Authorization', bob.auth);
    expect(after.body.data[0].unreadCount).toBe(0);
  });

  it('pushes notifications in real time', async () => {
    const alice = await registerUser();
    const bob = await registerUser();
    const a = await connectAs(alice);
    const post = await createPost(alice);

    const incoming = nextEvent(a, 'notification:new');
    await api().post(`/api/v2/posts/${post._id}/like`).set('Authorization', bob.auth);

    expect((await incoming).type).toBe('like');
  });

  it('tracks presence across multiple connections', async () => {
    const alice = await registerUser();
    const bob = await registerUser();
    const a = await connectAs(alice);
    const query = async () => (await a.emitWithAck('presence:query', { userIds: [bob.id] }))[0].status;

    const tab1 = await connectAs(bob);
    const tab2 = await connectAs(bob);
    expect(await query()).toBe('online');

    tab1.close();
    await new Promise((r) => setTimeout(r, 100));
    expect(await query()).toBe('online');

    const offline = nextEvent(a, 'presence:update');
    tab2.close();
    expect((await offline).status).toBe('offline');
    expect(await query()).toBe('offline');
  });
});
