# DayToExpense — Implementation Plan

## What We Are Building

A complete, production-quality, modern web-based **Expense, Income, Finance, Investment, Invoice and Business Management** application named **DayToExpense**. The existing C# + MySQL desktop application is kept completely untouched and used only as a conceptual reference.

---

## Existing System Analysis

### Old Database: `tblentrydetails`

The old database contains **465 real transaction records** spanning **November 2025 – June 2026**. Key findings:

| Field | Type | Notes |
|---|---|---|
| `EntryID` | int PK | Auto-increment |
| `Date` | date | Transaction date |
| `Time` | time | Transaction time |
| `Year/Month/Day` | varchar | Redundant — stored as strings |
| `Category` | text | Free-text, no FK |
| `EntryText` | text | Description/title |
| `Amount` | **float** | ⚠️ Uses float — financial precision risk |
| `DescribeText` | text | Notes field |
| `Type` | text | `'Expense'`, `'Income'`, `'Loan'` |
| `FilePath` | text | Absolute Windows path to attachment |

#### Old `tblpersonaldetails`
Health/personal tracker (BMI, weight, distance). Not part of finance — will be excluded from migration.

#### Old `users`
Single-user table: `UserID`, `Username`, `Password` (SHA-256 plain hash — insecure).

---

### What Was Found in Transaction Data

**Existing categories extracted from real data:**
- Food, Grocery, Bakery, Petrol, Medicine, Travel
- Business, Salary (income types)
- Recharge And Bills, Home Electricity Bill, BSNL/Airtel Recharge
- Flipkart/Amazon Ordered, Snapmint Order EMI
- Inverter EMI, Mobile EMI, Jupiter Scooty EMI (loans)
- Groww (investments — Mutual Funds)
- Chaya Account, Federal Account, Money Transfer (transfers between people/accounts)
- LIC Premium (insurance)
- GPay Reward (cashback/rewards)
- Garden Items, Garage, Home, Cosmetics, Stationary
- Lottery, Donation, Pigmi Savings
- TeamCA (domain/business expense)
- Facebook Ads, Online Marketing

**Real people/contacts in data:**
- Abhishek (business partner — share of business income paid out)
- Chaya (family member — transfers to "Chaya Account")
- Shruthi Chikki (loans given/received)
- Nishant, Vinay, Vivek (personal loans)
- Shreeram (shared expenses)

**Types used:**
- `Expense` — regular expense
- `Income` — salary, business income, received money
- `Loan` — EMI / loan tracking (stored twice as both Loan + Expense — a workaround in the old system)

---

### What to Reuse (Conceptually)

| Old Concept | New DayToExpense Entity |
|---|---|
| Category-based entries | `transaction_categories` + `transaction_subcategories` |
| Expense type | `transactions` with `type=EXPENSE` |
| Income type | `transactions` with `type=INCOME` |
| Loan type (duplicate rows) | Proper `loans` + `loan_payments` tables |
| FilePath attachments | `attachments` table with secure storage |
| Chaya Account entries | `accounts` (real bank/savings accounts) |
| Business income / payout to Abhishek | `transactions` + `contacts` |
| Groww mutual fund | `investments` module |
| Recurring EMIs (Inverter, Mobile, Scooty) | `recurring_transactions` + `loans` |
| GPay rewards | Income category: Cashback/Rewards |

---

### What NOT to Reuse

| Old Problem | New Approach |
|---|---|
| `float` for amounts | Use `DECIMAL(18,2)` everywhere |
| Loan stored as duplicate Expense row | Proper loan + payment tables |
| Category as free-text with no FK | Normalized category tables |
| Password stored as SHA-256 plain | Argon2id hashing |
| Single-user, no workspace | Multi-user + multi-workspace architecture |
| No account model (no bank accounts) | Accounts as core first-class entities |
| Transfers recorded as Expense+Income | Proper `transfers` table |
| Year/Month/Day stored as strings | Standard `DATE`/`TIMESTAMP` columns |
| Absolute Windows file paths | Relative paths with secure storage |

---

## Proposed DayToExpense Architecture

```
DayToExpense/
│
├── backend/
│   ├── app/
│   │   └── main.py                  # FastAPI app factory
│   ├── api/
│   │   └── v1/
│   │       ├── auth.py
│   │       ├── accounts.py
│   │       ├── transactions.py
│   │       ├── income.py
│   │       ├── expenses.py
│   │       ├── transfers.py
│   │       ├── investments.py
│   │       ├── budgets.py
│   │       ├── invoices.py
│   │       ├── customers.py
│   │       ├── suppliers.py
│   │       ├── loans.py
│   │       ├── credit_cards.py
│   │       ├── subscriptions.py
│   │       ├── recurring.py
│   │       ├── reports.py
│   │       ├── dashboard.py
│   │       ├── settings.py
│   │       ├── notifications.py
│   │       └── migration.py
│   ├── models/                      # SQLAlchemy ORM models
│   ├── schemas/                     # Pydantic request/response schemas
│   ├── services/                    # Business logic layer
│   ├── repositories/                # DB query layer
│   ├── database/
│   │   └── connection.py            # DB engine + session factory
│   ├── migrations/                  # Alembic migrations
│   ├── core/
│   │   ├── config.py                # Settings from .env
│   │   ├── security.py              # JWT + password hashing
│   │   └── dependencies.py          # FastAPI dependency injection
│   ├── reports/                     # PDF/Excel generation
│   └── utils/
│       ├── decimal_utils.py
│       ├── pagination.py
│       └── audit.py
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── layouts/
│   │   ├── hooks/
│   │   ├── services/                # API service layer (axios)
│   │   ├── stores/                  # Zustand state management
│   │   └── utils/
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── db/
│   ├── migrations/                  # Alembic migration files
│   ├── seeds/                       # Demo data seeder
│   └── docs/                        # ER diagrams, schema docs
│
├── docs/
├── .env.example
└── README.md
```

---

## Proposed Database Schema (Core Tables)

### Auth & Users
```
users                    workspaces              workspace_members
─────────────────        ──────────────────      ──────────────────
id (UUID PK)             id (UUID PK)            workspace_id (FK)
email (unique)           name                    user_id (FK)
username (unique)        type (personal/         role (owner/admin/
password_hash            business/family)        member/viewer)
full_name                owner_id (FK→users)     joined_at
is_active                base_currency           is_active
is_verified              settings (JSON)
last_login               created_at
login_attempts           updated_at
locked_until
created_at
updated_at
```

### Accounts
```
accounts
─────────────────────────────────────────────
id (UUID PK)
workspace_id (FK→workspaces)
name                    ← "SBI Savings", "HDFC Savings"
account_type            ← SAVINGS/CURRENT/CREDIT_CARD/CASH/WALLET/LOAN/INVESTMENT/OTHER
bank_name
account_number_masked
currency_code
opening_balance (DECIMAL 18,4)
current_balance (DECIMAL 18,4)
credit_limit (DECIMAL 18,4)   ← for credit cards
billing_date                   ← for credit cards
due_date                       ← for credit cards
color                          ← UI color label
icon
is_active
notes
created_at / updated_at
is_deleted / deleted_at
```

### Transactions (Central Ledger)
```
transactions
──────────────────────────────────────────────────────────────
id (UUID PK)
workspace_id (FK)
account_id (FK→accounts)
category_id (FK→transaction_categories)
subcategory_id (FK→transaction_subcategories) nullable
type                ← INCOME / EXPENSE / TRANSFER / REFUND / ADJUSTMENT
                       INVESTMENT / LOAN_PAYMENT / CREDIT_CARD_PAYMENT
amount (DECIMAL 18,4)
currency_code
exchange_rate (DECIMAL 12,6)
base_amount (DECIMAL 18,4)    ← amount in workspace base currency
date (DATE)
time (TIME)
description
notes
reference_number
payment_method      ← CASH/UPI/NEFT/IMPS/CHEQUE/CARD/AUTO_DEBIT
contact_id (FK→contacts)  nullable
tags                ← JSON array
attachment_ids      ← JSON array of attachment UUIDs
location
status              ← PENDING/COMPLETED/CANCELLED/RECONCILED
is_recurring        ← bool
recurring_id (FK→recurring_transactions) nullable
created_by (FK→users)
created_at / updated_at
is_deleted / deleted_at / deleted_by
```

### Transfers
```
transfers
──────────────────────────────
id (UUID PK)
workspace_id (FK)
from_account_id (FK→accounts)
to_account_id (FK→accounts)
amount (DECIMAL 18,4)
from_transaction_id (FK→transactions)  ← debit side
to_transaction_id (FK→transactions)    ← credit side
fee (DECIMAL 18,4)
date
reference
notes
created_by / created_at
```

### Categories
```
transaction_categories
──────────────────────
id / workspace_id
name / icon / color
type (INCOME/EXPENSE/BOTH)
is_system (predefined)
is_active

transaction_subcategories
─────────────────────────
id / category_id / name / icon / is_active
```

### Investments
```
investments
────────────────────────────────────────
id (UUID PK) / workspace_id
name / type (STOCKS/MF/SIP/FD/RD/GOLD/etc.)
institution / account_id (FK→accounts)
purchase_date / quantity
purchase_price (DECIMAL) / invested_amount (DECIMAL)
current_value (DECIMAL) / current_price (DECIMAL)
maturity_date / notes / is_active

investment_transactions
────────────────────────
id / investment_id / type (BUY/SELL/DIVIDEND/SIP_INSTALLMENT)
date / quantity / price / amount / notes

sip_plans
──────────────────────────────────────
id / investment_id / amount (DECIMAL)
frequency (MONTHLY/QUARTERLY/YEARLY)
start_date / next_date / end_date
status (ACTIVE/PAUSED/COMPLETED)
total_invested / installments_completed
```

### Budgets
```
budgets
────────────────────────────────────
id / workspace_id / name
period (MONTHLY/QUARTERLY/YEARLY)
start_date / end_date / is_active

budget_categories
──────────────────────────────────
id / budget_id / category_id
allocated_amount (DECIMAL)
spent_amount (DECIMAL)   ← computed/cached
alert_at_75 / alert_at_90 / alert_at_100 (bool)
```

### Loans
```
loans
────────────────────────────────────────
id / workspace_id
name / institution / type (HOME/VEHICLE/PERSONAL/etc.)
principal (DECIMAL) / interest_rate (DECIMAL)
tenure_months / emi_amount (DECIMAL)
start_date / end_date
account_id (FK→accounts)
outstanding_balance (DECIMAL)
total_paid / interest_paid
status (ACTIVE/CLOSED/DEFAULTED)

loan_payments
──────────────────────────
id / loan_id / transaction_id
date / emi_amount / principal_component / interest_component
balance_after / notes
```

### Invoices
```
invoices
────────────────────────────────────────────────────────────
id / workspace_id / invoice_number
customer_id (FK→customers) / date / due_date
subtotal / discount / tax_amount / total (all DECIMAL)
paid_amount / balance / status (DRAFT/SENT/PARTIAL/PAID/OVERDUE/CANCELLED)
gstin / notes / terms / currency_code
created_by / created_at / updated_at

invoice_items
─────────────────────────────
id / invoice_id / description
quantity (DECIMAL) / unit_price (DECIMAL)
discount_pct / tax_rate / amount (DECIMAL)

invoice_payments
──────────────────────────────
id / invoice_id / transaction_id
date / amount / payment_method / notes
```

### Customers & Suppliers
```
customers / suppliers
─────────────────────────────────────────
id / workspace_id / name / email / phone
company / gstin / address / notes
total_sales (for customers) / total_purchases (for suppliers)
outstanding / is_active
```

### Supporting Tables
```
currencies / exchange_rates / attachments / notifications
subscriptions / recurring_transactions / audit_logs / settings
```

---

## Migration Strategy from Old System

1. A dedicated **migration utility** at `/api/v1/migration/` will:
   - Accept old MySQL connection details
   - Read `tblentrydetails` rows
   - Map `Type='Expense'` → new EXPENSE transactions
   - Map `Type='Income'` → new INCOME transactions
   - Map `Type='Loan'` + duplicate Expense rows → deduplicate into a loan payment
   - Map old Category strings → matched or new categories
   - Convert `float` amounts to `DECIMAL`
   - Skip `tblpersonaldetails` (not financial data)
   - Provide preview/validation before import
   - Generate a migration report
2. The old database is **never modified**

---

## Technology Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2.x, Alembic |
| Auth | JWT (access + refresh), Argon2id password hashing |
| DB | MySQL (primary) + PostgreSQL (supported), switched via `DATABASE_URL` |
| Frontend | React 18, TypeScript, Vite, React Router v6 |
| State | Zustand |
| API Client | Axios + React Query |
| Charts | Recharts |
| UI | Tailwind CSS (utility-first, professional) |
| PDF | WeasyPrint (backend), react-pdf (frontend preview) |
| Excel | openpyxl |
| File Upload | FastAPI UploadFile, stored securely |

---

## Implementation Phases

| Phase | What Gets Built |
|---|---|
| **1** | Analysis ✅ (complete) |
| **2** | Project scaffold, `.env`, DB connection, Alembic setup |
| **3** | SQLAlchemy models for all tables |
| **4** | Authentication — register, login, JWT, refresh tokens, profile |
| **5** | Workspaces + multi-user architecture |
| **6** | Accounts module (CRUD + balance management) |
| **7** | Categories + transaction engine (the core ledger) |
| **8** | Transfers — atomic debit/credit with rollback |
| **9** | Income & Expense modules with filters/pagination |
| **10** | Dashboard API + analytics queries |
| **11** | React frontend foundation — routing, auth flow, layout |
| **12** | Accounts UI + Quick Transaction entry |
| **13** | Dashboard UI with charts (Recharts) |
| **14** | Income, Expense, Transfer pages |
| **15** | Budgets module |
| **16** | Recurring transactions + subscriptions |
| **17** | Investments + SIP module |
| **18** | Loans + EMI scheduler |
| **19** | Credit card management |
| **20** | Customers + Suppliers |
| **21** | Invoice generation + PDF export |
| **22** | Reports — PDF, Excel, CSV export |
| **23** | Old system migration utility |
| **24** | Seed data (demo accounts, transactions, investments) |
| **25** | Security hardening — rate limiting, CORS, audit log |
| **26** | Responsive UI, mobile layout |
| **27** | Notifications system |
| **28** | README + documentation |

> [!IMPORTANT]
> This is a very large application. The implementation will proceed **phase by phase**. Phase 2–10 (backend foundation + core modules) will be built first, then the frontend, then advanced modules.

---

## Open Questions

> [!IMPORTANT]
> **1. Database server**: Do you have MySQL running locally on this Windows machine, or do you want to start with SQLite for development and switch to MySQL/PostgreSQL for production? Using SQLite initially means zero setup friction but we'd need a quick switch later.

> [!IMPORTANT]
> **2. Frontend port / dev server**: Should the frontend dev server run on the default Vite port `5173` and the backend on `8000`? Or do you have a preferred port configuration?

> [!IMPORTANT]
> **3. Existing transactions as seed data**: Should the **465 real transactions** from the old `tblentrydetails` be imported as seed data into the new system automatically during setup, or would you prefer to use the migration utility manually later?

> [!IMPORTANT]
> **4. Scope for first build**: The full system has 28 build phases. Should I build the **complete system end-to-end** (backend + frontend for all modules), or should I build **Phase 2–14** first (full backend + working frontend with core modules: auth, accounts, transactions, dashboard, income, expense, transfers) and then continue with advanced modules?

---

## Verification Plan

### Automated
- Pytest unit tests for all financial calculations
- API endpoint tests (auth, accounts, transactions, transfers)
- Balance consistency tests (transfer atomicity)
- Decimal precision tests

### Manual
- Start backend: `uvicorn main:app --reload`
- Start frontend: `npm run dev`
- Register user → create workspace → add accounts → record transactions → verify dashboard totals
- Create a transfer → verify neither account shows it as income/expense
- Run old data migration → verify record counts match
