#!/usr/bin/env bash
# ==============================================================
# API 性能测试便捷运行脚本
#
# 用法:
#   ./scripts/run.sh <test_type> [config_file] [extra_k6_args...]
#
# 参数:
#   test_type    - smoke | stress | soak
#   config_file  - .env 配置文件路径（可选）
#   extra_args   - 传递给 k6 的额外参数
#
# 示例:
#   ./scripts/run.sh smoke
#   ./scripts/run.sh stress config/examples/cloud-studio-hot-ranking.env
#   ./scripts/run.sh stress config/examples/cloud-studio-hot-ranking.env --summary-export=results/before.json
# ==============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 检查 k6
if ! command -v k6 &> /dev/null; then
    echo -e "${RED}❌ 未安装 k6，请先安装: brew install k6${NC}"
    exit 1
fi

# 参数检查
TEST_TYPE="${1:-}"
CONFIG_FILE="${2:-}"
shift 2 2>/dev/null || true
EXTRA_ARGS="$*"

if [ -z "$TEST_TYPE" ]; then
    echo -e "${CYAN}📊 API 性能测试工具${NC}"
    echo ""
    echo "用法: $0 <test_type> [config_file] [extra_k6_args...]"
    echo ""
    echo "测试类型:"
    echo "  smoke   - 冒烟测试（~15s，快速验证接口可用性）"
    echo "  stress  - 压力测试（~1.5min，渐进加压找拐点）"
    echo "  soak    - 持久测试（~10min，发现内存泄漏等问题）"
    echo ""
    echo "示例:"
    echo "  $0 smoke"
    echo "  $0 stress config/examples/cloud-studio-hot-ranking.env"
    echo "  $0 stress my-api.env --summary-export=results/before.json"
    exit 0
fi

# 验证测试类型
TEST_FILE="$PROJECT_DIR/test/${TEST_TYPE}.js"
if [ ! -f "$TEST_FILE" ]; then
    echo -e "${RED}❌ 未知测试类型: $TEST_TYPE${NC}"
    echo "   可选: smoke | stress | soak"
    exit 1
fi

# 构建 k6 环境变量参数
K6_ENV_ARGS=""

if [ -n "$CONFIG_FILE" ] && [ -f "$CONFIG_FILE" ]; then
    echo -e "${CYAN}📂 加载配置文件: $CONFIG_FILE${NC}"
    while IFS='=' read -r key value; do
        # 跳过空行和注释
        [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]] && continue
        # 去除前后空格
        key=$(echo "$key" | xargs)
        value=$(echo "$value" | xargs)
        [ -z "$key" ] && continue
        K6_ENV_ARGS="$K6_ENV_ARGS -e $key=$value"
    done < "$CONFIG_FILE"
elif [ -n "$CONFIG_FILE" ]; then
    echo -e "${YELLOW}⚠️  配置文件不存在: $CONFIG_FILE，使用环境变量/默认值${NC}"
fi

# 也把当前 shell 中的相关环境变量传入
for var in API_NAME BASE_URL API_PATH METHOD QUERY_PARAMS BODY CUSTOM_HEADERS TOKEN COOKIE \
           EXPECTED_STATUS CHECK_FIELD THRESHOLD_P95 THRESHOLD_P99 THRESHOLD_ERROR_RATE \
           STAGES SOAK_DURATION SOAK_VUS; do
    if [ -n "${!var:-}" ]; then
        K6_ENV_ARGS="$K6_ENV_ARGS -e $var=${!var}"
    fi
done

echo -e "${GREEN}🚀 启动 ${TEST_TYPE} 测试...${NC}"
echo -e "${CYAN}   测试文件: $TEST_FILE${NC}"
echo ""

# 运行 k6
eval "k6 run $K6_ENV_ARGS $EXTRA_ARGS $TEST_FILE"
