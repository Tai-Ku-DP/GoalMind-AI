# Goal Agent — Testing Guide

Tài liệu này mô tả cách test Goal Agent, các tool được dùng và output mong đợi.

---

## Kiến trúc tổng quan

```
User message
    │
    ▼
GoalAgentService.stream()
    │
    ├── Tool: listGoals        → danh sách rocks tổng quan
    ├── Tool: getGoalDetail    → chi tiết 1 rock + milestones
    └── Tool: updateGoalStatus → cập nhật trạng thái rock
```

**File liên quan:**
- `goal.agent.ts` — khởi tạo agent, stream output
- `goal.tools.ts` — định nghĩa 3 tools trên
- `goal.prompts.ts` — system prompt, logic phân tích, format output

---

## Các tool và khi nào chúng chạy

### `listGoals`
Gọi khi user hỏi tổng quan, danh sách, hay không chỉ định rock cụ thể.

| Câu hỏi mẫu | Tool chạy |
|---|---|
| "Danh sách goals của tôi" | `listGoals` |
| "Mục tiêu nào đang trễ hạn?" | `listGoals` |
| "Tổng quan OKR quý này" | `listGoals` |
| "Rock nào đang OFF_TRACK?" | `listGoals` |

**Output mong đợi:** Danh sách rocks + Risk Level + Forecast + Root Cause + closing summary.

---

### `getGoalDetail`
Gọi khi cần thông tin sâu hơn về 1 rock cụ thể — milestone detail, root cause chính xác, recommended actions cụ thể.

| Câu hỏi mẫu | Tool chạy |
|---|---|
| "Milestone của rock [tên] là gì?" | `listGoals` → `getGoalDetail` |
| "Phân tích sâu rock về tuyển dụng" | `listGoals` → `getGoalDetail` |
| "Rock nào bị stalled milestone?" | `listGoals` → `getGoalDetail` (HIGH rocks) |
| "Analyze overdue OKR rock" | `listGoals` → `getGoalDetail` |
| Sau khi list, user nói "có" / "ok" / "phân tích đi" | `getGoalDetail` (từng HIGH rock) |

> **Lưu ý:** `getGoalDetail` luôn cần `rockId` — agent sẽ tự lấy từ kết quả `listGoals` trước đó.

---

### `updateGoalStatus`
Gọi khi user muốn thay đổi trạng thái rock.

| Câu hỏi mẫu | Tool chạy |
|---|---|
| "Đánh dấu rock X là DONE" | `listGoals` → `updateGoalStatus` |
| "Cập nhật rock về marketing thành AT_RISK" | `listGoals` → `updateGoalStatus` |

> Agent sẽ confirm với user trước khi thực sự gọi tool này.

---

## Debug — xem tool nào đang chạy

Mỗi tool đều có `console.log` prefix `[TOOL]`. Xem terminal backend:

```
[TOOL] listGoals called { teamId: undefined, sessionId: undefined }
[TOOL] getGoalDetail called { rockId: '6789abc...' }
[TOOL] updateGoalStatus called { rockId: '...', status: 'DONE' }
```

Nếu hỏi phân tích sâu mà **chỉ thấy `listGoals`** → agent đang dùng context cũ, không gọi thêm tool. Kiểm tra description của `getGoalDetail` trong `goal.tools.ts`.

---

## Flow test 2 bước (quan trọng)

Flow này kiểm tra toàn bộ pipeline từ overview → deep analysis:

**Bước 1:** Gửi câu hỏi list goals
```
Danh sách mục tiêu của tôi
```

**Output mong đợi:**
- Danh sách rocks với Risk Level, Forecast, Root Cause
- Cuối cùng có closing summary:
```
📊 Tổng quan: X mục tiêu HIGH🔴 | Y MEDIUM🟡 | Z DONE✅ | W LOW🟢

Bạn có muốn tôi phân tích sâu các mục tiêu HIGH risk không?
```

**Bước 2:** Xác nhận
```
có
```
hoặc: `ok`, `làm đi`, `phân tích đi`, `yes`

**Output mong đợi:**
- Agent gọi `getGoalDetail` cho **từng** rock HIGH🔴
- Mỗi rock hiện đầy đủ: Root Cause (tên milestone cụ thể) + Forecast + Expected Revenue + Recommended Actions (gắn với assignee)
- Kết thúc bằng bảng tổng hợp action theo owner

**Terminal sẽ hiện:**
```
[TOOL] getGoalDetail called { rockId: 'id-rock-1' }
[TOOL] getGoalDetail called { rockId: 'id-rock-2' }
[TOOL] getGoalDetail called { rockId: 'id-rock-3' }
...
```

---

## Logic Risk Level

```
status = DONE                                          → DONE✅  (ưu tiên cao nhất)
isOverdue = true  AND status ≠ DONE
  AND (percentDone < 90% OR doneMilestones < total)   → HIGH🔴
isOverdue = false AND daysRemaining < 30
  AND percentDone < 80%                               → MEDIUM🟡
isOverdue = true  AND percentDone ≥ 90%
  AND status ≠ DONE                                   → MEDIUM🟡
còn lại                                               → LOW🟢
```

**Bug cũ đã fix:** Rock status = DONE dù isOverdue vẫn hiện HIGH🔴 → đã fix bằng cách check DONE trước.

---

## Logic Forecast Completion

```
daysElapsed = today - startDate  (tính từ ngày bắt đầu rock)
velocity    = percentDone / daysElapsed  (% hoàn thành mỗi ngày)
forecastDate = today + (100 - percentDone) / velocity
```

Hiện `N/A` khi:
- Không có `startDate` trong dữ liệu
- `velocity = 0` (rock chưa có tiến độ)

---

## Logic Doanh thu dự kiến

Agent tự tìm số tiền trong `title` hoặc `description` của rock:
- Dạng nhận diện: `"100tr"`, `"500 triệu"`, `"1 tỷ"`, `"1B"`
- Tính: `số tiền × (percentDone / 100)`
- Bỏ qua hoàn toàn (không hiện gì) nếu không tìm thấy số tiền

> Để có revenue cụ thể, thêm số tiền vào title hoặc description của rock trong Simplamo.

---

## Checklist test nhanh

- [ ] `listGoals` chạy khi hỏi danh sách
- [ ] Closing summary xuất hiện sau danh sách
- [ ] Rock DONE không hiện warning trễ hạn
- [ ] Rock DONE hiện `DONE✅` thay vì `HIGH🔴`
- [ ] Forecast hiện ngày cụ thể khi có `startDate`
- [ ] Sau khi đồng ý phân tích sâu: `getGoalDetail` chạy cho từng HIGH rock
- [ ] Action trong detail mode gắn với tên milestone + assignee cụ thể
- [ ] `updateGoalStatus` confirm trước khi thực thi
