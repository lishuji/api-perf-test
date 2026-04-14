/**
 * 通用请求执行模块
 * 根据配置发起对应方法的 HTTP 请求，并记录自定义指标
 */
import http from 'k6/http';
import { check } from 'k6';
import { buildUrl, buildHeaders } from './config.js';

/**
 * 执行 HTTP 请求
 * @param {object} config - 从 loadConfig 返回的配置对象
 * @param {object} metrics - { latency: Trend, errorRate: Rate }
 * @param {object} [overrides] - 可选覆盖: { queryParams, body, headers }
 */
export function executeRequest(config, metrics, overrides = {}) {
  // 合并覆盖参数
  const finalConfig = {
    ...config,
    queryParams: { ...config.queryParams, ...overrides.queryParams },
  };

  const url = overrides.url || buildUrl(finalConfig);
  const headers = { ...buildHeaders(config), ...overrides.headers };
  const params = { headers };

  let res;

  switch (config.method) {
    case 'POST':
      res = http.post(url, overrides.body || config.body, params);
      break;
    case 'PUT':
      res = http.put(url, overrides.body || config.body, params);
      break;
    case 'PATCH':
      res = http.patch(url, overrides.body || config.body, params);
      break;
    case 'DELETE':
      res = http.del(url, overrides.body || config.body, params);
      break;
    default:
      res = http.get(url, params);
  }

  // 记录指标
  metrics.latency.add(res.timings.duration);
  metrics.errorRate.add(res.status !== config.expectedStatus);

  // 通用校验
  const checks = {};
  checks[`状态码 ${config.expectedStatus}`] = (r) => r.status === config.expectedStatus;
  checks['响应 < 1s'] = (r) => r.timings.duration < 1000;

  if (config.checkField) {
    checks[`字段 "${config.checkField}" 非空`] = (r) => {
      try {
        return r.json(config.checkField) !== null;
      } catch (e) {
        return false;
      }
    };
  }

  check(res, checks);

  return res;
}
