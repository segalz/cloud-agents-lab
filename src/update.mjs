export function markDone(text, id) {
  const stepRegex = /^[-*] \[([ xX])\] S\d+\.\d+ /;
  const idPattern = new RegExp(`^[-*] \\[([ xX])\\] ${id.replace(/\./g, "\\.")} `);

  const lines = text.split(/(\r?\n)/);
  const result = [];
  let foundPendingStep = false;
  let foundStepId = false;

  for (let i = 0; i < lines.length; i += 2) {
    const line = lines[i];
    const newline = lines[i + 1] || "";

    if (line !== undefined && line.match(stepRegex) && !line.startsWith(" ")) {
      if (line.match(idPattern)) {
        foundStepId = true;
        if (line.includes("[ ]")) {
          result.push(line.replace(/\[ \]/, "[x]"));
          foundPendingStep = true;
        } else {
          result.push(line);
        }
      } else {
        result.push(line);
      }
      result.push(newline);
    } else {
      if (line !== undefined) {
        result.push(line);
        result.push(newline);
      }
    }
  }

  const output = result.join("");
  if (!foundStepId) {
    throw new Error(`unknown step: ${id}`);
  }

  if (!foundPendingStep) {
    return text;
  }

  return output;
}