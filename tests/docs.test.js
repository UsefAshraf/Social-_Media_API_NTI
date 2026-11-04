const { api } = require('./helpers');
const { app } = require('../src/app');

const routerLayers = (stack) => stack.filter((layer) => layer.name === 'router');
// Express stores mount paths as regexps like ^\/auth\/?(?=\/|$)
const mountPath = (layer) => layer.regexp.source.match(/^\^\\\/([\w-]+)/)[1];

// Collect "method /path" for every route mounted under /api/v2
const mountedRoutes = () => {
  const v2 = routerLayers(app._router.stack).find((layer) => mountPath(layer) === 'api');
  const routes = [];

  for (const layer of routerLayers(v2.handle.stack)) {
    const prefix = mountPath(layer);
    for (const { route } of layer.handle.stack.filter((l) => l.route)) {
      const path = `/${prefix}${route.path === '/' ? '' : route.path}`.replace(/:(\w+)/g, '{$1}');
      for (const method of Object.keys(route.methods)) routes.push(`${method} ${path}`);
    }
  }
  return routes;
};

describe('api docs', () => {
  it('serves Swagger UI and the raw spec', async () => {
    expect((await api().get('/api-docs/')).status).toBe(200);
    const spec = await api().get('/api-docs.json');
    expect(spec.body.openapi).toBe('3.0.3');
  });

  it('redirects / to the docs and describes /api/v2', async () => {
    const root = await api().get('/');
    expect(root.status).toBe(302);
    expect(root.headers.location).toBe('/api-docs');

    const index = await api().get('/api/v2');
    expect(index.body).toMatchObject({ success: true, version: 'v2', docs: '/api-docs' });
  });

  it('documents every mounted route', async () => {
    const { body: spec } = await api().get('/api-docs.json');
    const documented = Object.entries(spec.paths).flatMap(([p, ops]) => Object.keys(ops).map((m) => `${m} ${p}`));

    expect(mountedRoutes().sort()).toEqual(documented.sort());
  });
});
