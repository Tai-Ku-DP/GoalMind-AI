import { Injectable } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { GoalAgentService } from '../goal/goal.agent';
import { MetricsAgentService } from '../metrics/metrics.agent';
import { ActionAgentService } from '../action/action.agent';

type Intent = 'goal' | 'metrics' | 'action' | 'general';

@Injectable()
export class OrchestratorService {
  constructor(
    private readonly goalAgent: GoalAgentService,
    private readonly metricsAgent: MetricsAgentService,
    private readonly actionAgent: ActionAgentService,
  ) {}

  async *stream(message: string): AsyncGenerator<string> {
    const intent = await this.classifyIntent(message);

    switch (intent) {
      case 'goal':
        yield* this.goalAgent.stream(message);
        break;
      case 'metrics':
        yield* this.metricsAgent.stream(message);
        break;
      case 'action':
        yield* this.actionAgent.stream(message);
        break;
      default:
        yield 'Xin chào! Tôi là GoalMind AI — trợ lý quản trị kết nối với Simplamo. Bạn muốn hỏi về mục tiêu (Goals), chỉ số (Metrics) hay công việc (Actions)?';
    }
  }

  private async classifyIntent(message: string): Promise<Intent> {
    const llm = new ChatOpenAI({
      model: 'gpt-4o-mini',
      temperature: 0,
    });
    const result = await llm.invoke([
      new SystemMessage(
        'Classify the user intent as exactly one word: goal, metrics, action, or general. Only respond with that single word.',
      ),
      new HumanMessage(message),
    ]);
    const intent = (
      typeof result.content === 'string'
        ? result.content
        : ''
    )
      .trim()
      .toLowerCase();

    const validIntents: readonly string[] = ['goal', 'metrics', 'action'];
    return validIntents.includes(intent)
      ? (intent as Intent)
      : 'general';
  }
}
