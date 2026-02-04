#!/usr/bin/env python3
"""Set admin for a user"""

import sqlite3

db_path = 'instance/scraper.db'
username = 'dungdev73'

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Find user
cursor.execute("SELECT id, username, email, is_admin FROM users WHERE username = ?", (username,))
user = cursor.fetchone()

if user:
    user_id, uname, email, is_admin = user
    cursor.execute("UPDATE users SET is_admin = 1 WHERE id = ?", (user_id,))
    conn.commit()
    print(f"✅ Set admin for user: {uname}")
    print(f"   Email: {email}")
    print(f"   Was admin: {bool(is_admin)}")
    print(f"   Now admin: True")
else:
    print(f"❌ User '{username}' not found")
    # List all users
    cursor.execute("SELECT username, email FROM users")
    users = cursor.fetchall()
    if users:
        print("\nExisting users:")
        for u in users:
            print(f"  - {u[0]} ({u[1]})")

conn.close()
