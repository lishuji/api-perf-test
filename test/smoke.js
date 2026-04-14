/**
 * 冒烟测试（Smoke Test）
 *
 * 用途：快速验证接口可用性，约 15 秒完成
 *
 * 用法：
 *   # JSON 配置（推荐）
 *   k6 run -e CONFIG_FILE=config/my-apis.json -e API_ID=user-list test/smoke.js
 *
 *   # 环境变量（兼容旧方式）
 *   k6 run -e BASE_URL=https://your-host.com -e API_PATH=/api/xxx test/smoke.js
 */
import { sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { loadConfig } from '../lib/config.js';
import { executeRequest } from '../lib/request.js';

// ============ 加载配置文件 ============
const configContent = __ENV.CONFIG_FILE ? open(__ENV.CONFIG_FILE) : null;
const config = loadConfig(__ENV, configContent);

console.log(`📌 测试接口: ${config.apiName} [${config.method}] ${config.baseUrl}${config.apiPath}`);

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
