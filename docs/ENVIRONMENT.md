# Environment

## Policy
All project dependencies must be installed locally inside this project.

Do not install runtime or development dependencies globally for this application.

## Current Tooling
- Node.js: required.
- npm: required.
- Rust/Cargo: not required for the first web spike.
- Tauri: deferred until Rust/Cargo are installed.

## Local Node Environment
The Node environment is isolated by:

- `package.json`
- `package-lock.json`
- local `node_modules/`
- `.gitignore`

Install dependencies from the project root:

```powershell
cd PROYECTOS\P-AJEDREZ-GM
npm install
```

Run the development server:

```powershell
cd PROYECTOS\P-AJEDREZ-GM
npm run dev
```

Run the local API and UI together:

```powershell
cd PROYECTOS\P-AJEDREZ-GM
npm run dev:local
```

The scripts load `.env` when it exists. Copy `.env.example` and configure only local values.

## External UCI Engine
ATEROMANTE does not bundle Stockfish. The local API starts the executable configured in:

```text
ATEROMANTE_UCI_ENGINE_PATH
```

If the variable is empty, the API searches for `stockfish` in `PATH`.

Optional limits:

```text
ATEROMANTE_UCI_DEPTH=12
ATEROMANTE_UCI_TIMEOUT_MS=15000
```

The analysis endpoint validates the persisted FEN, limits depth to `1-24` and stops an analysis that exceeds the configured timeout. Keeping the engine external avoids committing platform-specific binaries and makes license handling explicit.

Run only the local API:

```powershell
cd PROYECTOS\P-AJEDREZ-GM
npm run api
```

Build:

```powershell
cd PROYECTOS\P-AJEDREZ-GM
npm run build
```

Lint:

```powershell
cd PROYECTOS\P-AJEDREZ-GM
npm run lint
```

Test:

```powershell
cd PROYECTOS\P-AJEDREZ-GM
npm test
```

## Local Data
Runtime databases must live in `data/` or another user-selected local data directory.

The repository ignores `data/`, `*.db`, `*.db-shm` and `*.db-wal`.

## Future Desktop Environment
The intended desktop target is Tauri. Tauri requires Rust and Cargo.

Before enabling Tauri:
1. install Rust/Cargo through the official toolchain;
2. verify `rustc --version`;
3. verify `cargo --version`;
4. add Tauri configuration in a separate commit;
5. keep all Node dependencies local.

## Secrets
LLM provider keys must live in `.env` or the operating system credential store.

`.env` files are ignored by Git. If examples are needed, create `.env.example` without real secrets.

Current example variables are documented in `.env.example`.
