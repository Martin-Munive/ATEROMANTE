export class TutorProviderUnavailableError extends Error {
  constructor(message = 'Tutor provider is unavailable') {
    super(message);
    this.name = 'TutorProviderUnavailableError';
  }
}

export const tutorProviderConfigs = [
  {
    id: 'mock-local',
    label: 'Tutor simulado local',
    kind: 'mock',
    model: 'ateromante-mock-v0',
    enabled: true,
    supportsStreaming: false,
  },
  {
    id: 'openai-compatible-default',
    label: 'OpenAI-compatible API',
    kind: 'openai-compatible',
    model: process.env.ATEROMANTE_OPENAI_MODEL || 'configured-by-user',
    enabled: Boolean(process.env.ATEROMANTE_OPENAI_API_KEY),
    baseUrl: process.env.ATEROMANTE_OPENAI_BASE_URL || 'https://api.openai.com/v1',
    apiKeyEnv: 'ATEROMANTE_OPENAI_API_KEY',
    supportsStreaming: true,
  },
  {
    id: 'local-http-default',
    label: 'Local HTTP model',
    kind: 'local-http',
    model: process.env.ATEROMANTE_LOCAL_LLM_MODEL || 'configured-by-user',
    enabled: Boolean(process.env.ATEROMANTE_LOCAL_LLM_URL),
    baseUrl: process.env.ATEROMANTE_LOCAL_LLM_URL || 'http://127.0.0.1:11434',
    supportsStreaming: true,
  },
];

const tutorDepths = new Set(['hint', 'tactical', 'strategic', 'full-lesson']);

function normalizeTutorDepth(value) {
  return tutorDepths.has(value) ? value : 'hint';
}

class MockTutorProvider {
  config = tutorProviderConfigs[0];

  async explainPosition(context) {
    const depthLabel = {
      hint: 'pista breve',
      tactical: 'lectura tactica',
      strategic: 'plan estrategico',
      'full-lesson': 'clase completa',
    }[context.tutorDepth];
    const lastMoveText = context.lastMove ? `Despues de ${context.lastMove}, ` : '';
    const engineHint = context.engineLines[0]?.principalVariation
      ? `La linea del motor sugiere revisar ${context.engineLines[0].principalVariation}.`
      : 'Sin motor activo, prioriza amenazas, rey y piezas indefensas.';

    return {
      summary: `${depthLabel}: ${lastMoveText}evalua centro, seguridad del rey y piezas sin defensa. ${engineHint}`,
      candidateMove: context.engineLines[0]?.principalVariation?.split(' ')[0],
      teachingFocus: ['centro', 'seguridad del rey', 'piezas indefensas'],
      visualAnnotations: [
        { kind: 'square', square: 'd5', color: 'green', label: 'casilla critica' },
      ],
      followUpExercise: 'Anota dos jugadas candidatas y descarta una por una amenaza concreta.',
      confidence: context.engineLines.length > 0 ? 'medium' : 'low',
    };
  }
}

export class TutorService {
  constructor({
    providerId = process.env.ATEROMANTE_LLM_PROVIDER || 'mock-local',
    providers = new Map([['mock-local', new MockTutorProvider()]]),
    eventRepository,
  } = {}) {
    this.providerId = providerId;
    this.providers = providers;
    this.eventRepository = eventRepository;
  }

  listProviders() {
    return tutorProviderConfigs.map((config) => ({
      ...config,
      active: config.id === this.providerId,
    }));
  }

  async explain({ state, engineEvaluation = null, tutorDepth = 'hint', language = 'es' }) {
    const provider = this.providers.get(this.providerId);
    if (!provider) {
      throw new TutorProviderUnavailableError(`Tutor provider is not implemented: ${this.providerId}`);
    }

    const currentMove = state.moves.at(-1) ?? null;
    const currentPosition = state.positions.at(-1) ?? null;
    const normalizedDepth = normalizeTutorDepth(tutorDepth);
    const response = await provider.explainPosition({
      language,
      tutorDepth: normalizedDepth,
      fen: state.fen,
      pgn: state.pgn,
      lastMove: currentMove?.san,
      engineLines: engineEvaluation ? [{
        evaluation: engineEvaluation.score_mate !== null
          ? `M${engineEvaluation.score_mate}`
          : `${engineEvaluation.score_cp ?? 0}`,
        principalVariation: JSON.parse(engineEvaluation.pv_json).join(' '),
      }] : [],
      studentProfileSummary: 'Perfil local pendiente de configuracion.',
      matchPolicy: {
        tutorVisibility: state.game.tutor_policy?.includes('private') ? 'private' : 'shared',
        assistanceTiming: 'live',
        enginePermission: state.game.engine_policy,
      },
    });

    const stored = this.eventRepository?.recordTutorEvent({
      sessionId: state.game.session_id,
      gameId: state.game.id,
      moveId: currentMove?.id ?? null,
      positionId: currentPosition?.id ?? null,
      llmProviderId: provider.config.id,
      tutorMode: normalizedDepth,
      visibility: state.game.tutor_policy?.includes('private') ? 'private' : 'shared',
      summary: response.summary,
      teachingFocus: response.teachingFocus,
      annotations: response.visualAnnotations,
      confidence: response.confidence,
    });

    return {
      id: stored?.id ?? null,
      provider: provider.config,
      tutorMode: normalizedDepth,
      summary: response.summary,
      candidateMove: response.candidateMove ?? null,
      teachingFocus: response.teachingFocus,
      visualAnnotations: response.visualAnnotations,
      followUpExercise: response.followUpExercise ?? null,
      confidence: response.confidence,
      createdAt: stored?.created_at ?? new Date().toISOString(),
    };
  }
}
