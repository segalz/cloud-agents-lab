import { readFileSync } from "node:fs";
import { exit } from "node:process";
import { parsePlan, nextStep } from "../src/parse.mjs";

const [,, cmd, file] = process.argv;

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