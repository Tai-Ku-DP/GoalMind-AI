import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import { SimplamoClient } from '../../simplamo/simplamo.client';
import { createMetricsTools } from './metrics.tools';
import { METRICS_AGENT_PROMPT } from './metrics.prompts';
import { ToolCacheService } from '../cache/tool-cache.service';
import { SessionContextService } from '../../session/session-context.service';

@Injectable()
export class MetricsAgentService {
  constructor(
    private readonly simplamo: SimplamoClient,
    private readonly config: ConfigService,
    private readonly cache: ToolCacheService,
    private readonly sessionCtx: SessionContextService,
  ) {}

  async *stream(message: string, apiKey: string): AsyncGenerator<string> {
    const llm = new ChatOpenAI({
      model: 'gpt-5.3-codex',
      temperature: 0,
      openAIApiKey: apiKey,
      configuration: { baseURL: process.env.OPENAI_BASE_URL },
      streamUsage: false,
    });
    const agent = createReactAgent({
      llm,
      tools: createMetricsTools(
        this.simplamo,
        this.config,
        this.cache,
        () => this.sessionCtx.teamId ?? '',
      ),
      messageModifier: METRICS_AGENT_PROMPT,
    });
    const eventStream = agent.streamEvents(
      { messages: [new HumanMessage(message)] },
      { version: 'v2' },
    );
    for await (const event of eventStream) {
      if (event.event === 'on_tool_start') {
        yield `\x00TOOL_START:${event.name}\x00`;
      } else if (event.event === 'on_tool_end') {
        yield `\x00TOOL_END:${event.name}\x00`;
      } else if (event.event === 'on_chat_model_stream') {
        const chunk = (event.data as { chunk?: { content?: unknown } })?.chunk;
        const token = chunk?.content;
        if (typeof token === 'string' && token) {
          yield token;
        }
      }
    }
  }
}
