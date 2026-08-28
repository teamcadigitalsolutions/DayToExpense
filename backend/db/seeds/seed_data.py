import sys
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import asyncio
import uuid
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend.core.config import settings
from backend.core.security import hash_password
from backend.database.connection import Base

# System categories to seed
SYSTEM_CATEGORIES = [
    # INCOME
    {"name": "Salary", "type": "INCOME", "icon": "Banknote", "color": "#16a34a", "sort_order": 1},
    {"name": "Business", "type": "INCOME", "icon": "Briefcase", "color": "#2563eb", "sort_order": 2},
    {"name": "Freelance", "type": "INCOME", "icon": "Laptop", "color": "#7c3aed", "sort_order": 3},
    {"name": "Investment Returns", "type": "INCOME", "icon": "TrendingUp", "color": "#0891b2", "sort_order": 4},
    {"name": "Rental Income", "type": "INCOME", "icon": "Home", "color": "#d97706", "sort_order": 5},
    {"name": "Cashback / Rewards", "type": "INCOME", "icon": "Gift", "color": "#db2777", "sort_order": 6},
    {"name": "Refund", "type": "INCOME", "icon": "RefreshCw", "color": "#059669", "sort_order": 7},
    {"name": "Other Income", "type": "INCOME", "icon": "Plus", "color": "#6b7280", "sort_order": 8},
    # EXPENSE
    {"name": "Food & Dining", "type": "EXPENSE", "icon": "UtensilsCrossed", "color": "#ef4444", "sort_order": 10},
    {"name": "Grocery", "type": "EXPENSE", "icon": "ShoppingCart", "color": "#f97316", "sort_order": 11},
    {"name": "Transport & Fuel", "type": "EXPENSE", "icon": "Car", "color": "#eab308", "sort_order": 12},
    {"name": "Healthcare", "type": "EXPENSE", "icon": "HeartPulse", "color": "#ec4899", "sort_order": 13},
    {"name": "Utilities & Bills", "type": "EXPENSE", "icon": "Zap", "color": "#8b5cf6", "sort_order": 14},
    {"name": "Shopping", "type": "EXPENSE", "icon": "ShoppingBag", "color": "#06b6d4", "sort_order": 15},
    {"name": "Entertainment", "type": "EXPENSE", "icon": "Clapperboard", "color": "#f43f5e", "sort_order": 16},
    {"name": "Education", "type": "EXPENSE", "icon": "GraduationCap", "color": "#3b82f6", "sort_order": 17},
    {"name": "Travel", "type": "EXPENSE", "icon": "Plane", "color": "#14b8a6", "sort_order": 18},
    {"name": "Home & Maintenance", "type": "EXPENSE", "icon": "Wrench", "color": "#a3a3a3", "sort_order": 19},
    {"name": "Investments", "type": "EXPENSE", "icon": "BarChart2", "color": "#10b981", "sort_order": 20},
    {"name": "Insurance", "type": "EXPENSE", "icon": "Shield", "color": "#6366f1", "sort_order": 21},
    {"name": "Loan EMI", "type": "EXPENSE", "icon": "Landmark", "color": "#dc2626", "sort_order": 22},
    {"name": "Subscriptions", "type": "EXPENSE", "icon": "CreditCard", "color": "#7c3aed", "sort_order": 23},
    {"name": "Personal Care", "type": "EXPENSE", "icon": "Smile", "color": "#fb923c", "sort_order": 24},
    {"name": "Donation", "type": "EXPENSE", "icon": "Heart", "color": "#f43f5e", "sort_order": 25},
    {"name": "Other Expense", "type": "EXPENSE", "icon": "Minus", "color": "#6b7280", "sort_order": 26},
]


async def seed(db: AsyncSession):
    from backend.models.user import User
    from backend.models.workspace import Workspace, WorkspaceMember, WorkspaceType, WorkspaceRole
    from backend.models.account import Account
    from backend.models.all_models import (
        TransactionCategory, Investment, InvestmentType,
        Loan, LoanType, Budget, BudgetPeriod, BudgetCategory, Contact, ContactType,
    )
    from backend.models.transaction import Transaction, TransactionType, PaymentMethod, TransactionStatus
    from sqlalchemy import select

    print("[*] Seeding DayToExpense database...")

    # ── User ──────────────────────────────────────────────────────────────────
    existing = await db.execute(select(User).where(User.email == "admin@daytoexpense.com"))
    if existing.scalar_one_or_none():
        print("[!] Seed data already exists. Skipping.")
        return

    user = User(
        id=str(uuid.uuid4()),
        email="admin@daytoexpense.com",
        username="admin",
        password_hash=hash_password("DayToExpense@2024"),
        full_name="Charan Admin",
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    await db.flush()
    print(f"  [+] User created: {user.email}")

    # ── Workspace ─────────────────────────────────────────────────────────────
    workspace = Workspace(
        id=str(uuid.uuid4()),
        name="Charan Finance",
        type=WorkspaceType.PERSONAL,
        owner_id=user.id,
        base_currency="INR",
        description="Personal finance workspace",
    )
    db.add(workspace)
    await db.flush()

    member = WorkspaceMember(
        id=str(uuid.uuid4()),
        workspace_id=workspace.id,
        user_id=user.id,
        role=WorkspaceRole.OWNER,
        is_active=True,
    )
    db.add(member)
    ws_id = workspace.id
    print(f"  [+] Workspace created: {workspace.name}")

    # ── System Categories ─────────────────────────────────────────────────────
    cat_map = {}
    for cat_data in SYSTEM_CATEGORIES:
        cat = TransactionCategory(
            id=str(uuid.uuid4()),
            workspace_id=None,  # system category
            name=cat_data["name"],
            type=cat_data["type"],
            icon=cat_data["icon"],
            color=cat_data["color"],
            is_system=True,
            is_active=True,
            sort_order=cat_data["sort_order"],
        )
        db.add(cat)
        cat_map[cat_data["name"]] = cat.id
    await db.flush()
    print(f"  [+] {len(SYSTEM_CATEGORIES)} system categories seeded")

    # ── Accounts ──────────────────────────────────────────────────────────────
    accounts = [
        {"name": "SBI Savings",      "type": "SAVINGS",     "bank": "State Bank of India",    "balance": Decimal("15230.00"), "color": "#2563eb", "icon": "Building2"},
        {"name": "HDFC Savings",     "type": "SAVINGS",     "bank": "HDFC Bank",              "balance": Decimal("8450.00"),  "color": "#16a34a", "icon": "Building2"},
        {"name": "Cash Wallet",      "type": "CASH",        "bank": None,                      "balance": Decimal("3200.00"),  "color": "#d97706", "icon": "Wallet"},
        {"name": "ICICI Salary A/C", "type": "SAVINGS",     "bank": "ICICI Bank",             "balance": Decimal("42000.00"), "color": "#7c3aed", "icon": "Building2"},
        {"name": "HDFC Credit Card", "type": "CREDIT_CARD", "bank": "HDFC Bank",              "balance": Decimal("0.00"),     "color": "#ef4444", "icon": "CreditCard", "credit_limit": Decimal("100000")},
        {"name": "Groww Investment", "type": "INVESTMENT",  "bank": "Groww",                  "balance": Decimal("25000.00"), "color": "#10b981", "icon": "TrendingUp"},
    ]
    acc_ids = []
    for a in accounts:
        acc = Account(
            id=str(uuid.uuid4()),
            workspace_id=ws_id,
            name=a["name"],
            account_type=a["type"],
            bank_name=a.get("bank"),
            currency_code="INR",
            opening_balance=a["balance"],
            current_balance=a["balance"],
            credit_limit=a.get("credit_limit"),
            color=a["color"],
            icon=a["icon"],
            is_active=True,
        )
        db.add(acc)
        acc_ids.append(acc.id)
    await db.flush()
    sbi_id, hdfc_id, cash_id, icici_id, cc_id, groww_id = acc_ids
    print(f"  [+] {len(accounts)} accounts created")

    # ── Sample Transactions (last 3 months) ──────────────────────────────────
    today = date.today()
    salary_cat = cat_map.get("Salary")
    biz_cat = cat_map.get("Business")
    food_cat = cat_map.get("Food & Dining")
    grocery_cat = cat_map.get("Grocery")
    fuel_cat = cat_map.get("Transport & Fuel")
    util_cat = cat_map.get("Utilities & Bills")
    shop_cat = cat_map.get("Shopping")
    health_cat = cat_map.get("Healthcare")
    invest_cat = cat_map.get("Investments")
    loan_cat = cat_map.get("Loan EMI")

    def tx(account_id, type_, amount, description, category_id, days_ago, notes="", payment_method="UPI"):
        return Transaction(
            id=str(uuid.uuid4()),
            workspace_id=ws_id,
            account_id=account_id,
            category_id=category_id,
            type=type_,
            amount=Decimal(str(amount)),
            currency_code="INR",
            exchange_rate=Decimal("1.000000"),
            base_amount=Decimal(str(amount)),
            date=today - timedelta(days=days_ago),
            description=description,
            notes=notes,
            payment_method=payment_method,
            status="COMPLETED",
            is_recurring=False,
            created_by=user.id,
        )

    transactions = [
        # Income
        tx(icici_id, "INCOME", 25000, "Salary - August 2026", salary_cat, 22, payment_method="NEFT"),
        tx(icici_id, "INCOME", 23000, "Salary - July 2026", salary_cat, 52, payment_method="NEFT"),
        tx(icici_id, "INCOME", 23000, "Salary - June 2026", salary_cat, 82, payment_method="NEFT"),
        tx(sbi_id,   "INCOME", 6000,  "Business - Website Project", biz_cat, 5),
        tx(sbi_id,   "INCOME", 2500,  "Business - Design Work", biz_cat, 18),
        tx(sbi_id,   "INCOME", 1500,  "Business - Consulting", biz_cat, 35),
        tx(sbi_id,   "INCOME", 3000,  "Business - App Development", biz_cat, 60),
        # Food
        tx(cash_id,  "EXPENSE", 260, "Biryani & Kebab", food_cat, 1, payment_method="CASH"),
        tx(cash_id,  "EXPENSE", 120, "Bakery Items", food_cat, 3, payment_method="CASH"),
        tx(cash_id,  "EXPENSE", 180, "Fruits & Vegetables", grocery_cat, 5, payment_method="CASH"),
        tx(hdfc_id,  "EXPENSE", 680, "Grocery - Home supplies", grocery_cat, 7, payment_method="UPI"),
        tx(cash_id,  "EXPENSE", 140, "Icecream & Cold Drinks", food_cat, 9, payment_method="CASH"),
        tx(hdfc_id,  "EXPENSE", 1274, "Grocery - Monthly stock", grocery_cat, 11, payment_method="UPI"),
        tx(cash_id,  "EXPENSE", 200, "Mutton & Chicken", food_cat, 14, payment_method="CASH"),
        tx(hdfc_id,  "EXPENSE", 240, "Bakery Items", food_cat, 16, payment_method="UPI"),
        tx(cash_id,  "EXPENSE", 63,  "Curd & Milk", grocery_cat, 18, payment_method="CASH"),
        # Transport
        tx(cash_id,  "EXPENSE", 330, "Petrol", fuel_cat, 2, payment_method="CASH"),
        tx(cash_id,  "EXPENSE", 260, "Petrol", fuel_cat, 15, payment_method="CASH"),
        tx(hdfc_id,  "EXPENSE", 103, "Bus Ticket", fuel_cat, 20, payment_method="UPI"),
        # Utilities
        tx(hdfc_id,  "EXPENSE", 516, "Home Electricity Bill", util_cat, 10, payment_method="UPI"),
        tx(hdfc_id,  "EXPENSE", 589, "BSNL Broadband Recharge", util_cat, 12, payment_method="UPI"),
        tx(hdfc_id,  "EXPENSE", 548, "Airtel Recharge", util_cat, 24, payment_method="UPI"),
        tx(hdfc_id,  "EXPENSE", 199, "Canva Premium", util_cat, 13, payment_method="UPI"),
        # Shopping
        tx(hdfc_id,  "EXPENSE", 611, "Qubo CCTV Camera", shop_cat, 25, payment_method="UPI"),
        tx(hdfc_id,  "EXPENSE", 480, "Footwear", shop_cat, 30, payment_method="UPI"),
        tx(hdfc_id,  "EXPENSE", 270, "Laptop Cooler", shop_cat, 28, payment_method="UPI"),
        # Healthcare
        tx(cash_id,  "EXPENSE", 253, "Medicine - BP, Sinarest", health_cat, 20, payment_method="CASH"),
        tx(cash_id,  "EXPENSE", 160, "Medicine", health_cat, 40, payment_method="CASH"),
        # Investments
        tx(icici_id, "EXPENSE", 2000, "Inverter EMI", loan_cat, 22, payment_method="AUTO_DEBIT"),
        tx(icici_id, "EXPENSE", 2153, "Mobile EMI", loan_cat, 2, payment_method="AUTO_DEBIT"),
        tx(hdfc_id,  "EXPENSE", 100,  "Groww - Mutual Fund SIP", invest_cat, 8, payment_method="UPI"),
    ]

    for t in transactions:
        db.add(t)
    print(f"  [+] {len(transactions)} sample transactions seeded")

    # ── Investments ───────────────────────────────────────────────────────────
    investments = [
        Investment(
            id=str(uuid.uuid4()), workspace_id=ws_id,
            name="Groww Mutual Fund - HDFC Flexi Cap",
            type=InvestmentType.MUTUAL_FUND,
            institution="Groww / HDFC AMC",
            invested_amount=Decimal("12000.00"),
            current_value=Decimal("13450.00"),
            purchase_date=date(2025, 11, 1),
            is_active=True,
        ),
        Investment(
            id=str(uuid.uuid4()), workspace_id=ws_id,
            name="SBI Life Insurance (LIC)",
            type=InvestmentType.INSURANCE,
            institution="LIC of India",
            invested_amount=Decimal("7578.00"),
            current_value=Decimal("7578.00"),
            purchase_date=date(2026, 1, 9),
            is_active=True,
        ),
        Investment(
            id=str(uuid.uuid4()), workspace_id=ws_id,
            name="Pigmi Savings",
            type=InvestmentType.RECURRING_DEPOSIT,
            institution="Local Bank",
            invested_amount=Decimal("500.00"),
            current_value=Decimal("500.00"),
            purchase_date=date(2026, 1, 11),
            is_active=True,
        ),
    ]
    for inv in investments:
        db.add(inv)
    print(f"  [+] {len(investments)} investments seeded")

    # ── Loans ─────────────────────────────────────────────────────────────────
    loans = [
        Loan(
            id=str(uuid.uuid4()), workspace_id=ws_id,
            name="Inverter EMI",
            type=LoanType.PERSONAL,
            institution="Finance Company",
            principal=Decimal("24000.00"),
            interest_rate=Decimal("12.00"),
            tenure_months=12,
            emi_amount=Decimal("2000.00"),
            start_date=date(2025, 11, 5),
            outstanding_balance=Decimal("8000.00"),
            total_paid=Decimal("16000.00"),
            interest_paid=Decimal("1200.00"),
            status="ACTIVE",
            notes="Microtek Inverter",
        ),
        Loan(
            id=str(uuid.uuid4()), workspace_id=ws_id,
            name="Mobile EMI (Snapmint)",
            type=LoanType.PERSONAL,
            institution="Snapmint",
            principal=Decimal("12919.68"),
            interest_rate=Decimal("0.00"),
            tenure_months=6,
            emi_amount=Decimal("2153.28"),
            start_date=date(2026, 2, 14),
            outstanding_balance=Decimal("4306.56"),
            total_paid=Decimal("8613.12"),
            interest_paid=Decimal("0.00"),
            status="ACTIVE",
            notes="Smartphone - 0% EMI",
        ),
    ]
    for loan in loans:
        db.add(loan)
    print(f"  [+] {len(loans)} loans seeded")

    # ── Contacts ──────────────────────────────────────────────────────────────
    contacts = [
        Contact(id=str(uuid.uuid4()), workspace_id=ws_id, type=ContactType.CUSTOMER,
                name="RR Viva Hospital", phone="9876543210", company="RR Viva HMS", is_active=True),
        Contact(id=str(uuid.uuid4()), workspace_id=ws_id, type=ContactType.CUSTOMER,
                name="Veeram Clinics", phone="9845612345", company="Veeram Healthcare", is_active=True),
        Contact(id=str(uuid.uuid4()), workspace_id=ws_id, type=ContactType.PERSONAL,
                name="Abhishek", phone="9900001234", is_active=True),
    ]
    for c in contacts:
        db.add(c)
    print(f"  [+] {len(contacts)} contacts seeded")

    # ── Budget ────────────────────────────────────────────────────────────────
    budget = Budget(
        id=str(uuid.uuid4()), workspace_id=ws_id,
        name="August 2026 Budget",
        period=BudgetPeriod.MONTHLY,
        start_date=today.replace(day=1),
        is_active=True,
    )
    db.add(budget)
    await db.flush()
    for cat_name, amount in [("Food & Dining", 3000), ("Grocery", 5000), ("Transport & Fuel", 2000), ("Utilities & Bills", 3000)]:
        cat_id = cat_map.get(cat_name)
        if cat_id:
            db.add(BudgetCategory(
                id=str(uuid.uuid4()), budget_id=budget.id, category_id=cat_id,
                allocated_amount=Decimal(str(amount)),
            ))
    print("  [+] Budget seeded")

    await db.commit()
    print("\n[OK] Seed complete!")
    print("     Login: admin@daytoexpense.com / DayToExpense@2024")


async def main():
    from backend.database.connection import init_db, AsyncSessionLocal, engine
    await init_db()
    async with AsyncSessionLocal() as session:
        await seed(session)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
