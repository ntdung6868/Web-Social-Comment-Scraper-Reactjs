# ===========================================
# run.py - File thực thi chính
# ===========================================
# Khởi chạy Flask server
# Sử dụng: python run.py

import os
import sys

# Print startup info for debugging on Railway
print("=" * 50, file=sys.stderr, flush=True)
print("Starting Web Scraper Application...", file=sys.stderr, flush=True)
print(f"Python version: {sys.version}", file=sys.stderr, flush=True)
print(f"PORT env: {os.environ.get('PORT', 'not set')}", file=sys.stderr, flush=True)
print(f"Working directory: {os.getcwd()}", file=sys.stderr, flush=True)
print(f"Files in /app: {os.listdir('/app') if os.path.exists('/app') else 'N/A'}", file=sys.stderr, flush=True)
print("=" * 50, file=sys.stderr, flush=True)

try:
    from dotenv import load_dotenv
    load_dotenv()
    print("dotenv loaded", file=sys.stderr, flush=True)
    
    # Auto-migrate database on startup
    print("Running database migration...", file=sys.stderr, flush=True)
    try:
        import sqlite3
        db_path = 'instance/scraper.db'
        if os.path.exists(db_path):
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            # Create global_settings table if not exists
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS global_settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    key VARCHAR(100) UNIQUE NOT NULL,
                    value TEXT,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_by INTEGER REFERENCES users(id)
                )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS ix_global_settings_key ON global_settings (key)")
            conn.commit()
            conn.close()
            print("✅ Database migration completed!", file=sys.stderr, flush=True)
        else:
            print("Database not found, will be created on first request", file=sys.stderr, flush=True)
    except Exception as mig_err:
        print(f"Migration warning: {mig_err}", file=sys.stderr, flush=True)
    
    from app import create_app
    print("create_app imported", file=sys.stderr, flush=True)
    
    app = create_app()
    print("Flask app created successfully!", file=sys.stderr, flush=True)
except Exception as e:
    print(f"ERROR during startup: {e}", file=sys.stderr, flush=True)
    import traceback
    traceback.print_exc()
    sys.exit(1)

if __name__ == '__main__':
    # Lấy cấu hình từ biến môi trường
    debug = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'
    host = os.getenv('FLASK_HOST', '0.0.0.0')
    port = int(os.getenv('FLASK_PORT', 5000))
    
    print("=" * 50)
    print("🚀 Web Scraper Application")
    print("=" * 50)
    print(f"📍 Server: http://{host}:{port}")
    print(f"🔧 Debug Mode: {debug}")
    print("=" * 50)
    
    # Chạy server
    app.run(
        host=host,
        port=port,
        debug=debug
    )
