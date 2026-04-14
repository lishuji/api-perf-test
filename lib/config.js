/**
 * 通用配置解析模块
 *
 * 支持两种配置方式：
 * 1. JSON 配置文件（推荐）—— 通过 CONFIG_FILE + API_ID 环境变量指定
 * 2. 环境变量直传 —— 兼容旧方式，逐一传入 -e 参数
 */
import { open } from 'k6/file';

// ─────────────────── 工具函数 ───────────────────

/**
 * 安全解析 JSON 字符串，失败返回默认值
 */
export function safeParseJSON(str, defaultValue = {}) {
  if (!str) return defaultValue;
  try {
    return JSON.parse(str);
  } catch (e) {
    console.warn(`⚠️ JSON 解析失败: ${str}`);
    return defaultValue;
  }
}

/**
 * 将对象转为 URL query 字符串
 */
export function toQueryString(params) {
  if (!params || typeof params !== 'object') return '';
  const parts = [];
  for (const key in params) {
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`);
    }
  }
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

/**
 * 深合并两个对象（source 覆盖 target）
 */
function deepMerge(target, source) {
  const result = { ...target };
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      if (
        source[key] &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key]) &&
        target[key] &&
        typeof target[key] === 'object' &&
        !Array.isArray(target[key])
      ) {
        result[key] = deepMerge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
  }
  return result;
}

// ─────────────────── JSON 配置文件加载 ───────────────────

/**
 * 从 JSON 配置文件加载指定接口的配置
 * @param {string} configContent - JSON 配置文件内容
 * @param {string} apiId - 接口 ID（apis 中的 key）
 * @param {object} env - 环境变量（可覆盖配置文件中的值）
 * @returns {object} 标准化的配置对象
 */
function loadFromJSON(configContent, apiId, env) {
  const raw = JSON.parse(configContent);
  const globalCfg = raw.global || {};
  const apis = raw.apis || {};

  // 列出可用接口
  const availableApis = Object.keys(apis);

  if (!apiId) {
    console.error('❌ 使用 JSON 配置文件时必须指定 API_ID');
    console.error(`   可用接口: ${availableApis.join(', ')}`);
    throw new Error('API_ID is required');
  }

  const apiCfg = apis[apiId];
  if (!apiCfg) {
    console.error(`❌ 未找到接口 "${apiId}"`);
    console.error(`   可用接口: ${availableApis.join(', ')}`);
    throw new Error(`API "${apiId}" not found`);
  }

  // 合并 global + api 配置
  const mergedThresholds = deepMerge(
    globalCfg.thresholds || {},
    apiCfg.thresholds || {},
  );

  const mergedHeaders = deepMerge(
    globalCfg.headers || {},
    apiCfg.headers || {},
  );

  return {
    apiName: apiCfg.name || apiId,
    baseUrl: (env.BASE_URL || apiCfg.baseUrl || globalCfg.baseUrl || 'http://localhost:8080').replace(/\/$/, ''),
    apiPath: env.API_PATH || apiCfg.path || '/',
    method: (env.METHOD || apiCfg.method || 'GET').toUpperCase(),

    queryParams: apiCfg.query || {},
    body: apiCfg.body ? JSON.stringify(apiCfg.body) : null,
    customHeaders: mergedHeaders,

    token: env.TOKEN || apiCfg.token || globalCfg.token || '',
    cookie: env.COOKIE || apiCfg.cookie || globalCfg.cookie || '',

    expectedStatus: parseInt(env.EXPECTED_STATUS || apiCfg.expectedStatus || globalCfg.expectedStatus || '200', 10),
    checkField: apiCfg.checkField || '',

    thresholdP95: parseInt(env.THRESHOLD_P95 || mergedThresholds.p95 || '500', 10),
    thresholdP99: parseInt(env.THRESHOLD_P99 || mergedThresholds.p99 || '1000', 10),
    thresholdErrorRate: parseFloat(env.THRESHOLD_ERROR_RATE || mergedThresholds.errorRate || '1') / 100,
  };
}

// ─────────────────── 环境变量加载（兼容模式） ───────────────────

/**
 * 从环境变量加载配置（兼容旧方式）
 */
function loadFromEnv(env) {
  return {
    apiName: env.API_NAME || '未命名接口',
    baseUrl: (env.BASE_URL || 'http://localhost:8080').replace(/\/$/, ''),
    apiPath: env.API_PATH || '/',
    method: (env.METHOD || 'GET').toUpperCase(),

    queryParams: safeParseJSON(env.QUERY_PARAMS, {}),
    body: env.BODY || null,
    customHeaders: safeParseJSON(env.CUSTOM_HEADERS, {}),

    token: env.TOKEN || '',
    cookie: env.COOKIE || '',

    expectedStatus: parseInt(env.EXPECTED_STATUS || '200', 10),
    checkField: env.CHECK_FIELD || '',

    thresholdP95: parseInt(env.THRESHOLD_P95 || '500', 10),
    thresholdP99: parseInt(env.THRESHOLD_P99 || '1000', 10),
    thresholdErrorRate: parseFloat(env.THRESHOLD_ERROR_RATE || '1') / 100,
  };
}

// ─────────────────── 统一入口 ───────────────────

/**
 * 加载测试配置（自动识别配置方式）
 *
 * 优先级：
 *   1. CONFIG_FILE + API_ID → 从 JSON 配置文件加载
 *   2. 环境变量直传 → 兼容旧方式
 *
 * @param {object} env - k6 __ENV 对象
 * @param {string} [configContent] - 预加载的配置文件内容（通过 k6/file open 读取）
 */
export function loadConfig(env, configContent) {
  if (configContent) {
    return loadFromJSON(configContent, env.API_ID, env);
  }
  return loadFromEnv(env);
}

/**
 * 列出 JSON 配置文件中的所有可用接口
 * @param {string} configContent - 配置文件内容
 * @returns {string[]} 接口 ID 列表
 */
export function listApis(configContent) {
  const raw = JSON.parse(configContent);
  const apis = raw.apis || {};
  return Object.keys(apis).map((id) => {
    const api = apis[id];
    return `  ${id.padEnd(20)} ${(api.method || 'GET').padEnd(6)} ${api.path || '/'}  (${api.name || id})`;
  });
}

// ─────────────────── URL / Headers 构建 ───────────────────

/**
 * 构建完整请求 URL
 */
export function buildUrl(config) {
  const queryString = toQueryString(config.queryParams);
  return `${config.baseUrl}${config.apiPath}${queryString}`;
}

/**
 * 构建请求头
 */
export function buildHeaders(config) {
  const headers = {
    'Content-Type': 'application/json',
    ...config.customHeaders,
  };
  if (config.token) {
    headers['Authorization'] = `Bearer ${config.token}`;
  }
  if (config.cookie) {
    headers['Cookie'] = config.cookie;
  }
  return headers;
}
