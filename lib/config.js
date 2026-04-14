/**
 * 通用配置解析模块
 * 从 k6 环境变量 (__ENV) 中读取并解析测试配置
 */

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
 * 从环境变量加载完整测试配置
 */
export function loadConfig(env) {
  const config = {
    // 接口信息
    apiName: env.API_NAME || '未命名接口',
    baseUrl: (env.BASE_URL || 'http://localhost:8080').replace(/\/$/, ''),
    apiPath: env.API_PATH || '/',
    method: (env.METHOD || 'GET').toUpperCase(),

    // 请求参数
    queryParams: safeParseJSON(env.QUERY_PARAMS, {}),
    body: env.BODY || null,
    customHeaders: safeParseJSON(env.CUSTOM_HEADERS, {}),

    // 认证
    token: env.TOKEN || '',
    cookie: env.COOKIE || '',

    // 校验
    expectedStatus: parseInt(env.EXPECTED_STATUS || '200', 10),
    checkField: env.CHECK_FIELD || '',

    // 阈值
    thresholdP95: parseInt(env.THRESHOLD_P95 || '500', 10),
    thresholdP99: parseInt(env.THRESHOLD_P99 || '1000', 10),
    thresholdErrorRate: parseFloat(env.THRESHOLD_ERROR_RATE || '1') / 100,
  };

  return config;
}

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
