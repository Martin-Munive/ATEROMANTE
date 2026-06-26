# Engine Setup

## Current Policy
ATEROMANTE does not bundle Stockfish or any other engine.

The local API starts an external UCI executable configured by the user. This keeps platform-specific binaries out of the repository and makes licensing explicit.

## Environment Variables
Copy `.env.example` to `.env` and configure:

```text
ATEROMANTE_UCI_ENGINE_PATH=
ATEROMANTE_UCI_DEPTH=12
ATEROMANTE_UCI_TIMEOUT_MS=15000
```

If `ATEROMANTE_UCI_ENGINE_PATH` is empty, the API tries to run:

```text
stockfish
```

from `PATH`.

## Windows Example

```powershell
$env:ATEROMANTE_UCI_ENGINE_PATH="C:\tools\stockfish\stockfish.exe"
$env:ATEROMANTE_UCI_DEPTH="12"
$env:ATEROMANTE_UCI_TIMEOUT_MS="15000"
npm run dev:local
```

With a `.env` file:

```text
ATEROMANTE_UCI_ENGINE_PATH=C:\tools\stockfish\stockfish.exe
ATEROMANTE_UCI_DEPTH=12
ATEROMANTE_UCI_TIMEOUT_MS=15000
```

## Validate Availability
Check whether `stockfish` is available in PATH:

```powershell
where.exe stockfish
```

If the command cannot find Stockfish, set `ATEROMANTE_UCI_ENGINE_PATH` to the absolute executable path.

When the local API is running, ATEROMANTE also exposes:

```text
GET /api/engine/status
```

The endpoint reports whether the engine is available, the detected engine name and the bounded runtime settings. It does not expose the configured executable path.

## How Analysis Works
1. The UI requests analysis for the current game.
2. The API reconstructs the persisted FEN.
3. The API validates the FEN.
4. `UciEngineService` starts the configured UCI process.
5. The service sends `uci`, `isready`, `position fen ...` and `go depth ...`.
6. The service parses score, best move and principal variation.
7. The result is stored in SQLite and returned to the UI.

## Safety Bounds
The service enforces:

- single-line FEN input;
- legal FEN validation through `chess.js`;
- depth between `1` and `24`;
- timeout between `500` and `60000` ms;
- process path from server environment only;
- sanitized client error messages for missing or broken engines.

## Troubleshooting

### Motor UCI no disponible
The API could not start the engine.

Check:

- the executable path exists;
- the process can run from PowerShell;
- `.env` is in the project root;
- `ATEROMANTE_UCI_ENGINE_PATH` does not contain quotes inside the value.

### Engine protocol error
The process started but did not behave as a UCI engine.

Check:

- the binary is an actual UCI-compatible engine;
- antivirus or OS permissions are not blocking execution;
- timeout is not too low for the selected depth.

### Slow analysis
Lower:

```text
ATEROMANTE_UCI_DEPTH
```

or increase:

```text
ATEROMANTE_UCI_TIMEOUT_MS
```

## Licensing Note
Stockfish is GPL licensed. ATEROMANTE currently avoids bundling the engine. If a future package distributes Stockfish directly, release and license obligations must be reviewed before publication.
