# 🔥 Cloud Studio API 性能测试

针对 Cloud Studio `/liteapps/rankings/hot` 接口的 k6 性能测试项目。

## 安装

```bash
brew install k6
```

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
└── README.md
```

## 快速开始

### 1. 压力测试（约 1.5 分钟）

```bash
# 默认目标：https://cloudstudio.net
npm test

# 指定目标地址
k6 run -e BASE_URL=http://localhost:8080 test/stress.js

# 带登录态
k6 run -e BASE_URL=https://cloudstudio.net -e TOKEN=your-jwt-token test/stress.js
```

### 2. 冒烟测试（约 15 秒）

```bash
npm run test:smoke
```

### 3. 导出结果

```bash
npm run test:export
```

结果保存在 `results/result.json`。

### 4. 优化前后对比

```bash
# 第 1 步：优化前，导出结果
k6 run -e BASE_URL=https://cloudstudio.net --summary-export=results/before.json test/stress.js

# 第 2 步：部署优化代码...

# 第 3 步：优化后，导出结果
k6 run -e BASE_URL=https://cloudstudio.net --summary-export=results/after.json test/stress.js

# 第 4 步：自动对比
npm run compare
```

## 压力模型

压力测试 (`stress.js`) 的并发变化：

```
并发数
100 |                    ████████
 50 |          ██████████
 20 |  ████████                  ████
  0 |──────────────────────────────────→ 时间
     0s   15s      45s      75s   90s
      预热    稳态     压力     冷却
```

## 通过条件

| 指标 | 阈值 |
|------|------|
| p95 响应时间 | < 500ms |
| p99 响应时间 | < 1000ms |
| 错误率 | < 1% |

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `BASE_URL` | `http://localhost:8080` | 目标服务地址 |
| `TIMESTAMP` | 当前时间戳 | 热门排行榜快照时间戳 |
| `TOKEN` | 空 | JWT 登录态（可选） |
