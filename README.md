# GoalMind AI

Hệ thống AI Agent cho phép user chat bằng tiếng Việt tự nhiên với dữ liệu quản trị thật từ Simplamo — Goals, Metrics, Actions.

## Architecture

```
User message (tiếng Việt)
        ↓
  Orchestrator Agent (GPT-4o-mini — classify intent)
        ↓
┌──────────────┬──────────────┬──────────────┐
│ Goal Agent   │ Metrics Agent│ Action Agent │
│ (Rock/OKR)   │(Scorecard/KPI)│(Todo/Issue) │
└──────┬───────┴──────┬───────┴──────┬───────┘
       └──────────────┴──────────────┘
               Simplamo API
```

- **Orchestrator**: Dùng GPT-4o-mini để classify intent (nhanh, rẻ), route tới specialist agent
- **Specialist Agents**: Dùng GPT-4o với LangChain ReAct pattern + tool calling
- **Data Source**: Simplamo REST API (không có database riêng)

## Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Backend   | NestJS (TypeScript)                 |
| AI        | LangChain.js + LangGraph            |
| LLM       | GPT-4o / GPT-4o-mini (OpenAI)      |
| Frontend  | Next.js 16 + assistant-ui           |
| Streaming | SSE (Server-Sent Events)            |
| Data      | Simplamo REST API                   |

## Quick Start

### 1. Setup Environment

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your keys:
#   SIMPLAMO_API_TOKEN, OPENAI_API_KEY, SIMPLAMO_TEAM_ID

# Frontend
cp frontend/.env.example frontend/.env.local
```

### 2. Install & Run Backend

```bash
cd backend
npm install
npm run start:dev
# Running on http://localhost:4000
```

### 3. Install & Run Frontend

```bash
cd frontend
npm install
npm run dev
# Running on http://localhost:3000
```

### 4. Open Browser

Go to http://localhost:3000 and start chatting!

## Project Structure

```
backend/
  src/
    agents/
      orchestrator/    # Intent classification + routing
      goal/            # Rock/OKR management
      metrics/         # Scorecard/KPI analysis
      action/          # Todo/Issue management
    chat/              # SSE streaming endpoint
    simplamo/          # Shared Simplamo API client
frontend/
  src/
    app/
      page.tsx         # Landing page
      chat/page.tsx    # Chat interface
    components/
      goalmind-runtime.tsx  # assistant-ui SSE runtime
      chat-ui.tsx           # Chat UI with primitives
```

## Test Queries

```
Goal Agent:
  "Danh sách Rock/mục tiêu hiện tại của team?"
  "Goal nào đang dưới 50% mà gần deadline?"

Metrics Agent:
  "Chỉ số nào đang không đạt mục tiêu?"
  "Xu hướng doanh thu 4 tuần gần nhất?"

Action Agent:
  "Tôi cần làm gì tuần này?"
  "Tạo việc: gặp khách hàng ABC, hạn thứ 6"
```
# GoalMind-AI
