/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { MemorySaver } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import { SimplamoClient } from '../../simplamo/simplamo.client';
import { createGoalTools } from './goal.tools';
import { GOAL_AGENT_PROMPT } from './goal.prompts';
import { ToolCacheService } from '../cache/tool-cache.service';

// Single thread ID — all conversations share one persistent session.
// Replace with a per-user/session ID if multi-user support is needed.
const THREAD_ID = 'goal-session-default';

@Injectable()
export class GoalAgentService {
  private readonly checkpointSaver = new MemorySaver();

  constructor(
    private readonly simplamo: SimplamoClient,
    private readonly config: ConfigService,
    private readonly cache: ToolCacheService,
  ) {}

  async *stream(message: string, apiKey: string): AsyncGenerator<string> {
    const llm = new ChatOpenAI({
      model: 'gpt-5.3-codex',
      temperature: 0,
      openAIApiKey: apiKey,
      configuration: { baseURL: process.env.OPENAI_BASE_URL },
      streamUsage: false,
      maxRetries: 0,
    });
    const agent = createReactAgent({
      llm,
      tools: createGoalTools(this.simplamo, this.config, this.cache),
      messageModifier: GOAL_AGENT_PROMPT,
      checkpointSaver: this.checkpointSaver,
    });
    const eventStream = agent.streamEvents(
      { messages: [new HumanMessage(message)] },
      { version: 'v2', configurable: { thread_id: THREAD_ID } },
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
