import { Injectable } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { GoalAgentService } from '../goal/goal.agent';
import { MetricsAgentService } from '../metrics/metrics.agent';
import { ActionAgentService } from '../action/action.agent';
import { SessionContextService } from '../../session/session-context.service';
import { SimplamoClient } from '../../simplamo/simplamo.client';
import { ConfigService } from '@nestjs/config';

type Intent = 'goal' | 'metrics' | 'action' | 'general';

// Short affirmation/negation tokens that carry no standalone intent —
// always continue within the previous sub-agent's domain.
const CONTINUATION_PATTERN =
  /^(ok|oke|okay|có|co|yes|đúng|dung|được|duoc|làm đi|lam di|không|khong|no|thôi|thoi|sure|yep|nope|confirm|xác nhận|xac nhan|tiếp|tiep|đi|di)$/i;

// "đổi team" / "change team" triggers
const CHANGE_TEAM_PATTERN =
  /^(đổi team|doi team|change team|chọn team khác|chon team khac|reset team)$/i;

@Injectable()
export class OrchestratorService {
  private lastIntent: Intent = 'general';
  private readonly companyId: string;

  constructor(
    private readonly goalAgent: GoalAgentService,
    private readonly metricsAgent: MetricsAgentService,
    private readonly actionAgent: ActionAgentService,
    private readonly sessionCtx: SessionContextService,
    private readonly simplamo: SimplamoClient,
    private readonly config: ConfigService,
  ) {
    this.companyId = this.config.get<string>(
      'SIMPLAMO_COMPANY_ID',
      '60fd7f693e81570057440b4e',
    );
  }

  async *stream(message: string): AsyncGenerator<string> {
    const trimmed = message.trim();

    // ── "đổi team" → reset và bắt đầu lại flow chọn team ──
    if (CHANGE_TEAM_PATTERN.test(trimmed)) {
      this.sessionCtx.resetTeam();
      yield* this.teamSelectionFlow();
      return;
    }

    // ── Đang chờ user chọn team ──
    if (this.sessionCtx.pendingTeamSelection) {
      yield* this.handleTeamInput(trimmed);
      return;
    }

    // ── Chưa có team → phân loại intent trước, lưu lại, rồi bắt đầu chọn team ──
    if (!this.sessionCtx.hasTeam()) {
      // Classify intent ngay để lưu lại (chỉ khi không phải câu ngắn chung)
      if (!CONTINUATION_PATTERN.test(trimmed)) {
        const intent = await this.classifyIntent(trimmed);
        this.lastIntent = intent;
        // Lưu pending intent để sau khi chọn team sẽ tự route
        if (intent !== 'general') {
          this.sessionCtx.pendingIntent = { intent, message: trimmed };
        }
      }
      yield* this.teamSelectionFlow();
      return;
    }

    // ── Đã có team → route đến agent như bình thường ──
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
        yield `Bạn đang làm việc với team **${this.sessionCtx.teamName}**.\n\nTôi có thể giúp bạn về:\n- 🎯 **Goals** — Mục tiêu, Rocks, OKR\n- 📊 **Metrics** — Chỉ số, Scorecard, KPI\n- ✅ **Actions** — Todo, công việc cần làm\n\nHoặc gõ **"đổi team"** để chọn team khác.`;
    }
  }

  // ── Team Selection Flow ────────────────────────────────────────────────────

  private async *teamSelectionFlow(): AsyncGenerator<string> {
    try {
      // Nếu chưa có danh sách teams, fetch từ API
      if (!this.sessionCtx.availableTeams.length) {
        yield 'Đang tải danh sách teams...';
        const teams = await this.simplamo.listTeams(this.companyId);
        if (!teams.length) {
          yield '\n❌ Không tìm thấy team nào. Vui lòng kiểm tra cấu hình `SIMPLAMO_COMPANY_ID`.';
          return;
        }
        this.sessionCtx.setAvailableTeams(teams);
      }

      yield `\nVui lòng chọn team bạn muốn làm việc:\n\n${this.sessionCtx.formatTeamList()}\n\n→ Nhập số hoặc tên team:`;
      this.sessionCtx.setPendingSelection(true);
    } catch {
      yield '\n❌ Không thể tải danh sách teams. Vui lòng thử lại.';
    }
  }

  private async *handleTeamInput(input: string): AsyncGenerator<string> {
    const team = this.sessionCtx.resolveTeamFromInput(input);

    if (!team) {
      yield `❌ Không tìm thấy team "${input}". Vui lòng chọn lại:\n\n${this.sessionCtx.formatTeamList()}\n\n→ Nhập số hoặc tên team:`;
      return; // Vẫn giữ pendingTeamSelection = true
    }

    this.sessionCtx.setTeam(team._id, team.name);
    // Thông báo ngắn gọn, không hỏi lại
    yield `✅ Đã chọn team **${team.name}**. Đang xử lý yêu cầu của bạn...\n\n`;

    // ── Nếu có pending intent → tự route luôn ──
    const pending = this.sessionCtx.pendingIntent;
    this.sessionCtx.pendingIntent = null; // clear trước khi route

    if (pending) {
      this.lastIntent = pending.intent as
        | 'goal'
        | 'metrics'
        | 'action'
        | 'general';
      switch (pending.intent) {
        case 'goal':
          yield* this.goalAgent.stream(pending.message);
          break;
        case 'metrics':
          yield* this.metricsAgent.stream(pending.message);
          break;
        case 'action':
          yield* this.actionAgent.stream(pending.message);
          break;
        default:
          yield `Bạn đang làm việc với team **${team.name}**.\n\nTôi có thể giúp bạn về:\n- 🎯 **Goals** — Mục tiêu, Rocks, OKR\n- 📊 **Metrics** — Chỉ số, Scorecard, KPI\n- ✅ **Actions** — Todo, công việc cần làm`;
      }
    } else {
      // Không có pending intent (user chỉ gõ "đổi team") → hỏi muốn làm gì
      yield `Bạn đang làm việc với team **${team.name}**.\n\nTôi có thể giúp bạn về:\n- 🎯 **Goals** — Mục tiêu, Rocks, OKR\n- 📊 **Metrics** — Chỉ số, Scorecard, KPI\n- ✅ **Actions** — Todo, công việc cần làm`;
    }
  }

  // ── Intent Classification ──────────────────────────────────────────────────

  private async classifyIntent(message: string): Promise<Intent> {
    const llm = new ChatOpenAI({
      model: 'gpt-5.3-codex',
      temperature: 0,
      openAIApiKey: process.env.OPENAI_API_KEY,
      configuration: { baseURL: process.env.OPENAI_BASE_URL },
      streamUsage: false,
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
