/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { createAgent, ReactAgent } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import { SimplamoClient } from '../../simplamo/simplamo.client';
import { createActionTools } from './action.tools';
import { ACTION_AGENT_PROMPT } from './action.prompts';

@Injectable()
export class ActionAgentService {
  private agent: ReactAgent;

  constructor(simplamo: SimplamoClient) {
    const model = new ChatOpenAI({
      model: 'gpt-4o',
      temperature: 0,
    });

    this.agent = createAgent({
      model,
      tools: createActionTools(simplamo),
      systemPrompt: ACTION_AGENT_PROMPT,
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
