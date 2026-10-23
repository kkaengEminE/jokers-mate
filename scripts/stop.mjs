const port = Number(process.env.JOKERS_PORT ?? 5173);
try {
  const res = await fetch(`http://127.0.0.1:${port}/health`, {
    signal: AbortSignal.timeout(1000),
  });
  const data = await res.json();
  if (!["jokers-mate", "jokers-gambit"].includes(data.app) || !Number.isInteger(data.pid))
    throw Error();
  process.kill(data.pid, "SIGTERM");
  console.log("게임 서버를 종료했습니다. 저장된 게임은 유지됩니다.");
} catch {
  console.log("실행 중인 Joker’s Mate 서버를 찾지 못했습니다.");
}
