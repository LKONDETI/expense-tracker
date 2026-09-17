# Ledger — Personal Expense Tracker

> A full-stack personal finance app with AI-powered categorization, natural language chat, and smart subscription detection.

---

## Overview

**Ledger** lets you upload bank/credit card PDF statements, automatically categorize transactions using AI, review and correct them, then explore your spending through an interactive dashboard, insights engine, and a natural-language "Ask" interface powered by Claude 3.5 Sonnet.

---

## Features

| Area | What's Built |
|---|---|
| **Auth** | JWT register / login with BCrypt password hashing |
| **PDF Upload** | Drag-and-drop upload → PdfPig text extraction → AI categorization |
| **Statement Review** | User corrects categories before saving; merchant-category memory persists corrections |
| **Transactions** | List view with search, category filter, inline edit, and delete |
| **Subscriptions** | Auto-detected from recurring charges across multiple months |
| **Dashboard** | Stat cards (total spent, subscriptions, budget left), spend-by-category bars, recent transactions |
| **Insights** | AI-generated spending insights: projected month-end spend, dining vs. average, unused subs, bullet-point advice |
| **Ask (AI Chat)** | Natural language questions answered using your own transaction data via Claude |
| **Settings** | Monthly budget + per-category budgets, persisted to DB |
| **Privacy & Security** | PII stripping explanation, delete-all-data with confirmation modal |
| **UX Polish** | Loading skeletons, empty states, and error banners with retry on every screen |
| **AI Auto-switch** | Falls back to `MockAiService` when Azure Foundry credentials are not configured; uses real Claude when they are |

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 19 | UI framework |
| React Router | 7 | Client-side routing |
| Vite | 8 | Build tool & dev server |
| Recharts | latest | Dashboard charts |
| Lucide React | latest | Icon library |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| .NET | 9 | Web API framework |
| Entity Framework Core | latest | ORM & migrations |
| Npgsql | latest | PostgreSQL driver |
| PdfPig | latest | PDF text extraction |
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
┌─────────────────────────────────────────────────────┐
│                     Browser                         │
│   React 19 + React Router 7 + Recharts + Lucide     │
│   Vite dev server (local) / GitHub Pages (prod)     │
└───────────────────────┬─────────────────────────────┘
                        │ REST / JSON (JWT Bearer)
                        ▼
┌─────────────────────────────────────────────────────┐
│              .NET 9 Web API (ASP.NET Core)           │
│                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │  Auth       │  │  Statements  │  │  Insights │  │
│  │  /register  │  │  /upload     │  │  /ask     │  │
│  │  /login     │  │  /review     │  │  /chat    │  │
│  └─────────────┘  └──────────────┘  └───────────┘  │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │              IAiService                      │   │
│  │  MockAiService  │  AzureFoundryService       │   │
│  │  (no creds)     │  (Claude 3.5 Sonnet)       │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  Entity Framework Core + Npgsql                     │
└───────────────────────┬─────────────────────────────┘
                        │ TLS / Npgsql
                        ▼
┌─────────────────────────────────────────────────────┐
│              Neon — Serverless Postgres              │
│  Tables: users, transactions, statements,            │
│          merchant_category_map, budgets              │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│         Azure AI Foundry (when configured)          │
│         Claude 3.5 Sonnet endpoint                  │
└─────────────────────────────────────────────────────┘
```

---

## Getting Started (Local Development)

### Prerequisites

- [.NET 9 SDK](https://dotnet.microsoft.com/download/dotnet/9.0)
- [Node.js 20+](https://nodejs.org/) and npm
- A [Neon](https://neon.tech/) project (free tier works)
- _(Optional)_ Azure AI Foundry access with a Claude 3.5 Sonnet deployment

---

### 1. Clone the Repository

```bash
git clone https://github.com/<your-username>/expense-tracker.git
cd expense-tracker
```

---

### 2. Backend Setup

```bash
cd backend   # or wherever your .csproj lives
```

Copy and configure the app settings:

```bash
cp appsettings.json appsettings.Development.json
```

Edit `appsettings.Development.json` and fill in the required values (see [Environment Variables](#environment-variables) below).

Apply EF Core migrations and start the API:

```bash
dotnet ef database update
dotnet run
```

The API will start on `https://localhost:5001` (or the port shown in the console).

---

### 3. Frontend Setup

```bash
cd frontend   # or the React project root
npm install
npm run dev
```

The dev server will start on `http://localhost:5173` by default. Set the API base URL in your `.env.local`:

```env
VITE_API_BASE_URL=https://localhost:5001
```

---

### 4. Configuring Azure AI Foundry (Optional)

Without Azure credentials the app automatically falls back to `MockAiService`, which returns deterministic fake categories — perfect for local development and testing.

To enable real Claude 3.5 Sonnet responses, populate the following keys in `appsettings.Development.json` (see table below). The `AzureFoundryService` will be selected automatically at startup when all three keys are present and non-empty.

---

## Environment Variables

### Backend (`appsettings.json` / App Service config)

| Key | Description | Required |
|---|---|---|
| `ConnectionStrings__DefaultConnection` | Neon PostgreSQL connection string | ✅ Yes |
| `Jwt__Key` | Secret key for JWT signing (min 32 chars) | ✅ Yes |
| `Jwt__Issuer` | JWT issuer string | ✅ Yes |
| `Jwt__Audience` | JWT audience string | ✅ Yes |
| `AzureFoundry__Endpoint` | Azure AI Foundry endpoint URL | ⬜ Optional |
| `AzureFoundry__ApiKey` | Azure AI Foundry API key | ⬜ Optional |
| `AzureFoundry__DeploymentName` | Claude deployment name (e.g. `claude-3-5-sonnet`) | ⬜ Optional |

> **⚠️ Before deploying to production**, move all secrets out of `appsettings.json` and into Azure App Service environment variables or Azure Key Vault.

### Frontend (`.env.local`)

| Key | Description |
|---|---|
| `VITE_API_BASE_URL` | Base URL of the running .NET API |

---

## Roadmap

### ✅ Done
- [x] .NET 9 Web API with JWT auth
- [x] Neon Postgres + EF Core migrations
- [x] PDF upload → PdfPig extraction → AI categorization
- [x] Statement review screen with merchant-category memory
- [x] Transactions list (search, filter, inline edit, delete)
- [x] Subscription auto-detection
- [x] Dashboard (stat cards, spend-by-category, recent transactions)
- [x] AI Insights (projected spend, anomaly detection, unused subs)
- [x] Ask screen (natural language chat over user's data)
- [x] Settings (monthly + per-category budgets)
- [x] Privacy & Security screen (PII explanation, delete-all-data)
- [x] MockAiService / AzureFoundryService auto-switching
- [x] Loading skeletons, empty states, error banners on all screens

### 🔜 Next Up
- [ ] Fill in Azure Foundry credentials (`appsettings.json` placeholders)
- [ ] Analytics / Charts page — Recharts bar chart (monthly income vs. expenses) + pie chart (category breakdown)
- [ ] Frontend deployment → GitHub Pages
- [ ] Backend deployment → Azure App Service
- [ ] Move secrets to Azure App Service env vars / Key Vault

---

## Project Structure

```
expense-tracker/
├── backend/                  # .NET 9 Web API
│   ├── Controllers/          # API endpoints
│   ├── Models/               # EF Core entities
│   ├── Services/             # IAiService, MockAiService, AzureFoundryService
│   ├── Migrations/           # EF Core database migrations
│   └── appsettings.json      # Config (placeholders — do not commit secrets)
│
└── frontend/                 # React 19 + Vite
    ├── src/
    │   ├── pages/            # Dashboard, Transactions, Subscriptions, Insights, Ask, Settings, Upload
    │   ├── components/       # Shared UI components
    │   └── main.tsx          # App entry point
    └── vite.config.ts
```

---

## License

MIT
