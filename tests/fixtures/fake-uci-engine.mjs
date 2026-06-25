import { createInterface } from 'node:readline';

const lines = createInterface({ input: process.stdin });

lines.on('line', (line) => {
  if (line === 'uci') {
    process.stdout.write('id name Ateromante Test Engine\nuciok\n');
    return;
  }
  if (line === 'isready') {
    process.stdout.write('readyok\n');
    return;
  }
  if (line.startsWith('go depth ')) {
    const depth = line.slice('go depth '.length);
    process.stdout.write(`info depth ${depth} multipv 1 score cp 34 pv e2e4 e7e5 g1f3\n`);
    process.stdout.write('bestmove e2e4\n');
  }
});
