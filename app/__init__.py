# ===========================================
# __init__.py - Khởi tạo Flask Application
# ===========================================
# File này là entry point của package app
# Cấu hình Flask, extensions và register blueprints

import os
from flask import Flask, session, request
from flask_login import LoginManager
from flask_wtf.csrf import CSRFProtect
from dotenv import load_dotenv

from app.models import db, User
from app.translations import get_translation, get_all_translations

# Load biến môi trường từ file .env
load_dotenv()


def get_database_url():
    """
    Lấy DATABASE_URL và chuyển đổi postgres:// thành postgresql://
    Railway sử dụng postgres:// nhưng SQLAlchemy 2.x yêu cầu postgresql://
    """
    database_url = os.getenv('DATABASE_URL', 'sqlite:///scraper.db')
    
    # Railway PostgreSQL dùng postgres:// nhưng SQLAlchemy cần postgresql://
    if database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql://', 1)
    
    return database_url

# Khởi tạo các extensions
login_manager = LoginManager()
csrf = CSRFProtect()


def create_app(config=None):
    """
    Factory function để tạo Flask application
    
    Args:
        config: Dictionary chứa cấu hình tùy chỉnh (optional)
        
    Returns:
        Flask: Instance của Flask application
    """
    # Tạo Flask app
    app = Flask(__name__)
    
    # Cấu hình từ biến môi trường
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'default-secret-key-change-me')
    app.config['SQLALCHEMY_DATABASE_URI'] = get_database_url()
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # Cấu hình bổ sung cho PostgreSQL
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'pool_pre_ping': True,  # Kiểm tra connection trước khi sử dụng
        'pool_recycle': 300,    # Recycle connection sau 5 phút
    }
    
    # Cấu hình bảo mật CSRF
    app.config['WTF_CSRF_ENABLED'] = True
    app.config['WTF_CSRF_TIME_LIMIT'] = 3600  # Token hết hạn sau 1 giờ
    
    # Cấu hình Session
    app.config['SESSION_COOKIE_SECURE'] = False  # True trong production với HTTPS
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
    
    # Cấu hình Flask-Mail cho password reset
    app.config['MAIL_SERVER'] = os.getenv('MAIL_SERVER', 'smtp.gmail.com')
    app.config['MAIL_PORT'] = int(os.getenv('MAIL_PORT', 587))
    app.config['MAIL_USE_TLS'] = os.getenv('MAIL_USE_TLS', 'True').lower() == 'true'
    app.config['MAIL_USE_SSL'] = os.getenv('MAIL_USE_SSL', 'False').lower() == 'true'
    app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME', '')
    app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD', '')
    app.config['MAIL_DEFAULT_SENDER'] = os.getenv('MAIL_DEFAULT_SENDER', 'noreply@webscraper.com')
    
    # Áp dụng cấu hình tùy chỉnh nếu có
    if config:
        app.config.update(config)
    
    # Khởi tạo extensions với app
    db.init_app(app)
    login_manager.init_app(app)
    csrf.init_app(app)
    
    # Khởi tạo Flask-Mail (nếu có cấu hình)
    if app.config.get('MAIL_USERNAME'):
        try:
            from flask_mail import Mail
            mail = Mail(app)
            print('[Mail] Flask-Mail initialized successfully')
        except Exception as e:
            print(f'[Mail] Could not initialize Flask-Mail: {e}')
    
    # Cấu hình Flask-Login
    login_manager.login_view = 'auth.login'  # Route đăng nhập
    login_manager.login_message = 'Vui lòng đăng nhập để truy cập trang này.'
    login_manager.login_message_category = 'warning'
    
    @login_manager.user_loader
    def load_user(user_id):
        """
        Callback để load user từ session
        
        Args:
            user_id: ID của user
            
        Returns:
            User: Instance của User hoặc None
        """
        return User.query.get(int(user_id))
    
    # Register Blueprints
    from app.routes import main, auth, api, admin
    
    app.register_blueprint(main)
    app.register_blueprint(auth, url_prefix='/auth')
    app.register_blueprint(api)  # url_prefix đã định nghĩa trong blueprint
    app.register_blueprint(admin)  # url_prefix đã định nghĩa trong blueprint
    
    # Exempt CSRF cho extension APIs (dùng token-based auth thay vì CSRF)
    csrf.exempt(api)
    
    # Tạo database tables và migration
    with app.app_context():
        from sqlalchemy import text, inspect
        
        # Kiểm tra và tạo tables (handle trường hợp đã tồn tại)
        try:
            inspector = inspect(db.engine)
            existing_tables = inspector.get_table_names()
            
            if 'users' not in existing_tables:
                # Chỉ tạo tables nếu chưa tồn tại
                db.create_all()
                print('[Database] Created all tables')
            else:
                print('[Database] Tables already exist, skipping create_all()')
        except Exception as e:
            print(f'[Database] Warning during table check: {e}')
            # Fallback: try create_all anyway with error handling
            try:
                db.create_all()
            except Exception as create_err:
                print(f'[Database] Tables may already exist: {create_err}')
        
        # Auto-migration: Add new columns if not exist (for existing databases)
        # And create default admin user
        try:
            inspector = inspect(db.engine)
            
            # Check if users table exists
            if 'users' in inspector.get_table_names():
                columns = [col['name'] for col in inspector.get_columns('users')]
                
                # Detect database type
                db_url = str(db.engine.url)
                is_postgres = 'postgresql' in db_url or 'postgres' in db_url
                
                # Add missing columns (chỉ cần cho SQLite cũ)
                if not is_postgres:
                    new_cols = {
                        'is_admin': 'BOOLEAN DEFAULT 0',
                        'plan_type': "VARCHAR(20) DEFAULT 'free'",
                        'plan_status': "VARCHAR(20) DEFAULT 'active'",
                        'trial_uses': 'INTEGER DEFAULT 3',
                        'max_trial_uses': 'INTEGER DEFAULT 3',
                        'subscription_start': 'DATETIME',
                        'subscription_end': 'DATETIME',
                        'is_banned': 'BOOLEAN DEFAULT 0',
                        'ban_reason': 'VARCHAR(500)',
                        'banned_at': 'DATETIME',
                        'reset_token': 'VARCHAR(100)',
                        'reset_token_expiry': 'DATETIME',
                    }
                    
                    for col_name, col_type in new_cols.items():
                        if col_name not in columns:
                            try:
                                db.session.execute(text(f'ALTER TABLE users ADD COLUMN {col_name} {col_type}'))
                                print(f'[Migration] Added column: {col_name}')
                            except Exception as col_err:
                                print(f'[Migration] Column {col_name} may already exist: {col_err}')
                    
                    db.session.commit()
                else:
                    # PostgreSQL migration for new columns
                    new_cols_pg = {
                        'reset_token': 'VARCHAR(100)',
                        'reset_token_expiry': 'TIMESTAMP',
                        'last_password_change': 'TIMESTAMP',
                        'last_email_change': 'TIMESTAMP',
                        'last_password_reset_request': 'TIMESTAMP',
                    }
                    
                    for col_name, col_type in new_cols_pg.items():
                        if col_name not in columns:
                            try:
                                db.session.execute(text(f'ALTER TABLE users ADD COLUMN {col_name} {col_type}'))
                                print(f'[Migration] Added column: {col_name}')
                            except Exception as col_err:
                                print(f'[Migration] Column {col_name} may already exist: {col_err}')
                    
                    db.session.commit()
            
            # ========================================
            # TẠO ADMIN USER MẶC ĐỊNH
            # ========================================
            admin_username = 'admin'
            admin_email = 'ntdungdev73@gmail.com'
            admin_password = 'K@HUrm12mh8KN*LXq#jhy$&qwdfn772134'
            
            admin_user = User.query.filter_by(username=admin_username).first()
            if not admin_user:
                # Tạo admin user mới
                admin_user = User(
                    username=admin_username,
                    email=admin_email,
                    is_admin=True,
                    plan_type='pro',
                    plan_status='active',
                    trial_uses=999,
                    max_trial_uses=999
                )
                admin_user.set_password(admin_password)
                db.session.add(admin_user)
                db.session.commit()
                print(f'[Setup] Created admin user: {admin_username}')
                print(f'[Setup] Admin password: {admin_password}')
                print(f'[Setup] ⚠️  CHANGE PASSWORD AFTER FIRST LOGIN!')
            else:
                # Đảm bảo user này là admin
                if not admin_user.is_admin:
                    admin_user.is_admin = True
                    admin_user.plan_type = 'pro'
                    db.session.commit()
                    print(f'[Setup] Updated {admin_username} to admin')
                
        except Exception as e:
            print(f'[Migration] Warning: {e}')
    
    # Context processors - Các biến có sẵn trong tất cả templates
    @app.context_processor
    def utility_processor():
        """
        Inject các utility functions vào template context
        """
        # Lấy ngôn ngữ từ session, mặc định là tiếng Việt
        lang = session.get('lang', 'vi')
        # Lấy theme từ session, mặc định là light
        theme = session.get('theme', 'light')
        
        def _(key, **kwargs):
            """Hàm dịch ngắn gọn để dùng trong template"""
            return get_translation(lang, key, **kwargs)
        
        return {
            'app_name': 'Web Scraper',
            'current_year': 2026,
            '_': _,
            'lang': lang,
            'theme': theme,
            't': get_all_translations(lang)
        }
    
    # Route để đổi ngôn ngữ
    @app.route('/change-language/<lang_code>')
    def change_language(lang_code):
        """Đổi ngôn ngữ hiển thị"""
        if lang_code in ['vi', 'en', 'zh', 'ja']:
            session['lang'] = lang_code
        # Redirect về trang trước đó
        return redirect(request.referrer or url_for('main.dashboard'))
    
    # Route để đổi theme
    @app.route('/change-theme/<theme_code>')
    def change_theme(theme_code):
        """Đổi theme hiển thị"""
        if theme_code in ['light', 'dark']:
            session['theme'] = theme_code
        # Redirect về trang trước đó
        return redirect(request.referrer or url_for('main.dashboard'))
    
    from flask import redirect
    
    # Error handlers
    @app.errorhandler(404)
    def not_found_error(error):
        """Xử lý lỗi 404"""
        return {'error': 'Không tìm thấy trang'}, 404
    
    @app.errorhandler(500)
    def internal_error(error):
        """Xử lý lỗi 500"""
        db.session.rollback()
        return {'error': 'Lỗi server nội bộ'}, 500
    
    return app
