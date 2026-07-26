import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey } from "@/lib/ai/availability";
import type { AiCompletionRequest, AiCompletionResult, AiProvider } from "@/lib/ai/adapter";

/**
 * The initial concrete AiProvider, per ADR-0008. Constructs the client
 * lazily (not at module load) so importing this module never throws in
 * an environment with no configured key — only calling complete() does,
 * and every ai-*.ts service already checks isAiConfigured() before
 * reaching here, so that throw is a defensive backstop, not the normal
 * path a caller hits.
 */
const DEFAULT_MODEL = "claude-sonnet-5";
const DEFAULT_MAX_TOKENS = 2048;

export class AnthropicProvider implements AiProvider {
  readonly name = "anthropic";
  private client: Anthropic | null = null;

  private getClient(): Anthropic {
    if (!this.client) {
      this.client = new Anthropic({ apiKey: getAnthropicApiKey() });
    }
    return this.client;
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    const client = this.getClient();
    const response = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
      system: request.systemPrompt,
      messages: [{ role: "user", content: request.userPrompt }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    return {
      text,
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  }
}
