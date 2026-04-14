/**
 * 持久测试（Soak Test）
 *
 * 用途：中等负载长时间运行，发现内存泄漏、连接池耗尽等问题
 * 默认运行约 10 分钟，可通过 SOAK_DURATION 环境变量自定义
 *
 * 用法：k6 run -e BASE_URL=https://your-host.com -e API_PATH=/api/xxx test/soak.js
 *       k6 run -e SOAK_DURATION=30m test/soak.js   # 跑 30 分钟
 */
import { sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { loadConfig } from '../lib/config.js';
import { executeRequest } from '../lib/request.js';

// ============ 读取配置 ============
const config = loadConfig(__ENV);
const soakDuration = __ENV.SOAK_DURATION || '10m';
const soakVUs = parseInt(__ENV.SOAK_VUS || '30', 10);

// ============ 自定义指标 ============
const latency = new Trend('api_duration');
const errorRate = new Rate('errors');

// ============ 测试配置 ============
export const options = {
  stages: [
    { duration: '30s', target: soakVUs },        // 爬升
    { duration: soakDuration, target: soakVUs },  // 持续负载
    { duration: '30s', target: 0 },               // 冷却
  ],
  thresholds: {
    'api_duration': [
      `p(95)<${config.thresholdP95}`,
      `p(99)<${config.thresholdP99}`,
    ],
    'errors': [`rate<${config.thresholdErrorRate}`],
  },
};

// ============ 测试主体 ============
export default function () {
  executeRequest(config, { latency, errorRate });
  sleep(0.5);
}
