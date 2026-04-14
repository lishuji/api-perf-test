# 🔥 Cloud Studio API 性能测试

针对 Cloud Studio `/liteapps/rankings/hot` 接口的 [k6](https://k6.io/) 性能测试项目。

## 前置条件

### 安装 k6

**macOS**（推荐）：

```bash
brew install k6
```

**Linux（Debian/Ubuntu）**：

```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

**Windows**：

```bash
choco install k6
# 或
winget install k6 --source winget
```

**Docker**：

```bash
docker pull grafana/k6
docker run --rm -i grafana/k6 run - <test/stress.js
```

验证安装：

```bash
k6 version
```

### 安装 Node.js（仅对比脚本需要）

对比脚本 `scripts/compare.js` 需要 Node.js 运行环境。k6 测试脚本本身**不需要** Node.js。

## 项目结构

```
api-perf-test/
├── test/
│   ├── stress.js       # 压力测试（渐进加压，约 1.5 分钟）
│   └── smoke.js        # 冒烟测试（快速验证，约 15 秒）
├── scripts/
│   └── compare.js      # 优化前后结果对比脚本
├── results/            # 测试结果输出目录
│   └── .gitkeep
├── package.json
├── .gitignore
└── README.md
```

## 快速开始

### 1. 冒烟测试（约 15 秒，快速验证接口可用性）

```bash
# 默认打本地
k6 run test/smoke.js

# 指定目标地址
k6 run -e BASE_URL=https://your-host.com test/smoke.js
```

### 2. 压力测试（约 1.5 分钟，渐进加压找性能拐点）

```bash
k6 run -e BASE_URL=https://your-host.com test/stress.js
```

### 3. 带登录态测试

```bash
k6 run -e BASE_URL=https://your-host.com -e TOKEN=your-jwt-token test/stress.js
```

### 4. 导出结果到文件

```bash
k6 run -e BASE_URL=https://your-host.com --summary-export=results/result.json test/stress.js
```

### 5. 优化前后对比

```bash
# 第 1 步：优化前，导出基准结果
k6 run -e BASE_URL=https://your-host.com --summary-export=results/before.json test/stress.js

# 第 2 步：部署优化代码...

# 第 3 步：优化后，导出结果
k6 run -e BASE_URL=https://your-host.com --summary-export=results/after.json test/stress.js

# 第 4 步：自动生成对比报告
node scripts/compare.js
```

对比报告输出示例：

```
========================================
  🔥 热门排行榜接口性能对比报告
========================================

指标           优化前        优化后        变化
─────────────────────────────────────────────────
平均延迟         771.6ms      xxx.xms   ↓xx.x% ✅
p50 延迟         605.9ms      xxx.xms   ↓xx.x% ✅
p90 延迟        1417.6ms      xxx.xms   ↓xx.x% ✅
p95 延迟        1770.0ms      xxx.xms   ↓xx.x% ✅
QPS               52.5/s       xxx.x/s   ↑xx.x% ✅
─────────────────────────────────────────────────
```

## 压力模型

### 压力测试 (`stress.js`)

渐进加压，模拟真实流量从低到高的过程：

```
并发数
100 |                    ████████
 50 |          ██████████
 20 |  ████████                  ████
  0 |──────────────────────────────────→ 时间
     0s   15s      45s      75s   90s
      预热    稳态     压力     冷却
```

| 阶段 | 时长 | 并发数 | 目的 |
|------|------|--------|------|
| 预热 | 15s | 0 → 20 | 让服务暖起来，避免冷启动影响 |
| 稳态 | 30s | 20 → 50 | 观察正常负载下的表现 |
| 压力 | 30s | 50 → 100 | 观察高并发下是否劣化 |
| 冷却 | 15s | 100 → 0 | 观察服务恢复能力 |

### 冒烟测试 (`smoke.js`)

固定 10 并发跑 15 秒，快速验证接口是否正常。

## 通过条件（Thresholds）

| 指标 | 阈值 | 说明 |
|------|------|------|
| p95 响应时间 | < 500ms | 95% 的请求须在 500ms 内完成 |
| p99 响应时间 | < 1000ms | 99% 的请求须在 1 秒内完成 |
| 错误率 | < 1% | HTTP 错误（非 200）比例低于 1% |

不满足阈值时 k6 会输出 `✗` 标记，并以非零退出码退出（适合 CI/CD 集成）。

## 结果解读

运行后终端输出的关键指标：

```
hot_search_duration...: avg=731ms  min=173ms  med=627ms  max=7342ms  p(90)=1262ms  p(95)=1552ms
http_reqs.............: 5006   55.4/s
errors................: 0.00%
```

| 指标 | 含义 | 关注点 |
|------|------|--------|
| `avg` | 平均响应时间 | 整体水平 |
| `med` (p50) | 中位数响应时间 | 典型用户体验 |
| `p(90)` | 90% 请求的响应时间 | 大多数用户体验 |
| `p(95)` | 95% 请求的响应时间 | **优化前后对比的核心指标** |
| `max` | 最慢一次请求 | 长尾问题排查 |
| `http_reqs ... /s` | 每秒请求数（QPS） | 吞吐量，越高越好 |
| `errors` | 错误率 | 应低于 1% |

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `BASE_URL` | `http://localhost:8080` | 目标服务地址 |
| `TIMESTAMP` | 当前时间戳 | 热门排行榜快照时间戳 |
| `TOKEN` | 空 | JWT 登录态（可选） |

## npm scripts

| 命令 | 说明 |
|------|------|
| `npm test` | 运行压力测试 |
| `npm run test:smoke` | 运行冒烟测试 |
| `npm run test:export` | 压力测试 + 导出结果到 results/ |
| `npm run compare` | 对比 before.json 和 after.json |
