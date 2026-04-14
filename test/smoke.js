import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// ============ 自定义指标 ============
const hotLatency = new Trend('hot_search_duration');
const errorRate = new Rate('errors');

// ============ 环境变量 ============
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const TIMESTAMP = __ENV.TIMESTAMP || Math.floor(Date.now() / 1000);
const TOKEN = __ENV.TOKEN || '';

// ============ 轻量配置：快速验证 ============
export const options = {
  vus: 10,
  duration: '15s',
  thresholds: {
    'hot_search_duration': ['p(95)<500'],
    'errors': ['rate<0.01'],
  },
};

// ============ 请求头 ============
function getHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (TOKEN) {
    headers['Authorization'] = `Bearer ${TOKEN}`;
  }
  return headers;
}

// ============ 测试主体 ============
export default function () {
  const page = Math.floor(Math.random() * 5);
  const url = `${BASE_URL}/api/liteapps/rankings/hot?timestamp=${TIMESTAMP}&page=${page}&size=30`;

  const res = http.get(url, { headers: getHeaders() });

  hotLatency.add(res.timings.duration);
  errorRate.add(res.status !== 200);

  check(res, {
    '状态码 200': (r) => r.status === 200,
    '有返回数据': (r) => {
      try { return r.json('data') !== null; } catch (e) { return false; }
    },
    '响应 < 1s': (r) => r.timings.duration < 1000,
  });

  sleep(0.1);
}
