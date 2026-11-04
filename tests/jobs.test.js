// Point the app at Redis before any app module loads (jest isolates modules per file)
const url = process.env.TEST_REDIS_URL;
if (url) process.env.REDIS_URL = url;

const Post = require('../src/shared/models/Post');
const emailService = require('../src/api/v2/services/email.service');
const { startWorkers, stopWorkers } = require('../src/workers');
const { getQueue, closeQueues } = require('../src/shared/queue/queues');
const { getRedis, closeRedis } = require('../src/shared/config/redis');
// loading the app queues DB work that would keep a skipped run alive, so only load it when needed
const { api, registerUser } = url ? require('./helpers') : {};

const describeWithRedis = url ? describe : describe.skip;

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

const eventually = async (check, timeout = 10000) => {
  const start = Date.now();
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() - start > timeout) throw new Error('timed out waiting for job');
    await new Promise((r) => setTimeout(r, 100));
  }
};

describeWithRedis('background jobs (BullMQ + Redis)', () => {
  let workers;

  beforeAll(async () => {
    await getRedis().flushdb();
    workers = await startWorkers();
  });

  afterAll(async () => {
    await stopWorkers(workers);
    await closeQueues();
    await closeRedis();
  });

  afterEach(() => jest.restoreAllMocks());

  it('queues emails and delivers them from the worker', async () => {
    const delivered = jest.spyOn(emailService, 'deliverEmail').mockResolvedValue({ messageId: 'test' });

    const job = await emailService.sendWelcomeEmail('alice', 'alice@example.com');
    expect(job.name).toBe('send');

    await eventually(() => delivered.mock.calls.length);
    expect(delivered).toHaveBeenCalledWith(expect.objectContaining({ to: 'alice@example.com' }));
  });

  it('retries failed emails', async () => {
    const delivered = jest
      .spyOn(emailService, 'deliverEmail')
      .mockRejectedValueOnce(new Error('SMTP down'))
      .mockResolvedValue({ messageId: 'ok' });

    const job = await getQueue('email').add('send', { to: 'b@example.com', subject: 's', html: 'h' }, { attempts: 2 });
    await eventually(async () => (await job.isCompleted()) && job);
    expect(delivered).toHaveBeenCalledTimes(2);
  });

  it('processes uploaded images in the images queue', async () => {
    const alice = await registerUser();
    const res = await api()
      .post('/api/v2/posts')
      .set('Authorization', alice.auth)
      .field('content', 'queued image')
      .attach('image', PNG, { filename: 'p.png', contentType: 'image/png' });

    // the response comes back before processing, with the original upload
    expect(res.body.data.image).toMatch(/\.png$/);

    const post = await eventually(async () => {
      const p = await Post.findById(res.body.data._id);
      return p.image.endsWith('.webp') && p;
    });
    expect(post.thumbnail).toMatch(/-thumb\.webp$/);
  });

  it('schedules the nightly notification cleanup', async () => {
    const repeatables = await getQueue('maintenance').getRepeatableJobs();
    expect(repeatables).toEqual([expect.objectContaining({ name: 'cleanup-notifications', pattern: '0 3 * * *' })]);
  });
});
