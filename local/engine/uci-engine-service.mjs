import { spawn } from 'node:child_process';
import { Chess } from 'chess.js';

const DEFAULT_DEPTH = 12;
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_DEPTH = 24;
const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export class UciEngineUnavailableError extends Error {
  constructor(message = 'UCI engine is not available') {
    super(message);
    this.name = 'UciEngineUnavailableError';
  }
}

export class UciEngineInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UciEngineInputError';
  }
}

export class UciEngineProtocolError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UciEngineProtocolError';
  }
}

function boundedInteger(value, fallback, minimum, maximum, label) {
  const parsed = value === undefined ? Number(fallback) : Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new UciEngineInputError(`${label} must be between ${minimum} and ${maximum}`);
  }
  return parsed;
}

function validateFen(fen) {
  if (typeof fen !== 'string' || fen.includes('\n') || fen.includes('\r')) {
    throw new UciEngineInputError('FEN must be a single line');
  }

  try {
    return new Chess(fen).fen();
  } catch {
    throw new UciEngineInputError('FEN is not a valid chess position');
  }
}

function parseInfoLine(line) {
  const tokens = line.trim().split(/\s+/);
  if (tokens[0] !== 'info') {
    return null;
  }

  const depthIndex = tokens.indexOf('depth');
  const scoreIndex = tokens.indexOf('score');
  const multipvIndex = tokens.indexOf('multipv');
  const pvIndex = tokens.indexOf('pv');
  const scoreType = scoreIndex >= 0 ? tokens[scoreIndex + 1] : null;
  const scoreValue = scoreIndex >= 0 ? Number.parseInt(tokens[scoreIndex + 2], 10) : null;

  const parsed = {
    depth: depthIndex >= 0 ? Number.parseInt(tokens[depthIndex + 1], 10) : null,
    multipv: multipvIndex >= 0 ? Number.parseInt(tokens[multipvIndex + 1], 10) : 1,
    scoreCp: scoreType === 'cp' && Number.isInteger(scoreValue) ? scoreValue : null,
    scoreMate: scoreType === 'mate' && Number.isInteger(scoreValue) ? scoreValue : null,
    principalVariation: pvIndex >= 0 ? tokens.slice(pvIndex + 1) : [],
  };

  return parsed.depth !== null || parsed.scoreCp !== null || parsed.scoreMate !== null
    || parsed.principalVariation.length > 0
    ? parsed
    : null;
}

export class UciEngineService {
  constructor({
    command = process.env.ATEROMANTE_UCI_ENGINE_PATH || 'stockfish',
    args = [],
    defaultDepth = process.env.ATEROMANTE_UCI_DEPTH ?? DEFAULT_DEPTH,
    timeoutMs = process.env.ATEROMANTE_UCI_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS,
  } = {}) {
    this.command = command;
    this.args = args;
    this.defaultDepth = boundedInteger(defaultDepth, DEFAULT_DEPTH, 1, MAX_DEPTH, 'depth');
    this.timeoutMs = boundedInteger(timeoutMs, DEFAULT_TIMEOUT_MS, 500, 60_000, 'timeoutMs');
  }

  async checkAvailability() {
    try {
      const result = await this.analyze({ fen: STARTING_FEN, depth: 1 });
      return {
        available: true,
        configured: Boolean(process.env.ATEROMANTE_UCI_ENGINE_PATH),
        engineName: result.engineName,
        defaultDepth: this.defaultDepth,
        timeoutMs: this.timeoutMs,
      };
    } catch (error) {
      if (error instanceof UciEngineUnavailableError || error instanceof UciEngineProtocolError) {
        return {
          available: false,
          configured: Boolean(process.env.ATEROMANTE_UCI_ENGINE_PATH),
          engineName: null,
          defaultDepth: this.defaultDepth,
          timeoutMs: this.timeoutMs,
        };
      }
      throw error;
    }
  }

  analyze({ fen, depth = this.defaultDepth } = {}) {
    const normalizedFen = validateFen(fen);
    const normalizedDepth = boundedInteger(depth, this.defaultDepth, 1, MAX_DEPTH, 'depth');

    return new Promise((resolve, reject) => {
      const child = spawn(this.command, this.args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });
      let settled = false;
      let buffer = '';
      let engineName = 'UCI engine';
      let latestInfo = null;
      let stderr = '';

      const finish = (error, result = null) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeout);
        if (!child.killed) {
          child.kill();
        }
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      };

      const send = (command) => {
        if (!settled && child.stdin.writable) {
          child.stdin.write(`${command}\n`);
        }
      };

      const handleLine = (rawLine) => {
        const line = rawLine.trim();
        if (!line) {
          return;
        }
        if (line.startsWith('id name ')) {
          engineName = line.slice('id name '.length).trim();
          return;
        }
        if (line === 'uciok') {
          send('isready');
          return;
        }
        if (line === 'readyok') {
          send(`position fen ${normalizedFen}`);
          send(`go depth ${normalizedDepth}`);
          return;
        }
        if (line.startsWith('info ')) {
          latestInfo = parseInfoLine(line) ?? latestInfo;
          return;
        }
        if (line.startsWith('bestmove ')) {
          const bestMove = line.split(/\s+/)[1];
          if (!bestMove || bestMove === '(none)') {
            finish(new UciEngineProtocolError('UCI engine did not return a legal best move'));
            return;
          }
          finish(null, {
            engineName,
            depth: latestInfo?.depth ?? normalizedDepth,
            multipv: latestInfo?.multipv ?? 1,
            scoreCp: latestInfo?.scoreCp ?? null,
            scoreMate: latestInfo?.scoreMate ?? null,
            bestMove,
            principalVariation: latestInfo?.principalVariation?.length
              ? latestInfo.principalVariation
              : [bestMove],
            perspective: 'side-to-move',
          });
        }
      };

      const timeout = setTimeout(() => {
        finish(new UciEngineProtocolError(`UCI analysis timed out after ${this.timeoutMs} ms`));
      }, this.timeoutMs);

      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        buffer += chunk;
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          handleLine(line);
        }
      });
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk) => {
        stderr = `${stderr}${chunk}`.slice(-2_000);
      });
      child.stdin.on('error', (error) => {
        if (!settled) {
          finish(new UciEngineUnavailableError(`UCI engine input failed: ${error.code ?? 'unknown'}`));
        }
      });
      child.on('error', (error) => {
        if (error.code === 'ENOENT') {
          finish(new UciEngineUnavailableError('Configured UCI engine executable was not found'));
          return;
        }
        finish(new UciEngineUnavailableError('UCI engine process could not be started'));
      });
      child.on('close', (code) => {
        if (!settled) {
          const detail = stderr.trim() ? `: ${stderr.trim()}` : '';
          finish(new UciEngineProtocolError(`UCI engine exited with code ${code}${detail}`));
        }
      });

      send('uci');
    });
  }
}
