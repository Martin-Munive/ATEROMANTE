import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const artifactsDir = resolve(projectRoot, 'qa-artifacts');
const port = process.env.PORT ?? '5174';
const apiPort = process.env.ATEROMANTE_API_PORT ?? '4174';
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
      ATEROMANTE_API_PORT: apiPort,
      ATEROMANTE_DB_PATH: ':memory:',
      VITE_API_BASE_URL: apiBaseUrl,
    },
  });
  server.stdout.on('data', (chunk) => serverOutput.push(chunk.toString()));
  server.stderr.on('data', (chunk) => serverOutput.push(chunk.toString()));

  try {
    await waitForServer();
    const browser = await launchBrowser();
    const context = await browser.newContext({
      acceptDownloads: true,
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
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
    const tutorResponsePromise = page.waitForResponse((response) => (
      response.url().includes('/api/games/')
      && response.url().includes('/tutor/explain')
      && response.status() === 201
    ));
    await page.getByRole('button', { name: /Explicar/ }).click();
    await tutorResponsePromise;
    await page.getByText('pista breve', { exact: false }).waitFor();
    await page.getByRole('button', { name: 'Guardar aprendizaje' }).click();
    await page.getByText('Memoria').waitFor();
    await page.getByText('Repasos').waitFor();
    await page.getByText('position-recall · nuevo · pendiente', { exact: false }).waitFor();
    await page.getByText('Ejercicio dirigido', { exact: false }).waitFor();
    await page.getByLabel(/Respuesta de repaso/i).fill('Recorde el centro antes de calificar el repaso.');
    await page.getByRole('button', { name: 'Fácil' }).click();
    await page.getByText('estable · Fácil', { exact: false }).waitFor();
    await page.getByText('Respuesta alineada', { exact: false }).waitFor();
    await page.getByLabel('Buscar aprendizaje').fill('centro');
    await page.getByRole('button', { name: 'Buscar' }).click();
    await page.locator('.trace-results').getByText('centro', { exact: false }).waitFor();
    await page.locator('.trace-results').getByText('foco de tutor', { exact: false }).waitFor();
    await page.screenshot({ path: resolve(artifactsDir, 'interaction-e2e4.png'), fullPage: true });

    const importedFen = '8/8/8/8/8/8/4K3/7k w - - 0 1';
    await page.getByRole('textbox', { name: 'Posición FEN' }).fill(importedFen);
    await page.getByRole('button', { name: 'Abrir posición' }).click();
    await page.getByText('Blancas juegan', { exact: true }).waitFor();
    await page.getByRole('main').getByText(importedFen, { exact: true }).waitFor();
    await page.getByRole('main').getByText('0 jugadas', { exact: true }).waitFor();
    await page.screenshot({ path: resolve(artifactsDir, 'interaction-fen-import.png'), fullPage: true });

    const importedPgn = [
      '[Event "Training Match"]',
      '[Site "Bogota"]',
      '[White "Alice"]',
      '[Black "Bob"]',
      '[Result "*"]',
      '',
      '1. e4! {Claims central space.} e5 (1... c5 (1... e6) 2. Nf3) 2. Nf3 $1 Nc6 3. Bb5 a6',
    ].join('\n');
    const importedPgnPath = resolve(artifactsDir, 'training-match.pgn');
    await writeFile(importedPgnPath, importedPgn, 'utf8');
    await page.getByLabel('Archivo PGN').setInputFiles(importedPgnPath);
    await page.getByText('Blancas juegan', { exact: true }).waitFor();
    await page.getByRole('main').getByText('6 jugadas', { exact: true }).waitFor();
    await page.getByText('3. Bb5 a6', { exact: false }).waitFor();
    await page.getByText('Alice', { exact: true }).waitFor();
    await page.getByText('Bob', { exact: true }).waitFor();
    await page.getByText('Training Match', { exact: true }).waitFor();
    await page.getByText('Claims central space.', { exact: false }).waitFor();
    await page.getByText('NAG $1', { exact: false }).first().waitFor();
    await page.getByText('c5 Nf3', { exact: false }).waitFor();
    await page.getByText('e6', { exact: true }).waitFor();
    await page.getByText('training-match.pgn', { exact: true }).waitFor();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar' }).click();
    const download = await downloadPromise;
    const exportedPgnPath = resolve(artifactsDir, 'interaction-exported-training-match.pgn');
    await download.saveAs(exportedPgnPath);
    const exportedPgn = await readFile(exportedPgnPath, 'utf8');
    const expectedExportTokens = [
      '[Event "Training Match"]',
      '{Claims central space.}',
      '$1',
      'c5',
      'e6',
      '2. Nf3',
    ];
    const missingExportTokens = expectedExportTokens.filter((token) => !exportedPgn.includes(token));
    if (missingExportTokens.length > 0) {
      throw new Error(`PGN export missing expected tokens: ${missingExportTokens.join(', ')}`);
    }
    if (exportedPgn.includes(importedPgnPath)) {
      throw new Error('PGN export leaked the local import path.');
    }
    await page.getByRole('button', { name: /PGN 1\.1.*c5 Nf3/ }).click();
    await page.getByText('Variante PGN', { exact: true }).waitFor();
    await page.getByText('0/2', { exact: true }).first().waitFor();
    await page.getByRole('button', { name: 'Avanzar variante' }).click();
    await page.getByText('1/2', { exact: true }).first().waitFor();
    await page.getByText('c5', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Promover variante a línea principal' }).click();
    await page.getByRole('main').getByText('3 jugadas', { exact: true }).waitFor();
    await page.getByText('Training Match - promoted variation 0', { exact: true }).waitFor();
    await page.getByText('2. Nf3', { exact: false }).waitFor();
    await page.screenshot({ path: resolve(artifactsDir, 'interaction-pgn-import.png'), fullPage: true });

    if (consoleErrors.length > 0) {
      throw new Error(`Console errors detected: ${consoleErrors.join(' | ')}`);
    }

    await browser.close();
    console.log(`interaction_artifact=${resolve(artifactsDir, 'interaction-e2e4.png')}`);
    console.log(`fen_import_artifact=${resolve(artifactsDir, 'interaction-fen-import.png')}`);
    console.log(`pgn_import_artifact=${resolve(artifactsDir, 'interaction-pgn-import.png')}`);
    console.log(`pgn_export_artifact=${resolve(artifactsDir, 'interaction-exported-training-match.pgn')}`);
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
