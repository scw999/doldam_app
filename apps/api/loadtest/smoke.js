import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<800'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE = __ENV.API_BASE || 'https://doldam-api.scw999.workers.dev';

export default function () {
  const endpoints = ['/votes', '/posts?category=all', '/posts?category=all&sort=hot'];
  for (const p of endpoints) {
    const res = http.get(BASE + p);
    check(res, { [`${p} status 200`]: (r) => r.status === 200 });
  }
  sleep(1);
}
