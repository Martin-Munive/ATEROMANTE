import { useCallback, useEffect, useMemo, useState } from 'react';
import { Chess, type Square } from 'chess.js';

export type BoardPieces = Record<string, string>;

interface ApiMove {
  id: string;
  ply: number;
  san: string;
  uci: string;
  from: string;
  to: string;
  promotion?: string | null;
  classification?: string | null;
}

interface ApiGameState {
  sessionId: string;
  gameId: string;
  fen: string;
  pgn: string;
  pgnHeaders: Record<string, string>;
  pgnSource: PgnSource | null;
  pgnAnnotations: PgnAnnotation[];
  pgnVariations: PgnVariation[];
  turn: 'white' | 'black';
  result: string;
  legalMoves: string[];
  moves: ApiMove[];
}

export interface PgnAnnotation {
  id: string;
  positionId: string | null;
  fen: string;
  ply: number | null;
  annotationType: 'comment' | 'nag';
  value: string;
}

export interface PgnVariation {
  id: string;
  parentPly: number | null;
  parentFen: string | null;
  parentVariationIndex: number | null;
  variationIndex: number;
  depth: number;
  sanLine: string;
  rawPgn: string;
}

export interface PgnSource {
  sourceType: 'text' | 'file';
  fileName: string | null;
  mimeType: string | null;
  byteSize: number | null;
  pgnSha256: string;
  createdAt: string;
}

export interface SessionSummary {
  sessionId: string;
  gameId: string;
  mode: string;
  stationRole: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  moveCount: number;
  turn: 'white' | 'black';
  result: string;
  lastMove: string | null;
}

interface SessionsResponse {
  sessions: SessionSummary[];
}

export interface EngineAnalysis {
  id: string;
  gameId: string;
  moveId: string | null;
  positionId: string | null;
  engineName: string;
  depth: number;
  multipv: number;
  score: {
    type: 'cp' | 'mate';
    value: number | null;
  };
  bestMove: string;
  principalVariation: string[];
  perspective: 'side-to-move';
  createdAt: string;
}

export interface EngineStatus {
  available: boolean;
  configured: boolean;
  engineName: string | null;
  defaultDepth: number | null;
  timeoutMs: number | null;
}

export interface TutorExplanation {
  id: string | null;
  provider: {
    id: string;
    label: string;
    kind: string;
    model: string;
  };
  tutorMode: 'hint' | 'tactical' | 'strategic' | 'full-lesson';
  summary: string;
  candidateMove: string | null;
  teachingFocus: string[];
  visualAnnotations: Array<Record<string, unknown>>;
  followUpExercise: string | null;
  confidence: 'low' | 'medium' | 'high';
  createdAt: string;
}

export interface TutorProviderConfig {
  id: string;
  label: string;
  kind: string;
  model: string;
  enabled: boolean;
  active: boolean;
}

interface TutorProvidersResponse {
  providers: TutorProviderConfig[];
}

export interface PostGameReport {
  gameId: string;
  sessionId: string;
  generatedAt: string;
  summary: {
    moveCount: number;
    result: string;
    analyzedPositions: number;
    tutorExplanations: number;
    learningEvents: number;
    reviewItems: number;
    eventCount: number;
  };
  latestEngine: {
    engineName: string;
    depth: number;
    bestMove: string;
    scoreLabel: string;
    createdAt: string;
  } | null;
  criticalPosition: {
    positionId: string;
    moveId: string | null;
    ply: number;
    fen: string;
    sideToMove: 'white' | 'black';
    san: string | null;
    reason: string;
    bestMove: string | null;
    scoreLabel: string | null;
    depth: number | null;
  } | null;
  tutorFocus: Array<{ label: string; count: number }>;
  recentTutorEvents: Array<{
    id: string;
    providerId: string;
    tutorMode: string;
    summary: string;
    teachingFocus: string[];
    confidence: 'low' | 'medium' | 'high';
    createdAt: string;
  }>;
  recentLearningEvents: LearningEvent[];
  reviewQueue: ReviewItem[];
  recommendations: string[];
}

export interface LearningEvent {
  id: string;
  gameId: string;
  moveId: string | null;
  positionId: string | null;
  tutorEventId: string | null;
  eventType: string;
  theme: string;
  skill: string;
  summary: string;
  explanation: string;
  studentAction: string | null;
  confidence: 'low' | 'medium' | 'high';
  masteryState: 'new' | 'learning' | 'reviewing' | 'stable' | 'weak';
  createdAt: string;
}

interface LearningFromReportResponse {
  learningEvent: LearningEvent;
  reviewItem: ReviewItem;
  report: PostGameReport;
}

type ReviewResult = 'again' | 'hard' | 'good' | 'easy';

interface ReviewResultResponse {
  reviewItem: ReviewItem;
}

export interface ReviewItem {
  id: string;
  learningEventId: string;
  gameId: string | null;
  moveId: string | null;
  positionId: string | null;
  theme: string;
  skill: string;
  summary: string;
  masteryState: 'new' | 'learning' | 'reviewing' | 'stable' | 'weak';
  confidence: 'low' | 'medium' | 'high';
  positionFen: string | null;
  positionPly: number | null;
  sideToMove: 'white' | 'black' | null;
  exercisePrompt: string;
  expectedBestMove: string | null;
  expectedScoreLabel: string;
  expectedDepth: number | null;
  dueAt: string;
  intervalDays: number;
  ease: number;
  lastResult: string | null;
  nextPromptType: string;
  latestAnswer: string | null;
  latestAnswerAssessment: {
    label: 'alineada' | 'requiere detalle';
    matchedTerms: string[];
    candidateSignal: {
      expectedMove: string;
      matched: boolean;
    } | null;
    wordCount: number;
  } | null;
  createdAt: string;
  updatedAt: string;
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:4174';

const pieceGlyphs: Record<string, string> = {
  bp: '♟',
  bn: '♞',
  bb: '♝',
  br: '♜',
  bq: '♛',
  bk: '♚',
  wp: '♙',
  wn: '♘',
  wb: '♗',
  wr: '♖',
  wq: '♕',
  wk: '♔',
};

function boardPieces(chess: Chess): BoardPieces {
  const pieces: BoardPieces = {};

  for (const row of chess.board()) {
    for (const piece of row) {
      if (!piece) {
        continue;
      }
      pieces[piece.square] = pieceGlyphs[`${piece.color}${piece.type}`];
    }
  }

  return pieces;
}

function variationTokens(sanLine: string) {
  return sanLine.split(/\s+/).map((token) => token.trim()).filter(Boolean);
}

function toSquare(square: string) {
  return square as Square;
}

function turnLabel(turn: 'white' | 'black') {
  return turn === 'white' ? 'Blancas' : 'Negras';
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message ?? payload.error ?? 'request_failed');
  }
  return payload;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message ?? payload.error ?? 'request_failed');
  }
  return payload;
}

async function getText(url: string): Promise<string> {
  const response = await fetch(url);
  const payload = await response.text();
  if (!response.ok) {
    throw new Error(payload || 'request_failed');
  }
  return payload;
}

export function useChessGame() {
  const [state, setState] = useState<ApiGameState | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<EngineAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [recentSessions, setRecentSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);
  const [engineStatusLoading, setEngineStatusLoading] = useState(true);
  const [tutorExplanation, setTutorExplanation] = useState<TutorExplanation | null>(null);
  const [tutorLoading, setTutorLoading] = useState(false);
  const [tutorError, setTutorError] = useState<string | null>(null);
  const [tutorProviders, setTutorProviders] = useState<TutorProviderConfig[]>([]);
  const [selectedTutorProviderId, setSelectedTutorProviderId] = useState('mock-local');
  const [selectedTutorDepth, setSelectedTutorDepth] = useState<TutorExplanation['tutorMode']>('hint');
  const [postGameReport, setPostGameReport] = useState<PostGameReport | null>(null);
  const [postGameReportLoading, setPostGameReportLoading] = useState(false);
  const [postGameReportError, setPostGameReportError] = useState<string | null>(null);
  const [learningEventLoading, setLearningEventLoading] = useState(false);
  const [learningEventError, setLearningEventError] = useState<string | null>(null);
  const [lastLearningEvent, setLastLearningEvent] = useState<LearningEvent | null>(null);
  const [reviewResultLoadingId, setReviewResultLoadingId] = useState<string | null>(null);
  const [reviewResultError, setReviewResultError] = useState<string | null>(null);
  const [fenImportLoading, setFenImportLoading] = useState(false);
  const [fenImportError, setFenImportError] = useState<string | null>(null);
  const [pgnImportLoading, setPgnImportLoading] = useState(false);
  const [pgnImportError, setPgnImportError] = useState<string | null>(null);
  const [pgnExportError, setPgnExportError] = useState<string | null>(null);
  const [activeVariationId, setActiveVariationId] = useState<string | null>(null);
  const [activeVariationPly, setActiveVariationPly] = useState(0);

  async function refreshRecentSessions() {
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const payload = await getJson<SessionsResponse>(`${apiBaseUrl}/api/sessions?limit=6`);
      setRecentSessions(payload.sessions);
      return payload.sessions;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo cargar el historial.';
      setSessionsError(message);
      return [];
    } finally {
      setSessionsLoading(false);
    }
  }

  async function createNewGame() {
    return postJson<ApiGameState>(`${apiBaseUrl}/api/sessions`, {
      mode: 'solo-practice',
      stationRole: 'hybrid',
    });
  }

  async function recoverOrCreateGame() {
    return postJson<ApiGameState>(`${apiBaseUrl}/api/sessions/recover-or-create`, {
      mode: 'solo-practice',
      stationRole: 'hybrid',
    });
  }

  async function refreshEngineStatus() {
    setEngineStatusLoading(true);
    try {
      setEngineStatus(await getJson<EngineStatus>(`${apiBaseUrl}/api/engine/status`));
    } catch {
      setEngineStatus({
        available: false,
        configured: false,
        engineName: null,
        defaultDepth: null,
        timeoutMs: null,
      });
    } finally {
      setEngineStatusLoading(false);
    }
  }

  async function refreshTutorProviders() {
    try {
      const payload = await getJson<TutorProvidersResponse>(`${apiBaseUrl}/api/tutor/providers`);
      setTutorProviders(payload.providers);
      const activeProvider = payload.providers.find((provider) => provider.active && provider.enabled)
        ?? payload.providers.find((provider) => provider.enabled);
      if (activeProvider) {
        setSelectedTutorProviderId(activeProvider.id);
      }
      return payload.providers;
    } catch {
      setTutorProviders([]);
      setSelectedTutorProviderId('mock-local');
      return [];
    }
  }

  const refreshPostGameReport = useCallback(async (gameId = state?.gameId ?? null) => {
    if (!gameId) {
      setPostGameReport(null);
      return null;
    }

    setPostGameReportLoading(true);
    setPostGameReportError(null);
    try {
      const report = await getJson<PostGameReport>(`${apiBaseUrl}/api/games/${gameId}/report`);
      setPostGameReport(report);
      return report;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo generar el reporte.';
      setPostGameReport(null);
      setPostGameReportError(message);
      return null;
    } finally {
      setPostGameReportLoading(false);
    }
  }, [state?.gameId]);

  async function loadGame(gameId: string) {
    setLoading(true);
    setSelectedSquare(null);
    setLastError(null);
    setAnalysis(null);
    setAnalysisError(null);
    setTutorExplanation(null);
    setTutorError(null);
    setPostGameReport(null);
    setPostGameReportError(null);
    setLearningEventError(null);
    setLastLearningEvent(null);
    setActiveVariationId(null);
    setActiveVariationPly(0);
    try {
      const nextState = await getJson<ApiGameState>(`${apiBaseUrl}/api/games/${gameId}`);
      setState(nextState);
      await refreshRecentSessions();
    } catch (error) {
      setLastError(error instanceof Error ? error.message : 'No se pudo recuperar la sesión.');
    } finally {
      setLoading(false);
    }
  }

  async function importFen(fen: string) {
    const normalizedInput = fen.trim();
    if (!normalizedInput) {
      setFenImportError('Pega una posición FEN antes de importarla.');
      return null;
    }

    setFenImportLoading(true);
    setFenImportError(null);
    setSelectedSquare(null);
    setLastError(null);
    setAnalysis(null);
    setAnalysisError(null);
    setTutorExplanation(null);
    setTutorError(null);
    setPostGameReport(null);
    setPostGameReportError(null);
    setLearningEventError(null);
    setLastLearningEvent(null);
    setActiveVariationId(null);
    setActiveVariationPly(0);
    try {
      const imported = await postJson<ApiGameState>(`${apiBaseUrl}/api/import/fen`, { fen: normalizedInput });
      setState(imported);
      await refreshRecentSessions();
      return imported;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo importar la posición FEN.';
      setFenImportError(message);
      return null;
    } finally {
      setFenImportLoading(false);
    }
  }

  async function importPgn(pgn: string, sourceMetadata: Record<string, unknown> = {}) {
    const normalizedInput = pgn.trim();
    if (!normalizedInput) {
      setPgnImportError('Pega una partida PGN antes de importarla.');
      return null;
    }

    setPgnImportLoading(true);
    setPgnImportError(null);
    setSelectedSquare(null);
    setLastError(null);
    setAnalysis(null);
    setAnalysisError(null);
    setTutorExplanation(null);
    setTutorError(null);
    setPostGameReport(null);
    setPostGameReportError(null);
    setLearningEventError(null);
    setLastLearningEvent(null);
    setActiveVariationId(null);
    setActiveVariationPly(0);
    try {
      const imported = await postJson<ApiGameState>(`${apiBaseUrl}/api/import/pgn`, {
        pgn: normalizedInput,
        sourceMetadata,
      });
      setState(imported);
      await refreshRecentSessions();
      return imported;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo importar la partida PGN.';
      setPgnImportError(message);
      return null;
    } finally {
      setPgnImportLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function bootstrapGame() {
      try {
        const nextState = await recoverOrCreateGame();

        if (active) {
          setState(nextState);
          setLastError(null);
          setTutorExplanation(null);
          setTutorError(null);
        }
        if (active) {
          await refreshRecentSessions();
        }
        if (active) {
          await refreshEngineStatus();
        }
        if (active) {
          await refreshTutorProviders();
        }
      } catch (error) {
        if (active) {
          const message = error instanceof Error ? error.message : 'error desconocido';
          setLastError(`No se pudo conectar con la API local: ${message}`);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    bootstrapGame();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!state?.gameId) {
      setPostGameReport(null);
      return;
    }

    void refreshPostGameReport(state.gameId);
  }, [refreshPostGameReport, state?.gameId, state?.moves.length]);

  const chess = useMemo(() => new Chess(state?.fen), [state?.fen]);
  const activeVariation = useMemo(
    () => state?.pgnVariations.find((variation) => variation.id === activeVariationId) ?? null,
    [activeVariationId, state?.pgnVariations],
  );
  const variationPreview = useMemo(() => {
    if (!activeVariation?.parentFen) {
      return null;
    }
    const tokens = variationTokens(activeVariation.sanLine);
    const boundedPly = Math.min(activeVariationPly, tokens.length);
    const previewChess = new Chess(activeVariation.parentFen);
    const appliedMoves = [];
    for (const token of tokens.slice(0, boundedPly)) {
      const applied = previewChess.move(token);
      if (!applied) {
        break;
      }
      appliedMoves.push(applied.san);
    }
    return {
      variation: activeVariation,
      pieces: boardPieces(previewChess),
      fen: previewChess.fen(),
      moves: appliedMoves,
      ply: appliedMoves.length,
      totalPlies: tokens.length,
      canStepBack: appliedMoves.length > 0,
      canStepForward: appliedMoves.length < tokens.length,
    };
  }, [activeVariation, activeVariationPly]);
  const selectedLegalTargets = useMemo(() => {
    if (!selectedSquare) {
      return new Set<string>();
    }
    return new Set(chess.moves({ square: toSquare(selectedSquare), verbose: true }).map((move) => move.to));
  }, [chess, selectedSquare]);

  const lastMove = state?.moves.at(-1) ?? null;

  async function handleSquare(square: string) {
    setLastError(null);

    if (!state || variationPreview) {
      return null;
    }

    if (!selectedSquare) {
      if (chess.get(toSquare(square))) {
        setSelectedSquare(square);
      }
      return null;
    }

    if (selectedSquare === square) {
      setSelectedSquare(null);
      return null;
    }

    if (!selectedLegalTargets.has(square)) {
      if (chess.get(toSquare(square))?.color === chess.turn()) {
        setSelectedSquare(square);
      } else {
        setLastError(`${selectedSquare}-${square} no es legal en la posicion actual.`);
        setSelectedSquare(null);
      }
      return null;
    }

    try {
      const nextState = await postJson<ApiGameState>(`${apiBaseUrl}/api/games/${state.gameId}/moves`, {
        from: selectedSquare,
        to: square,
        promotion: 'q',
      });
      setState(nextState);
      setAnalysis(null);
      setAnalysisError(null);
      setTutorExplanation(null);
      setTutorError(null);
      setPostGameReport(null);
      setPostGameReportError(null);
      setLearningEventError(null);
      setLastLearningEvent(null);
      setSelectedSquare(null);
      setLastError(null);
      await refreshRecentSessions();
      return nextState.moves.at(-1) ?? null;
    } catch (error) {
      setLastError(error instanceof Error ? error.message : 'Movimiento rechazado por la API local.');
      setSelectedSquare(null);
      return null;
    }
  }

  async function resetGame() {
    setLoading(true);
    setSelectedSquare(null);
    setLastError(null);
    setAnalysis(null);
    setAnalysisError(null);
    setTutorExplanation(null);
    setTutorError(null);
    setPostGameReport(null);
    setPostGameReportError(null);
    setLearningEventError(null);
    setLastLearningEvent(null);
    try {
      setState(await createNewGame());
      await refreshRecentSessions();
    } catch (error) {
      setLastError(error instanceof Error ? error.message : 'No se pudo reiniciar la partida.');
    } finally {
      setLoading(false);
    }
  }

  function openVariation(variationId: string) {
    setSelectedSquare(null);
    setLastError(null);
    setActiveVariationId(variationId);
    setActiveVariationPly(0);
  }

  function closeVariation() {
    setActiveVariationId(null);
    setActiveVariationPly(0);
  }

  function stepVariation(delta: number) {
    if (!activeVariation) {
      return;
    }
    const totalPlies = variationTokens(activeVariation.sanLine).length;
    setActiveVariationPly((current) => Math.max(0, Math.min(totalPlies, current + delta)));
  }

  async function openVariationAsStudy() {
    if (!state || !activeVariation) {
      return null;
    }
    setLoading(true);
    setSelectedSquare(null);
    setLastError(null);
    setAnalysis(null);
    setAnalysisError(null);
    setTutorExplanation(null);
    setTutorError(null);
    setPostGameReport(null);
    setPostGameReportError(null);
    setLearningEventError(null);
    setLastLearningEvent(null);
    try {
      const imported = await postJson<ApiGameState>(
        `${apiBaseUrl}/api/games/${state.gameId}/variations/${activeVariation.variationIndex}/study`,
        {},
      );
      setState(imported);
      setActiveVariationId(null);
      setActiveVariationPly(0);
      await refreshRecentSessions();
      return imported;
    } catch (error) {
      setLastError(error instanceof Error ? error.message : 'No se pudo abrir la variante como estudio.');
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function promoteVariationAsMainLine() {
    if (!state || !activeVariation) {
      return null;
    }
    setLoading(true);
    setSelectedSquare(null);
    setLastError(null);
    setAnalysis(null);
    setAnalysisError(null);
    setTutorExplanation(null);
    setTutorError(null);
    setPostGameReport(null);
    setPostGameReportError(null);
    setLearningEventError(null);
    setLastLearningEvent(null);
    try {
      const promoted = await postJson<ApiGameState>(
        `${apiBaseUrl}/api/games/${state.gameId}/variations/${activeVariation.variationIndex}/mainline`,
        {},
      );
      setState(promoted);
      setActiveVariationId(null);
      setActiveVariationPly(0);
      await refreshRecentSessions();
      return promoted;
    } catch (error) {
      setLastError(error instanceof Error ? error.message : 'No se pudo promover la variante a línea principal.');
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function analyzePosition(depth = 12) {
    if (!state || analysisLoading) {
      return null;
    }

    setAnalysisLoading(true);
    setAnalysisError(null);
    try {
      const result = await postJson<EngineAnalysis>(`${apiBaseUrl}/api/games/${state.gameId}/analysis`, { depth });
      setAnalysis(result);
      await refreshPostGameReport(state.gameId);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo analizar la posición.';
      setAnalysis(null);
      setAnalysisError(message);
      return null;
    } finally {
      setAnalysisLoading(false);
    }
  }

  async function explainWithTutor({
    tutorDepth = selectedTutorDepth,
    providerId = selectedTutorProviderId,
  }: {
    tutorDepth?: TutorExplanation['tutorMode'];
    providerId?: string;
  } = {}) {
    if (!state || tutorLoading) {
      return null;
    }

    setTutorLoading(true);
    setTutorError(null);
    try {
      const result = await postJson<TutorExplanation>(`${apiBaseUrl}/api/games/${state.gameId}/tutor/explain`, {
        tutorDepth,
        providerId,
        language: 'es',
      });
      setTutorExplanation(result);
      await refreshPostGameReport(state.gameId);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo obtener la explicación del tutor.';
      setTutorExplanation(null);
      setTutorError(message);
      return null;
    } finally {
      setTutorLoading(false);
    }
  }

  async function createLearningEventFromReport() {
    if (!state || learningEventLoading) {
      return null;
    }

    setLearningEventLoading(true);
    setLearningEventError(null);
    try {
      const result = await postJson<LearningFromReportResponse>(
        `${apiBaseUrl}/api/games/${state.gameId}/learning/from-report`,
        {},
      );
      setLastLearningEvent(result.learningEvent);
      setPostGameReport(result.report);
      return result.learningEvent;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo guardar el aprendizaje.';
      setLearningEventError(message);
      return null;
    } finally {
      setLearningEventLoading(false);
    }
  }

  async function recordReviewResult(reviewItemId: string, result: ReviewResult, answerText = '') {
    if (!state || reviewResultLoadingId) {
      return null;
    }

    setReviewResultLoadingId(reviewItemId);
    setReviewResultError(null);
    try {
      const payload = await postJson<ReviewResultResponse>(`${apiBaseUrl}/api/reviews/${reviewItemId}/result`, {
        result,
        answerText,
      });
      await refreshPostGameReport(state.gameId);
      return payload.reviewItem;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo registrar el repaso.';
      setReviewResultError(message);
      return null;
    } finally {
      setReviewResultLoadingId(null);
    }
  }

  async function exportPgn() {
    if (!state) {
      return null;
    }
    setPgnExportError(null);
    try {
      const exported = await getText(`${apiBaseUrl}/api/games/${state.gameId}/export/pgn`);
      const blob = new Blob([exported], { type: 'application/x-chess-pgn;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const baseName = state.pgnSource?.fileName?.replace(/\.pgn$/i, '') || state.pgnHeaders.Event || 'ateromante-study';
      link.href = url;
      link.download = `${baseName}.pgn`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      return exported;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo exportar la partida PGN.';
      setPgnExportError(message);
      return null;
    }
  }

  return {
    pieces: variationPreview?.pieces ?? boardPieces(chess),
    selectedSquare,
    selectedLegalTargets,
    lastMove,
    lastError,
    history: state?.moves ?? [],
    fen: variationPreview?.fen ?? state?.fen ?? chess.fen(),
    pgn: state?.pgn ?? '',
    pgnHeaders: state?.pgnHeaders ?? {},
    pgnSource: state?.pgnSource ?? null,
    pgnAnnotations: state?.pgnAnnotations ?? [],
    pgnVariations: state?.pgnVariations ?? [],
    variationPreview,
    turn: state ? turnLabel(state.turn) : 'Cargando',
    result: state?.result ?? '*',
    legalMoveCount: state?.legalMoves.length ?? 0,
    inCheck: chess.inCheck(),
    isGameOver: chess.isGameOver(),
    loading,
    analysis,
    analysisLoading,
    analysisError,
    tutorExplanation,
    tutorLoading,
    tutorError,
    tutorProviders,
    selectedTutorProviderId,
    selectedTutorDepth,
    postGameReport,
    postGameReportLoading,
    postGameReportError,
    learningEventLoading,
    learningEventError,
    lastLearningEvent,
    reviewResultLoadingId,
    reviewResultError,
    engineStatus,
    engineStatusLoading,
    fenImportLoading,
    fenImportError,
    pgnImportLoading,
    pgnImportError,
    pgnExportError,
    currentGameId: state?.gameId ?? null,
    recentSessions,
    sessionsLoading,
    sessionsError,
    handleSquare,
    resetGame,
    analyzePosition,
    explainWithTutor,
    createLearningEventFromReport,
    recordReviewResult,
    setSelectedTutorProviderId,
    setSelectedTutorDepth,
    refreshPostGameReport,
    refreshEngineStatus,
    importFen,
    importPgn,
    loadGame,
    openVariation,
    closeVariation,
    stepVariation,
    openVariationAsStudy,
    promoteVariationAsMainLine,
    exportPgn,
  };
}
