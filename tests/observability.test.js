const { api, registerUser } = require('./helpers');

describe('request ids', () => {
  it('generates one when missing', async () => {
    const res = await api().get('/health');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('keeps a safe incoming id and replaces an unsafe one', async () => {
    expect((await api().get('/health').set('X-Request-Id', 'abc-123')).headers['x-request-id']).toBe('abc-123');
    const unsafe = 'has spaces <and> tags';
    expect((await api().get('/health').set('X-Request-Id', unsafe)).headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('includes the request id in error responses', async () => {
    const res = await api().get('/api/v2/posts').set('X-Request-Id', 'trace-me');
    expect(res.status).toBe(401);
    expect(res.body.requestId).toBe('trace-me');
  });
});

describe('metrics', () => {
  afterEach(() => {
    delete process.env.METRICS_TOKEN;
  });

  it('records request latency by route template', async () => {
    const user = await registerUser();
    await api().get('/api/v2/posts/000000000000000000000000').set('Authorization', user.auth);

    const res = await api().get('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toContain('smapi_http_request_duration_seconds_count{method="GET",route="/api/v2/posts/:id",status="404"}');
    expect(res.text).toContain('smapi_socket_connections');
    expect(res.text).toContain('smapi_process_cpu_seconds_total');
  });

  it('can require a token', async () => {
    process.env.METRICS_TOKEN = 'secret';
    expect((await api().get('/metrics')).status).toBe(401);
    expect((await api().get('/metrics').set('Authorization', 'Bearer secret')).status).toBe(200);
  });
});
