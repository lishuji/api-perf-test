/**
 * 压力测试（Stress Test）
 *
 * 用途：渐进加压，找出性能拐点，约 1.5 分钟完成
 *
 * 用法：
 *   # JSON 配置（推荐）
 *   k6 run -e CONFIG_FILE=config/my-apis.json -e API_ID=user-list test/stress.js
 *
 *   # 环境变量（兼容旧方式）
 *   k6 run -e BASE_URL=https://your-host.com -e API_PATH=/api/xxx test/stress.js
 *
 *   # 自定义并发阶段（JSON 数组，可选）
 *   k6 run -e STAGES='[{"duration":"10s","target":50},{"duration":"20s","target":100}]' test/stress.js
 */
import { sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { loadConfig, safeParseJSON } from '../lib/config.js';
import { executeRequest } from '../lib/request.js';

// ============ 加载配置文件 ============
const configContent = __ENV.CONFIG_FILE ? open(__ENV.CONFIG_FILE) : null;
const config = loadConfig(__ENV, configContent);

console.log(`📌 测试接口: ${config.apiName} [${config.method}] ${config.baseUrl}${config.apiPath}`);

// ============ 自定义指标 ============
const latency = new Trend('api_duration');
const errorRate = new Rate('errors');

// ============ 并发阶段 ============
const defaultStages = [
  { duration: '15s', target: 20 },   // 预热：0 → 20 并发
  { duration: '30s', target: 50 },   // 稳态：20 → 50 并发
  { duration: '30s', target: 100 },  // 压力：50 → 100 并发
  { duration: '15s', target: 0 },    // 冷却：100 → 0
];

const stages = safeParseJSON(__ENV.STAGES, defaultStages);

// ============ 测试配置 ============
export const options = {
  stages,
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
  sleep(0.1);
}
