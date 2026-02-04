#!/usr/bin/env python3
"""Migration script to add new columns to users table and create global_settings table"""

import sqlite3
import os

# Path to database
db_path = 'instance/scraper.db'

if not os.path.exists(db_path):
    print(f"Database not found: {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get existing columns
cursor.execute("PRAGMA table_info(users)")
existing_cols = [col[1] for col in cursor.fetchall()]
print(f"Existing columns: {existing_cols}")

# New columns to add
new_columns = [
    ("is_admin", "BOOLEAN DEFAULT 0"),
    ("plan_type", "VARCHAR(20) DEFAULT 'free'"),
    ("plan_status", "VARCHAR(20) DEFAULT 'active'"),
    ("trial_uses", "INTEGER DEFAULT 3"),
    ("max_trial_uses", "INTEGER DEFAULT 3"),
    ("subscription_start", "DATETIME"),
    ("subscription_end", "DATETIME"),
    ("is_banned", "BOOLEAN DEFAULT 0"),
    ("ban_reason", "VARCHAR(500)"),
    ("banned_at", "DATETIME"),
]

for col_name, col_type in new_columns:
    if col_name not in existing_cols:
        try:
            cursor.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}")
            print(f"✅ Added column: {col_name}")
        except Exception as e:
            print(f"❌ Error adding {col_name}: {e}")
    else:
        print(f"⏭️ Column already exists: {col_name}")

# Create global_settings table if not exists
print("\n📋 Checking global_settings table...")
cursor.execute("""
    CREATE TABLE IF NOT EXISTS global_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key VARCHAR(100) UNIQUE NOT NULL,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_by INTEGER REFERENCES users(id)
    )
""")
print("✅ global_settings table ready!")

# Create index on key column
try:
    cursor.execute("CREATE INDEX IF NOT EXISTS ix_global_settings_key ON global_settings (key)")
    print("✅ Index on global_settings.key created!")
except Exception as e:
    print(f"⏭️ Index already exists or error: {e}")

conn.commit()
conn.close()
print("\n✅ Migration completed!")
