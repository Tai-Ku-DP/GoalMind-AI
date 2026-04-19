import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import { SimplamoClient } from '../../simplamo/simplamo.client';
import { createMetricsTools } from './metrics.tools';
import { METRICS_AGENT_PROMPT } from './metrics.prompts';
import { ToolCacheService } from '../cache/tool-cache.service';

@Injectable()
export class MetricsAgentService {
  private agent: ReturnType<typeof createReactAgent>;

  constructor(
    private readonly simplamo: SimplamoClient,
    private readonly config: ConfigService,
    private readonly cache: ToolCacheService,
  ) {
    const llm = new ChatOpenAI({
      model: 'gpt-5.3-codex',
      temperature: 0,
      openAIApiKey: process.env.OPENAI_API_KEY,
      configuration: { baseURL: process.env.OPENAI_BASE_URL },
      streamUsage: false,
    });
    this.agent = createReactAgent({
      llm,
      tools: createMetricsTools(simplamo, config, cache),
      messageModifier: METRICS_AGENT_PROMPT,
    });
  }

  async *stream(message: string): AsyncGenerator<string> {
    const eventStream = this.agent.streamEvents(
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
