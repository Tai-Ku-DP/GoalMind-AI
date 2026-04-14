/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import { SimplamoClient } from '../../simplamo/simplamo.client';
import { createActionTools } from './action.tools';
import { ACTION_AGENT_PROMPT } from './action.prompts';

@Injectable()
export class ActionAgentService {
  private agent: ReturnType<typeof createReactAgent>;

  constructor(private readonly simplamo: SimplamoClient) {
    const llm = new ChatOpenAI({
      model: 'gpt-4o',
      temperature: 0,
    });
    this.agent = createReactAgent({
      llm,
      tools: createActionTools(simplamo),
      messageModifier: ACTION_AGENT_PROMPT,
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
