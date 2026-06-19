import { spawn } from 'node:child_process';

const vitePort = process.env.PORT ?? '5173';
const apiPort = process.env.ATEROMANTE_API_PORT ?? '4174';

function spawnProcess(command, args) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      ATEROMANTE_API_PORT: apiPort,
      VITE_API_BASE_URL: `http://127.0.0.1:${apiPort}`,
    },
  });
  return child;
}

function stopProcessTree(processRef) {
  if (!processRef.pid || processRef.killed) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(processRef.pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  processRef.kill('SIGTERM');
}

const api = spawnProcess('node', ['local/api/server.mjs']);
const viteCommand = process.platform === 'win32' ? 'cmd.exe' : 'npm';
const viteArgs = process.platform === 'win32'
  ? ['/d', '/s', '/c', `npm run dev -- --port ${vitePort}`]
  : ['run', 'dev', '--', '--port', vitePort];
const vite = spawnProcess(viteCommand, viteArgs);

function shutdown() {
  stopProcessTree(vite);
  stopProcessTree(api);
}

process.on('SIGINT', () => {
  shutdown();
  process.exit(130);
});
process.on('SIGTERM', () => {
  shutdown();
  process.exit(143);
});

api.on('exit', (code) => {
  if (code && code !== 0) {
    shutdown();
    process.exit(code);
  }
});

vite.on('exit', (code) => {
  if (code && code !== 0) {
    shutdown();
    process.exit(code);
  }
});
