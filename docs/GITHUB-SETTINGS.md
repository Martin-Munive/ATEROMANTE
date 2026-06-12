# GitHub Settings

## Repository
- Suggested name: `ATEROMANTE`
- Visibility: public
- Default branch: `main`
- License: GNU AGPL v3.0 or later

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
gh repo create Martin-Munive/ATEROMANTE --public --source . --remote origin --push --description "Laboratorio local de entrenamiento ajedrecistico para adultos con tablero educativo, tutor configurable, motor UCI y trazabilidad de aprendizaje."
```

Set topics:

```powershell
gh repo edit Martin-Munive/ATEROMANTE --add-topic chess --add-topic chess-training --add-topic chess-engine --add-topic stockfish --add-topic uci --add-topic pgn --add-topic fen --add-topic spaced-repetition --add-topic learning-science --add-topic react --add-topic vite --add-topic typescript --add-topic sqlite --add-topic local-first --add-topic educational-software --add-topic llm --add-topic chess-tutor
```

Verify:

```powershell
gh repo view Martin-Munive/ATEROMANTE
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
- authorship or tooling metadata unrelated to the project.
