#!/usr/bin/env node

const { execSync } = require('child_process');

const rawPort = process.argv[2] || process.env.PORT || '5000';
const port = String(rawPort).trim();

if (!/^\d+$/.test(port)) {
  console.error(`Invalid port: ${rawPort}`);
  process.exit(1);
}

try {
  const pidsOutput = execSync(`lsof -ti :${port}`, { stdio: ['ignore', 'pipe', 'ignore'] })
    .toString()
    .trim();

  if (!pidsOutput) {
    console.log(`ℹ️  Port ${port} already free`);
    process.exit(0);
  }

  const pids = pidsOutput
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean);

  if (!pids.length) {
    console.log(`ℹ️  Port ${port} already free`);
    process.exit(0);
  }

  for (const pid of pids) {
    try {
      process.kill(Number(pid), 'SIGTERM');
      console.log(`🛑 Stopped process ${pid} on port ${port}`);
    } catch (error) {
      console.warn(`⚠️  Could not stop process ${pid}: ${error.message}`);
    }
  }

  console.log(`✅ Port ${port} is ready`);
} catch {
  console.log(`ℹ️  Port ${port} already free`);
}
