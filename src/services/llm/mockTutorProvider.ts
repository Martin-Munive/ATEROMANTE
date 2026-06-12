import type {
  LlmProviderConfig,
  LlmTutorProvider,
  TutorPromptContext,
  TutorResponse,
} from '../../domain/llmTypes';

export class MockTutorProvider implements LlmTutorProvider {
  readonly config: LlmProviderConfig = {
    id: 'mock-local',
    label: 'Tutor simulado local',
    kind: 'mock',
    model: 'ateromante-mock-v0',
    enabled: true,
    supportsStreaming: false,
  };

  async explainPosition(context: TutorPromptContext): Promise<TutorResponse> {
    const depthLabel = {
      hint: 'pista breve',
      tactical: 'lectura tactica',
      strategic: 'plan estrategico',
      'full-lesson': 'clase completa',
    }[context.tutorDepth];

    return {
      summary: `Modo ${depthLabel}: revisa la presion central antes de elegir una captura automatica.`,
      candidateMove: context.engineLines[0]?.principalVariation.split(' ')[0],
      teachingFocus: ['centro', 'seguridad del rey', 'coordinacion de piezas'],
      visualAnnotations: [
        { kind: 'square', square: 'd5', color: 'green', label: 'casilla fuerte' },
        { kind: 'arrow', from: 'c3', to: 'd5', color: 'blue', label: 'maniobra candidata' },
      ],
      followUpExercise: 'Crear un puzzle de reconocimiento sobre caballo fuerte en d5.',
      confidence: context.engineLines.length > 0 ? 'medium' : 'low',
    };
  }
}
