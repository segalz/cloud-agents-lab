import { readFileSync, writeFileSync } from "node:fs";
import { exit } from "node:process";
import { parsePlan, nextStep } from "../src/parse.mjs";
import { summary } from "../src/summary.mjs";
import { markDone } from "../src/update.mjs";

const [,, cmd, file, id] = process.argv;

if (cmd === "status") {
  if (!file) {
    console.error("usage: node plan-tracker.mjs status <file>");
    exit(2);
  }
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    console.error(`cannot read file: ${file}`);
    exit(2);
  }
  const steps = parsePlan(text);
  const { done, total, percent } = summary(steps);
  console.log(`${done}/${total} done (${percent}%)`);
  exit(0);
}

if (cmd === "done") {
  if (!file || !id) {
    console.error("usage: node plan-tracker.mjs done <file> <id>");
    exit(2);
  }
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    console.error(`cannot read file: ${file}`);
    exit(2);
  }
  try {
    const newText = markDone(text, id);
    writeFileSync(file, newText);
    console.log(`marked ${id} done`);
    exit(0);
  } catch (e) {
    console.error(`unknown step: ${id}`);
    exit(1);
  }
}

if (cmd !== "next") {
  console.error("usage: node plan-tracker.mjs next <file>");
  exit(2);
}

if (!file) {
  console.error("usage: node plan-tracker.mjs next <file>");
  exit(2);
}

let text;
try {
  text = readFileSync(file, "utf8");
} catch {
  console.error(`cannot read file: ${file}`);
  exit(2);
}

const steps = parsePlan(text);
const step = nextStep(steps);

if (!step) {
  console.log("all steps done");
  exit(3);
}

console.log(`${step.id} ${step.title}`);
exit(0);