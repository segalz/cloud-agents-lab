export const stepLine = /^(?<indent>[-*] )\[(?<box>[ xX])\](?<prefix>\s+)S(?<num>\d+)\.(?<ver>\d+)(?<spaces>\s+)(?<rest>.*)$/;

export function parsePlan(text) {
  const steps = [];
  const ids = new Set();
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(stepLine);
    if (!match) continue;
    const { box, num, ver, rest } = match.groups;
    const id = `S${num}.${ver}`;
    if (ids.has(id)) {
      throw new Error(`duplicate step id: ${id}`);
    }
    ids.add(id);
    const title = rest.trim();
    steps.push({ id, title, done: box !== " " });
  }
  return steps;
}

export function nextStep(steps) {
  if (!Array.isArray(steps)) throw new TypeError();
  return steps.find((s) => !s.done) || null;
}