#!/usr/bin/env node

/**
 * 性能测试结果对比脚本
 *
 * 用法：
 *   node scripts/compare.js                                  # 默认对比 results/before.json vs results/after.json
 *   node scripts/compare.js path/to/before.json path/to/after.json
 *   API_NAME="用户列表接口" node scripts/compare.js           # 自定义接口名称
 */
const fs = require('fs');
const path = require('path');

// ============ 解析参数 ============
const args = process.argv.slice(2);
const resultsDir = path.join(__dirname, '..', 'results');

const beforePath = args[0] || path.join(resultsDir, 'before.json');
const afterPath = args[1] || path.join(resultsDir, 'after.json');
const apiName = process.env.API_NAME || '接口';

// ============ 检查文件 ============
if (!fs.existsSync(beforePath)) {
  console.error(`❌ 找不到基准结果文件: ${beforePath}`);
  console.error('   请先运行: k6 run --summary-export=results/before.json test/stress.js');
  process.exit(1);
}
if (!fs.existsSync(afterPath)) {
  console.error(`❌ 找不到对比结果文件: ${afterPath}`);
  console.error('   请先运行: k6 run --summary-export=results/after.json test/stress.js');
  process.exit(1);
}

const before = JSON.parse(fs.readFileSync(beforePath, 'utf-8'));
const after = JSON.parse(fs.readFileSync(afterPath, 'utf-8'));

// ============ 提取指标 ============

/**
 * 智能提取 k6 导出结果中的关键指标
 * 兼容自定义 Trend 和默认 http_req_duration
 */
function extract(data) {
  const metrics = data.metrics;

  // 优先使用自定义 Trend（api_duration），否则使用 http_req_duration
  const dur = metrics.api_duration || metrics.http_req_duration;
  if (!dur) {
    console.error('❌ 结果文件中找不到延迟指标（api_duration / http_req_duration）');
    process.exit(1);
  }

  const reqs = metrics.http_reqs;
  const errors = metrics.errors || metrics.http_req_failed;

  return {
    avg: dur.avg.toFixed(1),
    med: dur.med.toFixed(1),
    p90: dur['p(90)'].toFixed(1),
    p95: dur['p(95)'].toFixed(1),
    max: dur.max.toFixed(1),
    qps: reqs.rate.toFixed(1),
    count: reqs.count,
    errorRate: (((errors && errors.value) || 0) * 100).toFixed(2),
  };
}

const b = extract(before);
const a = extract(after);

// ============ 计算变化 ============
function improvement(beforeVal, afterVal) {
  const diff = ((beforeVal - afterVal) / beforeVal) * 100;
  if (Math.abs(diff) < 0.1) return '  持平  ';
  if (diff > 0) return `↓${diff.toFixed(1)}% ✅`;
  return `↑${Math.abs(diff).toFixed(1)}% ❌`;
}

function qpsImprovement(beforeVal, afterVal) {
  const diff = ((afterVal - beforeVal) / beforeVal) * 100;
  if (Math.abs(diff) < 0.1) return '  持平  ';
  if (diff > 0) return `↑${diff.toFixed(1)}% ✅`;
  return `↓${Math.abs(diff).toFixed(1)}% ❌`;
}

// ============ 输出报告 ============
const divider = '─'.repeat(55);

console.log();
console.log('═'.repeat(55));
console.log(`  📊 ${apiName} 性能对比报告`);
console.log('═'.repeat(55));
console.log();
console.log(`  基准文件: ${path.basename(beforePath)}`);
console.log(`  对比文件: ${path.basename(afterPath)}`);
console.log(`  生成时间: ${new Date().toLocaleString('zh-CN')}`);
console.log();
console.log(`  ${'指标'.padEnd(10)}  ${'基准值'.padEnd(12)}  ${'对比值'.padEnd(12)}  变化`);
console.log(`  ${divider}`);
console.log(`  ${'平均延迟'.padEnd(8)}  ${(b.avg + 'ms').padStart(12)}  ${(a.avg + 'ms').padStart(12)}  ${improvement(b.avg, a.avg)}`);
console.log(`  ${'p50 延迟'.padEnd(8)}  ${(b.med + 'ms').padStart(12)}  ${(a.med + 'ms').padStart(12)}  ${improvement(b.med, a.med)}`);
console.log(`  ${'p90 延迟'.padEnd(8)}  ${(b.p90 + 'ms').padStart(12)}  ${(a.p90 + 'ms').padStart(12)}  ${improvement(b.p90, a.p90)}`);
console.log(`  ${'p95 延迟'.padEnd(8)}  ${(b.p95 + 'ms').padStart(12)}  ${(a.p95 + 'ms').padStart(12)}  ${improvement(b.p95, a.p95)}`);
console.log(`  ${'最大延迟'.padEnd(8)}  ${(b.max + 'ms').padStart(12)}  ${(a.max + 'ms').padStart(12)}  ${improvement(b.max, a.max)}`);
console.log(`  ${'QPS'.padEnd(8)}  ${(b.qps + '/s').padStart(12)}  ${(a.qps + '/s').padStart(12)}  ${qpsImprovement(b.qps, a.qps)}`);
console.log(`  ${'请求总数'.padEnd(8)}  ${String(b.count).padStart(12)}  ${String(a.count).padStart(12)}`);
console.log(`  ${'错误率'.padEnd(8)}  ${(b.errorRate + '%').padStart(12)}  ${(a.errorRate + '%').padStart(12)}`);
console.log(`  ${divider}`);
console.log();

// ============ 简要结论 ============
const p95Diff = ((b.p95 - a.p95) / b.p95 * 100);
const qpsDiff = ((a.qps - b.qps) / b.qps * 100);

if (p95Diff > 10 || qpsDiff > 10) {
  console.log('  🎉 结论: 性能有明显提升！');
} else if (p95Diff < -10 || qpsDiff < -10) {
  console.log('  ⚠️  结论: 性能出现回退，建议排查！');
} else {
  console.log('  ℹ️  结论: 性能变化不大，基本持平。');
}
console.log();
