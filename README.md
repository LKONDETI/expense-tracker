# Ledger — Personal Expense Tracker

> A full-stack personal finance app with AI-powered categorization, natural language chat, interactive analytics, and smart subscription detection.

---

## Overview

**Ledger** lets you upload bank/credit card PDF statements, automatically parse and categorize transactions using AI, review and correct them, and explore your spending through interactive dashboards, visual analytics charts, insights engine, and a natural-language "Ask" interface powered by Claude 3.5 Sonnet via Azure AI Foundry.

---

## Features

| Area | What's Built |
|---|---|
| **Auth** | JWT register / login with BCrypt password hashing |
| **PDF Upload** | Drag-and-drop upload → coordinate-based PDF text extraction → AI categorization; statement history panel & privacy trust wall |
| **Statement Review** | User reviews and corrects categories before saving; merchant-category memory persists corrections for future uploads |
| **Transactions** | Data table with search, category filter, inline category editing, deletion, and running **Balance** column |
| **Analytics** | Interactive **Recharts Bar Chart** (monthly income vs. outgo) & **Pie/Donut Chart** (category breakdown with month selector) |
| **Subscriptions** | Auto-detected recurring payments across multiple billing cycles |
| **Dashboard** | Period date range display, stat cards (total spent, subscriptions, budget left), spend-by-category progress bars, recent transactions |
| **Insights** | AI-generated spending insights: projected month-end spend, dining vs. average, unused subs, bullet-point advice |
| **Ask (AI Chat)** | Natural language questions answered using your own transaction data via Claude |
| **Settings** | Monthly overall budget + per-category budgets, persisted to DB |
| **Privacy & Security** | PII privacy explanation, one-click reset/delete-all-data with confirmation modal |
| **UX Polish** | Loading skeletons, empty states, error banners with retry on every screen, local-noon date formatting (no timezone shifts) |
| **AI Auto-switch** | Local `MockAiService` fallback when Azure Foundry credentials are not configured; uses real Claude 3.5 Sonnet when configured |

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 19 | UI framework |
| React Router | 7 | Client-side routing |
| Vite | 8 | Dev server & build tool |
| Recharts | latest | Interactive bar & donut charts |
| Lucide React | latest | UI icon library |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| .NET | 9 | Web API framework |
| Entity Framework Core | 9 | ORM & database migrations |
| Npgsql | 9 | PostgreSQL driver |
| PdfPig | latest | PDF bounding-box text extraction |
| BCrypt.Net | latest | Password hashing |

### Infrastructure & AI
| Service | Purpose |
|---|---|
| Neon (serverless Postgres) | Database |
| Azure AI Foundry + Claude 3.5 Sonnet | AI categorization, insights, chat |
| GitHub Pages | Frontend hosting (planned) |
| Azure App Service | Backend hosting (planned) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                         Browser                         │
│   React 19 + React Router 7 + Recharts + Lucide Icons   │
│   Vite dev server (local) / GitHub Pages (prod)         │
└───────────────────────────┬─────────────────────────────┘
                            │ REST / JSON (JWT Bearer)
                            ▼
┌─────────────────────────────────────────────────────────┐
│              .NET 9 Web API (ASP.NET Core)               │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐   │
│  │  Auth       │  │  Statements  │  │  Analytics    │   │
│  │  /register  │  │  /upload     │  │  /analytics   │   │
│  │  /login     │  │  /history    │  └───────────────┘   │
│  └─────────────┘  └──────────────┘                      │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐   │
│  │Transactions │  │  Dashboard   │  │  Insights     │   │
│  │  /list      │  │  /stats      │  │  /ask         │   │
│  └─────────────┘  └──────────────┘  └───────────────┘   │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │                  IAiService                      │   │
│  │  MockAiService        │  AzureFoundryService     │   │
│  │  (local regex/line)   │  (Claude 3.5 Sonnet)     │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  Entity Framework Core + Npgsql                         │
└───────────────────────────┬─────────────────────────────┘
                            │ TLS / Npgsql
                            ▼
┌─────────────────────────────────────────────────────────┐
│              Neon — Serverless Postgres                  │
│  Tables: Users, Transactions, Statements,               │
│          MerchantCategoryMaps, CategoryBudgets          │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│         Azure AI Foundry (when configured)              │
│         Claude 3.5 Sonnet deployment                    │
└─────────────────────────────────────────────────────────┘
```

---

## Getting Started (Local Development)

### Prerequisites

- [.NET 9 SDK](https://dotnet.microsoft.com/download/dotnet/9.0)
- [Node.js 20+](https://nodejs.org/) and npm
- A [Neon](https://neon.tech/) PostgreSQL project (free tier works)
- _(Optional)_ Azure AI Foundry access with a Claude 3.5 Sonnet deployment

---

### 1. Clone the Repository

```bash
git clone https://github.com/LKONDETI/expense-tracker.git
cd expense-tracker
```

---

### 2. Backend Setup

```bash
cd backend
```

Create app settings configuration:

```bash
cp appsettings.json appsettings.Development.json
```

Edit `appsettings.Development.json` and set your Neon connection string and JWT key:

```json
{
  "ConnectionStrings": {
    "NeonDb": "Host=your-neon-host;Database=neondb;Username=your-user;Password=your-password;SSL Mode=Require"
  },
  "Jwt": {
    "Key": "your-super-secret-jwt-key-min-32-chars",
    "Issuer": "LedgerAPI",
    "Audience": "LedgerApp"
  }
}
```

Apply database migrations:

```bash
dotnet ef database update
```

Run the backend API:

```bash
dotnet run
```

The Web API runs on `http://localhost:5000` (or `https://localhost:5001`).

---

### 3. Frontend Setup

```bash
cd ../ledger
npm install
npm run dev
```

The dev server starts on `http://localhost:5173`. Create a `.env.local` if needed:

```env
VITE_API_URL=http://localhost:5000
```

---

### 4. Azure AI Foundry Setup (Optional)

Without Azure credentials, the app automatically falls back to `MockAiService` for offline development and testing.

To enable real Claude 3.5 Sonnet AI responses, set these keys in `appsettings.Development.json`:

```json
"AzureFoundry": {
  "Endpoint": "https://your-resource.services.ai.azure.com",
  "ApiKey": "your-azure-api-key",
  "DeploymentName": "claude-3-5-sonnet"
}
```

---

## Project Structure

```
expense-tracker/
├── backend/                  # .NET 9 Web API
│   ├── Controllers/          # Auth, Statements, Transactions, Analytics, Dashboard, Insights, Settings
│   ├── DTOs/                 # Request & Response DTOs (TransactionDto, AnalyticsResponse, etc.)
│   ├── Models/               # User, Statement, Transaction, MerchantCategoryMap, CategoryBudget
│   ├── Services/             # StatementService, MockAiService, AzureFoundryService, TransactionService
│   ├── Migrations/           # EF Core database migrations
│   └── appsettings.json      # Config template
│
└── ledger/                   # React 19 + Vite Frontend
    ├── src/
    │   ├── pages/            # Dashboard, Transactions, Analytics, Subscriptions, Insights, Ask, Settings, Upload
    │   ├── components/       # Sidebar, Navbar, Trust Wall, Confirm Modal
    │   ├── utils/            # api.js fetch wrapper & auth context
    │   └── App.jsx           # App routes
    └── index.html
```

---

## Roadmap

### ✅ Done
- [x] .NET 9 Web API with JWT authentication & BCrypt password hashing
- [x] Neon Postgres + EF Core migrations (including running `Balance` column support)
- [x] PDF statement parsing (coordinate-based Y-bucket row extractor) → AI categorization
- [x] Statement upload review & history panel
- [x] Transactions list (search, category filter, inline category edit, delete, running balance column)
- [x] Analytics page — Recharts monthly income vs. outgo bar chart & category donut chart
- [x] Subscription auto-detection across multi-month statements
- [x] Dashboard (exact period date range, stat cards, category progress bars, recent transactions)
- [x] AI Insights (projected spend, dining comparison, unused subscriptions, advice bullets)
- [x] Ask screen (natural language chat with thinking animation)
- [x] Settings (monthly budget + per-category budgets)
- [x] Privacy & Security screen (trust wall explanation, delete-all-data modal)
- [x] `MockAiService` / `AzureFoundryService` auto-switching
- [x] Skeletons, empty states, error handling across all views

### 🔜 Next Up
- [ ] Fill in Azure Foundry credentials (`appsettings.json` placeholders)
- [ ] Frontend deployment → GitHub Pages
- [ ] Backend deployment → Azure App Service / Render
- [ ] Move secrets to Azure Key Vault / App Service env vars

---

## License

MIT
