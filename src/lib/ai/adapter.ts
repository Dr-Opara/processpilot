import "server-only";

/**
 * Provider-neutral AI adapter interface, per ADR-0008. Every ai-*.ts
 * service calls `getAiProvider().complete()` — never a vendor SDK
 * directly — so swapping/adding a model vendor touches only
 * providers/*.ts, and the governance boundary
 * (docs/architecture/ai-architecture.md) is enforced once, here and in
 * the services that consume this interface, rather than duplicated
 * per feature.
 *
 * `systemPrompt` and `userPrompt` are kept as separate fields (never
 * concatenated by a caller before reaching the provider) so every
 * provider implementation can put retrieved/untrusted content in the
 * user turn and the fixed governance/behavior instructions in the
 * system turn — see prompt-safety.ts for the injection-defense
 * reasoning this split exists to support.
 */
export interface AiCompletionRequest {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
}

export interface AiCompletionResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface AiProvider {
  readonly name: string;
  complete(request: AiCompletionRequest): Promise<AiCompletionResult>;
}
