export class TutorProviderUnavailableError extends Error {
  constructor(message = 'Tutor provider is unavailable') {
    super(message);
    this.name = 'TutorProviderUnavailableError';
  }
}

const DEFAULT_LOCAL_HTTP_URL = 'http://127.0.0.1:11434/api/generate';
const DEFAULT_CHAT_COMPLETIONS_PATH = '/chat/completions';

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
    id: 'chat-completions-compatible',
    label: 'Chat completions compatible API',
    kind: 'chat-completions-compatible',
    model: process.env.ATEROMANTE_CHAT_MODEL || 'configured-by-user',
    enabled: Boolean(process.env.ATEROMANTE_CHAT_API_KEY && process.env.ATEROMANTE_CHAT_BASE_URL),
    baseUrl: process.env.ATEROMANTE_CHAT_BASE_URL || '',
    apiKeyEnv: 'ATEROMANTE_CHAT_API_KEY',
    supportsStreaming: true,
  },
  {
    id: 'local-http-default',
    label: 'Local HTTP model',
    kind: 'local-http',
    model: process.env.ATEROMANTE_LOCAL_LLM_MODEL || 'configured-by-user',
    enabled: Boolean(process.env.ATEROMANTE_LOCAL_LLM_MODEL),
    baseUrl: process.env.ATEROMANTE_LOCAL_LLM_URL || DEFAULT_LOCAL_HTTP_URL,
    supportsStreaming: false,
  },
];

const tutorDepths = new Set(['hint', 'tactical', 'strategic', 'full-lesson']);

function normalizeTutorDepth(value) {
  return tutorDepths.has(value) ? value : 'hint';
}

function boundedString(value, fallback = '', maxLength = 2000) {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, maxLength)
    : fallback;
}

function boundedStringArray(value, fallback = []) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()).slice(0, 6)
    : fallback;
}

function normalizeAnnotations(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      kind: ['arrow', 'square', 'line', 'opacity'].includes(item.kind) ? item.kind : 'square',
      from: typeof item.from === 'string' ? item.from.slice(0, 8) : undefined,
      to: typeof item.to === 'string' ? item.to.slice(0, 8) : undefined,
      square: typeof item.square === 'string' ? item.square.slice(0, 8) : undefined,
      color: ['green', 'amber', 'red', 'blue', 'violet'].includes(item.color) ? item.color : 'blue',
      label: typeof item.label === 'string' ? item.label.slice(0, 80) : undefined,
    }))
    .slice(0, 8);
}

function parseProviderContent(payload) {
  if (typeof payload === 'string') {
    return payload;
  }
  if (typeof payload?.summary === 'string') {
    return payload;
  }
  if (typeof payload?.response === 'string') {
    return payload.response;
  }
  if (typeof payload?.message?.content === 'string') {
    return payload.message.content;
  }
  if (typeof payload?.choices?.[0]?.message?.content === 'string') {
    return payload.choices[0].message.content;
  }
  return '';
}

function normalizeTutorResponse(payload) {
  const content = parseProviderContent(payload);
  let parsed = typeof content === 'string' ? null : content;
  if (typeof content === 'string') {
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = null;
    }
  }

  if (parsed && typeof parsed === 'object') {
    return {
      summary: boundedString(parsed.summary, 'El tutor local devolvio una respuesta sin resumen.'),
      candidateMove: typeof parsed.candidateMove === 'string' ? parsed.candidateMove.slice(0, 20) : undefined,
      teachingFocus: boundedStringArray(parsed.teachingFocus, ['revision local']),
      visualAnnotations: normalizeAnnotations(parsed.visualAnnotations),
      followUpExercise: typeof parsed.followUpExercise === 'string' ? parsed.followUpExercise.slice(0, 500) : undefined,
      confidence: ['low', 'medium', 'high'].includes(parsed.confidence) ? parsed.confidence : 'low',
    };
  }

  return {
    summary: boundedString(content, 'El tutor local no devolvio contenido.'),
    candidateMove: undefined,
    teachingFocus: ['revision local'],
    visualAnnotations: [],
    followUpExercise: undefined,
    confidence: 'low',
  };
}

function buildLocalHttpPrompt(context) {
  return [
    'Eres el tutor educativo de ATEROMANTE. No valides reglas de ajedrez ni inventes legalidad; usa solo el contexto preparado.',
    'Responde en JSON estricto con: summary, candidateMove, teachingFocus, visualAnnotations, followUpExercise, confidence.',
    `Idioma: ${context.language}`,
    `Modo tutor: ${context.tutorDepth}`,
    `FEN: ${context.fen}`,
    `PGN: ${context.pgn || '(sin PGN)'}`,
    `Ultima jugada: ${context.lastMove || '(sin jugada)'}`,
    `Lineas de motor: ${JSON.stringify(context.engineLines)}`,
    `Perfil: ${context.studentProfileSummary}`,
    `Politica: ${JSON.stringify(context.matchPolicy)}`,
  ].join('\n');
}

function buildChatMessages(context) {
  return [
    {
      role: 'system',
      content: [
        'Eres el tutor educativo de ATEROMANTE.',
        'No valides reglas de ajedrez ni inventes legalidad; usa solo el contexto preparado.',
        'Responde en JSON estricto con: summary, candidateMove, teachingFocus, visualAnnotations, followUpExercise, confidence.',
      ].join(' '),
    },
    {
      role: 'user',
      content: [
        `Idioma: ${context.language}`,
        `Modo tutor: ${context.tutorDepth}`,
        `FEN: ${context.fen}`,
        `PGN: ${context.pgn || '(sin PGN)'}`,
        `Ultima jugada: ${context.lastMove || '(sin jugada)'}`,
        `Lineas de motor: ${JSON.stringify(context.engineLines)}`,
        `Perfil: ${context.studentProfileSummary}`,
        `Politica: ${JSON.stringify(context.matchPolicy)}`,
      ].join('\n'),
    },
  ];
}

function resolveChatCompletionsUrl(baseUrl) {
  const trimmed = String(baseUrl || '').trim().replace(/\/$/, '');
  if (!trimmed) {
    return '';
  }
  return trimmed.endsWith(DEFAULT_CHAT_COMPLETIONS_PATH)
    ? trimmed
    : `${trimmed}${DEFAULT_CHAT_COMPLETIONS_PATH}`;
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

export class ChatCompletionsTutorProvider {
  constructor({
    config = tutorProviderConfigs.find((provider) => provider.id === 'chat-completions-compatible'),
    fetchImpl = globalThis.fetch,
    timeoutMs = Number.parseInt(process.env.ATEROMANTE_CHAT_TIMEOUT_MS ?? '30000', 10),
  } = {}) {
    this.config = config;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = Number.isInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 120000 ? timeoutMs : 30000;
  }

  async explainPosition(context) {
    const model = process.env.ATEROMANTE_CHAT_MODEL || this.config.model;
    const apiKey = process.env.ATEROMANTE_CHAT_API_KEY;
    const url = resolveChatCompletionsUrl(process.env.ATEROMANTE_CHAT_BASE_URL || this.config.baseUrl);
    if (!this.fetchImpl) {
      throw new TutorProviderUnavailableError('fetch is not available for chat-completions-compatible provider');
    }
    if (!url || !model || model === 'configured-by-user' || !apiKey) {
      throw new TutorProviderUnavailableError('ATEROMANTE_CHAT_BASE_URL, ATEROMANTE_CHAT_MODEL and ATEROMANTE_CHAT_API_KEY are required');
    }

    let response;
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: buildChatMessages(context),
          temperature: 0.2,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new TutorProviderUnavailableError(`Chat completions tutor request failed: ${error.message}`);
    }

    if (!response.ok) {
      throw new TutorProviderUnavailableError(`Chat completions tutor returned HTTP ${response.status}`);
    }

    const rawPayload = await response.text();
    let payload;
    try {
      payload = JSON.parse(rawPayload);
    } catch {
      payload = rawPayload;
    }
    return normalizeTutorResponse(payload);
  }
}

export class LocalHttpTutorProvider {
  constructor({
    config = tutorProviderConfigs.find((provider) => provider.id === 'local-http-default'),
    fetchImpl = globalThis.fetch,
    timeoutMs = Number.parseInt(process.env.ATEROMANTE_LOCAL_LLM_TIMEOUT_MS ?? '15000', 10),
  } = {}) {
    this.config = config;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = Number.isInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 120000 ? timeoutMs : 15000;
  }

  async explainPosition(context) {
    const model = process.env.ATEROMANTE_LOCAL_LLM_MODEL || this.config.model;
    if (!this.fetchImpl) {
      throw new TutorProviderUnavailableError('fetch is not available for local HTTP tutor provider');
    }
    if (!model || model === 'configured-by-user') {
      throw new TutorProviderUnavailableError('ATEROMANTE_LOCAL_LLM_MODEL is required for local-http-default');
    }

    let response;
    try {
      response = await this.fetchImpl(this.config.baseUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: buildLocalHttpPrompt(context),
          stream: false,
          context,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new TutorProviderUnavailableError(`Local HTTP tutor request failed: ${error.message}`);
    }

    if (!response.ok) {
      throw new TutorProviderUnavailableError(`Local HTTP tutor returned HTTP ${response.status}`);
    }

    const rawPayload = await response.text();
    let payload;
    try {
      payload = JSON.parse(rawPayload);
    } catch {
      payload = rawPayload;
    }
    return normalizeTutorResponse(payload);
  }
}

export class TutorService {
  constructor({
    providerId = process.env.ATEROMANTE_LLM_PROVIDER || 'mock-local',
    providers = new Map([
      ['mock-local', new MockTutorProvider()],
      ['chat-completions-compatible', new ChatCompletionsTutorProvider()],
      ['local-http-default', new LocalHttpTutorProvider()],
    ]),
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

  async explain({ state, engineEvaluation = null, tutorDepth = 'hint', language = 'es', providerId = null }) {
    const selectedProviderId = providerId || this.providerId;
    const provider = this.providers.get(selectedProviderId);
    if (!provider) {
      throw new TutorProviderUnavailableError(`Tutor provider is not implemented: ${selectedProviderId}`);
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
