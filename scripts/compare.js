const fs = require('fs');
const path = require('path');

const resultsDir = path.join(__dirname, '..', 'results');
const beforePath = path.join(resultsDir, 'before.json');
const afterPath = path.join(resultsDir, 'after.json');

// 检查文件是否存在
if (!fs.existsSync(beforePath)) {
  console.error('❌ 找不到 results/before.json，请先运行：');
  console.error('   k6 run --summary-export=results/before.json test/hot_ranking.js');
  process.exit(1);
}
if (!fs.existsSync(afterPath)) {
  console.error('❌ 找不到 results/after.json，请先运行：');
  console.error('   k6 run --summary-export=results/after.json test/hot_ranking.js');
  process.exit(1);
}

const before = JSON.parse(fs.readFileSync(beforePath, 'utf-8'));
const after = JSON.parse(fs.readFileSync(afterPath, 'utf-8'));

// 提取指标
function extract(data) {
  const dur = data.metrics.http_req_duration;
  const reqs = data.metrics.http_reqs;
  const errors = data.metrics.errors || data.metrics.http_req_failed;
  return {
    avg: dur.avg.toFixed(1),
    med: dur.med.toFixed(1),
    p90: dur['p(90)'].toFixed(1),
    p95: dur['p(95)'].toFixed(1),
    max: dur.max.toFixed(1),
    qps: reqs.rate.toFixed(1),
    count: reqs.count,
    errorRate: ((errors.value || 0) * 100).toFixed(2),
  };
}

const b = extract(before);
const a = extract(after);

// 计算提升百分比（负数表示时间减少 = 性能提升）
function improvement(beforeVal, afterVal) {
  const diff = ((beforeVal - afterVal) / beforeVal) * 100;
  if (diff > 0) return `↓${diff.toFixed(1)}% ✅`;
  if (diff < 0) return `↑${Math.abs(diff).toFixed(1)}% ❌`;
  return '持平';
}

function qpsImprovement(beforeVal, afterVal) {
  const diff = ((afterVal - beforeVal) / beforeVal) * 100;
  if (diff > 0) return `↑${diff.toFixed(1)}% ✅`;
  if (diff < 0) return `↓${Math.abs(diff).toFixed(1)}% ❌`;
  return '持平';
}

console.log('\n========================================');
console.log('  🔥 热门排行榜接口性能对比报告');
console.log('========================================\n');
console.log('指标           优化前        优化后        变化');
console.log('─────────────────────────────────────────────────');
console.log(`平均延迟       ${b.avg.padStart(8)}ms   ${a.avg.padStart(8)}ms   ${improvement(b.avg, a.avg)}`);
console.log(`p50 延迟       ${b.med.padStart(8)}ms   ${a.med.padStart(8)}ms   ${improvement(b.med, a.med)}`);
console.log(`p90 延迟       ${b.p90.padStart(8)}ms   ${a.p90.padStart(8)}ms   ${improvement(b.p90, a.p90)}`);
console.log(`p95 延迟       ${b.p95.padStart(8)}ms   ${a.p95.padStart(8)}ms   ${improvement(b.p95, a.p95)}`);
console.log(`最大延迟       ${b.max.padStart(8)}ms   ${a.max.padStart(8)}ms   ${improvement(b.max, a.max)}`);
console.log(`QPS            ${b.qps.padStart(8)}/s   ${a.qps.padStart(8)}/s   ${qpsImprovement(b.qps, a.qps)}`);
console.log(`请求总数       ${String(b.count).padStart(8)}      ${String(a.count).padStart(8)}`);
console.log(`错误率         ${b.errorRate.padStart(7)}%    ${a.errorRate.padStart(7)}%`);
console.log('─────────────────────────────────────────────────\n');
