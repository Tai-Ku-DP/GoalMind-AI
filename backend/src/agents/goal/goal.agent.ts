/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import { SimplamoClient } from '../../simplamo/simplamo.client';
import { createGoalTools } from './goal.tools';
import { GOAL_AGENT_PROMPT } from './goal.prompts';

@Injectable()
export class GoalAgentService {
  private agent: ReturnType<typeof createReactAgent>;

  constructor(
    private readonly simplamo: SimplamoClient,
    private readonly config: ConfigService,
  ) {
    const llm = new ChatOpenAI({
      model: 'gpt-4o',
      temperature: 0,
    });
    this.agent = createReactAgent({
      llm,
      tools: createGoalTools(simplamo, config),
      messageModifier: GOAL_AGENT_PROMPT,
    });
  }

  async *stream(message: string): AsyncGenerator<string> {
    const eventStream = this.agent.streamEvents(
      { messages: [new HumanMessage(message)] },
      { version: 'v2' },
    );
    for await (const event of eventStream) {
      if (
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
