export function markDone(text, id) {
  const lines = text.split(/(\r?\n)/);
  let found = false;
  for (let i = 0; i < lines.length; i += 2) {
    const line = lines[i];
    if (!/^[-*] \[([ xX])\] S\d+\.\d+ /.test(line)) continue;
    const match = line.match(/^([-*]) \[([ xX])\] (S\d+\.\d+) (.*)$/);
    if (!match) continue;
    const [, prefix, checkbox, stepId, title] = match;
    if (stepId !== id) continue;
    if (checkbox !== " ") return text;
    found = true;
    lines[i] = `${prefix} [x] ${id} ${title}`;
    break;
  }
  if (!found) {
    throw new Error(`unknown step: ${id}`);
  }
  return lines.join("");
}