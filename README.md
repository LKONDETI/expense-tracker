# Expense Tracker

A personal expense tracking app that lets a user upload a financial statement (PDF), automatically extracts and categorizes transactions, and answers natural-language questions about spending via an AI chat feature.

---

## 1. Project Goals

- Upload a bank statement (PDF) covering 1–6 months of transactions
- Extract individual transactions (date, description, amount)
- Auto-categorize transactions into a fixed category list
- Let the user review and correct parsed/categorized data before it's saved
- Ask natural-language questions about spending and get direct, factual answers ("How much did I spend on dining last month?")
- Use this project as hands-on practice for the Azure exam and a Claude/Anthropic practitioner exam

---

## 2. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React | Hosted on GitHub Pages (static, free) |
| Backend | .NET Web API | Hosted on Azure App Service |
| Database | Neon (Postgres) | Serverless Postgres, free tier |
| AI / Chat | Claude (via Microsoft Foundry) | Model picked in Foundry, billed through Azure |
| PDF parsing | .NET PDF text-extraction library + Claude structuring | See Section 5 |

**Why this stack:**
- GitHub Pages + Azure App Service keeps frontend and backend hosting cleanly separated, both effectively free/cheap at this scale.
- Neon is a good fit for transaction data — it's relational, bounded in size, and query-friendly for the aggregates a spending app needs (sums, category totals, monthly trends).
- Microsoft Foundry is used instead of the Anthropic API directly, and instead of AWS Bedrock, because:
  - It lets you pick/swap Claude models and pay-as-you-go, billed through Azure (matches the Azure exam prep goal)
  - It uses the actual Claude Messages API under the hood (matches the Claude practitioner exam prep goal)
  - There's no existing AWS footprint in this project to justify adding Bedrock

---

## 3. High-Level Architecture

```
[React frontend] --(GitHub Pages, static hosting)
        |
        v
[.NET Web API] --(Azure App Service)
        |
        |---> [Neon Postgres]      (transactions, categories, users, statements)
        |
        |---> [Microsoft Foundry]  (Claude model calls: categorization + chat)
```

**Key rule: the frontend never talks to Neon or Claude directly.**
All requests go through the .NET API, which is the only layer holding credentials (Foundry key, Neon connection string) and the only layer that decides what data a given request is allowed to see. This keeps API keys out of the browser and prevents one user's data from leaking into another user's response.

---

## 4. Categories (v1)

Fixed list — no open-ended/dynamic categories for now:

```
Housing
Dining
Groceries
Transportation
Subscriptions
Shopping
Insurance
Other
```

**Rules:**
- `Other` is a required fallback. Never force a transaction into a poor-fit category — bank fees, transfers, ATM withdrawals, etc. should land in `Other` and be resolved manually during review.
- `Subscriptions` is defined by **billing pattern, not content** — any recurring, auto-billed charge (Netflix, Spotify, gym membership, software) goes here regardless of what it's for. This keeps the rule mechanical and consistent rather than a judgment call per merchant.
  - Note: detecting "recurring" from a single month of data is unreliable. For v1, rely on a known-merchant heuristic list; true pattern detection (same amount, ~30-day interval) becomes possible once multiple months of data exist for a user.

---

## 5. Statement Upload & Parsing Pipeline

```
1. User uploads a PDF statement
2. .NET API extracts raw text from the PDF (text-extraction library)
3. Raw text is sent to Claude with a prompt to extract transactions as JSON:
   [{ date, description, amount }]
4. Claude also categorizes each transaction into one of the 8 fixed categories
   (same call or a follow-up call — decide based on prompt reliability during testing)
5. Parsed + categorized results are shown to the user in a review screen
   - user can edit/correct any row before saving
   - corrections to categories should be remembered per merchant (see Section 7)
6. Confirmed data is saved to Neon
```

**Notes:**
- v1 targets PDFs with selectable text (not scanned images). If a PDF has no extractable text, it's likely a scanned document — OCR / vision-based extraction is a stretch goal, not a v1 requirement.
- v1 should be tuned against **one bank's PDF format** (your own statement) rather than trying to generalize across banks immediately. Supporting multiple bank formats is a post-v1 goal.
- Do not auto-save parsed data without a review step — parsing accuracy on real-world statements will not be perfect, and an unreviewed bad parse can silently corrupt a user's data.

---

## 6. Data Model (Neon / Postgres)

Starting schema — adjust as needed once you're in the coding phase:

```sql
users
  id
  email
  created_at

statements
  id
  user_id
  file_name
  uploaded_at
  date_range_start
  date_range_end

transactions
  id
  user_id
  statement_id
  date
  description
  amount
  category         -- one of the 8 fixed categories
  created_at

merchant_category_map
  id
  user_id
  merchant_pattern   -- e.g. normalized merchant string
  category           -- user's confirmed/corrected category
  updated_at
```

`merchant_category_map` is what makes categorization improve over time: before calling Claude to categorize a transaction, check this table first for a known match for that user. Only fall back to Claude for unmatched merchants. When a user corrects a category during review, upsert it here.

---

## 7. Chat Feature Flow

```
1. User asks a question in the UI (e.g. "How much did I spend on dining last month?")
2. .NET API identifies the user (auth) and determines relevant scope
   (e.g. time range implied by the question)
3. API fetches only that user's relevant transaction rows from Neon
   (never the whole table, never another user's data)
4. API sends the question + that scoped data to Claude via Microsoft Foundry
   with a prompt instructing it to answer only from the given data,
   concisely and factually, and to say so if the data doesn't cover the question
5. Claude's answer is returned through the API to the frontend
```

The API key for Foundry lives only in the .NET backend's configuration (or Key Vault — see Section 9), never in frontend code.

---

## 8. Suggested Build Order (Phased Scope)

Given a 7–14 day timeline, scope ruthlessly for a working v1 first, then layer on polish.

**Phase 1 — Core pipeline (target: first ~7 days)**
- [ ] Neon schema set up (`users`, `statements`, `transactions`, `merchant_category_map`)
- [ ] .NET API: PDF upload endpoint + text extraction
- [ ] Claude call (via Foundry) to extract transactions as structured JSON from statement text
- [ ] Claude call (via Foundry) to categorize transactions into the 8 fixed categories
- [ ] Review/edit screen in React before saving
- [ ] Save confirmed transactions to Neon
- [ ] One working chat endpoint: question -> scoped data -> Claude -> answer

**Phase 2 — Refinement (remaining days, up to day 14)**
- [ ] Merchant-category memory (check `merchant_category_map` before calling Claude)
- [ ] Better handling of scanned/non-text PDFs (stretch goal, may defer past day 14)
- [ ] Support for additional bank statement formats (stretch goal)
- [ ] UI polish, auth hardening, error states
- [ ] Move secrets to Key Vault if not done from the start

---

## 9. Security & Practical Notes

- **Never commit real financial statements or connection strings/API keys to the repo**, even for personal testing. Use `.gitignore` for local test files and environment configs.
- Consider testing early parsing/categorization logic with a redacted or synthetic statement before uploading a real one.
- Decide early whether to use Azure Key Vault for secrets (Foundry key, Neon connection string) from day one, or start with App Service configuration/environment variables and migrate later. Since this project doubles as Azure exam practice, using Key Vault from the start gives more hands-on exposure.
- Auth: every API endpoint that touches transactions or chat must scope data to the authenticated user — this is the main safeguard against data leaking across users.

---

## 10. Open Decisions (revisit before/while coding)

- Whether to support CSV upload in addition to PDF, and if so, in which phase
- Whether transaction extraction and categorization happen in one Claude call or two
- Exact auth mechanism (Azure AD B2C, custom JWT, etc. — not yet decided)
- Whether multi-bank PDF format support is in scope at all for this version