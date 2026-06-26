import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const artifactsDir = resolve(projectRoot, 'qa-artifacts');
const port = process.env.PORT ?? '5174';
const url = `http://127.0.0.1:${port}`;

if (!/^\d{2,5}$/.test(port)) {
  throw new Error(`Invalid PORT value: ${port}`);
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

function stopProcessTree(processRef) {
  if (!processRef.pid || processRef.killed) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(processRef.pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  processRef.kill('SIGTERM');
}

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: 'msedge' });
  } catch {
    try {
      return await chromium.launch({ channel: 'chrome' });
    } catch {
      return chromium.launch();
    }
  }
}

async function main() {
  await mkdir(artifactsDir, { recursive: true });
  const serverOutput = [];

  const command = process.platform === 'win32' ? 'cmd.exe' : 'npm';
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', `npm run dev:local`]
    : ['run', 'dev:local'];
  const server = spawn(command, args, {
    cwd: projectRoot,
    stdio: 'pipe',
    env: {
      ...process.env,
      BROWSER: 'none',
      PORT: port,
      ATEROMANTE_API_PORT: '4174',
      ATEROMANTE_DB_PATH: ':memory:',
      VITE_API_BASE_URL: 'http://127.0.0.1:4174',
    },
  });
  server.stdout.on('data', (chunk) => serverOutput.push(chunk.toString()));
  server.stderr.on('data', (chunk) => serverOutput.push(chunk.toString()));

  try {
    await waitForServer();
    const browser = await launchBrowser();
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const consoleErrors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') {
        const text = message.text();
        if (!text.includes('favicon.ico') && !text.includes('404')) {
          consoleErrors.push(text);
        }
      }
    });
    page.on('response', (response) => {
      if (response.status() >= 500) {
        consoleErrors.push(`HTTP ${response.status()} ${response.url()}`);
      }
    });

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Casilla e2 ♙').click();
    await page.getByLabel('Casilla e4').click();

    await page.getByText('Negras juegan', { exact: true }).waitFor();
    await page.getByText('1. e4', { exact: false }).waitFor();
    await page.getByText('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', { exact: true }).waitFor();
    await page.screenshot({ path: resolve(artifactsDir, 'interaction-e2e4.png'), fullPage: true });

    const importedFen = '8/8/8/8/8/8/4K3/7k w - - 0 1';
    await page.getByRole('textbox', { name: 'Posición FEN' }).fill(importedFen);
    await page.getByRole('button', { name: 'Abrir posición' }).click();
    await page.getByText('Blancas juegan', { exact: true }).waitFor();
    await page.getByText(importedFen, { exact: true }).waitFor();
    await page.getByRole('main').getByText('0 jugadas', { exact: true }).waitFor();
    await page.screenshot({ path: resolve(artifactsDir, 'interaction-fen-import.png'), fullPage: true });

    const importedPgn = [
      '[Event "Training Match"]',
      '[Site "Bogota"]',
      '[White "Alice"]',
      '[Black "Bob"]',
      '[Result "*"]',
      '',
      '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6',
    ].join('\n');
    await page.getByRole('textbox', { name: 'Partida PGN' }).fill(importedPgn);
    await page.getByRole('button', { name: 'Abrir PGN' }).click();
    await page.getByText('Blancas juegan', { exact: true }).waitFor();
    await page.getByRole('main').getByText('6 jugadas', { exact: true }).waitFor();
    await page.getByText('3. Bb5 a6', { exact: false }).waitFor();
    await page.getByText('Alice', { exact: true }).waitFor();
    await page.getByText('Bob', { exact: true }).waitFor();
    await page.getByText('Training Match', { exact: true }).waitFor();
    await page.screenshot({ path: resolve(artifactsDir, 'interaction-pgn-import.png'), fullPage: true });

    if (consoleErrors.length > 0) {
      throw new Error(`Console errors detected: ${consoleErrors.join(' | ')}`);
    }

    await browser.close();
    console.log(`interaction_artifact=${resolve(artifactsDir, 'interaction-e2e4.png')}`);
    console.log(`fen_import_artifact=${resolve(artifactsDir, 'interaction-fen-import.png')}`);
    console.log(`pgn_import_artifact=${resolve(artifactsDir, 'interaction-pgn-import.png')}`);
  } finally {
    stopProcessTree(server);
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
