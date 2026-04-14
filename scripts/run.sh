#!/usr/bin/env bash
# ==============================================================
# API 性能测试便捷运行脚本
#
# 用法:
#   ./scripts/run.sh <command> [options...]
#
# 命令:
#   list   <config.json>                     列出配置文件中的所有接口
#   smoke  <config.json> <api_id> [k6_args]  冒烟测试
#   stress <config.json> <api_id> [k6_args]  压力测试
#   soak   <config.json> <api_id> [k6_args]  持久测试
#
# 示例:
#   ./scripts/run.sh list config/my-apis.json
#   ./scripts/run.sh smoke config/my-apis.json user-list
#   ./scripts/run.sh stress config/my-apis.json user-list --summary-export=results/before.json
# ==============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# 检查 k6
if ! command -v k6 &> /dev/null; then
    echo -e "${RED}❌ 未安装 k6，请先安装: brew install k6${NC}"
    exit 1
fi

# ─────────────── 帮助信息 ───────────────
show_help() {
    echo -e "${BOLD}📊 API 性能测试工具${NC}"
    echo ""
    echo "用法: $0 <command> <config.json> <api_id> [k6_args...]"
    echo ""
    echo -e "${CYAN}命令:${NC}"
    echo "  list   <config.json>                     列出配置中所有可用接口"
    echo "  smoke  <config.json> <api_id> [k6_args]  冒烟测试（~15s）"
    echo "  stress <config.json> <api_id> [k6_args]  压力测试（~1.5min）"
    echo "  soak   <config.json> <api_id> [k6_args]  持久测试（~10min）"
    echo ""
    echo -e "${CYAN}示例:${NC}"
    echo "  $0 list config/my-apis.json"
    echo "  $0 smoke config/my-apis.json user-list"
    echo "  $0 stress config/my-apis.json user-list --summary-export=results/before.json"
}

# ─────────────── 列出接口 ───────────────
list_apis() {
    local config_file="$1"
    if [ ! -f "$config_file" ]; then
        echo -e "${RED}❌ 配置文件不存在: $config_file${NC}"
        exit 1
    fi

    echo -e "${BOLD}📋 可用接口列表${NC}  (${config_file})"
    echo ""
    echo -e "  ${CYAN}ID                   方法    路径                          名称${NC}"
    echo "  ─────────────────────────────────────────────────────────────────────────"

    # 使用 node 解析 JSON（k6 不支持直接列出）
    if command -v node &> /dev/null; then
        node -e "
          const cfg = JSON.parse(require('fs').readFileSync('$config_file', 'utf-8'));
          const apis = cfg.apis || {};
          Object.entries(apis).forEach(([id, api]) => {
            const method = (api.method || 'GET').padEnd(6);
            const path = (api.path || '/').padEnd(30);
            const name = api.name || id;
            console.log('  ' + id.padEnd(20) + ' ' + method + '  ' + path + '  ' + name);
          });
          if (Object.keys(apis).length === 0) console.log('  (空)');
        "
    else
        echo -e "${YELLOW}  ⚠️  需要 Node.js 来解析 JSON 配置${NC}"
        echo "  请安装 Node.js 或直接查看配置文件"
    fi
    echo ""
}

# ─────────────── 参数检查 ───────────────
COMMAND="${1:-}"

if [ -z "$COMMAND" ] || [ "$COMMAND" = "-h" ] || [ "$COMMAND" = "--help" ]; then
    show_help
    exit 0
fi

# ─────────────── list 命令 ───────────────
if [ "$COMMAND" = "list" ]; then
    CONFIG_FILE="${2:-}"
    if [ -z "$CONFIG_FILE" ]; then
        echo -e "${RED}❌ 请指定配置文件: $0 list <config.json>${NC}"
        exit 1
    fi
    list_apis "$CONFIG_FILE"
    exit 0
fi

# ─────────────── 测试命令 ───────────────
TEST_TYPE="$COMMAND"
CONFIG_FILE="${2:-}"
API_ID="${3:-}"

# 验证测试类型
TEST_FILE="$PROJECT_DIR/test/${TEST_TYPE}.js"
if [ ! -f "$TEST_FILE" ]; then
    echo -e "${RED}❌ 未知测试类型: $TEST_TYPE${NC}"
    echo "   可选: smoke | stress | soak"
    exit 1
fi

# 构建 k6 参数
K6_ENV_ARGS=""
shift 1  # 移除 command

# 判断配置方式：.json 还是 .env
if [ -n "$CONFIG_FILE" ] && [ -f "$CONFIG_FILE" ]; then
    if [[ "$CONFIG_FILE" == *.json ]]; then
        # ─── JSON 配置文件模式 ───
        if [ -z "$API_ID" ]; then
            echo -e "${RED}❌ 使用 JSON 配置时必须指定 API_ID${NC}"
            echo ""
            list_apis "$CONFIG_FILE"
            echo -e "用法: $0 $TEST_TYPE $CONFIG_FILE ${CYAN}<api_id>${NC}"
            exit 1
        fi

        K6_ENV_ARGS="-e CONFIG_FILE=$CONFIG_FILE -e API_ID=$API_ID"
        shift 2 2>/dev/null || true  # 移除 config_file 和 api_id
        EXTRA_ARGS="$*"

        echo -e "${CYAN}📂 配置文件: $CONFIG_FILE${NC}"
        echo -e "${CYAN}🔗 接口 ID:  $API_ID${NC}"
    else
        # ─── .env 配置文件模式（兼容） ───
        shift 1 2>/dev/null || true  # 移除 config_file
        EXTRA_ARGS="$*"

        echo -e "${CYAN}📂 加载配置文件: $CONFIG_FILE${NC}"
        while IFS='=' read -r key value; do
            [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]] && continue
            key=$(echo "$key" | xargs)
            value=$(echo "$value" | xargs)
            [ -z "$key" ] && continue
            K6_ENV_ARGS="$K6_ENV_ARGS -e $key=$value"
        done < "$CONFIG_FILE"
    fi
elif [ -n "$CONFIG_FILE" ]; then
    echo -e "${YELLOW}⚠️  配置文件不存在: $CONFIG_FILE，使用环境变量/默认值${NC}"
    shift 1 2>/dev/null || true
    EXTRA_ARGS="$*"
else
    EXTRA_ARGS=""
fi

# 传递 shell 环境变量（覆盖配置文件值）
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
eval "k6 run $K6_ENV_ARGS ${EXTRA_ARGS:-} $TEST_FILE"
