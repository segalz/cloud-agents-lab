#!/usr/bin/env node
// Cloud supervisor: runs planning/plan.md steps with OpenCode (writer, openCodeHelperMcp) and
// Cline (reviewer, ClineMcp) on a GitHub Actions runner. Rules: planning/instructions/supervisor.md.
// State lives in git: planning/progress.md, planning/log.md, planning/runs.jsonl (branch agent/work).
import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const env = process.env;
const REPO = path.resolve(env.REPO_DIR || process.cwd());
const BRIDGES = path.resolve(env.BRIDGES_DIR || path.join(os.homedir(), "bridges"));
const LOCK_FILE = env.LOCK_FILE || path.join(REPO, "tests", "LOCKED.sha256");
const MAX_STEPS = Number(env.MAX_STEPS || 1);
const MAX_ATTEMPTS = Number(env.MAX_ATTEMPTS || 2);
const BUDGET_MS = Number(env.TIME_BUDGET_MIN || 60) * 60_000;
const WRITER_MODELS = (env.WRITER_MODELS || "").split(",").map(s => s.trim()).filter(Boolean);
const REVIEWER_PROVIDER = env.REVIEWER_PROVIDER || "nvidia";
const REVIEWER_MODEL = env.REVIEWER_MODEL || "";
const BRANCH = env.WORK_BRANCH || "agent/work";
const PUSH_URL = env.PUSH_TOKEN && env.GITHUB_REPOSITORY
  ? `https://x-access-token:${env.PUSH_TOKEN}@github.com/${env.GITHUB_REPOSITORY}.git` : null;
const RUN_ID = env.GITHUB_RUN_ID || `local-${Date.now()}`;
const RUN_URL = env.GITHUB_RUN_ID ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}` : "local";
const started = Date.now();

// ---------- secrets: known values (read from the runtime auth files) + token patterns ----------
function knownSecrets() {
  const out = [];
  const grab = (file, pick) => { try { const v = pick(JSON.parse(readFileSync(file, "utf8"))); if (v && v.length >= 8) out.push(v); } catch { /* absent */ } };
  grab(path.join(os.homedir(), ".local/share/opencode/auth.json"), j => j?.nvidia?.key);
  grab(path.join(os.homedir(), ".cline/data/settings/providers.json"), j => j?.providers?.nvidia?.settings?.apiKey);
  if (env.PUSH_TOKEN) out.push(env.PUSH_TOKEN);
  return [...new Set(out)];
}
const SECRETS = knownSecrets();
const SECRET_PATTERNS = [/nvapi-[A-Za-z0-9_-]{20,}/, /gh[pousr]_[A-Za-z0-9]{30,}/];
function redact(s) {
  let t = String(s ?? "");
  for (const k of SECRETS) t = t.split(k).join("[REDACTED]");
  for (const p of SECRET_PATTERNS) t = t.replace(new RegExp(p.source, "g"), "[REDACTED]");
  return t;
}

// ---------- shell helpers ----------
function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 32 << 20, ...opts });
}
const git = (...a) => sh("git", a);
const now = () => new Date().toISOString().replace(/\.\d+Z$/, "Z");
const P = f => path.join(REPO, f);
const short = (s, n) => { const t = redact(s).replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n)}…` : t; };

function cleanTree() {
  git("reset", "-q", "--hard", "HEAD");
  git("clean", "-qfd");
}
function changedFiles() {
  return git("status", "--porcelain", "-uall").split("\n").filter(Boolean).map(l => l.slice(3).trim().replace(/^"|"$/g, ""));
}
function push() {
  if (!PUSH_URL) return "skipped (no token)";
  for (let i = 0; i < 3; i++) {
    try { git("push", "-q", PUSH_URL, `HEAD:refs/heads/${BRANCH}`); return "ok"; }
    catch (e) { if (i === 2) return `failed: ${short(e.stderr || e.message, 200)}`; }
  }
}
function commit(message, paths) {
  git("add", "-A", "--", ...paths);
  if (!git("diff", "--cached", "--name-only").trim()) return null;
  const diff = git("diff", "--cached");
  if (SECRETS.some(k => diff.includes(k)) || SECRET_PATTERNS.some(p => p.test(diff))) {
    git("reset", "-q");
    throw new Error("SECRET_IN_DIFF: commit blocked");
  }
  git("commit", "-q", "-m", message);
  return git("rev-parse", "--short", "HEAD").trim();
}

// ---------- planning files ----------
function readProgress() {
  const lines = readFileSync(P("planning/progress.md"), "utf8").split("\n");
  const rows = [];
  lines.forEach((l, i) => {
    if (!/^\|\s*S\d+\.\d+\s*\|/.test(l)) return;
    const c = l.split("|").slice(1, -1).map(s => s.trim());
    rows.push({ line: i, id: c[0], title: c[1], status: c[2], attempts: Number(c[3]) || 0, writer: c[4], reviewer: c[5], commit: c[6], updated: c[7] });
  });
  return { lines, rows };
}
function saveProgress(pr, lastRun) {
  for (const r of pr.rows) {
    pr.lines[r.line] = `| ${r.id} | ${r.title} | ${r.status} | ${r.attempts} | ${r.writer} | ${r.reviewer} | ${r.commit} | ${r.updated} |`;
  }
  if (lastRun) pr.lines = pr.lines.map(l => (l.startsWith("Last run:") ? `Last run: ${lastRun}` : l));
  writeFileSync(P("planning/progress.md"), pr.lines.join("\n"));
}
function stepSpec(id) {
  const plan = readFileSync(P("planning/plan.md"), "utf8").replace(/\r\n/g, "\n");
  const start = plan.search(new RegExp(`^### ${id.replace(".", "\\.")}\\b`, "m"));
  if (start < 0) throw new Error(`no spec for ${id} in planning/plan.md`);
  const rest = plan.slice(start);
  const end = rest.slice(4).search(/^#{2,3} |^---$/m);
  const spec = (end < 0 ? rest : rest.slice(0, end + 4)).trim();
  const verify = spec.match(/^- \*\*Verify:\*\* `node --test ([^`]+)`/m)?.[1];
  const files = [...(spec.match(/^- \*\*Files allowed:\*\* (.+)$/m)?.[1] ?? "").matchAll(/`([^`]+)`/g)].map(m => m[1]);
  if (!verify || !files.length) throw new Error(`spec for ${id} lacks Verify or Files allowed`);
  const header = plan.slice(plan.indexOf("### Step-line format"), plan.indexOf("## Rules for every step")).trim();
  return { spec, verify, files, header };
}
function lockCheck() {
  for (const line of readFileSync(LOCK_FILE, "utf8").trim().split("\n")) {
    const [hash, file] = line.trim().split(/\s+/);
    const p = P(file);
    if (!existsSync(p)) return `missing ${file}`;
    if (createHash("sha256").update(readFileSync(p)).digest("hex") !== hash) return `changed ${file}`;
  }
  return null;
}
function runTests(files) {
  const r = spawnSync(process.execPath, ["--test", ...files], { cwd: REPO, encoding: "utf8", timeout: 180_000 });
  const out = `${r.stdout || ""}${r.stderr || ""}`;
  const num = k => Number(out.match(new RegExp(`^# ${k} (\\d+)`, "m"))?.[1] ?? 0);
  const failing = [...out.matchAll(/^not ok \d+ - (.+)$/gm)].map(m => m[1]).slice(0, 8);
  return { ok: r.status === 0, pass: num("pass"), fail: num("fail"), failing, tail: redact(out.split("\n").slice(-40).join("\n")) };
}

// ---------- log ----------
function mdEntry(e) {
  if (e.type === "run_start") {
    return `\n## ${e.time} · run [${e.run}](${e.url}) started\n- max steps ${e.maxSteps}, max attempts ${e.maxAttempts}, budget ${e.budgetMin} min\n- writer models: ${e.writerModels.map(m => `\`${m}\``).join(", ")}${e.writerModelsMissing?.length ? ` (not in the free list: ${e.writerModelsMissing.join(", ")})` : ""}\n- reviewer: \`${e.reviewer}\` · ping ${e.reviewerPing}\n- setup to first step: ${e.setupNote}\n`;
  }
  if (e.type === "run_end") {
    return `\n### ${e.time} · run ${e.run} ended · ${e.result}\n- steps done this run: ${e.stepsDone} · elapsed ${e.elapsedS}s\n${e.note ? `- note: ${e.note}\n` : ""}`;
  }
  const w = e.writer || {};
  const lines = [`\n### ${e.time} · ${e.step} · attempt ${e.attempt} · **${e.result}**`];
  if (w.model) lines.push(`- writer: \`${w.model}\` · ${w.seconds}s · bridge status ${w.status} · bridge check ${w.passed} · fix runs ${w.fixRuns} · restored ${w.restored}${w.limitKind ? ` · limit ${w.limitKind}` : ""}${w.tokens ? ` · tokens ${w.tokens}` : ""}`);
  if (e.carried) lines.push(`- carried feedback into this attempt: ${e.carried}`);
  if (w.summary) lines.push(`- writer said: ${w.summary}`);
  if (e.lock) lines.push(`- locked tests: ${e.lock}`);
  if (e.scope) lines.push(`- scope: ${e.scope}`);
  if (e.check) lines.push(`- independent check: ${e.check.pass}/${e.check.pass + e.check.fail} passed${e.check.rerun ? " (after one flaky re-run)" : ""}${e.check.failing?.length ? ` · failing: ${e.check.failing.join("; ")}` : ""}`);
  if (e.review) lines.push(`- reviewer: \`${e.review.model}\` · ${e.review.seconds}s · ${e.review.verdict}${e.review.notes ? ` — ${e.review.notes}` : ""}`);
  if (e.commit) lines.push(`- commit: \`${e.commit}\``);
  if (e.note) lines.push(`- note: ${e.note}`);
  return `${lines.join("\n")}\n`;
}
function log(entry) {
  const e = JSON.parse(redact(JSON.stringify(entry)));
  appendFileSync(P("planning/runs.jsonl"), `${JSON.stringify(e)}\n`);
  appendFileSync(P("planning/log.md"), mdEntry(e));
  console.log(mdEntry(e).trim());
}
function saveState(message) {
  const sha = commit(message, ["planning/progress.md", "planning/log.md", "planning/runs.jsonl"]);
  return sha ? push() : "nothing to commit";
}

// ---------- MCP bridges ----------
function childEnv() {
  const e = {};
  for (const [k, v] of Object.entries(env)) if (!/TOKEN|KEY|SECRET|PASSWORD/i.test(k)) e[k] = v;
  return { ...e, OPENCODE_HELPER_ALLOWED_ROOTS: path.dirname(REPO), OPENCODE_HELPER_SERVE: "0" };
}
async function connect(name, entry) {
  const transport = new StdioClientTransport({ command: process.execPath, args: [entry], cwd: path.dirname(path.dirname(entry)), env: childEnv(), stderr: "inherit" });
  const client = new Client({ name: `cloud-supervisor-${name}`, version: "1.0.0" });
  await client.connect(transport);
  return client;
}
async function callTool(client, name, args, timeoutMs) {
  const t0 = Date.now();
  try {
    const r = await client.callTool({ name, arguments: args }, undefined, { timeout: timeoutMs, onprogress: () => {}, resetTimeoutOnProgress: true, maxTotalTimeout: timeoutMs + 60_000 });
    const text = (r.content ?? []).map(c => c.text ?? "").join("\n");
    return { ok: !r.isError, text, seconds: Math.round((Date.now() - t0) / 1000) };
  } catch (err) {
    return { ok: false, text: String(err?.message ?? err), seconds: Math.round((Date.now() - t0) / 1000) };
  }
}
function jsonIn(text) {
  try { return JSON.parse(text); } catch { /* fall through */ }
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(text.slice(a, b + 1)); } catch { /* not json */ } }
  return null;
}
function parseWriter(res) {
  const j = jsonIn(res.text) || {};
  const v = j.verification || {};
  const flag = k => (typeof v[k] === "boolean" ? v[k] : (res.text.match(new RegExp(`"${k}"\\s*:\\s*(true|false)`))?.[1] === "true"));
  const limitKind = j.limitKind || res.text.match(/"limitKind"\s*:\s*"([a-z_]+)"/)?.[1]
    || (/\b(quota|rate.?limit|429|too many requests)\b/i.test(res.text) && !v.passed ? "rate_limit?" : null);
  const u = j.usage || {};
  return {
    status: j.status || (res.ok ? "ok" : "error"), passed: flag("passed"), fixRuns: v.fixRuns ?? "?", restored: flag("restored"),
    limitKind, tokens: u.inputTokens ? `${u.inputTokens}/${u.outputTokens ?? 0}` : null,
    summary: short(j.text || j.message || j.error || res.text, 300),
  };
}
function parseReview(res) {
  const j = jsonIn(res.text);
  const body = (j && typeof j.text === "string") ? j.text : res.text;
  // The Cline bridge returns Cline's own submission text, so the requested first line is often
  // reworded ("Submission recorded (verified): REJECT. ..."). Prefer "VERDICT: X", else the first bare word.
  const m = body.match(/VERDICT:\s*\**\s*(APPROVE|REJECT)/i) || body.match(/\b(APPROVE|REJECT)\b/);
  return { verdict: m ? m[1].toUpperCase() : null, body: redact(body) };
}

// Feedback that survives between runs: an owner note (planning/notes/<id>.md) plus the last
// attempt's feedback or reviewer REJECT for this step from planning/runs.jsonl.
function carriedFeedback(id) {
  const parts = [];
  const note = P(`planning/notes/${id}.md`);
  if (existsSync(note)) parts.push(`Note from the owner:\n${readFileSync(note, "utf8").trim()}`);
  let last = null;
  try {
    for (const l of readFileSync(P("planning/runs.jsonl"), "utf8").split("\n")) {
      if (!l.trim()) continue;
      const j = JSON.parse(l);
      if (j.type === "attempt" && j.step === id && j.writer) last = j;
    }
  } catch { /* no history */ }
  if (last) {
    const body = last.review?.full || last.review?.notes || "";
    if (last.feedback) parts.push(`From the previous attempt (run ${last.run}, ${last.result}):\n${last.feedback}`);
    else if (/\bREJECT\b/.test(body) && !/VERDICT:\s*\**\s*APPROVE/i.test(body)) parts.push(`The reviewer of the previous attempt (run ${last.run}) reported:\n${body}`);
  }
  if (!parts.length) return "";
  return `${parts.join("\n\n")}\n\nCode from a previous attempt may already exist in the allowed files: fix it rather than assuming it is correct.`.slice(0, 5000);
}

// ---------- one step ----------
async function runStep(writer, reviewer, pr, row) {
  const { spec, verify, files, header } = stepSpec(row.id);
  const earlierTests = pr.rows.filter(r => r.status === "done").map(r => stepSpec(r.id).verify);
  const writerRules = readFileSync(P("planning/instructions/writer.md"), "utf8");
  const reviewerRules = readFileSync(P("planning/instructions/reviewer.md"), "utf8");
  row.status = "in_progress"; row.updated = now();
  saveProgress(pr); saveState(`progress: ${row.id} started (run ${RUN_ID})`);

  let feedback = carriedFeedback(row.id);
  let carried = feedback ? `${feedback.length} chars (owner note${existsSync(P(`planning/notes/${row.id}.md`)) ? "" : " none"}, history)` : null;
  let modelIdx = 0;
  let failedAttempts = 0;
  while (failedAttempts < MAX_ATTEMPTS) {
    if (Date.now() - started > BUDGET_MS - 12 * 60_000) {
      log({ type: "attempt", time: now(), run: RUN_ID, step: row.id, attempt: row.attempts + 1, result: "stopped_budget", note: "time budget nearly used; step stays in_progress for the next run" });
      saveState(`log: ${row.id} stopped on budget`);
      return "budget";
    }
    const model = WRITER_MODELS[modelIdx];
    const e = { type: "attempt", time: now(), run: RUN_ID, step: row.id, attempt: row.attempts + 1 };
    if (carried) { e.carried = carried; carried = null; }
    if (!model) {
      e.result = "no_model_left"; e.note = "every writer model hit a quota or rate limit";
      log(e); break;
    }
    const prompt = `${writerRules}\n\n## Shared format (from planning/plan.md)\n\n${header}\n\n## Step\n\n${spec}${feedback ? `\n\n## Feedback from the previous attempt (fix every point)\n\n${feedback}` : ""}\n`;
    const res = await callTool(writer, "apply_opencode_edits", {
      directory: REPO, prompt, model, maxFixRuns: 2, budgetMs: 540_000,
      verify: { command: "node", args: ["--test", verify], timeoutSeconds: 120 },
    }, 600_000);
    const w = { model, seconds: res.seconds, ...parseWriter(res) };
    e.writer = w;
    if (w.limitKind && !w.passed) {
      e.result = "model_limit"; e.note = `moving to the next writer model (not counted as an attempt)`;
      cleanTree(); log(e); saveState(`log: ${row.id} model limit`); modelIdx++; continue;
    }
    row.attempts++;
    const fail = (result, why, fb) => {
      e.result = result; e.note = why; feedback = fb; e.feedback = fb.slice(0, 3000); failedAttempts++;
      cleanTree(); row.updated = now(); saveProgress(pr); log(e); saveState(`log: ${row.id} attempt ${e.attempt} ${result}`);
    };
    const lock = lockCheck();
    e.lock = lock ? `VIOLATION ${lock}` : "ok";
    if (lock) { fail("rejected_locked_tests", lock, `You changed a locked test (${lock}). Never edit anything under tests/.`); continue; }
    const changed = changedFiles();
    const outside = changed.filter(f => !files.includes(f));
    e.scope = outside.length ? `out of scope: ${outside.join(", ")}` : `ok (${changed.join(", ") || "no changes"})`;
    if (outside.length) { fail("rejected_scope", e.scope, `You changed files outside "Files allowed": ${outside.join(", ")}. Change only: ${files.join(", ")}.`); continue; }
    let check = runTests([...earlierTests, verify]);
    if (!check.ok) { const again = runTests([...earlierTests, verify]); if (again.ok) check = { ...again, rerun: true }; }
    e.check = { pass: check.pass, fail: check.fail, failing: check.failing, rerun: !!check.rerun };
    // A re-opened step may already hold correct code: "no changes + tests pass" goes to review as-is.
    const unchanged = !changed.length;
    if (unchanged && !check.ok) { fail("no_changes", "writer changed nothing and the tests fail", `No file was changed, and the tests fail. Implement the step in: ${files.join(", ")}.\nFailing: ${check.failing.join("; ")}`); continue; }
    if (!check.ok) { fail("rejected_tests", "independent check failed", `The tests failed. Failing: ${check.failing.join("; ")}\n\nOutput tail:\n${check.tail}`); continue; }

    let sha;
    if (unchanged) {
      sha = git("rev-parse", "--short", "HEAD").trim();
      e.note = "writer kept the existing code (no changes); reviewing the files as they are";
    } else {
      try { sha = commit(`${row.id}: ${row.title} (writer ${model}, run ${RUN_ID})`, files); }
      catch (err) { fail("blocked_secret", String(err.message), "Your change contained a secret-like value. Never write keys or tokens."); continue; }
    }
    e.commit = sha;

    const diff = unchanged
      ? redact(files.filter(f => existsSync(P(f))).map(f => `--- ${f} (current content, unchanged by this attempt)\n${readFileSync(P(f), "utf8")}`).join("\n\n")).slice(0, 14_000)
      : redact(git("show", "--stat", "--patch", "HEAD")).slice(0, 14_000);
    const reviewArgs = {
      cwd: REPO, provider: REVIEWER_PROVIDER, model: REVIEWER_MODEL, thinking: "high", timeoutSeconds: 280,
      prompt: `${reviewerRules}\n\n## Shared format (from planning/plan.md)\n\n${header}\n\n## Step\n\n${spec}\n\n## HEAD commit ${sha}\n\n\`\`\`diff\n${diff}\n\`\`\`\n`,
    };
    let rv = await callTool(reviewer, "ask_cline_workspace", reviewArgs, 330_000);
    let review = parseReview(rv);
    let reviewTries = 1;
    if (!review.verdict) { // one more try before giving up on the review
      rv = await callTool(reviewer, "ask_cline_workspace", reviewArgs, 330_000);
      review = parseReview(rv); reviewTries = 2;
    }
    e.review = { model: `${REVIEWER_PROVIDER}/${REVIEWER_MODEL}`, seconds: rv.seconds, tries: reviewTries, verdict: review.verdict || (rv.ok ? "no verdict" : "unavailable"), notes: short(review.body, 400), full: review.body.slice(0, 3000) };
    if (!review.verdict) {
      // Never accept unreviewed work: keep the candidate commit and stop for a human.
      e.result = "needs_review"; e.note = "reviewer gave no verdict twice; candidate kept on the branch, a human must review it";
      row.status = "needs_review"; row.writer = model; row.commit = sha; row.reviewer = e.review.verdict; row.updated = now();
      saveProgress(pr); log(e); saveState(`progress: ${row.id} needs human review (run ${RUN_ID})`);
      return "needs_review";
    }
    if (review.verdict === "REJECT") {
      if (!unchanged) { git("reset", "-q", "--hard", "HEAD~1"); e.commit = `${sha} (undone)`; }
      fail("rejected_review", "reviewer rejected", `The reviewer rejected the change:\n${review.body.slice(0, 3000)}`);
      continue;
    }
    e.result = "done";
    row.status = "done"; row.writer = model; row.commit = sha; row.updated = now();
    row.reviewer = "approve";
    saveProgress(pr); log(e);
    e.push = saveState(`progress: ${row.id} done (run ${RUN_ID})`);
    return "done";
  }
  row.status = "failed"; row.updated = now();
  saveProgress(pr); saveState(`progress: ${row.id} failed (run ${RUN_ID})`);
  return "failed";
}

// ---------- main ----------
async function main() {
  git("config", "core.autocrlf", "false");
  if (!WRITER_MODELS.length || !REVIEWER_MODEL) throw new Error("WRITER_MODELS and REVIEWER_MODEL are required");
  const writer = await connect("opencode", path.join(BRIDGES, "openCodeHelperMcp", "src", "index.js"));
  const reviewer = await connect("cline", path.join(BRIDGES, "ClineMcp", "dist", "index.js"));

  const listed = await callTool(writer, "list_free_models", {}, 120_000);
  const freeIds = new Set([...listed.text.matchAll(/"id":\s*"([^"]+)"/g)].map(m => m[1]));
  const missing = WRITER_MODELS.filter(m => freeIds.size && !freeIds.has(m));
  const ping = await callTool(reviewer, "cline_ping", { provider: REVIEWER_PROVIDER, model: REVIEWER_MODEL }, 180_000);
  log({
    type: "run_start", time: now(), run: RUN_ID, url: RUN_URL, maxSteps: MAX_STEPS, maxAttempts: MAX_ATTEMPTS, budgetMin: BUDGET_MS / 60_000,
    writerModels: WRITER_MODELS, writerModelsMissing: missing, freeModelCount: freeIds.size,
    reviewer: `${REVIEWER_PROVIDER}/${REVIEWER_MODEL}`, reviewerPing: ping.ok ? `ok (${ping.seconds}s)` : `FAILED: ${short(ping.text, 200)}`,
    setupNote: `${Math.round((Date.now() - started) / 1000)}s inside the supervisor (job setup time is in the Actions log)`,
  });
  saveState(`log: run ${RUN_ID} started`);

  let done = 0, result = "max_steps_reached";
  while (done < MAX_STEPS) {
    const pr = readProgress();
    const row = pr.rows.find(r => r.status === "pending" || r.status === "in_progress");
    if (!row) { result = "all_steps_done"; break; }
    const out = await runStep(writer, reviewer, pr, row);
    if (out !== "done") { result = out === "budget" ? "stopped_budget" : out === "needs_review" ? `needs_review ${row.id}` : `step_failed ${row.id}`; break; }
    done++;
  }
  const prFinal = readProgress();
  const total = prFinal.rows.length, finished = prFinal.rows.filter(r => r.status === "done").length;
  saveProgress(prFinal, `${now()} · run [${RUN_ID}](${RUN_URL}) · ${result} · ${finished}/${total} steps done`);
  log({ type: "run_end", time: now(), run: RUN_ID, result, stepsDone: done, elapsedS: Math.round((Date.now() - started) / 1000) });
  const pushed = saveState(`log: run ${RUN_ID} ended (${result})`);
  if (env.GITHUB_STEP_SUMMARY) {
    appendFileSync(env.GITHUB_STEP_SUMMARY, `## Supervisor: ${result}\n\n${finished}/${total} steps done. Push: ${pushed}.\n\n${readFileSync(P("planning/progress.md"), "utf8").split("\n").filter(l => l.startsWith("|")).join("\n")}\n`);
  }
  await writer.close().catch(() => {});
  await reviewer.close().catch(() => {});
  process.exit(result.startsWith("step_failed") || result.startsWith("needs_review") ? 1 : 0);
}

main().catch(err => {
  console.error("SUPERVISOR CRASH:", redact(err?.stack || err));
  try { log({ type: "run_end", time: now(), run: RUN_ID, result: "crash", stepsDone: 0, elapsedS: Math.round((Date.now() - started) / 1000), note: short(err?.message || err, 300) }); saveState(`log: run ${RUN_ID} crashed`); } catch { /* best effort */ }
  process.exit(2);
});
