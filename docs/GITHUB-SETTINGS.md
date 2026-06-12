# GitHub Settings

## Repository
- Suggested name: `AJEDREZ-GM`
- Visibility: public
- Default branch: `main`
- License: MIT

## Description
Laboratorio local de entrenamiento ajedrecistico para adultos con tablero educativo, tutor configurable, motor UCI y trazabilidad de aprendizaje.

## Website
Not configured yet.

## Topics
- chess
- chess-training
- chess-engine
- stockfish
- uci
- pgn
- fen
- spaced-repetition
- learning-science
- react
- vite
- typescript
- sqlite
- local-first
- educational-software

## Initial GitHub CLI Commands

Create a public repository from the project folder:

```powershell
gh repo create Martin-Munive/AJEDREZ-GM --public --source . --remote origin --push --description "Laboratorio local de entrenamiento ajedrecistico para adultos con tablero educativo, tutor configurable, motor UCI y trazabilidad de aprendizaje."
```

Set topics:

```powershell
gh repo edit Martin-Munive/AJEDREZ-GM --add-topic chess --add-topic chess-training --add-topic chess-engine --add-topic stockfish --add-topic uci --add-topic pgn --add-topic fen --add-topic spaced-repetition --add-topic learning-science --add-topic react --add-topic vite --add-topic typescript --add-topic sqlite --add-topic local-first --add-topic educational-software
```

Verify:

```powershell
gh repo view Martin-Munive/AJEDREZ-GM
```

## Publication Guard
Before push, verify that the repository does not include:
- private study material;
- local databases;
- API keys;
- internal workspace documentation;
- generated QA screenshots;
- `node_modules`;
- build artifacts.
