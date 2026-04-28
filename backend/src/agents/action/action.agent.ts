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
  constructor(
    private readonly simplamo: SimplamoClient,
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
      tools: createActionTools(
        this.simplamo,
        this.cache,
        () => this.sessionCtx.teamId ?? '',
      ),
      messageModifier: ACTION_AGENT_PROMPT,
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
