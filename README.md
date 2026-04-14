# 📊 API Perf Test — 通用 API 性能回归测试工具

基于 [k6](https://k6.io/) 的**配置驱动**性能测试框架，支持团队任意 HTTP 接口的**冒烟测试、压力测试、持久测试与性能回归对比**。

> 🎯 核心理念：**零代码测试新接口** —— 只需在 JSON 配置文件中添加一个接口定义，即可复用全部测试能力。

---

## ✨ 特性

- 🔧 **配置驱动** — 一个 JSON 文件管理所有接口，新增接口无需写测试代码
- 📦 **多接口管理** — 一个配置文件集中定义多个接口，全局配置自动继承
- 🚀 **三种测试模式** — 冒烟（15s）、压力（1.5min）、持久（10min+）
- 📊 **性能对比报告** — 自动对比优化前后，输出可视化报告
- 🔐 **认证支持** — Bearer Token / Cookie / 自定义 Headers
- 📦 **多请求方法** — GET / POST / PUT / PATCH / DELETE
- ⚙️ **灵活的阈值** — p95、p99、错误率均可按接口独立配置
- 🏗️ **CI/CD 友好** — 阈值不达标自动失败，适合流水线集成

---

## 项目结构

```
api-perf-test/
├── config/                    # 接口配置目录
│   ├── example.json           # JSON 配置文件模板（推荐）
│   ├── example.env            # .env 配置文件模板（兼容）
│   └── examples/              # 示例配置
│       └── post-api.env
├── lib/                       # 通用模块（k6 脚本共享）
│   ├── config.js              # 配置解析（支持 JSON + 环境变量双模式）
│   └── request.js             # 请求执行 & 指标采集
├── test/                      # 测试脚本
│   ├── smoke.js               # 冒烟测试（~15s）
│   ├── stress.js              # 压力测试（~1.5min）
│   └── soak.js                # 持久测试（~10min）
├── scripts/
│   ├── run.sh                 # 便捷运行脚本
│   └── compare.js             # 性能对比报告
├── results/                   # 测试结果输出
├── package.json
└── README.md
```

---

## 前置条件

### 安装 k6

```bash
# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Windows
choco install k6

# Docker
docker pull grafana/k6
```

### 安装 Node.js（仅对比脚本和 list 命令需要）

对比脚本 `scripts/compare.js` 和 `list` 命令需要 Node.js 运行环境。k6 测试脚本本身**不需要** Node.js。

---

## 🚀 快速开始

### 方式一：JSON 配置文件（推荐）

**1. 创建你的 API 配置文件：**

```bash
cp config/example.json config/my-apis.json
```

**2. 编辑配置，定义全局设置和接口列表：**

```json
{
  "global": {
    "baseUrl": "https://api.example.com",
    "token": "your-jwt-token",
    "thresholds": { "p95": 500, "p99": 1000, "errorRate": 1 }
  },
  "apis": {
    "user-list": {
      "name": "用户列表",
      "path": "/api/v1/users",
      "method": "GET",
      "query": { "page": 1, "size": 20 },
      "checkField": "data.list"
    },
    "user-search": {
      "name": "用户搜索",
      "path": "/api/v1/users/search",
      "method": "POST",
      "body": { "keyword": "test" },
      "thresholds": { "p95": 300 }
    }
  }
}
```

**3. 查看可用接口：**

```bash
./scripts/run.sh list config/my-apis.json
```

输出：

```
📋 可用接口列表  (config/my-apis.json)

  ID                   方法    路径                          名称
  ─────────────────────────────────────────────────────────────────────────
  user-list            GET     /api/v1/users                 用户列表
  user-search          POST    /api/v1/users/search          用户搜索
```

**4. 运行测试：**

```bash
# 冒烟测试
./scripts/run.sh smoke config/my-apis.json user-list

# 压力测试
./scripts/run.sh stress config/my-apis.json user-search

# 压力测试 + 导出结果
./scripts/run.sh stress config/my-apis.json user-list --summary-export=results/before.json
```

### 方式二：直接用 k6 命令

```bash
# JSON 配置
k6 run -e CONFIG_FILE=config/my-apis.json -e API_ID=user-list test/smoke.js

# 环境变量直传
k6 run -e BASE_URL=https://api.example.com -e API_PATH=/api/v1/users test/smoke.js
```

### 方式三：.env 配置文件（兼容旧方式）

```bash
cp config/example.env config/my-api.env
# 编辑 config/my-api.env
./scripts/run.sh stress config/my-api.env
```

---

## 📊 性能回归对比

```bash
# 第 1 步：优化前，跑基准测试
./scripts/run.sh stress config/my-apis.json user-list --summary-export=results/before.json

# 第 2 步：部署优化代码...

# 第 3 步：优化后，跑对比测试
./scripts/run.sh stress config/my-apis.json user-list --summary-export=results/after.json

# 第 4 步：生成对比报告
API_NAME="用户列表" node scripts/compare.js

# 也可以指定任意两个结果文件对比
node scripts/compare.js results/v1.json results/v2.json
```

**报告输出示例：**

```
═══════════════════════════════════════════════════════
  📊 用户列表接口 性能对比报告
═══════════════════════════════════════════════════════

  基准文件: before.json
  对比文件: after.json
  生成时间: 2024/1/15 14:30:00

  指标          基准值          对比值          变化
  ───────────────────────────────────────────────────────
  平均延迟        771.6ms       320.5ms   ↓58.5% ✅
  p50 延迟        605.9ms       280.2ms   ↓53.8% ✅
  p90 延迟       1417.6ms       520.1ms   ↓63.3% ✅
  p95 延迟       1770.0ms       650.3ms   ↓63.3% ✅
  QPS              52.5/s       128.3/s   ↑144.4% ✅
  ───────────────────────────────────────────────────────

  🎉 结论: 性能有明显提升！
```

---

## ⚙️ JSON 配置文件说明

### 配置结构

```json
{
  "global": { ... },    // 全局配置（所有接口共享）
  "apis": {             // 接口定义（按 ID 索引）
    "api-id": { ... }
  }
}
```

### global 全局配置

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `baseUrl` | string | `http://localhost:8080` | 服务基础地址 |
| `headers` | object | `{"Content-Type":"application/json"}` | 全局请求头 |
| `token` | string | 空 | Bearer Token |
| `cookie` | string | 空 | Cookie |
| `expectedStatus` | number | `200` | 期望状态码 |
| `thresholds.p95` | number | `500` | p95 上限（ms） |
| `thresholds.p99` | number | `1000` | p99 上限（ms） |
| `thresholds.errorRate` | number | `1` | 错误率上限（%） |

### apis 接口定义

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 否 | 接口名称（报告展示用） |
| `path` | string | **是** | 接口路径 |
| `method` | string | 否 | 请求方法（默认 GET） |
| `query` | object | 否 | URL Query 参数 |
| `body` | object | 否 | 请求体（POST/PUT） |
| `headers` | object | 否 | 自定义请求头（与 global 合并） |
| `token` | string | 否 | 覆盖全局 Token |
| `cookie` | string | 否 | 覆盖全局 Cookie |
| `expectedStatus` | number | 否 | 覆盖全局期望状态码 |
| `checkField` | string | 否 | 响应非空校验字段路径 |
| `thresholds` | object | 否 | 覆盖全局阈值（部分覆盖） |

### 配置继承规则

接口配置会**继承并覆盖**全局配置：

```json
{
  "global": {
    "baseUrl": "https://api.example.com",
    "thresholds": { "p95": 500, "p99": 1000, "errorRate": 1 }
  },
  "apis": {
    "fast-api": {
      "path": "/api/fast",
      "thresholds": { "p95": 100 }
    }
  }
}
```

`fast-api` 的最终阈值为 `{ p95: 100, p99: 1000, errorRate: 1 }` — p95 被覆盖，p99 和 errorRate 继承自 global。

---

## ⚙️ 环境变量参数（.env 模式 / 命令行覆盖）

环境变量可以覆盖 JSON 配置文件中的值，优先级最高。

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `CONFIG_FILE` | 空 | JSON 配置文件路径 |
| `API_ID` | 空 | 接口 ID（JSON 模式必填） |
| `BASE_URL` | `http://localhost:8080` | 覆盖 baseUrl |
| `API_PATH` | `/` | 覆盖接口路径 |
| `METHOD` | `GET` | 覆盖请求方法 |
| `TOKEN` | 空 | 覆盖 Token |
| `THRESHOLD_P95` | `500` | 覆盖 p95 阈值 |
| `THRESHOLD_P99` | `1000` | 覆盖 p99 阈值 |
| `THRESHOLD_ERROR_RATE` | `1` | 覆盖错误率阈值 |
| `STAGES` | 默认四阶段 | 自定义压力测试并发阶段（JSON） |
| `SOAK_DURATION` | `10m` | 持久测试时长 |
| `SOAK_VUS` | `30` | 持久测试并发数 |

---

## 🧪 测试模式说明

### 冒烟测试（`smoke.js`）

固定 10 并发跑 15 秒，**快速验证接口可用性和基本性能**。适合：

- 部署后的快速健康检查
- CI/CD 流水线中的门禁测试

### 压力测试（`stress.js`）

渐进加压，模拟真实流量从低到高：

```
并发数
100 |                    ████████
 50 |          ██████████
 20 |  ████████                  ████
  0 |──────────────────────────────────→ 时间
     0s   15s      45s      75s   90s
      预热    稳态     压力     冷却
```

自定义并发阶段：

```bash
k6 run -e 'STAGES=[{"duration":"10s","target":200},{"duration":"30s","target":500}]' test/stress.js
```

### 持久测试（`soak.js`）

中等负载长时间运行，**发现内存泄漏、连接池耗尽等问题**。

```bash
# 默认 30 并发跑 10 分钟
./scripts/run.sh soak config/my-apis.json user-list

# 自定义: 50 并发跑 30 分钟
k6 run -e CONFIG_FILE=config/my-apis.json -e API_ID=user-list -e SOAK_VUS=50 -e SOAK_DURATION=30m test/soak.js
```

---

## 🔌 CI/CD 集成

### GitHub Actions 示例

```yaml
name: API Performance Gate
on: [push]

jobs:
  perf-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: grafana/setup-k6-action@v1
      - name: Smoke test - user list
        run: |
          k6 run \
            -e CONFIG_FILE=config/apis.json \
            -e API_ID=user-list \
            -e BASE_URL=${{ secrets.API_BASE_URL }} \
            -e TOKEN=${{ secrets.API_TOKEN }} \
            test/smoke.js
      - name: Smoke test - user search
        run: |
          k6 run \
            -e CONFIG_FILE=config/apis.json \
            -e API_ID=user-search \
            -e BASE_URL=${{ secrets.API_BASE_URL }} \
            -e TOKEN=${{ secrets.API_TOKEN }} \
            test/smoke.js
```

### 流水线中的性能回归检测

```yaml
- name: Performance regression check
  run: |
    k6 run -e CONFIG_FILE=config/apis.json -e API_ID=user-list \
      --summary-export=results/current.json test/stress.js
    node scripts/compare.js results/baseline.json results/current.json
```

---

## 📋 为团队新接口添加测试

**只需 2 步：**

1. **在 JSON 配置文件中添加接口定义**

   ```json
   {
     "apis": {
       "existing-api": { ... },
       "my-new-api": {
         "name": "我的新接口",
         "path": "/api/v2/something",
         "method": "POST",
         "body": { "key": "value" },
         "checkField": "data"
       }
     }
   }
   ```

2. **运行测试**

   ```bash
   ./scripts/run.sh stress config/my-apis.json my-new-api
   ```

**无需写任何 k6 代码！**

---

## npm scripts

| 命令 | 说明 |
|------|------|
| `npm run test:smoke` | 冒烟测试（需设置环境变量） |
| `npm run test:stress` | 压力测试（需设置环境变量） |
| `npm run test:soak` | 持久测试（需设置环境变量） |
| `npm run test:export` | 压力测试 + 导出结果 |
| `npm run compare` | 对比 before.json vs after.json |

---

## License

MIT
