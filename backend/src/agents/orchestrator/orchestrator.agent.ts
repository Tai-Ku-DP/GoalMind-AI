import { Injectable } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { GoalAgentService } from '../goal/goal.agent';
import { MetricsAgentService } from '../metrics/metrics.agent';
import { ActionAgentService } from '../action/action.agent';

type Intent = 'goal' | 'metrics' | 'action' | 'general';

// Short affirmation/negation tokens that carry no standalone intent —
// always continue within the previous sub-agent's domain.
const CONTINUATION_PATTERN =
  /^(ok|oke|okay|có|co|yes|đúng|dung|được|duoc|làm đi|lam di|không|khong|no|thôi|thoi|sure|yep|nope|confirm|xác nhận|xac nhan|tiếp|tiep|đi|di)$/i;

@Injectable()
export class OrchestratorService {
  private lastIntent: Intent = 'general';

  constructor(
    private readonly goalAgent: GoalAgentService,
    private readonly metricsAgent: MetricsAgentService,
    private readonly actionAgent: ActionAgentService,
  ) {}

  async *stream(message: string): AsyncGenerator<string> {
    const trimmed = message.trim();

    // If the message is a pure continuation token, reuse the last intent
    // so confirmation replies stay inside the same sub-agent session.
    const intent = CONTINUATION_PATTERN.test(trimmed)
      ? this.lastIntent
      : await this.classifyIntent(trimmed);

    this.lastIntent = intent;

    switch (intent) {
      case 'goal':
        yield* this.goalAgent.stream(trimmed);
        break;
      case 'metrics':
        yield* this.metricsAgent.stream(trimmed);
        break;
      case 'action':
        yield* this.actionAgent.stream(trimmed);
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
    const intent = (typeof result.content === 'string' ? result.content : '')
      .trim()
      .toLowerCase();

    const validIntents: readonly string[] = ['goal', 'metrics', 'action'];
    return validIntents.includes(intent) ? (intent as Intent) : 'general';
  }
}
