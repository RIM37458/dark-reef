#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const SUPPRESSIONS = /@ts-ignore|@ts-nocheck|eslint-disable|biome-ignore|istanbul ignore|nosemgrep|gitleaks:allow|Stryker disable/;
const UNFINISHED = /throw new Error\([^)]*[Nn]ot implemented|catch\s*(?:\([^)]*\))?\s*\{\s*\}|\bTODO\b/;
const SKIPPED_TESTS = /\.(?:skip|todo)\b|\bxit\(|\bxdescribe\(/;

function normalizePath(path) {
  return path.replaceAll("\\", "/").replace(/^[ab]\//, "");
}

function isExecutableCode(path) {
  const normalized = normalizePath(path);
  return /^(?:src|scripts|test)\/.+\.c?m?js$/.test(normalized)
    && normalized !== "scripts/floor-guard.js";
}

function constraintKey(text) {
  return text.split("|").map((part) => part.trim()).filter(Boolean)[0];
}

function numbers(text) {
  return (text.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
}

function parseDiff(diff) {
  const added = [];
  const removed = [];
  const deletedFiles = new Set();
  let previousFile = "";
  let file = "";

  for (const line of diff.split("\n")) {
    if (line.startsWith("--- ")) {
      previousFile = normalizePath(line.slice(4).trim());
    } else if (line.startsWith("+++ ")) {
      const nextFile = normalizePath(line.slice(4).trim());
      file = nextFile === "/dev/null" ? previousFile : nextFile;
      if (nextFile === "/dev/null" && previousFile) deletedFiles.add(previousFile);
    }
    else if (line.startsWith("+") && !line.startsWith("+++")) {
      added.push({ file, text: line.slice(1) });
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      removed.push({ file, text: line.slice(1) });
    }
  }

  return { added, removed, deletedFiles };
}

export function analyzeDiff(diff) {
  const { added, removed, deletedFiles } = parseDiff(diff);
  const findings = [];
  const flag = (rule, file) => findings.push({ rule, file });

  for (const file of deletedFiles) {
    if (/test\/.+\.test\.js$/.test(file)) flag("test-file-deleted", file);
  }

  for (const { file, text } of added) {
    if (isExecutableCode(file) && SUPPRESSIONS.test(text)) flag("silenced-checker", file);
    if (isExecutableCode(file) && UNFINISHED.test(text)) flag("unfinished-work", file);
    if (/test\/.+\.test\.js$/.test(normalizePath(file)) && SKIPPED_TESTS.test(text)) {
      flag("test-made-easier", file);
    }
    if (/CONSTRAINTS\.md$/.test(file) && /^\|\s*[WE]\d+\s*\|/.test(text)) {
      flag("new-exception", file);
    }
  }

  const changedTestFiles = new Set(removed
    .filter(({ file }) => /test\/.+\.test\.js$/.test(normalizePath(file)))
    .map(({ file }) => file));
  for (const file of changedTestFiles) {
    if (deletedFiles.has(file)) continue;
    const removedAssertions = removed.filter(
      (line) => line.file === file && /\bassert\b/.test(line.text),
    ).length;
    const addedAssertions = added.filter(
      (line) => line.file === file && /\bassert\b/.test(line.text),
    ).length;
    if (removedAssertions > addedAssertions) flag("assertion-removed", file);
  }

  for (const { file, text } of removed) {
    if (/CONSTRAINTS\.md$/.test(file) && /^- F\d+\b/.test(text.trim())) {
      flag("floor-rule-removed", file);
    }
  }

  const removedConstraints = removed.filter(({ file }) => /CONSTRAINTS\.md$/.test(file));
  const addedConstraints = added.filter(({ file }) => /CONSTRAINTS\.md$/.test(file));
  for (const previous of removedConstraints) {
    const next = addedConstraints.find(
      ({ text }) => constraintKey(text) === constraintKey(previous.text),
    );
    if (!next) continue;
    const before = numbers(previous.text);
    if (numbers(next.text).some((value, index) => before[index] !== undefined && value < before[index])) {
      flag("threshold-lowered", previous.file);
    }
  }

  return findings;
}

function git(args, allowedStatuses = [0]) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  return allowedStatuses.includes(result.status) ? result.stdout : null;
}

export function collectDiff(base = "main") {
  const mergeBase = git(["merge-base", base, "HEAD"])?.trim();
  if (!mergeBase) return null;

  const tracked = git(["diff", "--unified=0", mergeBase, "--"]);
  if (tracked === null) return null;

  const untrackedFiles = (git(["ls-files", "--others", "--exclude-standard"]) ?? "")
    .split(/\r?\n/)
    .filter(Boolean);
  const untracked = untrackedFiles.map((file) => (
    git(["diff", "--no-index", "--unified=0", "--", "/dev/null", file], [0, 1]) ?? ""
  )).join("\n");

  return `${tracked}\n${untracked}`;
}

function run() {
  const baseIndex = process.argv.indexOf("--base");
  const base = baseIndex === -1 ? "main" : process.argv[baseIndex + 1];
  if (!base) {
    console.error("floor-guard: --base requires a Git ref");
    process.exitCode = 2;
    return;
  }

  const diff = collectDiff(base);
  if (diff === null) {
    console.error(`floor-guard: no merge base against ${base}`);
    process.exitCode = 2;
    return;
  }

  const findings = analyzeDiff(diff);
  if (findings.length === 0) {
    console.log("floor-guard: clean");
    return;
  }

  console.error(`floor-guard: ${findings.length} floor violation(s):`);
  for (const finding of findings) {
    console.error(`  [${finding.rule}] ${finding.file}`);
  }
  console.error("Fix the change or record a reviewed, owned, expiring exception.");
  process.exitCode = 1;
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) run();
