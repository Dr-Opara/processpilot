import "server-only";
import { AnthropicProvider } from "@/lib/ai/providers/anthropic-provider";
import type { AiProvider } from "@/lib/ai/adapter";

let provider: AiProvider | undefined;

/** The one place that names a concrete provider — every ai-*.ts service calls this, never `new AnthropicProvider()` directly, per ADR-0008. */
export function getAiProvider(): AiProvider {
  if (!provider) provider = new AnthropicProvider();
  return provider;
}
