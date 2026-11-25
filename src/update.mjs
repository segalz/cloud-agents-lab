import { stepLine } from "./parse.mjs";

export function markDone(text, id) {
  const lines = text.split(/(\r?\n)/);
  for (let i = 0; i < lines.length; i += 2) {
    const line = lines[i];
    const match = line.match(stepLine);
    if (!match) continue;
    const { indent, box, num, ver, prefix, spaces, rest } = match.groups;
    const stepId = `S${num}.${ver}`;
    if (stepId !== id) continue;
    if (box !== " ") return text;
    lines[i] = `${indent}[x]${prefix}S${num}.${ver}${spaces}${rest}`;
    return lines.join("");
  }
  throw new Error(`unknown step: ${id}`);
}