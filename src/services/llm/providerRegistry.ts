import type { LlmProviderConfig, LlmTutorProvider } from '../../domain/llmTypes';
import { MockTutorProvider } from './mockTutorProvider';

const mockProvider = new MockTutorProvider();

export const llmProviderConfigs: LlmProviderConfig[] = [
  mockProvider.config,
  {
    id: 'chat-completions-compatible',
    label: 'Chat completions compatible API',
    kind: 'chat-completions-compatible',
    model: 'configured-by-user',
    enabled: false,
    baseUrl: '',
    apiKeyEnv: 'ATEROMANTE_CHAT_API_KEY',
    supportsStreaming: true,
  },
  {
    id: 'local-http-default',
    label: 'Local HTTP model',
    kind: 'local-http',
    model: 'configured-by-user',
    enabled: false,
    baseUrl: 'http://127.0.0.1:11434',
    supportsStreaming: true,
  },
];

export function createTutorProvider(providerId: string): LlmTutorProvider {
  if (providerId === mockProvider.config.id) {
    return mockProvider;
  }

  throw new Error(`LLM provider is not implemented yet: ${providerId}`);
}
