/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import { SimplamoClient } from '../../simplamo/simplamo.client';
import { ToolCacheService } from '../cache/tool-cache.service';
import { createActionTools } from './action.tools';
import { ACTION_AGENT_PROMPT } from './action.prompts';
import { SessionContextService } from '../../session/session-context.service';

@Injectable()
export class ActionAgentService {
  private agent: ReturnType<typeof createReactAgent>;

  constructor(
    simplamo: SimplamoClient,
    cache: ToolCacheService,
    private readonly sessionCtx: SessionContextService,
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
      tools: createActionTools(simplamo, cache, () => sessionCtx.teamId ?? ''),
      messageModifier: ACTION_AGENT_PROMPT,
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
      } else if (
        event.event === 'on_chat_model_stream' &&
        event.data?.chunk?.content
      ) {
        const token = event.data.chunk.content;
        if (typeof token === 'string') {
          yield token;
        }
      }
    }
  }
}
