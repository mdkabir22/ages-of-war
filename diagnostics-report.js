#!/usr/bin/env node
/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';

function usage() {
  console.log('Usage:');
  console.log('  node diagnostics-report.js <input-batch.json> [output-report.md]');
  console.log('  node diagnostics-report.js --compare <baseline-batch.json> <candidate-batch.json> [output-report.md]');
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function avg(rows, key) {
  if (!rows.length) return 0;
  const total = rows.reduce((sum, row) => sum + (typeof row[key] === 'number' ? row[key] : 0), 0);
  return total / rows.length;
}

function modeBreakdown(rows) {
  const acc = {};
  for (const row of rows) {
    const mode = typeof row.mode === 'string' ? row.mode : 'unknown';
    acc[mode] = (acc[mode] || 0) + 1;
  }
  return acc;
}

function topEvents(rows, limit) {
  const acc = {};
  for (const row of rows) {
    const event = typeof row.event === 'string' && row.event.trim() ? row.event.trim() : 'none';
    acc[event] = (acc[event] || 0) + 1;
  }
  return Object.entries(acc)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function metricsFromBatch(batch) {
  const rows = Array.isArray(batch.rows) ? batch.rows : [];
  const wins = rows.filter((r) => r.win === true).length;
  const losses = rows.filter((r) => r.win === false).length;
  const winRate = rows.length ? (wins / rows.length) * 100 : 0;
  return {
    rows,
    wins,
    losses,
    winRate,
    waves: avg(rows, 'wave'),
    kills: avg(rows, 'kills'),
    aiPressure: avg(rows, 'aiPressure'),
    objectiveCompletion: avg(rows, 'objectiveCompletionPct'),
    byMode: modeBreakdown(rows),
  };
}

function diffValue(nextVal, baseVal) {
  return nextVal - baseVal;
}

function fmtDelta(value, suffix = '') {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}${suffix}`;
}

function buildReport(batch, sourcePath) {
  const summary = metricsFromBatch(batch);
  const { rows, wins, losses, winRate, aiPressure, objectiveCompletion, kills, waves, byMode } = summary;
  const events = topEvents(rows, 8);
  const exportedAt = typeof batch.exportedAt === 'number' ? new Date(batch.exportedAt).toISOString() : 'unknown';

  const lines = [];
  lines.push('# Diagnostics Report');
  lines.push('');
  lines.push(`- Source file: \`${sourcePath}\``);
  lines.push(`- Schema: \`${batch.schemaVersion || 'unknown'}\``);
  lines.push(`- Exported at: \`${exportedAt}\``);
  lines.push(`- Total matches: \`${rows.length}\``);
  lines.push(`- Wins / Losses: \`${wins}\` / \`${losses}\``);
  lines.push(`- Win rate: \`${winRate.toFixed(2)}%\``);
  lines.push(`- Avg wave: \`${waves.toFixed(2)}\``);
  lines.push(`- Avg kills: \`${kills.toFixed(2)}\``);
  lines.push(`- Avg AI pressure: \`${aiPressure.toFixed(3)}\``);
  lines.push(`- Avg objective completion: \`${objectiveCompletion.toFixed(2)}%\``);
  lines.push('');
  lines.push('## Mode Breakdown');
  lines.push('');
  for (const [mode, count] of Object.entries(byMode).sort((a, b) => b[1] - a[1])) {
    lines.push(`- ${mode}: ${count}`);
  }
  lines.push('');
  lines.push('## Top Events');
  lines.push('');
  for (const [event, count] of events) {
    lines.push(`- ${event}: ${count}`);
  }
  lines.push('');
  lines.push('## Quick Flags');
  lines.push('');
  if (winRate < 45) lines.push('- Win rate is below target band (45-58%).');
  if (winRate > 58) lines.push('- Win rate is above target band (45-58%).');
  if (objectiveCompletion < 45) lines.push('- Objective completion is below 45% threshold.');
  if (aiPressure > 0.35) lines.push('- AI pressure looks elevated; review difficulty bias.');
  if (aiPressure < 0.08) lines.push('- AI pressure looks low; game may feel too easy.');
  if (lines[lines.length - 1] === '') {
    lines.push('- No obvious threshold breaches.');
  }
  lines.push('');
  return lines.join('\n');
}

function buildCompareReport(baseBatch, basePath, nextBatch, nextPath) {
  const base = metricsFromBatch(baseBatch);
  const next = metricsFromBatch(nextBatch);
  const lines = [];
  lines.push('# Diagnostics Compare Report');
  lines.push('');
  lines.push(`- Baseline file: \`${basePath}\``);
  lines.push(`- Candidate file: \`${nextPath}\``);
  lines.push(`- Baseline matches: \`${base.rows.length}\``);
  lines.push(`- Candidate matches: \`${next.rows.length}\``);
  lines.push('');
  lines.push('## Metric Deltas (Candidate - Baseline)');
  lines.push('');
  lines.push(`- Win rate delta: \`${fmtDelta(diffValue(next.winRate, base.winRate), '%')}\``);
  lines.push(`- Avg wave delta: \`${fmtDelta(diffValue(next.waves, base.waves))}\``);
  lines.push(`- Avg kills delta: \`${fmtDelta(diffValue(next.kills, base.kills))}\``);
  lines.push(`- Avg AI pressure delta: \`${fmtDelta(diffValue(next.aiPressure, base.aiPressure))}\``);
  lines.push(`- Objective completion delta: \`${fmtDelta(diffValue(next.objectiveCompletion, base.objectiveCompletion), '%')}\``);
  lines.push('');
  lines.push('## Mode Mix Deltas (match count)');
  lines.push('');
  const allModes = new Set([...Object.keys(base.byMode), ...Object.keys(next.byMode)]);
  for (const mode of Array.from(allModes).sort()) {
    const b = base.byMode[mode] || 0;
    const n = next.byMode[mode] || 0;
    const d = n - b;
    const sign = d > 0 ? '+' : '';
    lines.push(`- ${mode}: baseline ${b}, candidate ${n}, delta ${sign}${d}`);
  }
  lines.push('');
  lines.push('## Quick Interpretation');
  lines.push('');
  const winRateDelta = diffValue(next.winRate, base.winRate);
  if (winRateDelta < -3) lines.push('- Candidate looks harder (win rate dropped >3pp).');
  if (winRateDelta > 3) lines.push('- Candidate looks easier (win rate rose >3pp).');
  const aiPressureDelta = diffValue(next.aiPressure, base.aiPressure);
  if (aiPressureDelta > 0.05) lines.push('- AI pressure increased materially (>0.05).');
  if (aiPressureDelta < -0.05) lines.push('- AI pressure decreased materially (<-0.05).');
  const objectiveDelta = diffValue(next.objectiveCompletion, base.objectiveCompletion);
  if (objectiveDelta < -5) lines.push('- Objective completion dropped more than 5pp.');
  if (objectiveDelta > 5) lines.push('- Objective completion improved more than 5pp.');
  if (lines[lines.length - 1] === '') lines.push('- No major shifts detected by default thresholds.');
  lines.push('');
  return lines.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    usage();
    process.exit(1);
  }

  const isCompare = args[0] === '--compare';
  let outputPath;

  if (isCompare) {
    if (args.length < 3) {
      usage();
      process.exit(1);
    }
    const basePath = path.resolve(args[1]);
    const nextPath = path.resolve(args[2]);
    outputPath = args[3] ? path.resolve(args[3]) : path.resolve(process.cwd(), `diagnostics-compare-${Date.now()}.md`);

    if (!fs.existsSync(basePath)) {
      console.error(`Baseline file not found: ${basePath}`);
      process.exit(1);
    }
    if (!fs.existsSync(nextPath)) {
      console.error(`Candidate file not found: ${nextPath}`);
      process.exit(1);
    }

    try {
      const baseBatch = readJson(basePath);
      const nextBatch = readJson(nextPath);
      const report = buildCompareReport(baseBatch, basePath, nextBatch, nextPath);
      fs.writeFileSync(outputPath, report, 'utf8');
      console.log(`Compare report written: ${outputPath}`);
    } catch (error) {
      console.error(`Failed to generate compare report: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
    return;
  }

  const inputPath = path.resolve(args[0]);
  outputPath = args[1] ? path.resolve(args[1]) : path.resolve(process.cwd(), `diagnostics-report-${Date.now()}.md`);
  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }
  try {
    const batch = readJson(inputPath);
    const report = buildReport(batch, inputPath);
    fs.writeFileSync(outputPath, report, 'utf8');
    console.log(`Report written: ${outputPath}`);
  } catch (error) {
    console.error(`Failed to generate report: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

main();
