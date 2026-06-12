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
