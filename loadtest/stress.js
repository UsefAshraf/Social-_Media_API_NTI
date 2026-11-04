// k6 stress test: ramps feed requests per second to find where latency degrades.
// npm run loadtest:stress
import http from 'k6/http';
import { check } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:5000';
const API = `${BASE}/api/v2`;

export const options = {
  scenarios: {
    ramp: {
      executor: 'ramping-arrival-rate',
      startRate: 50,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 400,
      stages: [
        { duration: '20s', target: 200 },
        { duration: '20s', target: 400 },
        { duration: '20s', target: 600 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

export function setup() {
  const run = Date.now().toString(36);
  const res = http.post(
    `${API}/auth/register`,
    JSON.stringify({ username: `stress_${run}`, email: `stress_${run}@example.com`, password: 'secret123' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  const token = res.json('data.accessToken');
  for (let i = 0; i < 30; i++) {
    http.post(`${API}/posts`, JSON.stringify({ content: `Stress seed ${i}` }), {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
  }
  return { token };
}

export default function ({ token }) {
  const res = http.get(`${API}/posts/feed?limit=20`, { headers: { Authorization: `Bearer ${token}` } });
  check(res, { 'feed 200': (r) => r.status === 200 });
}
