// k6 load test: users scrolling the feed, liking, posting and checking trends.
// npm run loadtest   (BASE_URL defaults to http://localhost:5000)
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:5000';
const API = `${BASE}/api/v2`;
const USERS = 5;
const POSTS_PER_USER = 10;

export const options = {
  scenarios: {
    browse: {
      executor: 'ramping-vus',
      stages: [
        { duration: '15s', target: 20 },
        { duration: '30s', target: 50 },
        { duration: '15s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:feed}': ['p(95)<300'],
    'http_req_duration{name:like}': ['p(95)<300'],
    'http_req_duration{name:create}': ['p(95)<500'],
  },
};

const json = (body, token) => ({
  headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
});

// a few users who follow each other and already have posts
export function setup() {
  const run = Date.now().toString(36);
  const users = [];
  for (let i = 0; i < USERS; i++) {
    const res = http.post(
      `${API}/auth/register`,
      JSON.stringify({ username: `load_${run}_${i}`, email: `load_${run}_${i}@example.com`, password: 'secret123' }),
      json()
    );
    check(res, { registered: (r) => r.status === 201 });
    users.push({ id: res.json('data.user.id'), token: res.json('data.accessToken') });
  }
  for (const user of users) {
    for (const other of users) {
      if (other.id !== user.id) http.post(`${API}/users/${other.id}/follow`, null, json(null, user.token));
    }
    for (let p = 0; p < POSTS_PER_USER; p++) {
      http.post(`${API}/posts`, JSON.stringify({ content: `Seed post ${p} #loadtest #k6` }), json(null, user.token));
    }
  }
  return { users };
}

export default function ({ users }) {
  const user = users[__VU % users.length];
  const auth = json(null, user.token);

  const feed = http.get(`${API}/posts/feed?limit=20`, { ...auth, tags: { name: 'feed' } });
  check(feed, { 'feed 200': (r) => r.status === 200 });

  const posts = feed.json('data') || [];
  if (posts.length && Math.random() < 0.3) {
    const post = posts[Math.floor(Math.random() * posts.length)];
    const like = http.post(`${API}/posts/${post._id}/like`, null, { ...auth, tags: { name: 'like' } });
    check(like, { 'like 200': (r) => r.status === 200 });
  }

  if (Math.random() < 0.1) {
    const created = http.post(`${API}/posts`, JSON.stringify({ content: `Load ${__VU}-${__ITER} #loadtest` }), {
      ...auth,
      tags: { name: 'create' },
    });
    check(created, { 'create 201': (r) => r.status === 201 });
  }

  if (Math.random() < 0.2) {
    const trending = http.get(`${API}/hashtags/trending`, { ...auth, tags: { name: 'trending' } });
    check(trending, { 'trending 200': (r) => r.status === 200 });
  }

  sleep(1);
}
