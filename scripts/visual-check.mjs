import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const artifactsDir = resolve(projectRoot, 'qa-artifacts');
const port = process.env.PORT ?? '5175';
const apiPort = process.env.ATEROMANTE_API_PORT ?? '4175';
const apiBaseUrl = process.env.VITE_API_BASE_URL ?? `http://127.0.0.1:${apiPort}`;
const url = `http://127.0.0.1:${port}`;

if (!/^\d{2,5}$/.test(port)) {
  throw new Error(`Invalid PORT value: ${port}`);
}

if (!/^\d{2,5}$/.test(apiPort)) {
  throw new Error(`Invalid ATEROMANTE_API_PORT value: ${apiPort}`);
}

async function waitForServer(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
    }
  }
  throw new Error(`Vite server did not respond at ${url}`);
}

async function stopProcessTree(processRef) {
  if (!processRef.pid || processRef.killed) return;
  const processExit = new Promise((resolveExit) => {
    processRef.once('exit', resolveExit);
  });
  if (process.platform === 'win32') {
    const taskkill = spawn('taskkill', ['/pid', String(processRef.pid), '/T', '/F'], { stdio: 'ignore' });
    await new Promise((resolveKill) => {
      taskkill.once('exit', resolveKill);
      taskkill.once('error', resolveKill);
    });
    await Promise.race([
      processExit,
      new Promise((resolveDelay) => setTimeout(resolveDelay, 2000)),
    ]);
    return;
  }
  processRef.kill('SIGTERM');
  await Promise.race([
    processExit,
    new Promise((resolveDelay) => setTimeout(resolveDelay, 2000)),
  ]);
}

async function main() {
  await mkdir(artifactsDir, { recursive: true });
  const serverOutput = [];

  const command = process.platform === 'win32' ? 'cmd.exe' : 'npm';
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npm run dev:local']
    : ['run', 'dev:local'];
  const server = spawn(command, args, {
    cwd: projectRoot,
    stdio: 'pipe',
    env: {
      ...process.env,
      BROWSER: 'none',
      PORT: port,
      ATEROMANTE_API_PORT: apiPort,
      ATEROMANTE_DB_PATH: ':memory:',
      VITE_API_BASE_URL: apiBaseUrl,
    },
  });
  server.stdout.on('data', (chunk) => serverOutput.push(chunk.toString()));
  server.stderr.on('data', (chunk) => serverOutput.push(chunk.toString()));

  try {
    await waitForServer();
    let browser;
    try {
      browser = await chromium.launch({ channel: 'msedge' });
    } catch {
      try {
        browser = await chromium.launch({ channel: 'chrome' });
      } catch {
        browser = await chromium.launch();
      }
    }
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.screenshot({ path: resolve(artifactsDir, 'desktop.png'), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'networkidle' });
    await page.screenshot({ path: resolve(artifactsDir, 'mobile.png'), fullPage: true });

    await browser.close();
    console.log(`visual_artifacts=${artifactsDir}`);
  } finally {
    await stopProcessTree(server);
    if (serverOutput.length > 0) {
      console.log('vite_output_start');
      console.log(serverOutput.join('').trim());
      console.log('vite_output_end');
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
