export function parsePlan(text) {
  const steps = [];
  const ids = new Set();
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!/^[-*] \[([ xX])\] S(\d+)\.(\d+) /.test(line)) continue;
    const match = line.match(/^[-*] \[([ xX])\] S(\d+)\.(\d+) (.*)$/);
    if (!match) continue;
    const [, checkbox, , , title] = match;
    const id = `S${match[2]}.${match[3]}`;
    if (ids.has(id)) {
      throw new Error(`duplicate step id: ${id}`);
    }
    ids.add(id);
    steps.push({ id, title: title.trim(), done: checkbox !== " " });
  }
  return steps;
}