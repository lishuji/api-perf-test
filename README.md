# 📊 API Perf Test

通用 API 性能回归测试工具 —— 基于 [k6](https://k6.io/)，配置驱动，开箱即用。

一个 JSON 文件管理所有接口，**新增接口零代码**，支持冒烟 / 压力 / 持久测试与性能回归对比。

## 30 秒上手

```bash
# 0. 安装 k6（仅首次）
brew install k6              # macOS
# sudo apt install k6        # Linux
# choco install k6           # Windows

# 1. 创建配置文件
cp config/example.json config/my-apis.json
# 编辑 config/my-apis.json，填入你的接口信息

# 2. 查看可用接口
./scripts/run.sh list config/my-apis.json

# 3. 跑一个冒烟测试（约 15 秒）
./scripts/run.sh smoke config/my-apis.json user-list
```

## 配置文件

一个 JSON 文件定义全局设置 + 多个接口，接口级配置**自动继承并可覆盖**全局配置：

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

> 💡 `user-search` 的 p95 是 300ms（自己的），p99 是 1000ms（继承 global），baseUrl 和 token 也继承自 global。

## 运行测试

```bash
# 冒烟测试（~15s，快速验证接口可用性）
./scripts/run.sh smoke config/my-apis.json <api_id>

# 压力测试（~1.5min，渐进加压找拐点）
./scripts/run.sh stress config/my-apis.json <api_id>

# 持久测试（~10min，发现内存泄漏）
./scripts/run.sh soak config/my-apis.json <api_id>
```

### 压力模型

```
并发数
100 |                    ████████
 50 |          ██████████
 20 |  ████████                  ████
  0 |──────────────────────────────────→ 时间
     0s   15s      45s      75s   90s
      预热    稳态     压力     冷却
```

### 常用选项

```bash
# 导出结果到文件
./scripts/run.sh stress config/my-apis.json user-list --summary-export=results/result.json

# 环境变量覆盖配置（如切换环境）
BASE_URL=https://staging.example.com ./scripts/run.sh smoke config/my-apis.json user-list

# 自定义压力阶段
k6 run -e CONFIG_FILE=config/my-apis.json -e API_ID=user-list \
  -e 'STAGES=[{"duration":"10s","target":200},{"duration":"30s","target":500}]' test/stress.js

# 自定义持久测试参数（50 并发跑 30 分钟）
k6 run -e CONFIG_FILE=config/my-apis.json -e API_ID=user-list \
  -e SOAK_VUS=50 -e SOAK_DURATION=30m test/soak.js
```

## 性能回归对比

```bash
# 1. 优化前，跑基准
./scripts/run.sh stress config/my-apis.json user-list --summary-export=results/before.json

# 2. 部署优化代码...

# 3. 优化后，跑对比
./scripts/run.sh stress config/my-apis.json user-list --summary-export=results/after.json

# 4. 生成对比报告
API_NAME="用户列表" node scripts/compare.js
# 或指定任意两个结果文件
node scripts/compare.js results/v1.json results/v2.json
```

输出示例：

```
═══════════════════════════════════════════════════════
  📊 用户列表 性能对比报告
═══════════════════════════════════════════════════════

  指标          基准值          对比值          变化
  ───────────────────────────────────────────────────────
  平均延迟        771.6ms       320.5ms   ↓58.5% ✅
  p95 延迟       1770.0ms       650.3ms   ↓63.3% ✅
  QPS              52.5/s       128.3/s   ↑144.4% ✅
  ───────────────────────────────────────────────────────

  🎉 结论: 性能有明显提升！
```

## 团队新增接口

**只需 2 步：**

**① 在配置文件中加一段：**

```json
"order-create": {
  "name": "创建订单",
  "path": "/api/v1/orders",
  "method": "POST",
  "body": { "productId": "123", "quantity": 1 },
  "checkField": "data.orderId"
}
```

**② 运行测试：**

```bash
./scripts/run.sh stress config/my-apis.json order-create
```

无需写任何 k6 代码！

## CI/CD 集成

```yaml
# GitHub Actions
name: API Performance Gate
on: [push]
jobs:
  perf-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: grafana/setup-k6-action@v1
      - name: Smoke test
        run: |
          k6 run \
            -e CONFIG_FILE=config/apis.json \
            -e API_ID=user-list \
            -e BASE_URL=${{ secrets.API_BASE_URL }} \
            -e TOKEN=${{ secrets.API_TOKEN }} \
            test/smoke.js
      - name: Regression check
        run: |
          k6 run -e CONFIG_FILE=config/apis.json -e API_ID=user-list \
            --summary-export=results/current.json test/stress.js
          node scripts/compare.js results/baseline.json results/current.json
```

---

## 参考

### 项目结构

```
api-perf-test/
├── config/                         # 接口配置
│   └── example.json                #   配置模板
├── lib/                            # 通用模块
│   ├── config.js                   #   配置解析
│   └── request.js                  #   请求执行 & 指标采集
├── test/                           # 测试脚本
│   ├── smoke.js                    #   冒烟测试（~15s）
│   ├── stress.js                   #   压力测试（~1.5min）
│   └── soak.js                     #   持久测试（~10min）
├── scripts/
│   ├── run.sh                      #   便捷运行脚本
│   └── compare.js                  #   性能对比报告
└── results/                        #   测试结果输出
```

### global 全局字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `baseUrl` | string | `http://localhost:8080` | 服务基础地址 |
| `headers` | object | `{"Content-Type":"application/json"}` | 全局请求头 |
| `token` | string | — | Bearer Token |
| `cookie` | string | — | Cookie |
| `expectedStatus` | number | `200` | 期望状态码 |
| `thresholds.p95` | number | `500` | p95 上限（ms） |
| `thresholds.p99` | number | `1000` | p99 上限（ms） |
| `thresholds.errorRate` | number | `1` | 错误率上限（%） |

### apis 接口字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | | 接口名称（报告展示用） |
| `path` | string | ✅ | 接口路径 |
| `method` | string | | 请求方法，默认 `GET` |
| `query` | object | | URL Query 参数 |
| `body` | object | | 请求体（POST/PUT/PATCH） |
| `headers` | object | | 自定义请求头（与 global 合并） |
| `token` | string | | 覆盖全局 Token |
| `cookie` | string | | 覆盖全局 Cookie |
| `expectedStatus` | number | | 覆盖全局期望状态码 |
| `checkField` | string | | 响应 JSON 非空校验字段路径 |
| `thresholds` | object | | 覆盖全局阈值（深合并） |

### 环境变量覆盖

环境变量优先级最高，可覆盖 JSON 配置文件中的任何值：

| 变量 | 说明 |
|------|------|
| `CONFIG_FILE` | JSON 配置文件路径 |
| `API_ID` | 接口 ID |
| `BASE_URL` | 覆盖 baseUrl |
| `TOKEN` | 覆盖 Token |
| `THRESHOLD_P95` / `P99` / `ERROR_RATE` | 覆盖阈值 |
| `STAGES` | 自定义压力阶段（JSON 数组） |
| `SOAK_DURATION` | 持久测试时长（默认 `10m`） |
| `SOAK_VUS` | 持久测试并发数（默认 `30`） |

### npm scripts

| 命令 | 说明 |
|------|------|
| `npm run test:smoke` | 冒烟测试（需先设环境变量） |
| `npm run test:stress` | 压力测试 |
| `npm run test:soak` | 持久测试 |
| `npm run test:export` | 压力测试 + 导出结果 |
| `npm run compare` | 对比 before.json vs after.json |

## License

MIT
