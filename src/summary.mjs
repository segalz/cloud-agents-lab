export function summary(steps) {
  const total = steps.length;
  const done = steps.filter(s => s.done).length;
  const pending = total - done;
  const percent = total === 0 ? 0 : Math.floor(done * 100 / total);
  return { total, done, pending, percent };
}