# ===========================================
# models.py - Định nghĩa Database Models
# ===========================================
# File này chứa các model cho User và ScrapeHistory
# Sử dụng Flask-SQLAlchemy để tương tác với database

from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

# Khởi tạo SQLAlchemy instance
db = SQLAlchemy()


class User(UserMixin, db.Model):
    """
    Model User - Quản lý thông tin người dùng
    
    Attributes:
        id: ID duy nhất của user
        username: Tên đăng nhập (unique)
        email: Email (unique)
        password_hash: Mật khẩu đã được mã hóa PBKDF2
        created_at: Thời gian tạo tài khoản
        is_active: Trạng thái hoạt động của tài khoản
        cookie_file: Tên file cookie đã upload (nếu có)
        cookie_data: Nội dung cookie JSON (lưu trực tiếp)
    """
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    
    # ==========================================
    # Plan & Subscription Fields
    # ==========================================
    is_admin = db.Column(db.Boolean, default=False)  # Admin flag
    plan_type = db.Column(db.String(20), default='free')  # 'free' hoặc 'pro'
    plan_status = db.Column(db.String(20), default='active')  # 'active' hoặc 'expired'
    trial_uses = db.Column(db.Integer, default=3)  # Số lần dùng thử còn lại (Free plan)
    max_trial_uses = db.Column(db.Integer, default=3)  # Tổng số lần dùng thử
    subscription_start = db.Column(db.DateTime, nullable=True)  # Ngày bắt đầu Pro
    subscription_end = db.Column(db.DateTime, nullable=True)  # Ngày hết hạn Pro
    is_banned = db.Column(db.Boolean, default=False)  # Đã bị ban
    ban_reason = db.Column(db.String(500), nullable=True)  # Lý do ban
    banned_at = db.Column(db.DateTime, nullable=True)  # Thời gian ban
    
    # Password reset fields
    reset_token = db.Column(db.String(100), nullable=True, unique=True)
    reset_token_expiry = db.Column(db.DateTime, nullable=True)
    
    # Rate limiting for sensitive actions (7 days cooldown)
    last_password_change = db.Column(db.DateTime, nullable=True)  # Lần đổi mật khẩu cuối
    last_email_change = db.Column(db.DateTime, nullable=True)  # Lần đổi email cuối
    last_password_reset_request = db.Column(db.DateTime, nullable=True)  # Lần yêu cầu reset password cuối
    
    # Cookie settings cho TikTok
    tiktok_cookie_file = db.Column(db.String(255), nullable=True)
    tiktok_cookie_data = db.Column(db.Text, nullable=True)
    use_tiktok_cookie = db.Column(db.Boolean, default=False)
    
    # Cookie settings cho Facebook
    facebook_cookie_file = db.Column(db.String(255), nullable=True)
    facebook_cookie_data = db.Column(db.Text, nullable=True)
    use_facebook_cookie = db.Column(db.Boolean, default=False)
    
    # Proxy settings
    proxy_enabled = db.Column(db.Boolean, default=False)
    proxy_list = db.Column(db.Text, nullable=True)  # Danh sách proxy, mỗi dòng 1 proxy
    proxy_rotation = db.Column(db.String(20), default='random')  # random, sequential
    current_proxy_index = db.Column(db.Integer, default=0)  # Dùng cho sequential rotation

    # Scraper settings
    headless_mode = db.Column(db.Boolean, default=True)  # True = ẩn Chrome, False = hiện Chrome để debug/giải captcha
    
    # Quan hệ với ScrapeHistory (1 user có nhiều lịch sử scrape)
    scrape_histories = db.relationship('ScrapeHistory', backref='user', lazy='dynamic')
    
    def set_password(self, password):
        """
        Mã hóa mật khẩu bằng PBKDF2 với SHA256
        
        Args:
            password: Mật khẩu gốc từ người dùng
        """
        # Sử dụng pbkdf2:sha256 với 600000 iterations (chuẩn bảo mật cao)
        self.password_hash = generate_password_hash(
            password, 
            method='pbkdf2:sha256:600000'
        )
    
    def check_password(self, password):
        """
        Kiểm tra mật khẩu có khớp không
        
        Args:
            password: Mật khẩu cần kiểm tra
            
        Returns:
            bool: True nếu khớp, False nếu không
        """
        return check_password_hash(self.password_hash, password)
    
    def can_scrape(self):
        """
        Kiểm tra user có thể scrape không
        
        Returns:
            tuple: (can_scrape: bool, message: str)
        """
        if self.is_banned:
            return False, 'Tài khoản của bạn đã bị khóa'
        
        if self.plan_type == 'pro':
            if self.subscription_end and self.subscription_end < datetime.utcnow():
                self.plan_status = 'expired'
                db.session.commit()
                return False, 'Gói Pro của bạn đã hết hạn'
            return True, 'OK'
        
        # Free plan
        if self.trial_uses <= 0:
            self.plan_status = 'expired'
            db.session.commit()
            return False, 'Bạn đã hết lượt dùng thử. Vui lòng nâng cấp lên Pro!'
        
        return True, 'OK'
    
    def use_trial(self):
        """
        Sử dụng 1 lượt trial (cho Free plan)
        """
        if self.plan_type == 'free' and self.trial_uses > 0:
            self.trial_uses -= 1
            if self.trial_uses <= 0:
                self.plan_status = 'expired'
            db.session.commit()
    
    def get_download_limit(self):
        """
        Lấy giới hạn số comment được tải về
        
        Returns:
            int: Số comment tối đa được tải, None nếu không giới hạn
        """
        if self.plan_type == 'free':
            return 100  # Free plan chỉ tải được 100 comments
        return None  # Pro không giới hạn
    
    def __repr__(self):
        return f'<User {self.username}>'


class ScrapeHistory(db.Model):
    """
    Model ScrapeHistory - Lưu lịch sử các lần scrape
    
    Attributes:
        id: ID duy nhất
        user_id: ID của user thực hiện scrape
        platform: Nền tảng (tiktok/facebook)
        url: URL video/post được scrape
        total_comments: Tổng số comment đã lấy được
        status: Trạng thái (pending/success/failed)
        error_message: Thông báo lỗi nếu có
        created_at: Thời gian thực hiện
    """
    __tablename__ = 'scrape_histories'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    platform = db.Column(db.String(20), nullable=False)  # 'tiktok' hoặc 'facebook'
    url = db.Column(db.String(500), nullable=False)
    total_comments = db.Column(db.Integer, default=0)
    status = db.Column(db.String(20), default='pending')  # pending/success/failed
    error_message = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    # Quan hệ với Comment (1 history có nhiều comments)
    comments = db.relationship('Comment', backref='scrape_history', lazy='dynamic',
                               cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<ScrapeHistory {self.id} - {self.platform}>'


class Comment(db.Model):
    """
    Model Comment - Lưu thông tin từng comment đã scrape
    
    Attributes:
        id: ID duy nhất
        scrape_history_id: ID của lịch sử scrape
        username: Tên người bình luận
        content: Nội dung bình luận
        timestamp: Thời gian bình luận (từ nguồn)
        likes: Số lượt thích (nếu có)
    """
    __tablename__ = 'comments'
    
    id = db.Column(db.Integer, primary_key=True)
    scrape_history_id = db.Column(db.Integer, db.ForeignKey('scrape_histories.id'), 
                                   nullable=False, index=True)
    username = db.Column(db.String(100), nullable=False)
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.String(100), nullable=True)  # Thời gian từ nguồn (dạng text)
    likes = db.Column(db.Integer, default=0)
    scraped_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        """
        Chuyển đổi comment thành dictionary
        
        Returns:
            dict: Thông tin comment dạng dictionary
        """
        return {
            'id': self.id,
            'username': self.username,
            'content': self.content,
            'timestamp': self.timestamp,
            'likes': self.likes,
            'scraped_at': self.scraped_at.strftime('%Y-%m-%d %H:%M:%S')
        }
    
    def __repr__(self):
        return f'<Comment by {self.username}>'

class GlobalSettings(db.Model):
    """
    Model GlobalSettings - Lưu cài đặt toàn cục do Admin quản lý
    
    Bao gồm:
    - Proxy settings cho toàn bộ users
    - Các cài đặt hệ thống khác
    """
    __tablename__ = 'global_settings'
    
    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(100), unique=True, nullable=False, index=True)
    value = db.Column(db.Text, nullable=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    
    @staticmethod
    def get(key, default=None):
        """Lấy giá trị setting theo key"""
        setting = GlobalSettings.query.filter_by(key=key).first()
        return setting.value if setting else default
    
    @staticmethod
    def get_bool(key, default=False):
        """Lấy giá trị boolean"""
        value = GlobalSettings.get(key)
        if value is None:
            return default
        return value.lower() in ('true', '1', 'yes', 'on')
    
    @staticmethod
    def set(key, value, admin_id=None):
        """Cập nhật hoặc tạo mới setting"""
        setting = GlobalSettings.query.filter_by(key=key).first()
        if setting:
            setting.value = str(value) if value is not None else None
            setting.updated_by = admin_id
        else:
            setting = GlobalSettings(key=key, value=str(value) if value is not None else None, updated_by=admin_id)
            db.session.add(setting)
        db.session.commit()
        return setting
    
    def __repr__(self):
        return f'<GlobalSettings {self.key}>'