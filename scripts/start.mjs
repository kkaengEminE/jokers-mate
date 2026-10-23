import { spawn } from "node:child_process";
import { mkdir, open, access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.JOKERS_PORT ?? 5173),
  url = `http://127.0.0.1:${port}`;
async function health() {
  try {
    const res = await fetch(url + "/health", {
      signal: AbortSignal.timeout(800),
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}
const existing = await health();
if (["jokers-mate", "jokers-gambit"].includes(existing?.app)) {
  console.log(`게임이 실행 중입니다: ${url}/`);
  process.exit(0);
}
try {
  await access(resolve(root, "dist/index.html"));
} catch {
  console.error("먼저 npm run build를 실행하세요.");
  process.exit(1);
}
await mkdir(resolve(root, ".local"), { recursive: true });
const log = await open(resolve(root, ".local/server.log"), "a");
const child = spawn(process.execPath, [resolve(root, "scripts/serve.mjs")], {
  cwd: root,
  detached: true,
  stdio: ["ignore", log.fd, log.fd],
  env: process.env,
});
child.unref();
await log.close();
for (let i = 0; i < 30; i++) {
  const state = await health();
  if (["jokers-mate", "jokers-gambit"].includes(state?.app)) {
    console.log(`게임 실행 완료: ${url}/\n종료: npm run stop`);
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 150));
}
console.error(
  "게임 서버를 시작하지 못했습니다. 포트 사용 여부와 .local/server.log를 확인하세요.",
);
process.exit(1);
