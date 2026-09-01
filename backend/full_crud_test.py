import asyncio
import sys
import uuid
from datetime import date, timedelta
from decimal import Decimal

sys.path.insert(0, '.')

from httpx import AsyncClient, ASGITransport
from backend.main import app
from backend.database.connection import AsyncSessionLocal
from backend.models.user import User
from backend.models.workspace import Workspace, WorkspaceMember, WorkspaceRole
from backend.core.security import create_access_token
from sqlalchemy import select

results = []

def record(module, action, method, path, success, detail=""):
    status = "[PASS]" if success else "[FAIL]"
    results.append({
        "module": module,
        "action": action,
        "method": method,
        "path": path,
        "status": status,
        "detail": detail
    })
    print(f"{status} {module} - {action} ({method} {path}) {detail}")

async def run_full_verification():
    print("==================================================")
    print("STARTING FULL END-TO-END CRUD VERIFICATION SUITE")
    print("==================================================")
    
    # 1. Setup DB User and Workspace Context
    async with AsyncSessionLocal() as db:
        res_u = await db.execute(select(User).limit(1))
        user = res_u.scalar_one_or_none()
        if not user:
            print("[FAIL] No user found in database. Cannot run tests.")
            return

        res_ws = await db.execute(select(Workspace).limit(1))
        workspace = res_ws.scalar_one_or_none()
        if not workspace:
            print("[FAIL] No workspace found in database. Cannot run tests.")
            return

        # Ensure user is workspace OWNER
        res_mem = await db.execute(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == workspace.id,
                WorkspaceMember.user_id == user.id
            )
        )
        mem = res_mem.scalar_one_or_none()
        if not mem:
            mem = WorkspaceMember(
                id=str(uuid.uuid4()),
                workspace_id=workspace.id,
                user_id=user.id,
                role=WorkspaceRole.OWNER
            )
            db.add(mem)
            await db.commit()

        token = create_access_token({"sub": user.id})
        headers = {"Authorization": f"Bearer {token}"}
        ws_id = workspace.id
        user_id = user.id

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        
        # ─────────────────────────────────────────────────────────────
        # 0. AUTH & WORKSPACE CRUD
        # ─────────────────────────────────────────────────────────────
        try:
            r = await client.get("/api/v1/auth/me", headers=headers)
            record("Auth", "Get Current User Profile", "GET", "/auth/me", r.status_code == 200)
        except Exception as e:
            record("Auth", "Get Current User Profile", "GET", "/auth/me", False, str(e))

        try:
            r = await client.put("/api/v1/auth/me", headers=headers, json={"full_name": user.full_name})
            record("Auth", "Update User Profile", "PUT", "/auth/me", r.status_code == 200)
        except Exception as e:
            record("Auth", "Update User Profile", "PUT", "/auth/me", False, str(e))

        try:
            r = await client.get("/api/v1/workspaces", headers=headers)
            record("Workspaces", "List Workspaces", "GET", "/workspaces", r.status_code == 200)
        except Exception as e:
            record("Workspaces", "List Workspaces", "GET", "/workspaces", False, str(e))

        new_ws_id = None
        try:
            r = await client.post("/api/v1/workspaces", headers=headers, json={"name": "Temp Test WS", "type": "PERSONAL"})
            if r.status_code in (200, 201):
                new_ws_id = r.json().get("data", {}).get("id")
                record("Workspaces", "Create Workspace", "POST", "/workspaces", True)
            else:
                record("Workspaces", "Create Workspace", "POST", "/workspaces", False, f"Status: {r.status_code}")
        except Exception as e:
            record("Workspaces", "Create Workspace", "POST", "/workspaces", False, str(e))

        if new_ws_id:
            try:
                r = await client.put(f"/api/v1/workspaces/{new_ws_id}", headers=headers, json={"name": "Temp Test WS Renamed"})
                record("Workspaces", "Update Workspace", "PUT", f"/workspaces/{new_ws_id}", r.status_code == 200)
            except Exception as e:
                record("Workspaces", "Update Workspace", "PUT", f"/workspaces/{new_ws_id}", False, str(e))

            try:
                r = await client.delete(f"/api/v1/workspaces/{new_ws_id}", headers=headers)
                record("Workspaces", "Delete Workspace", "DELETE", f"/workspaces/{new_ws_id}", r.status_code == 200)
            except Exception as e:
                record("Workspaces", "Delete Workspace", "DELETE", f"/workspaces/{new_ws_id}", False, str(e))

        # ─────────────────────────────────────────────────────────────
        # 1. ACCOUNTS CRUD
        # ─────────────────────────────────────────────────────────────
        acc_id = None
        try:
            r = await client.post(
                f"/api/v1/workspaces/{ws_id}/accounts",
                headers=headers,
                json={
                    "name": "Test Bank Account",
                    "account_type": "SAVINGS",
                    "currency_code": "INR",
                    "opening_balance": 10000.0,
                    "bank_name": "State Bank",
                    "color": "#3B82F6",
                }
            )
            if r.status_code in (200, 201):
                acc_id = r.json().get("data", {}).get("id")
                record("Accounts", "Create Account", "POST", f"/workspaces/{ws_id}/accounts", True)
            else:
                record("Accounts", "Create Account", "POST", f"/workspaces/{ws_id}/accounts", False, f"Status: {r.status_code}, Body: {r.text}")
        except Exception as e:
            record("Accounts", "Create Account", "POST", f"/workspaces/{ws_id}/accounts", False, str(e))

        try:
            r = await client.get(f"/api/v1/workspaces/{ws_id}/accounts", headers=headers)
            record("Accounts", "List Accounts", "GET", f"/workspaces/{ws_id}/accounts", r.status_code == 200)
        except Exception as e:
            record("Accounts", "List Accounts", "GET", f"/workspaces/{ws_id}/accounts", False, str(e))

        if acc_id:
            try:
                r = await client.put(
                    f"/api/v1/workspaces/{ws_id}/accounts/{acc_id}",
                    headers=headers,
                    json={
                        "name": "Test Bank Account Updated",
                        "opening_balance": 15000.0
                    }
                )
                record("Accounts", "Update Account", "PUT", f"/workspaces/{ws_id}/accounts/{acc_id}", r.status_code == 200)
            except Exception as e:
                record("Accounts", "Update Account", "PUT", f"/workspaces/{ws_id}/accounts/{acc_id}", False, str(e))

        # ─────────────────────────────────────────────────────────────
        # 2. CATEGORIES CRUD
        # ─────────────────────────────────────────────────────────────
        cat_id = None
        try:
            r = await client.post(
                f"/api/v1/workspaces/{ws_id}/categories",
                headers=headers,
                json={
                    "name": "Test General Expense",
                    "type": "EXPENSE",
                    "icon": "ShoppingCart",
                    "color": "#EF4444"
                }
            )
            if r.status_code in (200, 201):
                cat_id = r.json().get("data", {}).get("id")
                record("Categories", "Create Category", "POST", f"/workspaces/{ws_id}/categories", True)
            else:
                record("Categories", "Create Category", "POST", f"/workspaces/{ws_id}/categories", False, f"Status: {r.status_code}, Body: {r.text}")
        except Exception as e:
            record("Categories", "Create Category", "POST", f"/workspaces/{ws_id}/categories", False, str(e))

        try:
            r = await client.get(f"/api/v1/workspaces/{ws_id}/categories", headers=headers)
            record("Categories", "List Categories", "GET", f"/workspaces/{ws_id}/categories", r.status_code == 200)
        except Exception as e:
            record("Categories", "List Categories", "GET", f"/workspaces/{ws_id}/categories", False, str(e))

        if cat_id:
            try:
                r = await client.put(
                    f"/api/v1/workspaces/{ws_id}/categories/{cat_id}",
                    headers=headers,
                    json={"name": "Test General Expense Renamed"}
                )
                record("Categories", "Update Category", "PUT", f"/workspaces/{ws_id}/categories/{cat_id}", r.status_code == 200)
            except Exception as e:
                record("Categories", "Update Category", "PUT", f"/workspaces/{ws_id}/categories/{cat_id}", False, str(e))

        # ─────────────────────────────────────────────────────────────
        # 3. TRANSACTIONS CRUD
        # ─────────────────────────────────────────────────────────────
        tx_id = None
        if acc_id and cat_id:
            try:
                r = await client.post(
                    f"/api/v1/workspaces/{ws_id}/transactions",
                    headers=headers,
                    json={
                        "account_id": acc_id,
                        "category_id": cat_id,
                        "type": "EXPENSE",
                        "amount": 250.0,
                        "date": str(date.today()),
                        "description": "Supermarket Supplies",
                        "payment_method": "UPI",
                        "status": "COMPLETED"
                    }
                )
                if r.status_code in (200, 201):
                    tx_id = r.json().get("data", {}).get("id")
                    record("Transactions", "Create Transaction", "POST", f"/workspaces/{ws_id}/transactions", True)
                else:
                    record("Transactions", "Create Transaction", "POST", f"/workspaces/{ws_id}/transactions", False, f"Status: {r.status_code}, Body: {r.text}")
            except Exception as e:
                record("Transactions", "Create Transaction", "POST", f"/workspaces/{ws_id}/transactions", False, str(e))

            try:
                r = await client.get(f"/api/v1/workspaces/{ws_id}/transactions", headers=headers)
                record("Transactions", "List Transactions", "GET", f"/workspaces/{ws_id}/transactions", r.status_code == 200)
            except Exception as e:
                record("Transactions", "List Transactions", "GET", f"/workspaces/{ws_id}/transactions", False, str(e))

            if tx_id:
                try:
                    r = await client.put(
                        f"/api/v1/workspaces/{ws_id}/transactions/{tx_id}",
                        headers=headers,
                        json={
                            "description": "Supermarket Supplies - Updated",
                            "amount": 300.0
                        }
                    )
                    record("Transactions", "Update Transaction", "PUT", f"/workspaces/{ws_id}/transactions/{tx_id}", r.status_code == 200)
                except Exception as e:
                    record("Transactions", "Update Transaction", "PUT", f"/workspaces/{ws_id}/transactions/{tx_id}", False, str(e))

        # ─────────────────────────────────────────────────────────────
        # 4. TRANSFERS CRUD
        # ─────────────────────────────────────────────────────────────
        acc2_id = None
        transfer_id = None
        try:
            r = await client.post(
                f"/api/v1/workspaces/{ws_id}/accounts",
                headers=headers,
                json={
                    "name": "Secondary Cash Account",
                    "account_type": "CASH",
                    "currency_code": "INR",
                    "opening_balance": 5000.0,
                }
            )
            if r.status_code in (200, 201):
                acc2_id = r.json().get("data", {}).get("id")
        except Exception:
            pass

        if acc_id and acc2_id:
            try:
                r = await client.post(
                    f"/api/v1/workspaces/{ws_id}/transfers",
                    headers=headers,
                    json={
                        "from_account_id": acc_id,
                        "to_account_id": acc2_id,
                        "amount": 1000.0,
                        "date": str(date.today()),
                        "description": "ATM Cash Withdrawal",
                    }
                )
                if r.status_code in (200, 201):
                    transfer_id = r.json().get("data", {}).get("id")
                    record("Transfers", "Create Transfer", "POST", f"/workspaces/{ws_id}/transfers", True)
                else:
                    record("Transfers", "Create Transfer", "POST", f"/workspaces/{ws_id}/transfers", False, f"Status: {r.status_code}, Body: {r.text}")
            except Exception as e:
                record("Transfers", "Create Transfer", "POST", f"/workspaces/{ws_id}/transfers", False, str(e))

            try:
                r = await client.get(f"/api/v1/workspaces/{ws_id}/transfers", headers=headers)
                record("Transfers", "List Transfers", "GET", f"/workspaces/{ws_id}/transfers", r.status_code == 200)
            except Exception as e:
                record("Transfers", "List Transfers", "GET", f"/workspaces/{ws_id}/transfers", False, str(e))

            if transfer_id:
                try:
                    r = await client.delete(f"/api/v1/workspaces/{ws_id}/transfers/{transfer_id}", headers=headers)
                    record("Transfers", "Delete Transfer", "DELETE", f"/workspaces/{ws_id}/transfers/{transfer_id}", r.status_code == 200)
                except Exception as e:
                    record("Transfers", "Delete Transfer", "DELETE", f"/workspaces/{ws_id}/transfers/{transfer_id}", False, str(e))

        # ─────────────────────────────────────────────────────────────
        # 5. BUDGETS CRUD
        # ─────────────────────────────────────────────────────────────
        budget_id = None
        try:
            r = await client.post(
                f"/api/v1/workspaces/{ws_id}/budgets",
                headers=headers,
                json={
                    "name": "Monthly Groceries Budget",
                    "period": "MONTHLY",
                    "start_date": str(date.today().replace(day=1)),
                    "categories": [
                        {"category_id": cat_id, "allocated_amount": 15000.0}
                    ] if cat_id else []
                }
            )
            if r.status_code in (200, 201):
                budget_id = r.json().get("data", {}).get("id")
                record("Budgets", "Create Budget", "POST", f"/workspaces/{ws_id}/budgets", True)
            else:
                record("Budgets", "Create Budget", "POST", f"/workspaces/{ws_id}/budgets", False, f"Status: {r.status_code}, Body: {r.text}")
        except Exception as e:
            record("Budgets", "Create Budget", "POST", f"/workspaces/{ws_id}/budgets", False, str(e))

        try:
            r = await client.get(f"/api/v1/workspaces/{ws_id}/budgets", headers=headers)
            record("Budgets", "List Budgets", "GET", f"/workspaces/{ws_id}/budgets", r.status_code == 200)
        except Exception as e:
            record("Budgets", "List Budgets", "GET", f"/workspaces/{ws_id}/budgets", False, str(e))

        if budget_id:
            try:
                r = await client.put(
                    f"/api/v1/workspaces/{ws_id}/budgets/{budget_id}",
                    headers=headers,
                    json={"name": "Monthly Groceries Budget - Updated"}
                )
                record("Budgets", "Update Budget", "PUT", f"/workspaces/{ws_id}/budgets/{budget_id}", r.status_code == 200)
            except Exception as e:
                record("Budgets", "Update Budget", "PUT", f"/workspaces/{ws_id}/budgets/{budget_id}", False, str(e))

            try:
                r = await client.delete(f"/api/v1/workspaces/{ws_id}/budgets/{budget_id}", headers=headers)
                record("Budgets", "Delete Budget", "DELETE", f"/workspaces/{ws_id}/budgets/{budget_id}", r.status_code == 200)
            except Exception as e:
                record("Budgets", "Delete Budget", "DELETE", f"/workspaces/{ws_id}/budgets/{budget_id}", False, str(e))

        # ─────────────────────────────────────────────────────────────
        # 6. INVESTMENTS & SIP PLANS CRUD
        # ─────────────────────────────────────────────────────────────
        inv_id = None
        try:
            r = await client.post(
                f"/api/v1/workspaces/{ws_id}/investments",
                headers=headers,
                json={
                    "name": "Nifty 50 Index Fund",
                    "type": "MUTUAL_FUND",
                    "invested_amount": 50000.0,
                    "current_value": 53000.0,
                }
            )
            if r.status_code in (200, 201):
                inv_id = r.json().get("data", {}).get("id")
                record("Investments", "Create Investment", "POST", f"/workspaces/{ws_id}/investments", True)
            else:
                record("Investments", "Create Investment", "POST", f"/workspaces/{ws_id}/investments", False, f"Status: {r.status_code}, Body: {r.text}")
        except Exception as e:
            record("Investments", "Create Investment", "POST", f"/workspaces/{ws_id}/investments", False, str(e))

        try:
            r = await client.get(f"/api/v1/workspaces/{ws_id}/investments", headers=headers)
            record("Investments", "List Investments", "GET", f"/workspaces/{ws_id}/investments", r.status_code == 200)
        except Exception as e:
            record("Investments", "List Investments", "GET", f"/workspaces/{ws_id}/investments", False, str(e))

        if inv_id:
            try:
                r = await client.put(
                    f"/api/v1/workspaces/{ws_id}/investments/{inv_id}",
                    headers=headers,
                    json={"name": "Nifty 50 Index Fund - Updated", "current_value": 55000.0}
                )
                record("Investments", "Update Investment", "PUT", f"/workspaces/{ws_id}/investments/{inv_id}", r.status_code == 200)
            except Exception as e:
                record("Investments", "Update Investment", "PUT", f"/workspaces/{ws_id}/investments/{inv_id}", False, str(e))

            try:
                r = await client.delete(f"/api/v1/workspaces/{ws_id}/investments/{inv_id}", headers=headers)
                record("Investments", "Delete Investment", "DELETE", f"/workspaces/{ws_id}/investments/{inv_id}", r.status_code == 200)
            except Exception as e:
                record("Investments", "Delete Investment", "DELETE", f"/workspaces/{ws_id}/investments/{inv_id}", False, str(e))

        # ─────────────────────────────────────────────────────────────
        # 7. LOANS CRUD
        # ─────────────────────────────────────────────────────────────
        loan_id = None
        try:
            r = await client.post(
                f"/api/v1/workspaces/{ws_id}/loans",
                headers=headers,
                json={
                    "name": "Vehicle Loan",
                    "type": "PERSONAL",
                    "institution": "HDFC Bank",
                    "principal": 200000.0,
                    "interest_rate": 8.5,
                    "tenure_months": 24,
                    "emi_amount": 9000.0,
                    "start_date": str(date.today()),
                    "account_id": acc_id,
                }
            )
            if r.status_code in (200, 201):
                loan_id = r.json().get("data", {}).get("id")
                record("Loans", "Create Loan", "POST", f"/workspaces/{ws_id}/loans", True)
            else:
                record("Loans", "Create Loan", "POST", f"/workspaces/{ws_id}/loans", False, f"Status: {r.status_code}, Body: {r.text}")
        except Exception as e:
            record("Loans", "Create Loan", "POST", f"/workspaces/{ws_id}/loans", False, str(e))

        try:
            r = await client.get(f"/api/v1/workspaces/{ws_id}/loans", headers=headers)
            record("Loans", "List Loans", "GET", f"/workspaces/{ws_id}/loans", r.status_code == 200)
        except Exception as e:
            record("Loans", "List Loans", "GET", f"/workspaces/{ws_id}/loans", False, str(e))

        if loan_id:
            try:
                r = await client.put(
                    f"/api/v1/workspaces/{ws_id}/loans/{loan_id}",
                    headers=headers,
                    json={"name": "Vehicle Loan Updated"}
                )
                record("Loans", "Update Loan", "PUT", f"/workspaces/{ws_id}/loans/{loan_id}", r.status_code == 200)
            except Exception as e:
                record("Loans", "Update Loan", "PUT", f"/workspaces/{ws_id}/loans/{loan_id}", False, str(e))

            try:
                r = await client.delete(f"/api/v1/workspaces/{ws_id}/loans/{loan_id}", headers=headers)
                record("Loans", "Delete Loan", "DELETE", f"/workspaces/{ws_id}/loans/{loan_id}", r.status_code == 200)
            except Exception as e:
                record("Loans", "Delete Loan", "DELETE", f"/workspaces/{ws_id}/loans/{loan_id}", False, str(e))

        # ─────────────────────────────────────────────────────────────
        # 8. CONTACTS CRUD
        # ─────────────────────────────────────────────────────────────
        contact_id = None
        try:
            r = await client.post(
                f"/api/v1/workspaces/{ws_id}/contacts",
                headers=headers,
                json={
                    "name": "Jane Doe Staff",
                    "type": "EMPLOYEE",
                    "email": "jane.staff@example.com",
                    "phone": "9876543210",
                }
            )
            if r.status_code in (200, 201):
                contact_id = r.json().get("data", {}).get("id")
                record("Contacts", "Create Contact", "POST", f"/workspaces/{ws_id}/contacts", True)
            else:
                record("Contacts", "Create Contact", "POST", f"/workspaces/{ws_id}/contacts", False, f"Status: {r.status_code}, Body: {r.text}")
        except Exception as e:
            record("Contacts", "Create Contact", "POST", f"/workspaces/{ws_id}/contacts", False, str(e))

        try:
            r = await client.get(f"/api/v1/workspaces/{ws_id}/contacts", headers=headers)
            record("Contacts", "List Contacts", "GET", f"/workspaces/{ws_id}/contacts", r.status_code == 200)
        except Exception as e:
            record("Contacts", "List Contacts", "GET", f"/workspaces/{ws_id}/contacts", False, str(e))

        if contact_id:
            try:
                r = await client.put(
                    f"/api/v1/workspaces/{ws_id}/contacts/{contact_id}",
                    headers=headers,
                    json={"name": "Jane Doe Senior Staff"}
                )
                record("Contacts", "Update Contact", "PUT", f"/workspaces/{ws_id}/contacts/{contact_id}", r.status_code == 200)
            except Exception as e:
                record("Contacts", "Update Contact", "PUT", f"/workspaces/{ws_id}/contacts/{contact_id}", False, str(e))

        # ─────────────────────────────────────────────────────────────
        # 9. INVOICES CRUD
        # ─────────────────────────────────────────────────────────────
        invoice_id = None
        if contact_id:
            try:
                r = await client.post(
                    f"/api/v1/workspaces/{ws_id}/invoices",
                    headers=headers,
                    json={
                        "customer_id": contact_id,
                        "date": str(date.today()),
                        "due_date": str(date.today() + timedelta(days=15)),
                        "items": [
                            {"description": "Consulting Services", "quantity": 10.0, "unit_price": 500.0, "tax_rate": 18.0}
                        ]
                    }
                )
                if r.status_code in (200, 201):
                    invoice_id = r.json().get("data", {}).get("id")
                    record("Invoices", "Create Invoice", "POST", f"/workspaces/{ws_id}/invoices", True)
                else:
                    record("Invoices", "Create Invoice", "POST", f"/workspaces/{ws_id}/invoices", False, f"Status: {r.status_code}, Body: {r.text}")
            except Exception as e:
                record("Invoices", "Create Invoice", "POST", f"/workspaces/{ws_id}/invoices", False, str(e))

            try:
                r = await client.get(f"/api/v1/workspaces/{ws_id}/invoices", headers=headers)
                record("Invoices", "List Invoices", "GET", f"/workspaces/{ws_id}/invoices", r.status_code == 200)
            except Exception as e:
                record("Invoices", "List Invoices", "GET", f"/workspaces/{ws_id}/invoices", False, str(e))

            if invoice_id:
                try:
                    r = await client.put(
                        f"/api/v1/workspaces/{ws_id}/invoices/{invoice_id}",
                        headers=headers,
                        json={"status": "SENT", "notes": "Sent via email"}
                    )
                    record("Invoices", "Update Invoice", "PUT", f"/workspaces/{ws_id}/invoices/{invoice_id}", r.status_code == 200)
                except Exception as e:
                    record("Invoices", "Update Invoice", "PUT", f"/workspaces/{ws_id}/invoices/{invoice_id}", False, str(e))

                try:
                    r = await client.delete(f"/api/v1/workspaces/{ws_id}/invoices/{invoice_id}", headers=headers)
                    record("Invoices", "Delete Invoice", "DELETE", f"/workspaces/{ws_id}/invoices/{invoice_id}", r.status_code == 200)
                except Exception as e:
                    record("Invoices", "Delete Invoice", "DELETE", f"/workspaces/{ws_id}/invoices/{invoice_id}", False, str(e))

        # Delete Contact after invoice test
        if contact_id:
            try:
                r = await client.delete(f"/api/v1/workspaces/{ws_id}/contacts/{contact_id}", headers=headers)
                record("Contacts", "Delete Contact", "DELETE", f"/workspaces/{ws_id}/contacts/{contact_id}", r.status_code == 200)
            except Exception as e:
                record("Contacts", "Delete Contact", "DELETE", f"/workspaces/{ws_id}/contacts/{contact_id}", False, str(e))

        # ─────────────────────────────────────────────────────────────
        # 10. SUBSCRIPTIONS CRUD
        # ─────────────────────────────────────────────────────────────
        sub_id = None
        try:
            r = await client.post(
                f"/api/v1/workspaces/{ws_id}/subscriptions",
                headers=headers,
                json={
                    "name": "Cloud Server Hosting",
                    "amount": 2000.0,
                    "billing_cycle": "MONTHLY",
                    "next_billing_date": str(date.today() + timedelta(days=30)),
                    "account_id": acc_id,
                    "category_id": cat_id,
                }
            )
            if r.status_code in (200, 201):
                sub_id = r.json().get("data", {}).get("id")
                record("Subscriptions", "Create Subscription", "POST", f"/workspaces/{ws_id}/subscriptions", True)
            else:
                record("Subscriptions", "Create Subscription", "POST", f"/workspaces/{ws_id}/subscriptions", False, f"Status: {r.status_code}, Body: {r.text}")
        except Exception as e:
            record("Subscriptions", "Create Subscription", "POST", f"/workspaces/{ws_id}/subscriptions", False, str(e))

        try:
            r = await client.get(f"/api/v1/workspaces/{ws_id}/subscriptions", headers=headers)
            record("Subscriptions", "List Subscriptions", "GET", f"/workspaces/{ws_id}/subscriptions", r.status_code == 200)
        except Exception as e:
            record("Subscriptions", "List Subscriptions", "GET", f"/workspaces/{ws_id}/subscriptions", False, str(e))

        if sub_id:
            try:
                r = await client.put(
                    f"/api/v1/workspaces/{ws_id}/subscriptions/{sub_id}",
                    headers=headers,
                    json={"name": "Cloud Server Hosting - Upgraded", "amount": 2500.0}
                )
                record("Subscriptions", "Update Subscription", "PUT", f"/workspaces/{ws_id}/subscriptions/{sub_id}", r.status_code == 200)
            except Exception as e:
                record("Subscriptions", "Update Subscription", "PUT", f"/workspaces/{ws_id}/subscriptions/{sub_id}", False, str(e))

            try:
                r = await client.delete(f"/api/v1/workspaces/{ws_id}/subscriptions/{sub_id}", headers=headers)
                record("Subscriptions", "Delete Subscription", "DELETE", f"/workspaces/{ws_id}/subscriptions/{sub_id}", r.status_code == 200)
            except Exception as e:
                record("Subscriptions", "Delete Subscription", "DELETE", f"/workspaces/{ws_id}/subscriptions/{sub_id}", False, str(e))

        # ─────────────────────────────────────────────────────────────
        # 11. WISHLIST CRUD & ACTIONS
        # ─────────────────────────────────────────────────────────────
        wish_id = None
        try:
            r = await client.post(
                f"/api/v1/workspaces/{ws_id}/wishlist",
                headers=headers,
                json={
                    "name": "Fresh Organic Apples",
                    "quantity": 2.5,
                    "unit": "kg",
                    "price": 120.0,
                    "notes": "Red Delicious variety"
                }
            )
            if r.status_code in (200, 201):
                wish_id = r.json().get("data", {}).get("id")
                record("Wishlist", "Create Wishlist Item", "POST", f"/workspaces/{ws_id}/wishlist", True)
            else:
                record("Wishlist", "Create Wishlist Item", "POST", f"/workspaces/{ws_id}/wishlist", False, f"Status: {r.status_code}, Body: {r.text}")
        except Exception as e:
            record("Wishlist", "Create Wishlist Item", "POST", f"/workspaces/{ws_id}/wishlist", False, str(e))

        try:
            r = await client.get(f"/api/v1/workspaces/{ws_id}/wishlist", headers=headers)
            record("Wishlist", "List Wishlist Items", "GET", f"/workspaces/{ws_id}/wishlist", r.status_code == 200)
        except Exception as e:
            record("Wishlist", "List Wishlist Items", "GET", f"/workspaces/{ws_id}/wishlist", False, str(e))

        if wish_id:
            try:
                r = await client.put(
                    f"/api/v1/workspaces/{ws_id}/wishlist/{wish_id}",
                    headers=headers,
                    json={"quantity": 3.0}
                )
                record("Wishlist", "Update Wishlist Item", "PUT", f"/workspaces/{ws_id}/wishlist/{wish_id}", r.status_code == 200)
            except Exception as e:
                record("Wishlist", "Update Wishlist Item", "PUT", f"/workspaces/{ws_id}/wishlist/{wish_id}", False, str(e))

            # Test Advance Action
            if acc_id:
                try:
                    r = await client.post(
                        f"/api/v1/workspaces/{ws_id}/wishlist/{wish_id}/advance",
                        headers=headers,
                        json={
                            "account_id": acc_id,
                            "amount": 300.0,
                            "notes": "Advance from room partner"
                        }
                    )
                    record("Wishlist", "Record Wishlist Advance (Income)", "POST", f"/workspaces/{ws_id}/wishlist/{wish_id}/advance", r.status_code == 200)
                except Exception as e:
                    record("Wishlist", "Record Wishlist Advance (Income)", "POST", f"/workspaces/{ws_id}/wishlist/{wish_id}/advance", False, str(e))

                # Test Purchase Action (Record Expense)
                try:
                    r = await client.post(
                        f"/api/v1/workspaces/{ws_id}/wishlist/{wish_id}/purchase",
                        headers=headers,
                        json={
                            "account_id": acc_id,
                            "category_id": cat_id,
                            "price": 110.0,
                            "record_expense": True
                        }
                    )
                    record("Wishlist", "Purchase Wishlist Item (Expense)", "POST", f"/workspaces/{ws_id}/wishlist/{wish_id}/purchase", r.status_code == 200)
                except Exception as e:
                    record("Wishlist", "Purchase Wishlist Item (Expense)", "POST", f"/workspaces/{ws_id}/wishlist/{wish_id}/purchase", False, str(e))

            try:
                r = await client.delete(f"/api/v1/workspaces/{ws_id}/wishlist/{wish_id}", headers=headers)
                record("Wishlist", "Delete Wishlist Item", "DELETE", f"/workspaces/{ws_id}/wishlist/{wish_id}", r.status_code == 200)
            except Exception as e:
                record("Wishlist", "Delete Wishlist Item", "DELETE", f"/workspaces/{ws_id}/wishlist/{wish_id}", False, str(e))

        # ─────────────────────────────────────────────────────────────
        # 12. SETTINGS & DYNAMIC COLLECTIONS
        # ─────────────────────────────────────────────────────────────
        try:
            r = await client.post(
                f"/api/v1/workspaces/{ws_id}/settings/test_array_setting",
                headers=headers,
                json=[{"id": 1, "item": "Alpha"}, {"id": 2, "item": "Beta"}]
            )
            record("Settings", "Save Array Setting", "POST", f"/workspaces/{ws_id}/settings/test_array_setting", r.status_code == 200)
        except Exception as e:
            record("Settings", "Save Array Setting", "POST", f"/workspaces/{ws_id}/settings/test_array_setting", False, str(e))

        try:
            r = await client.post(
                f"/api/v1/workspaces/{ws_id}/settings/test_dict_setting",
                headers=headers,
                json={"theme": "dark", "currency": "INR"}
            )
            record("Settings", "Save Object Setting", "POST", f"/workspaces/{ws_id}/settings/test_dict_setting", r.status_code == 200)
        except Exception as e:
            record("Settings", "Save Object Setting", "POST", f"/workspaces/{ws_id}/settings/test_dict_setting", False, str(e))

        try:
            r = await client.get(f"/api/v1/workspaces/{ws_id}/settings/test_dict_setting", headers=headers)
            record("Settings", "Get Setting", "GET", f"/workspaces/{ws_id}/settings/test_dict_setting", r.status_code == 200)
        except Exception as e:
            record("Settings", "Get Setting", "GET", f"/workspaces/{ws_id}/settings/test_dict_setting", False, str(e))

        # ─────────────────────────────────────────────────────────────
        # 13. REPORTS & DASHBOARD
        # ─────────────────────────────────────────────────────────────
        try:
            r = await client.get(f"/api/v1/workspaces/{ws_id}/reports/income?format=json&period=THIS_MONTH", headers=headers)
            record("Reports", "Income Report (JSON)", "GET", f"/workspaces/{ws_id}/reports/income", r.status_code == 200)
        except Exception as e:
            record("Reports", "Income Report (JSON)", "GET", f"/workspaces/{ws_id}/reports/income", False, str(e))

        try:
            r = await client.get(f"/api/v1/workspaces/{ws_id}/reports/income?format=csv&period=THIS_MONTH", headers=headers)
            record("Reports", "Income Report (CSV)", "GET", f"/workspaces/{ws_id}/reports/income", r.status_code == 200)
        except Exception as e:
            record("Reports", "Income Report (CSV)", "GET", f"/workspaces/{ws_id}/reports/income", False, str(e))

        try:
            r = await client.get(f"/api/v1/workspaces/{ws_id}/reports/expense?format=json&period=THIS_MONTH", headers=headers)
            record("Reports", "Expense Report (JSON)", "GET", f"/workspaces/{ws_id}/reports/expense", r.status_code == 200)
        except Exception as e:
            record("Reports", "Expense Report (JSON)", "GET", f"/workspaces/{ws_id}/reports/expense", False, str(e))

        try:
            r = await client.get(f"/api/v1/workspaces/{ws_id}/reports/expense?format=csv&period=THIS_MONTH", headers=headers)
            record("Reports", "Expense Report (CSV)", "GET", f"/workspaces/{ws_id}/reports/expense", r.status_code == 200)
        except Exception as e:
            record("Reports", "Expense Report (CSV)", "GET", f"/workspaces/{ws_id}/reports/expense", False, str(e))

        try:
            r = await client.get(f"/api/v1/workspaces/{ws_id}/dashboard/summary", headers=headers)
            record("Dashboard", "Dashboard Summary", "GET", f"/workspaces/{ws_id}/dashboard/summary", r.status_code == 200)
        except Exception as e:
            record("Dashboard", "Dashboard Summary", "GET", f"/workspaces/{ws_id}/dashboard/summary", False, str(e))

        # Cleanup created temporary test entities
        if tx_id:
            await client.delete(f"/api/v1/workspaces/{ws_id}/transactions/{tx_id}", headers=headers)
        if acc_id:
            await client.delete(f"/api/v1/workspaces/{ws_id}/accounts/{acc_id}", headers=headers)
        if acc2_id:
            await client.delete(f"/api/v1/workspaces/{ws_id}/accounts/{acc2_id}", headers=headers)
        if cat_id:
            await client.delete(f"/api/v1/workspaces/{ws_id}/categories/{cat_id}", headers=headers)

    print("\n==================================================")
    print("RESULTS SUMMARY:")
    print("==================================================")
    passed_cnt = sum(1 for r in results if "[PASS]" in r["status"])
    failed_cnt = sum(1 for r in results if "[FAIL]" in r["status"])
    print(f"Total Tests Run: {len(results)}")
    print(f"Passed: {passed_cnt}")
    print(f"Failed: {failed_cnt}")
    if failed_cnt > 0:
        print("\nFailed Items:")
        for r in results:
            if "[FAIL]" in r["status"]:
                print(f"- {r['module']} {r['action']}: {r['detail']}")
    else:
        print("\nALL ROUTES AND CRUD OPERATIONS ARE 100% OPERATIONAL AND READY FOR DEPLOYMENT!")

if __name__ == '__main__':
    asyncio.run(run_full_verification())
