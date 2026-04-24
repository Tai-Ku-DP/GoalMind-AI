# GoalMind AI — Tài liệu kỹ thuật

> Viết theo phong cách "học để hiểu" — đi từ tổng quan đến chi tiết, giải thích **tại sao** chứ không chỉ **làm gì**.

---

## 1. Tổng quan hệ thống

GoalMind AI là một **AI chatbot quản trị doanh nghiệp** kết nối trực tiếp với nền tảng **Simplamo** (phần mềm EOS — Entrepreneurial Operating System). User đặt câu hỏi bằng tiếng Việt, AI hiểu intent, gọi Simplamo API, rồi trả về kết quả được render thành UI card.

### Tech stack

| Layer | Công nghệ |
|---|---|
| Frontend | Next.js 14 (App Router), TailwindCSS, `@assistant-ui/react` |
| Backend | NestJS, LangChain.js, LangGraph (ReAct agent) |
| AI model | GPT-5.3-codex (qua LLMGate proxy) |
| External API | Simplamo REST API |
| Persistence | IndexedDB (chat history, browser-side) |

### Kiến trúc tổng thể

```
Browser (Next.js)
  │
  │  POST /api/chat  (SSE stream)
  │  POST /api/session/reset  (khi xóa lịch sử)
  ▼
NestJS Backend
  │
  ├─ ChatController → ChatService → OrchestratorService
  │                                       │
  │                         ┌─────────────┼─────────────┐
  │                         ▼             ▼             ▼
  │                    GoalAgent   MetricsAgent   ActionAgent
  │                         │             │             │
  │                         └──────── SimplamoClient ───┘
  │                                  (Axios → Simplamo API)
  │
  │  SSE events: { content: "..." } / { type: "tool_start" } / { type: "tool_end" }
  ▼
Frontend: GoalMindRuntimeProvider
  │
  ├─ Reads SSE stream token-by-token
  ├─ Tracks tool_start/tool_end → shows loading UI
  └─ AssistantMessageContent → parseAllSegments → renders UI cards
```

---

## 2. Flow hoàn chỉnh: từ câu hỏi đến UI card

Ví dụ: user gõ **"Chỉ số nào đang off-track?"**

### Bước 1 — Frontend gửi request

```typescript
// goalmind-runtime.tsx
const res = await fetch(`${API_URL}/api/chat`, {
  method: "POST",
  body: JSON.stringify({ message: "Chỉ số nào đang off-track?" }),
});
```

Frontend dùng **SSE (Server-Sent Events)** — nhận từng chunk ngay khi server yield, không phải đợi response hoàn tất. Lý do: text xuất hiện "gõ dần" như ChatGPT.

### Bước 2 — Backend nhận và stream response

```typescript
// chat.controller.ts
@Post('chat')
async chat(@Body() body, @Res() res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.flushHeaders(); // Gửi header ngay để browser biết đây là SSE

  for await (const chunk of this.chatService.stream(body.message)) {
    res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
  }
  res.write('data: [DONE]\n\n');
  res.end();
}
```

**Tại sao SSE thay vì WebSocket?** SSE là HTTP thuần, một chiều (server→client) — đủ cho chat, không cần setup WS server riêng.

### Bước 3 — OrchestratorService: Team selection + routing

```
stream("Chỉ số nào đang off-track?")
  │
  ├─ Phát hiện "đổi team"? → resetTeam() → teamSelectionFlow()
  ├─ pendingTeamSelection = true? → handleTeamInput()
  │
  ├─ !hasTeam()?
  │    → classifyIntent() trước → lưu pendingIntent
  │    → teamSelectionFlow() [hỏi user chọn team]
  │
  └─ Đã có team → classifyIntent() → LLM call riêng
       │
       ├─ "goal"    → GoalAgentService.stream()
       ├─ "metrics" → MetricsAgentService.stream()
       ├─ "action"  → ActionAgentService.stream()
       └─ "general" → trả lời cứng
```

**Continuation pattern:** user gõ "ok", "có", "làm đi" → không classify lại, dùng lastIntent. Cho phép multi-turn: "Phân tích goal số 3" → "ok" → GoalAgent tiếp tục đúng context.

**pendingIntent flow (mới):**
```
User: "Danh sách hành động" (chưa có team)
  → classifyIntent() = "action"
  → pendingIntent = { intent: "action", message: "Danh sách hành động" }
  → teamSelectionFlow()

User: "Product Team"
  → handleTeamInput()
  → setTeam(...)
  → pendingIntent tồn tại → tự route ActionAgent ngay
  → KHÔNG hỏi "Bạn muốn hỏi về điều gì?"
```

### Bước 4 — ReAct Agent xử lý

```
ReAct Loop (Reason + Act):
  ┌─ LLM "nghĩ" → quyết định gọi tool nào
  ├─ Tool được gọi → kết quả trả về LLM
  ├─ LLM "nghĩ tiếp" → cần tool khác không?
  └─ LLM tổng hợp → viết response cuối (NDJSON block)
```

**Tại sao ReAct?** LLM tự quyết định khi nào cần thêm `getGoalDetail` sau `listGoals`. Không cần hardcode từng case.

### Bước 5 — Tool gọi Simplamo API

```typescript
const getOffTrackScorecardMetrics = tool(
  async ({ teamId }) => {
    const tid = teamId || resolveTeamId(); // dynamic từ SessionContext
    const cached = cache.get(`offtrackMetrics:${tid}`);
    if (cached) return cached;
    
    const data = await client.getScorecardMeasurables({ teamId: tid });
    // xử lý, tính off-track...
    
    // Trả về NDJSON string → LLM copy nguyên vào response
    return `\`\`\`ndjson\n${header}\n${lines.join('\n')}\n\`\`\``;
  }
);
```

**Tại sao tool trả về NDJSON string, không phải object?** Nếu trả về object, LLM có thể format lại hoặc tóm tắt — mất dữ liệu. String buộc LLM copy nguyên vào response, frontend parse từ đó.

### Bước 6 — Frontend parse NDJSON và render card

```
rawText = "Phân tích chỉ số 1:\n```ndjson\n...\n```\n\nPhân tích chỉ số 2:\n```ndjson\n...\n```"

parseAllSegments(rawText):
  → segments = [
      { kind: "text",   content: "Phân tích chỉ số 1:" },
      { kind: "ndjson", schema: "scorecard-trend", items: [...] },
      { kind: "text",   content: "Phân tích chỉ số 2:" },
      { kind: "ndjson", schema: "scorecard-trend", items: [...] },
    ]

Render từng segment theo thứ tự:
  <MarkdownContent text="Phân tích chỉ số 1:" />
  <NdjsonMetricTrendView ... />
  <MarkdownContent text="Phân tích chỉ số 2:" />
  <NdjsonMetricTrendView ... />
```

**Progressive rendering:** Mỗi dòng NDJSON hoàn chỉnh → parse ngay → render card ngay. Dòng cuối đang stream dở → skip, hiện skeleton placeholder.

**Multi-block support (mới):** `parseAllSegments` xử lý nhiều block `ndjson` trong cùng một message thay vì chỉ block đầu tiên. Giải quyết trường hợp AI phân tích 2+ chỉ số cùng lúc.

---

## 3. Chi tiết từng module

### SessionContextService — Bộ nhớ ngắn hạn

```typescript
// @Global() → singleton, chia sẻ toàn app
export class SessionContextService {
  private _teamId: string | null = null;
  private _pendingTeamSelection = false;
  private _availableTeams: ITeamInfo[] = [];

  /** Lưu intent gốc trước khi vào flow chọn team */
  pendingIntent: { intent: string; message: string } | null = null;
  
  hasTeam() → boolean
  setTeam(id, name) → lưu + tắt pendingSelection
  resetTeam() → xóa sạch teamId + pendingIntent + pendingSelection
  resolveTeamFromInput("2") → teams[1]  // hỗ trợ cả số lẫn tên
  formatTeamList() → "1. Sales Team\n2. Leadership Team"
}
```

**Team selection flow (cập nhật):**
```
Cold start + user có intent rõ ràng:
  classifyIntent(message) → "action"
  pendingIntent = { intent: "action", message }
  → listTeams(companyId) [filter: isPrivate=false]
  → yield danh sách
  → setPendingSelection(true)

User gõ "Product Team":
  pendingTeamSelection = true → handleTeamInput("Product Team")
  → setTeam(id, name)
  → yield "✅ Đã chọn team..."
  → pendingIntent tồn tại → route ActionAgent(message gốc) ngay

Khi "đổi team" (không có pending intent):
  → yield thông tin team + "Tôi có thể giúp bạn về..."
```

**Session reset khi xóa lịch sử:**
```
Frontend clearHistory():
  1. setMessages([])
  2. clearSession(SESSION_ID)        ← xóa IndexedDB
  3. POST /api/session/reset         ← gọi backend

Backend POST /api/session/reset:
  → sessionCtx.resetTeam()           ← xóa teamId, pendingIntent
```

> ⚠️ **Single-user caveat:** Singleton in-memory. Nếu cần multi-user, phải scope theo session ID.

---

### ToolCacheService — TTL cache đơn giản

```typescript
export class ToolCacheService {
  get<T>(key)         // undefined nếu miss hoặc expired
  set<T>(key, value, ttlMs = 5 * 60 * 1000)
  invalidate(key)     // sau mutation
  invalidatePrefix(prefix)  // vd: xóa "listGoals:*"
}
```

**Cache key design:**
```
scorecardMetrics:TEAM_ID:13        ← 13 tuần, tất cả
scorecardMetrics:TEAM_ID:13:mine   ← 13 tuần, chỉ của tôi
offtrackMetrics:TEAM_ID:all
goalDetail:ROCK_ID
currentUser                        ← cache 30 phút
```

Sau `updateGoalStatus` → `invalidate('goalDetail:...')` + `invalidatePrefix('listGoals:')` → buộc fetch lại.

---

### SimplamoClient — API Gateway

```typescript
export class SimplamoClient {
  listTeams(companyId)              // GET /company/teams
  listRocks(params)                  // GET /eos-core/rocks
  getRockDetail(rockId)
  updateRockStatus(params)
  getScorecardMeasurables(params)   // GET /eos-core/score-cards/measurables
  getScorecardMetricCalculation()   // POST /eos-core/score-cards/metric-calculation
  listTodos(params)
  createTodos(todos[])
  updateTodo(id, payload)
  createIssue(payload)
}
```

Mọi lỗi được interceptor normalize thành `Error("[Simplamo 400] message")` → LLM nhận message rõ ràng.

---

### MetricsAgent — 3 tools, 3 schemas

| Tool | Use case | NDJSON schema |
|---|---|---|
| `getScorecardMetrics` | "Liệt kê tất cả chỉ số" | `scorecard-overview` |
| `getOffTrackScorecardMetrics` | "Chỉ số nào off-track?" | `scorecard-offtrack` |
| `getScorecardTrend` | "Phân tích xu hướng leads" | `scorecard-trend` |

**Off-track detection:**
```typescript
const pct = (value / effectiveGoal) * 100;
// consecutive weeks off-track:
if (consecutive >= 4) → CRITICAL
if (consecutive >= 2) → WARNING
else → ON_TRACK
```

**goalAdvanced** — mỗi metric có thể có nhiều target theo thời gian:
```typescript
function getEffectiveGoal(score, mainGoal, goalAdvanced?) {
  const adv = goalAdvanced?.find(a => 
    score.date >= a.periodStart && score.date <= a.periodEnd
  );
  return adv ?? mainGoal; // dùng advanced nếu score nằm trong range
}
```

**Scorecard-trend output** chứa:
- `priorityActions[]`: urgency = THIS_WEEK | TWO_WEEKS | MISSING_DATA
- `discussionPoints[]`: severity = CRITICAL | HIGH | MEDIUM | LOW
- `scores[]`: lịch sử tuần cho biểu đồ bar

---

### GoalAgent — EOS 5-Layer Analysis

**2 modes:**
- **MODE 1** (`listGoals` → `goal-list`): Danh sách nhanh, có risk badge, không có actions
- **MODE 2** (`getGoalDetail` → `goal-detail`): Phân tích sâu theo EOS

**5 Analysis Layers (MODE 2):**
```
L1: Scorecard Check
  expectedPace = (ngày đã qua / tổng ngày quarter) × 100
  gap = expectedPace - percentDone
  gap > 20% → "đang tụt hậu nghiêm trọng"

L2: IDS
  Identify → phát biểu vấn đề 1 câu, không "có vẻ"
  Discuss  → 3P: People / Process / Platform
  Solve    → "[Owner] phải [action] trước [ngày cụ thể]"

L3: People/Process/Platform detail
  1 người ôm > 3 milestone → flag overload
  Nhiều milestone OFF_TRACK liên tiếp → fix process

L4: 90-Day Priority Filter
  Max 3 actions, chỉ giữ action thực hiện được trong 1-5 ngày
  
L5: Owner Accountability Report
  Không dùng "nên cân nhắc" — dùng "phải", "quyết định ngay"
```

GoalAgent dùng **MemorySaver** → nhớ context qua nhiều turns trong session. Metrics/Action agent không có — mỗi lượt là context mới.

---

### ActionAgent — Todo & Issue Management

```
listTodosToday(onlyMine?)  → dueDate = hôm nay
listAllTodos(onlyMine?)    → toàn bộ
listOverdueTodos(onlyMine?)→ dueDate < today && status != DONE
createTodo(...)
updateTodo(todoId, ...)
parseNaturalDate(text)     → "thứ 6" → ISO 8601
```

**Resolve by title:** Agent tự tìm todoId theo title (gọi listAllTodos nếu cần), không yêu cầu user cung cấp ID.

**onlyMine flow:**
```
user: "todo của tôi" → onlyMine=true
  → tool gọi /users/me (cache 30 phút)
  → filter todos.ownerId === currentUserId
```

**Todo owner trong NDJSON (cập nhật):**

`mapTodo()` bây giờ include trường `owner` từ Simplamo API:
```typescript
// ITodo.owner từ Simplamo
owner?: {
  _id: string;
  email?: string;
  fullName?: string;
  avatar?: string;
}

// mapTodo output
{
  id, title, status, dueDate, priorityType, description, isOverdue,
  owner: { fullName: string | null, avatar: string | null } | null
}
```

Schema NDJSON mỗi dòng todo:
```json
{
  "id": "<string>",
  "title": "<string>",
  "status": "NOT_STARTED" | "PLAN" | "ON_TRACK" | "DONE",
  "dueDate": "<YYYY-MM-DD | null>",
  "priorityType": "HIGH" | "MEDIUM" | "LOW",
  "description": "<string>",
  "isOverdue": false,
  "owner": { "fullName": "<string>", "avatar": "<url>" }
}
```

---

## 4. Frontend — Rendering Pipeline

### AssistantMessageContent — Decision tree (cập nhật)

```
rawText = toàn bộ text đã nhận

① rawText rỗng + đang stream:
   - Tool đang chạy → <AIThinkingSteps /> (3 bước: lấy dữ liệu → phân tích → tạo kết quả)
   - Không có tool  → typing dots animation

② rawText có ```ndjson (một hoặc nhiều block):
   parseAllSegments() → mảng segment [text | ndjson]
   Render từng segment theo thứ tự
   Nếu đang stream + tools còn chạy + không có block đang mở
     → <InlineThinkingIndicator /> phía dưới

③ rawText có ```json (legacy):
   parseGoalsFromText() | parseMetricFromText()

④ Plain text + tools đang chạy:
   <MarkdownContent> + <InlineThinkingIndicator />

⑤ Plain text thuần:
   <MarkdownContent>
```

### NDJSON multi-block parse (cập nhật)

```typescript
// Thay thế parseNdjsonBlock (chỉ tìm block đầu tiên)
function parseAllSegments(rawText): Segment[] | null {
  // Dùng vòng lặp với cursor để tìm TẤT CẢ block ndjson
  // Trả về mảng segment xen kẽ text / ndjson theo đúng thứ tự
  // Ví dụ: [text, ndjson, text, ndjson]
}

type Segment =
  | { kind: "text"; content: string }
  | { kind: "ndjson"; schema; header; items; isClosed }
```

**Tại sao cần:** khi AI phân tích 2+ chỉ số cùng lúc, nó emit 2 block `ndjson` riêng biệt trong 1 message. `indexOf` cũ chỉ lấy block đầu → block thứ 2 render ra raw JSON.

### InlineThinkingIndicator (mới)

Hiển thị phía dưới text khi message đã có content nhưng tool vẫn còn chạy:

```
✅ Đã chọn team Product Team. Đang xử lý...

📋 Đang lấy danh sách todo... ● ● ●   ← InlineThinkingIndicator
```

Áp dụng cho:
- **Pure text + streaming + tools chạy**: case chọn team xong rồi auto-route
- **NDJSON segments + streaming + chờ block tiếp**: khi đang phân tích tiếp metric thứ 2

### TodoCard — Owner display (cập nhật)

`OwnerAvatar` component hiển thị cả avatar và fullName dạng chip:

```
[NVA] Tùng   ← avatar circle + tên cuối của fullName
```

- Nếu có `avatar` URL: render `<img>`
- Nếu không: render initials (2 chữ cái đầu)
- `displayName`: lấy từ cuối `fullName` (first name)
- Truncate max 80px nếu tên dài

### Tool Progress UI

```
activeTool  = null, toolEverEnded = false → typing dots
activeTool != null                        → ToolProgressIndicator: "Đang tải scorecard..."
activeTool  = null, toolEverEnded = true  → AIThinkingSteps step 2/3
contentStarted = true                     → show text (hide ThinkingSteps)
text có content + tools chạy             → InlineThinkingIndicator bên dưới text
```

---

## 5. API Endpoints

### Chat

```
POST /api/chat
Body: { message: string }
Response: SSE stream
  data: { type: "tool_start", tool: "listAllTodos" }
  data: { type: "tool_end", tool: "listAllTodos" }
  data: { content: "chunk text" }
  data: [DONE]
```

### Session

```
POST /api/session/reset
Response: { success: true }
Tác dụng: sessionCtx.resetTeam() → xóa teamId, pendingIntent
Gọi khi: user nhấn "Xóa lịch sử" trên frontend
```

### Todos

```
POST /api/todos
Body: { title, dueDate?, priorityType?, description?, ownerId?, rockId? }
Response: { success: true, todo }

PATCH /api/todos/:todoId
Body: IUpdateTodoPayload
Response: { success: true, todo }
```

### Issues

```
POST /api/issues
Body: { title, ownerId?, description?, interval?, status? }
Response: { success: true, issue }
```

`teamId` và `companyId` lấy động từ `SessionContextService`.

---

## 6. Quick-create từ MetricCard

### Todo (Priority Actions section)

```
QuickCreateActionButton click
  → POST /api/todos { title, ownerId, ... }
  → ChatController → SimplamoClient.createTodos()
  → Simplamo API POST /eos-core/todos/many
```

### Issue (Discussion Points section)

```
QuickCreateIssueButton click
  → POST /api/issues { title, ownerId, ... }
  → ChatController → SimplamoClient.createIssue()
  → Simplamo API POST /eos-core/issues
```

---

## 7. Những điểm dễ gây nhầm lẫn

### ① Dynamic teamId — getter function, không phải value

```typescript
// ❌ Sai: teamId bị capture tại thời điểm tạo tools
const tools = createMetricsTools(simplamo, config, cache);

// ✅ Đúng: getter được gọi mỗi lần tool chạy
const tools = createMetricsTools(simplamo, config, cache, () => sessionCtx.teamId ?? '');
```

### ② SSE chunk không phải line hoàn chỉnh

```typescript
// ❌ Sai:
JSON.parse(chunk); // chunk có thể là nửa dòng

// ✅ Đúng:
const lines = text.split("\n");
for (const line of lines) {
  if (!line.startsWith("data: ")) continue;
  JSON.parse(line.slice(6)); // safe
}
```

### ③ NDJSON dòng cuối bị cắt khi streaming

`parseAllSegments` skip dòng cuối khi block chưa đóng:
```typescript
const candidateLines = (isClosed ? rawLines : rawLines.slice(0, -1)).filter(Boolean);
```

### ④ position ≠ index ≠ rockId

Trong GoalAgent:
- `position` = số thứ tự hiển thị trên UI (1-based)
- array index = thứ tự trong mảng JavaScript (0-based)
- `id` = MongoDB ObjectId → dùng cho mọi API call

User nói "rock số 3" → tìm rock có `position = 3` → lấy `id` → gọi API. **Không dùng `position` làm rockId.**

### ⑤ Hai format NDJSON song song

- **Mới:** ` ```ndjson ` — progressive render, item-by-item, hỗ trợ multi-block
- **Legacy:** ` ```json ` — parse toàn bộ rồi render

Frontend check NDJSON trước. Nếu không phải, fallback sang JSON legacy.

### ⑥ GoalAgent có memory, các agent khác thì không

GoalAgent dùng `MemorySaver` với `thread_id` cố định → nhớ context qua nhiều turns. Metrics/Action agent không có — mỗi lượt là fresh context. Hệ quả: "cái chỉ số đó thế nào?" sau khi đã xem metrics sẽ không được nhớ.

### ⑦ Session reset khi xóa lịch sử (mới)

`clearHistory` trên frontend PHẢI gọi `POST /api/session/reset` để backend cũng reset team. Nếu chỉ xóa IndexedDB mà không gọi API, team cũ vẫn còn trong bộ nhớ singleton của NestJS.

### ⑧ pendingIntent bị clear sau khi route (mới)

```typescript
// ✅ Clear TRƯỚC khi yield + route để tránh double-execute nếu có lỗi
const pending = this.sessionCtx.pendingIntent;
this.sessionCtx.pendingIntent = null;
if (pending) yield* agent.stream(pending.message);
```

---

## 8. Cấu hình môi trường

```bash
# backend/.env
SIMPLAMO_API_TOKEN=...
SIMPLAMO_TEAM_ID=...           # fallback nếu chưa chọn team qua UI
SIMPLAMO_SESSION_ID=...        # Quarter/session hiện tại
SIMPLAMO_OWNER_ID=...          # fallback ownerId
SIMPLAMO_COMPANY_ID=...        # dùng để filter teams (isPrivate=false)
OPENAI_API_KEY=...
OPENAI_BASE_URL=https://llmgate.app/v1
PORT=4000

# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:4000
```

---

## 9. Gợi ý cải thiện

| Vấn đề | Hiện tại | Đề xuất |
|---|---|---|
| Multi-user | Singleton in-memory | Scope SessionContext theo JWT/cookie |
| Memory cho Metrics/Action | Không có | MemorySaver + thread_id |
| Token hết hạn | Lỗi từ Simplamo | Intercept 401 → alert frontend |
| Team selection khi restart | Phải chọn lại | Persist teamId vào Redis/DB |
| Tool errors trong stream | Yield text lỗi | Thêm `{ type: "error" }` SSE event riêng |
| classifyIntent mỗi request | Tốn 1 LLM call | Cache intent theo session context |
| Owner avatar resolution | Simplamo trả về nested object | Cân nhắc normalize ở client layer |
