# GoalMind AI — Tài liệu kỹ thuật

> Tài liệu này được tổng hợp từ source code thực tế của dự án.  
> Mục tiêu: giúp bạn hiểu **cách tích hợp AI vào ứng dụng thực tế** — từ kiến trúc đến từng dòng code.

---

## Mục lục

1. [Dự án này làm gì?](#1-dự-án-này-làm-gì)
2. [Kiến trúc tổng thể](#2-kiến-trúc-tổng-thể)
3. [Backend — NestJS](#3-backend--nestjs)
4. [Tầng AI — LangChain + LangGraph](#4-tầng-ai--langchain--langgraph)
5. [Tool Calling — Cách AI gọi API](#5-tool-calling--cách-ai-gọi-api)
6. [Orchestrator — Định tuyến ý định](#6-orchestrator--định-tuyến-ý-định)
7. [Streaming SSE — Trả lời real-time](#7-streaming-sse--trả-lời-real-time)
8. [Tool Cache — Tránh gọi API lặp](#8-tool-cache--tránh-gọi-api-lặp)
9. [Frontend — Next.js + assistant-ui](#9-frontend--nextjs--assistant-ui)
10. [Tại sao KHÔNG dùng pgvector + RAG?](#10-tại-sao-không-dùng-pgvector--rag)
11. [Luồng xử lý đầy đủ (end-to-end)](#11-luồng-xử-lý-đầy-đủ-end-to-end)
12. [Tóm tắt các khái niệm cần nhớ](#12-tóm-tắt-các-khái-niệm-cần-nhớ)

---

## 1. Dự án này làm gì?

**GoalMind AI** là chatbot nội bộ cho doanh nghiệp đang dùng **Simplamo** (phần mềm quản trị OKR/EOS). Thay vì phải vào Simplamo thủ công để xem báo cáo, người dùng chỉ cần **hỏi bằng tiếng Việt**:

```
User: "Chỉ số nào đang tệ nhất tuần này?"
AI:   [gọi API Simplamo] → phân tích → trả về card UI đẹp với actions cụ thể
```

**Điểm khác biệt so với chatbot thông thường:**
- AI không chỉ trả lời câu hỏi — nó **thực sự gọi API** để lấy data thật
- AI có thể **thực hiện hành động** (cập nhật trạng thái goal)
- Kết quả trả về là **JSON có cấu trúc** → frontend render thành card UI đẹp

---

## 2. Kiến trúc tổng thể

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                    │
│  ┌─────────────────┐    ┌──────────────────────────────┐   │
│  │  GoalMind       │    │  AssistantUI (chat-ui.tsx)   │   │
│  │  Runtime        │───▶│  - Render chat messages       │   │
│  │  (SSE client)   │    │  - Parse JSON → Card UI       │   │
│  └─────────────────┘    └──────────────────────────────┘   │
└────────────────────────────────┬────────────────────────────┘
                                 │ HTTP POST /api/chat
                                 │ ← SSE stream response
┌────────────────────────────────▼────────────────────────────┐
│                        BACKEND (NestJS)                      │
│  ┌──────────────┐   ┌──────────────────────────────────┐   │
│  │ ChatController│──▶│         Orchestrator             │   │
│  │ /api/chat    │   │  Phân loại intent → route đúng   │   │
│  └──────────────┘   │  sub-agent (goal/metrics/action) │   │
│                      └──────────┬───────────────────────┘   │
│          ┌───────────────────────┼───────────────────┐      │
│          ▼                       ▼                   ▼       │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │  GoalAgent   │  │  MetricsAgent    │  │ ActionAgent  │  │
│  │  (ReAct)     │  │  (ReAct)         │  │  (ReAct)     │  │
│  └──────┬───────┘  └────────┬─────────┘  └──────┬───────┘  │
│         │                   │                    │           │
│  ┌──────▼───────────────────▼────────────────────▼───────┐  │
│  │                    ToolCacheService                    │  │
│  └──────────────────────────┬───────────────────────────┘  │
│                              │                               │
│  ┌───────────────────────────▼───────────────────────────┐  │
│  │                   SimplamoClient                       │  │
│  │           (Axios → Simplamo REST API)                  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Backend — NestJS

Backend xây dựng theo module pattern của NestJS. Mỗi domain có module riêng:

```
src/
├── app.module.ts            ← Root module, import tất cả
├── chat/
│   ├── chat.controller.ts   ← Nhận HTTP POST /api/chat
│   └── chat.service.ts      ← Delegate đến Orchestrator
├── simplamo/
│   └── simplamo.client.ts   ← Axios client gọi Simplamo API
└── agents/
    ├── orchestrator/        ← Phân loại intent + route
    ├── goal/                ← Agent xử lý mục tiêu (rocks/OKRs)
    ├── metrics/             ← Agent xử lý KPI/Scorecard
    ├── action/              ← Agent xử lý Actions/To-dos
    └── cache/               ← TTL cache cho tool results
```

### `app.module.ts` — Wiring tất cả lại

```typescript
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),  // đọc .env toàn cục
    SimplamoModule,      // HTTP client
    GoalModule,          // Sub-agent goals
    MetricsModule,       // Sub-agent metrics
    ActionModule,        // Sub-agent actions
    OrchestratorModule,  // Router
    ChatModule,          // HTTP endpoint
  ],
})
export class AppModule {}
```

---

## 4. Tầng AI — LangChain + LangGraph

Đây là **trái tim** của toàn bộ dự án. Hiểu phần này = hiểu cách tích hợp AI.

### 4.1 ReAct Agent là gì?

**ReAct** = **Re**asoning + **Act**ing. Đây là pattern phổ biến nhất để LLM có thể "làm việc" thay vì chỉ "trả lời".

```
Vòng lặp ReAct:
  ┌─────────────────────────────────────────────────────────┐
  │  1. Nhận câu hỏi từ user                                │
  │  2. LLM suy nghĩ: "Tôi cần gọi tool gì?"               │
  │  3. Gọi tool → nhận kết quả                             │
  │  4. LLM suy nghĩ lại với kết quả mới                    │
  │  5. Nếu cần thêm tool → lặp lại bước 2                  │
  │  6. Khi đủ thông tin → tổng hợp và trả lời              │
  └─────────────────────────────────────────────────────────┘
```

Ví dụ thực tế:
```
User: "Phân tích rock số 3"

LLM nghĩ: "Tôi chưa có danh sách rocks, cần gọi listGoals trước"
→ Gọi listGoals() → nhận 13 rocks, tìm position=3, lấy id

LLM nghĩ: "Cần chi tiết hơn, gọi getGoalDetail"
→ Gọi getGoalDetail(rockId) → nhận milestones, deadline...

LLM nghĩ: "Đủ thông tin rồi, tổng hợp và trả lời"
→ Xuất JSON goal-detail + actions cụ thể
```

### 4.2 Cách tạo một ReAct Agent trong dự án

Mỗi sub-agent (Goal, Metrics, Action) đều được tạo theo cùng một pattern:

```typescript
// goal.agent.ts
@Injectable()
export class GoalAgentService {
  private agent: ReturnType<typeof createReactAgent>;

  constructor(
    private readonly simplamo: SimplamoClient,
    private readonly config: ConfigService,
    private readonly cache: ToolCacheService,
  ) {
    // 1. Khởi tạo LLM
    const llm = new ChatOpenAI({
      model: 'gpt-5.3-codex',
      temperature: 0,           // 0 = deterministic, không "creative"
      openAIApiKey: process.env.OPENAI_API_KEY,
      configuration: { baseURL: process.env.OPENAI_BASE_URL },
    });

    // 2. Tạo agent với LLM + Tools + System Prompt
    this.agent = createReactAgent({
      llm,
      tools: createGoalTools(simplamo, config, cache),  // các hàm AI có thể gọi
      messageModifier: GOAL_AGENT_PROMPT,               // system prompt
      checkpointSaver: new MemorySaver(),               // nhớ conversation history
    });
  }
}
```

**3 thành phần bắt buộc của một Agent:**

| Thành phần | Mục đích |
|---|---|
| **LLM** | Bộ não — suy nghĩ và ra quyết định |
| **Tools** | Tay — thực hiện hành động (gọi API) |
| **System Prompt** | Tính cách + quy tắc hành vi |

### 4.3 `MemorySaver` — Nhớ lịch sử hội thoại

Goal Agent dùng `MemorySaver` và `thread_id` để AI nhớ context giữa các tin nhắn:

```typescript
// Tất cả messages trong session dùng chung 1 thread
const THREAD_ID = 'goal-session-default';

// Khi stream:
this.agent.streamEvents(
  { messages: [new HumanMessage(message)] },
  { version: 'v2', configurable: { thread_id: THREAD_ID } },  // ← key!
);
```

Nhờ đó, nếu user hỏi "chi tiết hơn về rock 3?" sau khi đã xem danh sách, AI biết "rock 3" là gì mà không cần hỏi lại.

---

## 5. Tool Calling — Cách AI gọi API

### 5.1 Tool là gì?

Tool (hay Function Calling) là cách bạn nói với LLM: "Đây là những hàm bạn có thể gọi. Khi nào cần data thật, hãy dùng chúng."

```typescript
// Ví dụ khai báo một tool — metrics.tools.ts
const getScorecardMetrics = tool(
  // Hàm thực thi (AI sẽ trigger khi cần)
  async ({ teamId, interval }) => {
    const raw = await getRawMeasurables(tid, interval ?? 13);
    const processed = raw.map(processMeasurable);
    return JSON.stringify({ success: true, metrics: processed });
  },
  // Metadata — LLM đọc cái này để biết khi nào nên dùng tool
  {
    name: 'getScorecardMetrics',
    description: `Get the team's Scorecard measurables...
      Call this when user asks about KPIs, scorecard overview.`,
    schema: z.object({          // LLM biết cần truyền params gì
      teamId: z.string().optional(),
      interval: z.number().optional(),
    }),
  },
);
```

**Quan trọng:** LLM đọc `description` để quyết định _khi nào_ gọi tool, và đọc `schema` để biết truyền _tham số gì_.

### 5.2 Flow của một tool call

```
User: "Liệt kê chỉ số nào đang tệ"
           ↓
LLM (suy nghĩ): "Nên dùng getOffTrackScorecardMetrics"
           ↓
LangChain intercepts → gọi hàm TypeScript thực tế
           ↓
SimplamoClient.getScorecardMeasurables() → Simplamo API
           ↓
Kết quả JSON → trả lại cho LLM
           ↓
LLM format thành output cho user
```

### 5.3 Các tools hiện có

**Goal Agent tools:**
| Tool | Mục đích |
|---|---|
| `listGoals` | Lấy danh sách tất cả rocks/OKRs |
| `getGoalDetail` | Chi tiết 1 rock: milestones, assignee, deadline |
| `updateGoalStatus` | Cập nhật trạng thái (ON_TRACK/DONE...) |

**Metrics Agent tools:**
| Tool | Mục đích |
|---|---|
| `getScorecardMetrics` | Tổng quan tất cả KPIs |
| `getOffTrackScorecardMetrics` | Chỉ các KPI đang off-track, sort theo severity |
| `getScorecardTrend` | Lịch sử 13 tuần của 1 KPI cụ thể |

**Tất cả tools đều chia sẻ** `getRawMeasurables()` — hàm cache raw API response.

---

## 6. Orchestrator — Định tuyến ý định

Dự án có 3 sub-agent chuyên biệt. Orchestrator quyết định agent nào xử lý từng câu hỏi:

```typescript
// orchestrator.agent.ts
type Intent = 'goal' | 'metrics' | 'action' | 'general';

async *stream(message: string) {
  // Các từ như "ok", "có", "đồng ý" → tiếp tục trong agent cũ
  const intent = CONTINUATION_PATTERN.test(message)
    ? this.lastIntent
    : await this.classifyIntent(message);  // gọi LLM phân loại

  switch (intent) {
    case 'goal':    yield* this.goalAgent.stream(message);
    case 'metrics': yield* this.metricsAgent.stream(message);
    case 'action':  yield* this.actionAgent.stream(message);
  }
}

// Classify bằng cách gọi LLM với prompt siêu ngắn
private async classifyIntent(message: string): Promise<Intent> {
  const result = await llm.invoke([
    new SystemMessage('Classify intent as: goal, metrics, action, or general. One word only.'),
    new HumanMessage(message),
  ]);
  // → "metrics" → route đến MetricsAgent
}
```

**Tại sao tách thành nhiều agent?**
- Mỗi agent có **system prompt riêng** → chuyên môn hóa, ít "hallucinate" hơn
- **Tools riêng** → context window nhỏ hơn → nhanh hơn, rẻ hơn
- Dễ **mở rộng** — thêm agent mới mà không ảnh hưởng agent cũ

---

## 7. Streaming SSE — Trả lời real-time

Thay vì chờ AI trả lời xong rồi mới nhận, dự án dùng **Server-Sent Events (SSE)** để stream từng token.

### 7.1 Backend stream

```typescript
// chat.controller.ts
@Post('chat')
async chat(@Body() body: { message: string }, @Res() res: Response) {
  // Thiết lập SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');

  for await (const chunk of this.chatService.stream(body.message)) {
    if (chunk.startsWith('\x00TOOL_START:')) {
      // Thông báo tool đang chạy → frontend hiện spinner
      res.write(`data: ${JSON.stringify({ type: 'tool_start', tool })}\\n\\n`);
    } else {
      // Token text từ LLM → frontend append vào chat
      res.write(`data: ${JSON.stringify({ content: chunk })}\\n\\n`);
    }
  }
  res.write('data: [DONE]\\n\\n');
}
```

### 7.2 Agent stream events

```typescript
// Trong mỗi agent (goal/metrics/action):
async *stream(message: string): AsyncGenerator<string> {
  const eventStream = this.agent.streamEvents(
    { messages: [new HumanMessage(message)] },
    { version: 'v2' }
  );

  for await (const event of eventStream) {
    if (event.event === 'on_tool_start') {
      yield `\x00TOOL_START:${event.name}\x00`;    // ← signal đặc biệt
    } else if (event.event === 'on_tool_end') {
      yield `\x00TOOL_END:${event.name}\x00`;
    } else if (event.event === 'on_chat_model_stream') {
      const token = event.data?.chunk?.content;
      if (typeof token === 'string') yield token;  // ← stream từng token
    }
  }
}
```

### 7.3 Frontend nhận stream

```typescript
// goalmind-runtime.tsx
const reader = res.body?.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  // Parse SSE events
  const parsed = JSON.parse(payload);
  if (parsed.type === 'tool_start') {
    setActiveTool(parsed.tool);  // → hiện "Đang phân tích..." spinner
  } else if (parsed.content) {
    assistantContent += parsed.content;
    setMessages(/* update last message */);  // → update UI real-time
  }
}
```

---

## 8. Tool Cache — Tránh gọi API lặp

Vấn đề: User hỏi "tổng quan KPI" → gọi API. Rồi hỏi "chỉ số nào tệ?" → **gọi API lần nữa** dù data không đổi.

Giải pháp: `ToolCacheService` — in-memory TTL cache (5 phút mặc định).

### 8.1 Architecture của cache

```
User hỏi "tổng quan"
     ↓
getScorecardMetrics() → check cache key "scorecardMetrics:teamId:13"
     ↓ MISS
getRawMeasurables()   → check cache key "rawMeasurables:teamId:13"
     ↓ MISS
SimplamoClient.getScorecardMeasurables() → Simplamo API  ← API gọi 1 lần duy nhất
     ↓
cache.set("rawMeasurables:teamId:13", raw, 5min)
     ↓
xử lý → cache.set("scorecardMetrics:teamId:13", result, 5min)
     ↓ trả về

User hỏi "chỉ số nào tệ?"
     ↓
getOffTrackScorecardMetrics() → check cache key "offtrackMetrics:teamId:all"
     ↓ MISS
getRawMeasurables()   → check cache key "rawMeasurables:teamId:13"
     ↓ HIT ✅ (dùng lại data cũ, KHÔNG gọi API!)
xử lý → filter off-track → cache.set(...) → trả về
```

### 8.2 Cache invalidation

Sau khi `updateGoalStatus` thay đổi data, cache cũ bị vô hiệu hóa:

```typescript
// goal.tools.ts — sau khi update thành công
cache.invalidate(`goalDetail:${rockId}`);     // xóa detail cache của rock đó
cache.invalidatePrefix('listGoals:');          // xóa toàn bộ list cache
```

### 8.3 API của ToolCacheService

```typescript
cache.get<T>(key)               // → T | undefined (auto-expire khi quá TTL)
cache.set<T>(key, value, ttlMs) // → lưu với TTL (mặc định 5 phút)
cache.invalidate(key)           // → xóa 1 key
cache.invalidatePrefix(prefix)  // → xóa tất cả key có prefix đó
```

---

## 9. Frontend — Next.js + assistant-ui

### 9.1 Luồng UI

```
GoalMindRuntimeProvider (goalmind-runtime.tsx)
  └─ Quản lý state messages[], isRunning, activeTool
  └─ SSE client: fetch → stream → update state

ChatUI (chat-ui.tsx)
  └─ AssistantMessage
       └─ AssistantMessageContent
            ├─ [streaming] ToolProgressIndicator (hiện spinner tool)
            ├─ [json complete] parseMetricFromText() → MetricView
            ├─ [json complete] parseGoalsFromText()  → GoalCardList / GoalListView
            └─ [plain text]   MessagePrimitive.Content
```

### 9.2 Smart JSON → Card UI parsing

Khi AI trả về JSON, frontend không hiện raw JSON mà parse thành UI card đẹp:

```typescript
// chat-ui.tsx — AssistantMessageContent
const jsonComplete = /```json[\s\S]*?```/.test(rawText);

if (jsonComplete) {
  // Thử parse metric schema trước
  const metricParsed = parseMetricFromText(rawText);
  if (metricParsed) return <MetricView payload={metricParsed} />;

  // Thử parse goal schema
  const goalParsed = parseGoalsFromText(rawText);
  if (goalParsed) return goalParsed.type === 'goal-list'
    ? <GoalListView rocks={goalParsed.rocks} />
    : <GoalCardList goals={goalParsed.goals} />;
}

// Fallback: text thường
return <MessagePrimitive.Content />;
```

**3 loại JSON schema → 3 loại UI:**

| Schema type | Component | Hiển thị |
|---|---|---|
| `scorecard-overview` | `ScorecardOverviewView` | Summary badges + tất cả KPI cards |
| `scorecard-offtrack` | `ScorecardOfftrackView` | Chỉ KPI lệch mục tiêu, sort theo severity |
| `scorecard-trend` | `ScorecardTrendView` | 1 KPI với bar chart lịch sử 13 tuần |
| `goal-list` | `GoalListView` | Danh sách collapsible có milestone |
| `goal-detail` | `GoalCardList` | Card chi tiết với actions |

---

## 10. Tại sao KHÔNG dùng pgvector + RAG?

Đây là câu hỏi rất hay. Để hiểu tại sao, cần biết RAG là gì và khi nào nên dùng.

### 10.1 RAG (Retrieval-Augmented Generation) là gì?

```
RAG hoạt động như sau:
  User hỏi câu hỏi
       ↓
  Vector hóa câu hỏi (embedding)
       ↓
  Tìm trong pgvector những đoạn văn bản "gần nhất" về mặt semantic
       ↓
  Nhét những đoạn văn đó vào context window của LLM
       ↓
  LLM trả lời dựa trên những đoạn văn đó
```

**RAG phù hợp khi:** Bạn có một kho tài liệu tĩnh lớn (docs, FAQ, legal documents...) và muốn AI trả lời dựa trên nội dung đó mà không cần fine-tune model.

### 10.2 Tại sao GoalMind AI KHÔNG phù hợp với RAG?

| Tiêu chí | RAG | Tool Calling (GoalMind dùng) |
|---|---|---|
| **Loại data** | Tĩnh (documents, text) | **Động** (realtime API data) |
| **Độ mới của data** | Cần re-embed khi data thay đổi | Luôn mới nhất (gọi API) |
| **Cấu trúc data** | Unstructured text | **Structured JSON** |
| **Khả năng hành động** | Chỉ đọc | **Đọc + Ghi** (update status) |
| **Nguồn dữ liệu** | Embedded sẵn trong DB | Live từ Simplamo API |
| **Khi nào phù hợp** | Q&A về văn bản | **Q&A + Actions về operational data** |

### 10.3 Phân tích chi tiết từng lý do

**❌ Lý do 1: Data luôn thay đổi**

Dữ liệu KPI, rocks, milestones trong Simplamo thay đổi **hàng ngày, hàng tuần**. Với RAG:
- Bạn phải liên tục re-embed data mới vào pgvector
- Có thể AI trả lời dựa trên data cũ vài giờ trước
- Với Tool Calling: Gọi API → data **100% real-time**

**❌ Lý do 2: Data đã có cấu trúc**

```json
{
  "title": "Tăng doanh thu Q2",
  "percentDone": 65,
  "consecutiveOffTrackWeeks": 3,
  "achievementPct": 78
}
```

Data Simplamo đã là JSON có cấu trúc rõ ràng. RAG phù hợp với **unstructured text** (như PDF, bài viết). Đưa JSON vào vector DB là lãng phí — bạn đang "text hóa" data đã structured.

**❌ Lý do 3: Cần thực hiện hành động (không chỉ đọc)**

GoalMind AI có thể **cập nhật trạng thái goals**:
```
User: "Mark rock 3 là DONE"
AI: gọi updateGoalStatus() → PATCH /eos-core/rocks/{rockId}
```
RAG chỉ có thể *đọc và tổng hợp* từ vector store, không thể *thực hiện actions*.

**❌ Lý do 4: Logic phức tạp cần code thực**

Tính toán `consecutiveOffTrackWeeks`, `achievementPct`, trend analysis... đòi hỏi code TypeScript thực sự, không phải "retrieve text và để LLM tính". Ví dụ:

```typescript
// metrics.tools.ts — logic thực tế
function countConsecutiveOffTrack(recent, goalValue, orientation) {
  let count = 0;
  for (const s of recent) {
    const isOffTrack = orientation === 'gte'
      ? s.value < goalValue
      : s.value > goalValue;
    if (isOffTrack) count++;
    else break;   // dừng ngay khi gặp tuần on-track
  }
  return count;
}
```

Nếu dùng RAG, bạn sẽ nhét raw numbers vào vector DB rồi nhờ LLM "tự tính" → dễ sai, không deterministic.

### 10.4 Khi nào NÊN dùng RAG trong GoalMind AI?

Nếu dự án mở rộng thêm các tính năng sau thì mới cần RAG:

```
✅ Dùng RAG khi thêm:
- Chatbot hỏi đáp về "Cách sử dụng Simplamo" (docs tĩnh)
- Tìm kiếm lịch sử meeting notes / email
- Q&A từ file PDF policy của công ty
- Semantic search trong kho tài liệu nội bộ
```

### 10.5 Tóm tắt quyết định kiến trúc

```
Câu hỏi để chọn RAG hay Tool Calling:

"Data của tôi là gì?"
├─ Văn bản/docs tĩnh, ít thay đổi
│    └─ RAG + pgvector ✅
│
└─ Data có cấu trúc, thay đổi liên tục, cần actions
     └─ Tool Calling + LangChain ReAct ✅ (như GoalMind AI)
```

---

## 11. Luồng xử lý đầy đủ (end-to-end)

Ví dụ: User gõ **"Liệt kê chỉ số tệ nhất"**

```
1. Frontend (goalmind-runtime.tsx)
   → POST /api/chat { message: "Liệt kê chỉ số tệ nhất" }

2. ChatController.chat()
   → Set SSE headers
   → Gọi ChatService.stream()

3. ChatService → OrchestratorService.stream()
   → LLM classifyIntent("Liệt kê chỉ số tệ nhất")
   → Trả về "metrics"

4. MetricsAgentService.stream()
   → LangGraph ReAct loop bắt đầu

5. LLM (lần 1 — reasoning):
   → "Tôi cần dùng getOffTrackScorecardMetrics"
   → Emit event: on_tool_start
   → Backend stream: "\x00TOOL_START:getOffTrackScorecardMetrics\x00"
   → Frontend: setActiveTool("getOffTrackScorecardMetrics") → hiện spinner "Đang tìm chỉ số lệch mục tiêu..."

6. Tool execution:
   → check cache "offtrackMetrics:teamId:all" → MISS
   → getRawMeasurables(teamId, 13)
     → check cache "rawMeasurables:teamId:13" → MISS (lần đầu)
     → SimplamoClient.getScorecardMeasurables() → HTTP GET Simplamo
     → cache.set("rawMeasurables:teamId:13", raw)
   → filter off-track, sort CRITICAL first
   → cache.set("offtrackMetrics:teamId:all", result)
   → Emit: on_tool_end
   → Backend stream: "\x00TOOL_END:getOffTrackScorecardMetrics\x00"
   → Frontend: setActiveTool(null)

7. LLM (lần 2 — generating):
   → Nhận tool result
   → Viết pre-text: "Phát hiện 2 chỉ số đang lệch mục tiêu:"
   → Viết JSON block với schema scorecard-offtrack
   → Stream từng token qua on_chat_model_stream

8. Backend stream each token:
   → res.write(`data: {"content": "P"}`)
   → res.write(`data: {"content": "h"}`)
   → ...

9. Frontend (goalmind-runtime.tsx):
   → Append từng token vào assistantContent
   → setMessages() → update UI real-time

10. Frontend (chat-ui.tsx — AssistantMessageContent):
    → Khi JSON block bắt đầu streaming:
      → Hiện pre-text + GoalSkeleton (loading placeholder)
    → Khi JSON block hoàn tất:
      → parseMetricFromText() → parse schema "scorecard-offtrack"
      → Render <ScorecardOfftrackView> với MetricCard cho từng KPI

11. res.write('data: [DONE]')
    → frontend: setIsRunning(false)
    → Conversation kết thúc
```

---

## 12. Tóm tắt các khái niệm cần nhớ

| Khái niệm | Giải thích ngắn gọn |
|---|---|
| **ReAct Agent** | Vòng lặp: suy nghĩ → gọi tool → suy nghĩ lại → trả lời |
| **Tool / Function Calling** | Cách LLM gọi code TypeScript thực tế |
| **System Prompt** | Tính cách + quy tắc của AI, không thay đổi theo conversation |
| **MemorySaver** | Lưu lịch sử hội thoại trong RAM, AI nhớ context |
| **SSE (Server-Sent Events)** | HTTP stream — server push data liên tục đến client |
| **streamEvents** | LangGraph API để nhận từng event (tool_start, token...) |
| **ToolCacheService** | In-memory Map với TTL, tránh gọi API trùng |
| **Orchestrator** | Router: phân loại intent và gọi đúng sub-agent |
| **RAG** | Tìm kiếm văn bản tương đồng → phù hợp với docs tĩnh |
| **Tool Calling** | Gọi API real-time → phù hợp với data động, cần actions |

---

> **Gợi ý học tiếp:**
> - Thử thêm 1 tool mới cho `MetricsAgent` (ví dụ: `getTopPerformers`)
> - Tìm hiểu về `LangGraph` để build workflow phức tạp hơn ReAct đơn giản
> - Đọc thêm về `OpenAI function calling spec` để hiểu cơ chế tool calling ở tầng API
