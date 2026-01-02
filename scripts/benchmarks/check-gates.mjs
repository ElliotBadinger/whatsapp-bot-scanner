#!/usr/bin/env node
import fs from "node:fs";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readJsonFromStdin() {
  const data = fs.readFileSync(0, "utf8");
  if (!data.trim()) {
    throw new Error("No report data provided on stdin");
  }
  return JSON.parse(data);
}

function getValue(payload, path) {
  return path.split(".").reduce((acc, segment) => {
    if (!acc || typeof acc !== "object") return undefined;
    return acc[segment];
  }, payload);
}

function evaluateGate(gate, value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return { status: "missing", value };
  }
  const direction = gate.direction || "gte";
  const green = gate.green;
  const amber = gate.amber;
  const passesGreen =
    direction === "lte" ? value <= green : value >= green;
  const passesAmber =
    direction === "lte" ? value <= amber : value >= amber;

  if (passesGreen) return { status: "green", value };
  if (passesAmber) return { status: "amber", value };
  return { status: "red", value };
}

function resolveTarget(report, gate) {
  if (!gate.source) return report;
  const sources = Array.isArray(report.sources) ? report.sources : [];
  return sources.find((entry) => entry.source === gate.source);
}

const args = parseArgs(process.argv.slice(2));
const reportPath = args.report || process.env.BENCHMARK_REPORT_PATH;
const gatesPath = args.gates || "benchmarks/gates.json";

const report = reportPath ? readJson(reportPath) : readJsonFromStdin();
const gates = readJson(gatesPath);
const gateList = [
  ...(Array.isArray(gates.gates) ? gates.gates : []),
  ...(Array.isArray(gates.sourceGates) ? gates.sourceGates : []),
];

const results = [];
let redCount = 0;
let amberCount = 0;
let greenCount = 0;
let missingCount = 0;

for (const gate of gateList) {
  const target = resolveTarget(report, gate);
  const targetId = gate.source || "overall";
  const value = target ? getValue(target, gate.path) : undefined;
  const verdict = evaluateGate(gate, value);
  if (verdict.status === "red") redCount += 1;
  if (verdict.status === "amber") amberCount += 1;
  if (verdict.status === "green") greenCount += 1;
  if (verdict.status === "missing") missingCount += 1;
  results.push({
    id: gate.id,
    target: targetId,
    path: gate.path,
    status: verdict.status,
    value: verdict.value,
    direction: gate.direction || "gte",
    green: gate.green,
    amber: gate.amber,
  });
}

const summary = {
  total: results.length,
  green: greenCount,
  amber: amberCount,
  red: redCount,
  missing: missingCount,
};

const output = { summary, results };
if (args.output) {
  fs.writeFileSync(args.output, JSON.stringify(output, null, 2), "utf8");
} else {
  console.log(JSON.stringify(output, null, 2));
}

if (redCount > 0 || missingCount > 0) {
  process.exitCode = 1;
}
