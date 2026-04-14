/**
 * 冒烟测试（Smoke Test）
 *
 * 用途：快速验证接口可用性，约 15 秒完成
 * 用法：k6 run -e BASE_URL=https://your-host.com -e API_PATH=/api/xxx test/smoke.js
 */
import { sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { loadConfig } from '../lib/config.js';
import { executeRequest } from '../lib/request.js';

// ============ 读取配置 ============
const config = loadConfig(__ENV);

// ============ 自定义指标 ============
const latency = new Trend('api_duration');
const errorRate = new Rate('errors');

// ============ 测试配置 ============
export const options = {
  vus: 10,
  duration: '15s',
  thresholds: {
    'api_duration': [`p(95)<${config.thresholdP95}`],
    'errors': [`rate<${config.thresholdErrorRate}`],
  },
};

// ============ 测试主体 ============
export default function () {
  executeRequest(config, { latency, errorRate });
  sleep(0.1);
}
