import { readFile, writeFile, rename, appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const agentsDir = path.join(root, "agents");
const configPath = path.join(agentsDir, "config.json");
const inboxPath = path.join(agentsDir, "inbox.json");
const livePath = path.join(root, "state.live.json");
const liveTempPath = path.join(root, "state.live.json.tmp");
const logPath = path.join(agentsDir, "runner.log");

const config = JSON.parse(await readFile(configPath, "utf8"));
const now = () => new Date();
const iso = (date) => new Date(date).toISOString();

let state = emptyState();
let busy = false;
let stopped = false;

function emptyState() {
  const start = Date.now();
  return {
    version: 1,
    demo: false,
    updatedAt: iso(start),
    runner: {
      heartbeatAt: iso(start),
      tickSec: config.tickSec,
      ollama: "checking",
      model: config.model,
    },
    agents: config.agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      home: agent.home,
      task: agent.task,
      status: agent.auto ? "idle" : "needs_input",
      summary: agent.auto ? "Waiting for the first local run." : agent.waiting,
      error: "",
      model: config.model,
      lastRunAt: null,
      nextRunAt: agent.auto ? iso(start + (agent.firstDelaySec ?? 0) * 1000) : null,
      runs: 0,
      inputUsed: "",
    })),
  };
}

async function log(line) {
  const text = `${iso(now())} ${line}\n`;
  await mkdir(agentsDir, { recursive: true });
  await appendFile(logPath, text).catch(() => {});
}

async function publish() {
  state.updatedAt = iso(now());
  state.runner.heartbeatAt = state.updatedAt;
  state.runner.tickSec = config.tickSec;
  const body = JSON.stringify(state, null, 2);
  await writeFile(liveTempPath, body);
  await rename(liveTempPath, livePath);
}

function agentRecord(id) {
  return state.agents.find((agent) => agent.id === id);
}

async function readInbox() {
  try {
    const parsed = JSON.parse(await readFile(inboxPath, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function clip(text, max = 280) {
  const clean = String(text || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return "";
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function replyText(raw) {
  const withoutThink = String(raw || "").replace(/<think>[\s\S]*?<\/think>/gi, "\n");
  const lines = withoutThink
    .split(/\n/)
    .map((line) => line.replace(/^[\-*•\d.)\s]+/, "").trim())
    .filter((line) => line && !/^(hmm|okay|ok|the user|i need|i should|let me|first|this seems|alright)\b/i.test(line));
  return clip(lines.slice(-2).join(" "));
}

async function ollama(prompt) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), config.requestTimeoutSec * 1000);
  try {
    const res = await fetch(`${config.ollamaUrl}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: config.model,
        prompt,
        stream: false,
        keep_alive: config.keepAlive,
        options: { temperature: 0.3, num_predict: 160 },
      }),
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = await res.json();
    const text = replyText(data.response);
    if (!text) throw new Error("Ollama returned an empty reply");
    return text;
  } finally {
    clearTimeout(timer);
  }
}

async function pingOllama() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(`${config.ollamaUrl}/api/tags`, { signal: ctrl.signal });
    state.runner.ollama = res.ok ? "up" : "down";
  } catch {
    state.runner.ollama = "down";
  } finally {
    clearTimeout(timer);
  }
}

function due(agent, record) {
  if (!record.nextRunAt) return false;
  return Date.now() >= new Date(record.nextRunAt).getTime();
}

async function runAgent(spec, record, note) {
  busy = true;
  record.status = "working";
  record.error = "";
  record.summary = note ? "Reading the note." : "Thinking.";
  await publish();
  const prompt = `Answer in one or two sentences. No reasoning.\n\n${note ? `${spec.prompt}\n\nNote:\n${note}` : spec.prompt}`;
  try {
    const reply = await ollama(prompt);
    record.status = "idle";
    record.summary = reply;
    record.runs += 1;
    record.lastRunAt = iso(now());
    record.inputUsed = note || "";
    if (spec.auto) record.nextRunAt = iso(Date.now() + spec.everyMin * 60 * 1000);
    else record.nextRunAt = null;
    state.runner.ollama = "up";
    await log(`${spec.id} ok runs=${record.runs}`);
  } catch (err) {
    const timedOut = err.name === "AbortError";
    record.status = "down";
    record.error = clip(timedOut ? "Ollama timed out" : err.message || err, 160);
    record.summary = "This run failed.";
    record.lastRunAt = iso(now());
    if (spec.auto) record.nextRunAt = iso(Date.now() + 5 * 60 * 1000);
    if (timedOut || !String(err.message || "").startsWith("Ollama")) state.runner.ollama = "down";
    await log(`${spec.id} down ${record.error}`);
  } finally {
    busy = false;
    await publish();
  }
}

async function tick() {
  if (stopped || busy) {
    await publish();
    return;
  }
  await pingOllama();
  const inbox = await readInbox();
  for (const spec of config.agents) {
    const record = agentRecord(spec.id);
    if (spec.auto) continue;
    const note = String(inbox[spec.id] || "").trim();
    if (!note) {
      if (record.status !== "working" && record.status !== "down") {
        record.status = "needs_input";
        record.summary = spec.waiting;
      }
      continue;
    }
    if (note !== record.inputUsed && record.status !== "working") {
      await runAgent(spec, record, note);
      return;
    }
  }
  if (state.runner.ollama !== "up") {
    await publish();
    return;
  }
  const next = config.agents
    .filter((spec) => spec.auto && due(spec, agentRecord(spec.id)))
    .sort((a, b) => new Date(agentRecord(a.id).nextRunAt) - new Date(agentRecord(b.id).nextRunAt))[0];
  if (!next) {
    await publish();
    return;
  }
  await runAgent(next, agentRecord(next.id), "");
}

async function main() {
  try {
    const previous = JSON.parse(await readFile(livePath, "utf8"));
    if (previous && Array.isArray(previous.agents)) {
      for (const saved of previous.agents) {
        const record = agentRecord(saved.id);
        if (!record) continue;
        record.runs = saved.runs || 0;
        record.lastRunAt = saved.lastRunAt || null;
        record.summary = saved.summary || record.summary;
        record.inputUsed = saved.inputUsed || "";
        if (saved.status === "down") record.nextRunAt = iso(Date.now());
        else if (saved.nextRunAt) record.nextRunAt = saved.nextRunAt;
      }
    }
  } catch {
    // First launch has no live state yet.
  }
  await publish();
  await log("runner started");
  await tick();
  const timer = setInterval(() => {
    tick().catch(async (err) => {
      await log(`tick failed ${clip(err.message || err, 160)}`);
    });
  }, config.tickSec * 1000);
  const stop = async () => {
    stopped = true;
    clearInterval(timer);
    await log("runner stopped");
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

await main();
