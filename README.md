# 📊 API Perf Test — 通用 API 性能回归测试工具

基于 [k6](https://k6.io/) 的**配置驱动**性能测试框架，支持团队任意 HTTP 接口的**冒烟测试、压力测试、持久测试与性能回归对比**。

> 🎯 核心理念：**零代码测试新接口** —— 只需写一个 `.env` 配置文件，即可复用全部测试能力。

---

## ✨ 特性

- 🔧 **配置驱动** — 新增接口只需添加 `.env` 配置，无需写测试代码
- 🚀 **三种测试模式** — 冒烟（15s）、压力（1.5min）、持久（10min+）
- 📊 **性能对比报告** — 自动对比优化前后，输出可视化报告
- 🔐 **认证支持** — Bearer Token / Cookie / 自定义 Headers
- 📦 **多请求方法** — GET / POST / PUT / PATCH / DELETE
- ⚙️ **灵活的阈值** — p95、p99、错误率均可自定义
- 🏗️ **CI/CD 友好** — 阈值不达标自动失败，适合流水线集成

---

## 项目结构

```
api-perf-test/
├── config/                    # 接口配置目录
│   ├── example.env            # 配置文件模板
│   └── examples/              # 示例配置
│       ├── cloud-studio-hot-ranking.env
│       └── post-api.env
├── lib/                       # 通用模块（k6 脚本共享）
│   ├── config.js              # 配置解析
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

### 安装 Node.js（仅对比脚本需要）

对比脚本 `scripts/compare.js` 需要 Node.js 运行环境。k6 测试脚本本身**不需要** Node.js。

---

## 🚀 快速开始

### 方式一：直接用命令行参数

```bash
# 冒烟测试（~15s）
k6 run -e BASE_URL=https://api.example.com -e API_PATH=/api/v1/users test/smoke.js

# 压力测试（~1.5min）
k6 run -e BASE_URL=https://api.example.com -e API_PATH=/api/v1/users test/stress.js

# POST 接口
k6 run \
  -e BASE_URL=https://api.example.com \
  -e API_PATH=/api/v1/search \
  -e METHOD=POST \
  -e 'BODY={"keyword":"test"}' \
  test/stress.js
```

### 方式二：使用配置文件（推荐）

**1. 复制模板并填写配置：**

```bash
cp config/example.env config/my-api.env
# 编辑 config/my-api.env，填入你的接口信息
```

**2. 使用运行脚本：**

```bash
# 给脚本加执行权限（首次）
chmod +x scripts/run.sh

# 冒烟测试
./scripts/run.sh smoke config/my-api.env

# 压力测试
./scripts/run.sh stress config/my-api.env

# 压力测试 + 导出结果
./scripts/run.sh stress config/my-api.env --summary-export=results/before.json
```

### 方式三：环境变量导出

```bash
export BASE_URL=https://api.example.com
export API_PATH=/api/v1/users
export API_NAME="用户列表接口"
export TOKEN=your-jwt-token

k6 run test/smoke.js
```

---

## 📊 性能回归对比

```bash
# 第 1 步：优化前，跑基准测试
./scripts/run.sh stress config/my-api.env --summary-export=results/before.json

# 第 2 步：部署优化代码...

# 第 3 步：优化后，跑对比测试
./scripts/run.sh stress config/my-api.env --summary-export=results/after.json

# 第 4 步：生成对比报告
API_NAME="我的接口" node scripts/compare.js

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

## ⚙️ 配置参数说明

### 接口配置

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `API_NAME` | `未命名接口` | 接口名称，用于报告展示 |
| `BASE_URL` | `http://localhost:8080` | 目标服务基础地址 |
| `API_PATH` | `/` | 接口路径 |
| `METHOD` | `GET` | 请求方法：GET/POST/PUT/PATCH/DELETE |

### 请求参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `QUERY_PARAMS` | `{}` | URL Query 参数（JSON 格式） |
| `BODY` | 空 | 请求体（JSON 字符串，POST/PUT 有效） |
| `CUSTOM_HEADERS` | `{}` | 自定义请求头（JSON 格式） |

### 认证

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `TOKEN` | 空 | Bearer Token |
| `COOKIE` | 空 | Cookie 字符串 |

### 校验 & 阈值

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `EXPECTED_STATUS` | `200` | 期望 HTTP 状态码 |
| `CHECK_FIELD` | 空 | 响应 JSON 非空校验字段路径 |
| `THRESHOLD_P95` | `500` | p95 响应时间上限（ms） |
| `THRESHOLD_P99` | `1000` | p99 响应时间上限（ms） |
| `THRESHOLD_ERROR_RATE` | `1` | 最大错误率（%） |

### 测试模式特有参数

| 参数 | 适用测试 | 说明 |
|------|----------|------|
| `STAGES` | stress | 自定义并发阶段（JSON 数组） |
| `SOAK_DURATION` | soak | 持续负载时长，默认 `10m` |
| `SOAK_VUS` | soak | 持续并发数，默认 `30` |

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
k6 run -e BASE_URL=https://api.example.com test/soak.js

# 自定义: 50 并发跑 30 分钟
k6 run -e SOAK_VUS=50 -e SOAK_DURATION=30m test/soak.js
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
      - name: Run smoke test
        run: |
          k6 run \
            -e BASE_URL=${{ secrets.API_BASE_URL }} \
            -e API_PATH=/api/v1/health \
            -e TOKEN=${{ secrets.API_TOKEN }} \
            test/smoke.js
```

### 流水线中的性能回归检测

```yaml
- name: Performance regression check
  run: |
    k6 run -e BASE_URL=$API_URL --summary-export=results/current.json test/stress.js
    node scripts/compare.js results/baseline.json results/current.json
```

---

## 📋 为团队新接口添加测试

**只需 3 步：**

1. **复制配置模板**
   ```bash
   cp config/example.env config/my-new-api.env
   ```

2. **编辑配置文件**，填入接口地址、参数、认证信息

3. **运行测试**
   ```bash
   ./scripts/run.sh stress config/my-new-api.env
   ```

**无需写任何 k6 代码！**

---

## npm scripts

| 命令 | 说明 |
|------|------|
| `npm run test:smoke` | 冒烟测试 |
| `npm run test:stress` | 压力测试 |
| `npm run test:soak` | 持久测试 |
| `npm run test:export` | 压力测试 + 导出结果 |
| `npm run compare` | 对比 before.json vs after.json |

---

## License

MIT
