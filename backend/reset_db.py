import asyncio
import sys
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from sqlalchemy import text
from backend.database.connection import engine, Base
import backend.models  # noqa: F401


async def reset_db():
    print("Disabling MySQL foreign key checks...")
    async with engine.begin() as conn:
        await conn.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
        print("Dropping all existing tables in MySQL database 'daytodayexpenses'...")
        
        # Fetch all tables directly from MySQL
        tables_res = await conn.execute(text("SHOW TABLES;"))
        tables = [t[0] for t in tables_res.fetchall()]
        for t_name in tables:
            print(f"Dropping table: {t_name}")
            await conn.execute(text(f"DROP TABLE IF EXISTS `{t_name}`;"))

        print("Creating fresh clean tables...")
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
        
    print("SUCCESS: All MySQL tables in 'daytodayexpenses' truncated and recreated fresh!")


if __name__ == "__main__":
    asyncio.run(reset_db())
