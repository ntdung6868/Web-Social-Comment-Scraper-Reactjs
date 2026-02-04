# ===========================================
# routes.py - Điều hướng các trang
# ===========================================
# File này chứa tất cả các routes của ứng dụng:
# - Authentication routes (login, register, logout)
# - Dashboard routes
# - Settings routes
# - Scraper API routes
# - Admin routes

import json
import logging
from functools import wraps
from flask import Blueprint, render_template, redirect, url_for, flash, request, jsonify, send_file, session, abort
from flask_login import login_user, logout_user, login_required, current_user
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)
from werkzeug.utils import secure_filename

from app.models import db, User, ScrapeHistory, Comment, GlobalSettings
from app.auth import LoginForm, RegisterForm, ScrapeForm
from app.scraper import get_scraper, detect_platform, ScraperException, BotDetectedException, URLNotFoundException, CaptchaDetectedException, get_cookie_grabber, TikTokAPIScraper
from app.utils import (
    export_to_excel, 
    validate_url, 
    generate_export_filename,
    format_relative_time,
    get_status_badge_class,
    get_platform_icon
)

# Tạo blueprint cho các routes
main = Blueprint('main', __name__)
auth = Blueprint('auth', __name__)
api = Blueprint('api', __name__, url_prefix='/api')
admin = Blueprint('admin', __name__, url_prefix='/admin')

# Global dict để lưu trữ scraping progress theo user_id
scraping_progress = {}


# Admin required decorator
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or not current_user.is_admin:
            flash('Bạn không có quyền truy cập trang này.', 'error')
            return redirect(url_for('main.dashboard'))
        return f(*args, **kwargs)
    return decorated_function


# ===========================================
# AUTHENTICATION ROUTES
# ===========================================

@auth.route('/login', methods=['GET', 'POST'])
def login():
    """
    Trang đăng nhập
    
    GET: Hiển thị form đăng nhập
    POST: Xử lý đăng nhập
    """
    # Nếu đã đăng nhập thì chuyển đến dashboard
    if current_user.is_authenticated:
        return redirect(url_for('main.dashboard'))
    
    # Xóa thông báo "Đăng nhập thành công!" cũ để tránh hiển thị 
    # sau khi đã đăng xuất, nhưng giữ lại các tin nhắn khác
    if request.method == 'GET' and '_flashes' in session:
        flashes = session.get('_flashes', [])
        # Giữ lại chỉ các message không phải là success messages
        filtered_flashes = [f for f in flashes if f[0] != 'success']
        if filtered_flashes:
            session['_flashes'] = filtered_flashes
        else:
            session.pop('_flashes', None)
    
    form = LoginForm()
    
    if form.validate_on_submit():
        # Tìm user theo username hoặc email
        login_input = form.username.data
        user = User.query.filter(
            (User.username == login_input) | (User.email == login_input)
        ).first()
        
        if user and user.check_password(form.password.data):
            # Kiểm tra user bị ban
            if user.is_banned:
                flash(f'Tài khoản đã bị khóa. Lý do: {user.ban_reason}', 'error')
                return render_template('login.html', form=form)
            
            # Đăng nhập thành công
            login_user(user, remember=form.remember_me.data)
            
            # Redirect đến trang được yêu cầu trước đó (nếu có)
            next_page = request.args.get('next')
            if next_page:
                return redirect(next_page)
            
            return redirect(url_for('main.dashboard'))
        else:
            # Đăng nhập thất bại
            flash('Tên đăng nhập hoặc mật khẩu không đúng', 'error')
    
    return render_template('login.html', form=form)


@auth.route('/register', methods=['GET', 'POST'])
def register():
    """
    Trang đăng ký tài khoản mới
    
    GET: Hiển thị form đăng ký
    POST: Xử lý đăng ký
    """
    # Nếu đã đăng nhập thì chuyển đến dashboard
    if current_user.is_authenticated:
        return redirect(url_for('main.dashboard'))
    
    form = RegisterForm()
    
    if form.validate_on_submit():
        # Kiểm tra username đã tồn tại chưa
        existing_user = User.query.filter_by(username=form.username.data).first()
        if existing_user:
            flash('Tên đăng nhập đã được sử dụng. Vui lòng chọn tên khác.', 'error')
            return render_template('register.html', form=form)
        
        # Kiểm tra email đã tồn tại chưa
        existing_email = User.query.filter_by(email=form.email.data).first()
        if existing_email:
            flash('Email đã được đăng ký. Vui lòng sử dụng email khác.', 'error')
            return render_template('register.html', form=form)
        
        # Tạo user mới
        user = User(
            username=form.username.data,
            email=form.email.data
        )
        user.set_password(form.password.data)
        
        # Lưu vào database
        db.session.add(user)
        db.session.commit()
        
        flash('Đăng ký thành công! Vui lòng đăng nhập.', 'success')
        return redirect(url_for('auth.login'))
    
    return render_template('register.html', form=form)


@auth.route('/change-password', methods=['GET', 'POST'])
@login_required
def change_password():
    """
    Xử lý đổi mật khẩu (chỉ POST, không có trang riêng)
    Rate limit: 7 ngày giữa các lần đổi
    """
    if request.method == 'POST':
        # Kiểm tra rate limit 7 ngày
        if current_user.last_password_change:
            days_since_last = (datetime.utcnow() - current_user.last_password_change).days
            if days_since_last < 7:
                days_remaining = 7 - days_since_last
                flash(f'Bạn chỉ có thể đổi mật khẩu mỗi 7 ngày. (Còn {days_remaining} ngày)', 'error')
                return redirect(url_for('main.profile'))
        
        current_password = request.form.get('current_password')
        new_password = request.form.get('new_password')
        confirm_password = request.form.get('confirm_password')
        
        # Kiểm tra mật khẩu hiện tại
        if not current_user.check_password(current_password):
            flash('Mật khẩu hiện tại không đúng.', 'error')
            return redirect(url_for('main.profile'))
        
        # Kiểm tra mật khẩu mới
        if len(new_password) < 8:
            flash('Mật khẩu mới phải có ít nhất 8 ký tự.', 'error')
            return redirect(url_for('main.profile'))
        
        if new_password != confirm_password:
            flash('Mật khẩu xác nhận không khớp.', 'error')
            return redirect(url_for('main.profile'))
        
        # Đổi mật khẩu
        current_user.set_password(new_password)
        current_user.last_password_change = datetime.utcnow()
        db.session.commit()
        
        flash('Đổi mật khẩu thành công!', 'success')
        return redirect(url_for('main.profile'))
    
    # GET request -> redirect to profile
    return redirect(url_for('main.profile'))


@auth.route('/forgot-password', methods=['GET', 'POST'])
def forgot_password():
    """
    Trang quên mật khẩu - nhập email để nhận link reset
    Rate limit: 7 ngày giữa các lần yêu cầu
    """
    if current_user.is_authenticated:
        return redirect(url_for('main.dashboard'))
    
    if request.method == 'POST':
        email = request.form.get('email', '').strip()
        
        if not email:
            flash('Vui lòng nhập email.', 'error')
            return render_template('forgot_password.html')
        
        user = User.query.filter_by(email=email).first()
        
        if user:
            import secrets
            from datetime import timedelta
            import os
            
            # Kiểm tra rate limit 7 ngày
            if user.last_password_reset_request:
                days_since_last = (datetime.utcnow() - user.last_password_reset_request).days
                if days_since_last < 7:
                    days_remaining = 7 - days_since_last
                    flash(f'Bạn chỉ có thể yêu cầu đặt lại mật khẩu mỗi 7 ngày. <a href="#" onclick="openAdminContactModal(); return false;" class="font-bold underline text-blue-400 hover:text-blue-300">👉 Liên hệ Admin</a> nếu cần hỗ trợ gấp. (Còn {days_remaining} ngày)', 'error')
                    return render_template('forgot_password.html')
            
            # Tạo token ngẫu nhiên
            token = secrets.token_urlsafe(32)
            user.reset_token = token
            user.reset_token_expiry = datetime.utcnow() + timedelta(hours=1)  # Hết hạn sau 1 giờ
            
            reset_url = url_for('auth.reset_password', token=token, _external=True)
            email_sent = False
            
            # Gửi email qua Resend API
            resend_api_key = os.getenv('RESEND_API_KEY')
            if resend_api_key:
                try:
                    import requests as http_requests
                    response = http_requests.post(
                        'https://api.resend.com/emails',
                        headers={
                            'Authorization': f'Bearer {resend_api_key}',
                            'Content-Type': 'application/json'
                        },
                        json={
                            'from': os.getenv('MAIL_FROM', 'Crawl Comments <onboarding@resend.dev>'),
                            'to': [user.email],
                            'subject': 'Đặt lại mật khẩu - Crawl Comments',
                            'html': f'''
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                                    <h1 style="color: white; margin: 0;">Crawl Comments</h1>
                                </div>
                                <div style="padding: 30px; background: #f9fafb;">
                                    <h2 style="color: #1f2937;">Xin chào {user.username},</h2>
                                    <p style="color: #4b5563; line-height: 1.6;">
                                        Bạn đã yêu cầu đặt lại mật khẩu. Nhấn vào nút bên dưới:
                                    </p>
                                    <div style="text-align: center; margin: 30px 0;">
                                        <a href="{reset_url}" 
                                           style="background: #667eea; color: white; padding: 15px 30px; 
                                                  text-decoration: none; border-radius: 8px; font-weight: bold;">
                                            Đặt lại mật khẩu
                                        </a>
                                    </div>
                                    <p style="color: #6b7280; font-size: 14px;">Link hết hạn sau 1 giờ.</p>
                                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                                    <p style="color: #9ca3af; font-size: 12px;">
                                        Hoặc copy link: {reset_url}
                                    </p>
                                </div>
                            </div>
                            '''
                        },
                        timeout=10
                    )
                    if response.status_code == 200:
                        email_sent = True
                        # Cập nhật thời gian yêu cầu reset
                        user.last_password_reset_request = datetime.utcnow()
                        db.session.commit()
                        flash('Đã gửi link đặt lại mật khẩu đến email của bạn! Vui lòng kiểm tra hộp thư (kể cả spam).', 'success')
                except Exception as e:
                    pass  # Silent fail
            
            if not email_sent:
                # Không gửi được email - báo lỗi và yêu cầu liên hệ admin
                flash('Không thể gửi email. <a href="#" onclick="openAdminContactModal(); return false;" class="font-bold underline text-blue-400 hover:text-blue-300">👉 Liên hệ Admin</a> để được hỗ trợ.', 'error')
        else:
            # Email không tồn tại - vẫn hiển thị thông báo giống như thành công để tránh leak
            flash('Nếu email tồn tại trong hệ thống, bạn sẽ nhận được link đặt lại mật khẩu.', 'success')
        
        return render_template('forgot_password.html')
    
    return render_template('forgot_password.html')


@auth.route('/reset-password/<token>', methods=['GET', 'POST'])
def reset_password(token):
    """
    Trang đặt lại mật khẩu từ link email
    """
    if current_user.is_authenticated:
        return redirect(url_for('main.dashboard'))
    
    # Tìm user với token này
    user = User.query.filter_by(reset_token=token).first()
    
    if not user:
        flash('Link đặt lại mật khẩu không hợp lệ.', 'error')
        return redirect(url_for('auth.forgot_password'))
    
    # Kiểm tra token còn hạn không
    if user.reset_token_expiry and user.reset_token_expiry < datetime.utcnow():
        user.reset_token = None
        user.reset_token_expiry = None
        db.session.commit()
        flash('Link đặt lại mật khẩu đã hết hạn. Vui lòng yêu cầu lại.', 'error')
        return redirect(url_for('auth.forgot_password'))
    
    if request.method == 'POST':
        password = request.form.get('password', '')
        confirm_password = request.form.get('confirm_password', '')
        
        if len(password) < 8:
            flash('Mật khẩu phải có ít nhất 8 ký tự.', 'error')
            return render_template('reset_password.html', token=token)
        
        if password != confirm_password:
            flash('Mật khẩu xác nhận không khớp.', 'error')
            return render_template('reset_password.html', token=token)
        
        # Đặt mật khẩu mới
        user.set_password(password)
        user.reset_token = None
        user.reset_token_expiry = None
        db.session.commit()
        
        flash('Đặt lại mật khẩu thành công! Vui lòng đăng nhập.', 'success')
        return redirect(url_for('auth.login'))
    
    return render_template('reset_password.html', token=token)


@auth.route('/logout')
@login_required
def logout():
    """
    Đăng xuất
    """
    logout_user()
    flash('Bạn đã đăng xuất.', 'info')
    return redirect(url_for('auth.login'), code=303)


# ===========================================
# MAIN ROUTES
# ===========================================

@main.route('/health')
def health():
    """
    Health check endpoint for Railway/Docker
    """
    return {'status': 'healthy'}, 200


@main.route('/')
def index():
    """
    Trang chủ - Redirect đến dashboard nếu đã đăng nhập
    """
    if current_user.is_authenticated:
        return redirect(url_for('main.dashboard'))
    return redirect(url_for('auth.login'))


@main.route('/dashboard')
@login_required
def dashboard():
    """
    Trang Dashboard chính
    
    Hiển thị:
    - Form scrape URL
    - Lịch sử scrape của user (có phân trang)
    - Thống kê cơ bản
    """
    form = ScrapeForm()
    
    # Tự động xóa lịch sử cũ hơn 2 ngày (theo user)
    cutoff = datetime.utcnow() - timedelta(days=2)
    old_histories = ScrapeHistory.query.filter_by(user_id=current_user.id)
    old_histories = old_histories.filter(ScrapeHistory.created_at < cutoff).all()
    for history in old_histories:
        db.session.delete(history)
    if old_histories:
        db.session.commit()

    # Lấy page số từ query parameter (mặc định page 1)
    page = request.args.get('page', 1, type=int)
    per_page = 3  # Số items trên mỗi trang
    
    # Lấy lịch sử scrape của user (mới nhất trước) với pagination
    pagination = ScrapeHistory.query.filter_by(user_id=current_user.id)\
        .order_by(ScrapeHistory.created_at.desc())\
        .paginate(page=page, per_page=per_page, error_out=False)
    
    histories = pagination.items
    total_pages = pagination.pages
    current_page = page
    
    # Thống kê
    total_scrapes = ScrapeHistory.query.filter_by(user_id=current_user.id).count()
    total_comments = db.session.query(db.func.sum(ScrapeHistory.total_comments))\
        .filter_by(user_id=current_user.id).scalar() or 0
    success_scrapes = ScrapeHistory.query.filter_by(user_id=current_user.id, status='success').count()
    
    stats = {
        'total_scrapes': total_scrapes,
        'total_comments': total_comments,
        'success_scrapes': success_scrapes
    }
    
    def build_page_numbers(current, total, window=2):
        if total <= 7:
            return list(range(1, total + 1))
        pages = [1]
        if current - window > 2:
            pages.append(None)
        start = max(2, current - window)
        end = min(total - 1, current + window)
        pages.extend(range(start, end + 1))
        if current + window < total - 1:
            pages.append(None)
        pages.append(total)
        return pages

    page_numbers = build_page_numbers(current_page, total_pages)

    return render_template('dashboard.html', 
                          form=form, 
                          histories=histories,
                          stats=stats,
                          total_pages=total_pages,
                          current_page=current_page,
                          page_numbers=page_numbers,
                          format_relative_time=format_relative_time,
                          get_status_badge_class=get_status_badge_class,
                          get_platform_icon=get_platform_icon)


@main.route('/history/<int:history_id>')
@login_required
def view_history(history_id):
    """
    Xem chi tiết một lần scrape
    
    Args:
        history_id: ID của ScrapeHistory
    """
    history = ScrapeHistory.query.filter_by(
        id=history_id, 
        user_id=current_user.id
    ).first_or_404()
    
    comments = history.comments.all()
    
    return render_template('history_detail.html',
                          history=history,
                          comments=comments,
                          format_relative_time=format_relative_time,
                          get_platform_icon=get_platform_icon)


# ===========================================
# SETTINGS ROUTES
# ===========================================

@main.route('/settings', methods=['GET', 'POST'])
@login_required
def settings():
    """
    Trang cài đặt - Cấu hình cookie cho từng nền tảng
    """
    # Xóa thông báo "Đăng nhập thành công!" khi vào settings
    if request.method == 'GET':
        session.pop('_flashes', None)
    
    if request.method == 'POST':
        action = request.form.get('action')
        platform = request.form.get('platform', 'tiktok')
        
        if action == 'upload_cookie':
            # Upload file cookie cho platform cụ thể
            if 'cookie_file' not in request.files:
                flash('Không tìm thấy file', 'error')
                return redirect(url_for('main.settings'))
            
            file = request.files['cookie_file']
            
            if file.filename == '':
                flash('Chưa chọn file', 'error')
                return redirect(url_for('main.settings'))
            
            if file and file.filename.endswith('.json'):
                try:
                    content = file.read().decode('utf-8')
                    cookie_data = json.loads(content)
                    
                    # Kiểm tra format cookie
                    if isinstance(cookie_data, dict) and 'cookies' in cookie_data:
                        cookies = cookie_data['cookies']
                    elif isinstance(cookie_data, list):
                        cookies = cookie_data
                    else:
                        flash('Format cookie không hợp lệ', 'error')
                        return redirect(url_for('main.settings'))
                    
                    # Lưu vào database theo platform
                    if platform == 'tiktok':
                        current_user.tiktok_cookie_file = secure_filename(file.filename)
                        current_user.tiktok_cookie_data = content
                        current_user.use_tiktok_cookie = True
                    else:
                        current_user.facebook_cookie_file = secure_filename(file.filename)
                        current_user.facebook_cookie_data = content
                        current_user.use_facebook_cookie = True
                    
                    db.session.commit()
                    
                    platform_name = 'TikTok' if platform == 'tiktok' else 'Facebook'
                    flash(f'Đã upload cookie {platform_name} thành công! ({len(cookies)} cookies)', 'success')
                    
                except json.JSONDecodeError:
                    flash('File không phải JSON hợp lệ', 'error')
                except Exception as e:
                    flash(f'Lỗi: {str(e)}', 'error')
            else:
                flash('Chỉ chấp nhận file .json', 'error')
        
        elif action == 'toggle_cookie':
            # Bật/tắt cookie theo platform
            if platform == 'tiktok':
                current_user.use_tiktok_cookie = not current_user.use_tiktok_cookie
                status = 'bật' if current_user.use_tiktok_cookie else 'tắt'
                flash(f'Đã {status} cookie TikTok', 'success')
            else:
                current_user.use_facebook_cookie = not current_user.use_facebook_cookie
                status = 'bật' if current_user.use_facebook_cookie else 'tắt'
                flash(f'Đã {status} cookie Facebook', 'success')
            db.session.commit()
        
        elif action == 'delete_cookie':
            # Xóa cookie theo platform
            if platform == 'tiktok':
                current_user.tiktok_cookie_file = None
                current_user.tiktok_cookie_data = None
                current_user.use_tiktok_cookie = False
                flash('Đã xóa cookie TikTok', 'success')
            else:
                current_user.facebook_cookie_file = None
                current_user.facebook_cookie_data = None
                current_user.use_facebook_cookie = False
                flash('Đã xóa cookie Facebook', 'success')
            db.session.commit()
        
        elif action == 'save_proxy':
            # Lưu danh sách proxy
            proxy_list = request.form.get('proxy_list', '').strip()
            proxy_rotation = request.form.get('proxy_rotation', 'random')
            
            # Validate và clean proxy list
            if proxy_list:
                lines = proxy_list.split('\n')
                valid_proxies = []
                for line in lines:
                    line = line.strip()
                    if line and (line.startswith('http://') or line.startswith('https://') or line.startswith('socks')):
                        valid_proxies.append(line)
                    elif line and ':' in line:
                        # Format: ip:port hoặc ip:port:user:pass
                        valid_proxies.append(line)
                
                if valid_proxies:
                    current_user.proxy_list = '\n'.join(valid_proxies)
                    current_user.proxy_rotation = proxy_rotation
                    current_user.proxy_enabled = True
                    current_user.current_proxy_index = 0
                    db.session.commit()
                    flash(f'Đã lưu {len(valid_proxies)} proxy thành công!', 'success')
                else:
                    flash('Không tìm thấy proxy hợp lệ', 'error')
            else:
                flash('Vui lòng nhập danh sách proxy', 'error')
        
        elif action == 'toggle_proxy':
            # Bật/tắt proxy
            current_user.proxy_enabled = not current_user.proxy_enabled
            status = 'bật' if current_user.proxy_enabled else 'tắt'
            flash(f'Đã {status} proxy', 'success')
            db.session.commit()
        
        elif action == 'delete_proxy':
            # Xóa tất cả proxy
            current_user.proxy_list = None
            current_user.proxy_enabled = False
            current_user.current_proxy_index = 0
            db.session.commit()
            flash('Đã xóa tất cả proxy', 'success')
        
        elif action == 'update_proxy_rotation':
            # Cập nhật kiểu rotation
            proxy_rotation = request.form.get('proxy_rotation', 'random')
            current_user.proxy_rotation = proxy_rotation
            db.session.commit()
            flash(f'Đã đổi chế độ xoay proxy: {proxy_rotation}', 'success')
        
        elif action == 'save_scraper_settings':
            # Lưu cài đặt scraper
            # Check value thay vì chỉ check key exists
            headless_value = request.form.get('headless_mode', '')
            headless_mode = headless_value == 'on' or headless_value == 'true' or headless_value == '1'
            current_user.headless_mode = headless_mode
            db.session.commit()
            status = 'BẬT (Chrome ẩn)' if headless_mode else 'TẮT (Chrome hiện)'
            flash(f'Đã cập nhật chế độ Headless: {status}', 'success')
        
        return redirect(url_for('main.settings'))
    
    # GET request - lấy thông tin cookie của cả 2 platform
    def get_cookie_info(cookie_data, cookie_file, use_cookie):
        if not cookie_data:
            return None
        try:
            data = json.loads(cookie_data)
            if isinstance(data, dict) and 'cookies' in data:
                cookie_count = len(data['cookies'])
            elif isinstance(data, list):
                cookie_count = len(data)
            else:
                cookie_count = 0
            
            return {
                'filename': cookie_file,
                'count': cookie_count,
                'active': use_cookie
            }
        except:
            return None
    
    tiktok_cookie_info = get_cookie_info(
        current_user.tiktok_cookie_data,
        current_user.tiktok_cookie_file,
        current_user.use_tiktok_cookie
    )
    
    facebook_cookie_info = get_cookie_info(
        current_user.facebook_cookie_data,
        current_user.facebook_cookie_file,
        current_user.use_facebook_cookie
    )
    
    # Lấy thông tin scraper settings
    scraper_settings = {
        'headless_mode': getattr(current_user, 'headless_mode', True)
    }
    # Xử lý trường hợp headless_mode là None (user cũ chưa có field này)
    if scraper_settings['headless_mode'] is None:
        scraper_settings['headless_mode'] = True
    
    return render_template('settings.html', 
                          tiktok_cookie_info=tiktok_cookie_info,
                          facebook_cookie_info=facebook_cookie_info,
                          scraper_settings=scraper_settings)


# ===========================================
# API ROUTES
# ===========================================

def update_scraping_progress(user_id, total, message):
    """Helper function để cập nhật progress từ scraper"""
    scraping_progress[user_id] = {
        'total': total,
        'status': 'running',
        'message': message
    }


@api.route('/cookie-status', methods=['GET'])
@login_required
def get_cookie_status():
    """
    API endpoint để check trạng thái cookie của user
    Dùng để hiển thị trong Settings page
    """
    tiktok_info = None
    facebook_info = None
    
    if current_user.tiktok_cookie_data:
        try:
            cookie_data = json.loads(current_user.tiktok_cookie_data)
            cookie_list = cookie_data.get('cookies', cookie_data) if isinstance(cookie_data, dict) else cookie_data
            count = len(cookie_list) if isinstance(cookie_list, list) else 0
            from_extension = current_user.tiktok_cookie_file == 'extension'
            tiktok_info = {
                'has_cookie': True,
                'count': count,
                'active': current_user.use_tiktok_cookie,
                'from_extension': from_extension
            }
        except:
            pass
    
    if current_user.facebook_cookie_data:
        try:
            cookie_data = json.loads(current_user.facebook_cookie_data)
            cookie_list = cookie_data.get('cookies', cookie_data) if isinstance(cookie_data, dict) else cookie_data
            count = len(cookie_list) if isinstance(cookie_list, list) else 0
            from_extension = current_user.facebook_cookie_file == 'extension'
            facebook_info = {
                'has_cookie': True,
                'count': count,
                'active': current_user.use_facebook_cookie,
                'from_extension': from_extension
            }
        except:
            pass
    
    return jsonify({
        'tiktok': tiktok_info,
        'facebook': facebook_info
    })


@api.route('/scrape/progress', methods=['GET'])
@login_required
def get_scrape_progress():
    """
    API endpoint để lấy progress scraping hiện tại
    
    Returns:
        JSON với số comment đã cào được
    """
    user_id = current_user.id
    progress = scraping_progress.get(user_id, {
        'total': 0,
        'status': 'idle',
        'message': ''
    })
    return jsonify(progress)

@api.route('/scrape', methods=['POST'])
@login_required
def scrape():
    """
    API endpoint để scrape comment
    
    Request Body:
        url: URL video cần scrape
        
    Returns:
        JSON response với kết quả scrape
    """
    try:
        # Kiểm tra user có quyền scrape không (ban, expired, etc.)
        can_scrape, message = current_user.can_scrape()
        if not can_scrape:
            return jsonify({
                'success': False,
                'error': message
            }), 403
        
        # Lấy URL từ request
        data = request.get_json()
        url = data.get('url', '').strip()
        
        # Validate URL
        is_valid, platform, error = validate_url(url)
        if not is_valid:
            return jsonify({
                'success': False,
                'error': error
            }), 400
        
        # Tạo bản ghi lịch sử (status: pending)
        history = ScrapeHistory(
            user_id=current_user.id,
            platform=platform,
            url=url,
            status='pending'
        )
        db.session.add(history)
        db.session.commit()
        
        try:
            # Lấy proxy từ Global Settings (do admin cấu hình)
            proxy = None
            global_proxy_enabled = GlobalSettings.get_bool('proxy_enabled', False)
            global_proxy_list = GlobalSettings.get('proxy_list', '')
            
            if global_proxy_enabled and global_proxy_list:
                proxy_lines = [p.strip() for p in global_proxy_list.split('\n') if p.strip()]
                if proxy_lines:
                    proxy_rotation = GlobalSettings.get('proxy_rotation', 'random')
                    if proxy_rotation == 'sequential':
                        # Tuần tự
                        current_index = int(GlobalSettings.get('current_proxy_index', '0') or '0')
                        proxy = proxy_lines[current_index % len(proxy_lines)]
                        # Cập nhật index cho lần sau
                        GlobalSettings.set('current_proxy_index', str((current_index + 1) % len(proxy_lines)))
                    else:
                        # Random
                        import random
                        proxy = random.choice(proxy_lines)
            
            # Khởi tạo progress tracking cho user này
            user_id = current_user.id
            scraping_progress[user_id] = {
                'total': 0,
                'status': 'running',
                'message': 'Đang khởi tạo...'
            }
            
            # Lấy cookie theo platform tương ứng
            cookie_data = None
            if platform == 'tiktok' and current_user.use_tiktok_cookie and current_user.tiktok_cookie_data:
                try:
                    cookie_data = json.loads(current_user.tiktok_cookie_data)
                except:
                    pass
            elif platform == 'facebook' and current_user.use_facebook_cookie and current_user.facebook_cookie_data:
                try:
                    cookie_data = json.loads(current_user.facebook_cookie_data)
                except:
                    pass
            
            # ========================================
            # SELENIUM MODE - Dùng cho tất cả platforms
            # ========================================
            logger.info("🔧 Sử dụng Selenium Mode")
            headless = getattr(current_user, 'headless_mode', True)
            if headless is None:
                headless = True
            scraper = get_scraper(url, headless=headless, proxy=proxy)
            
            # Gán callback để cập nhật progress
            scraper.progress_callback = lambda total, msg: update_scraping_progress(user_id, total, msg)
            
            # Thực hiện scrape
            comments_data = scraper.scrape(url, cookie_data=cookie_data)
            
            # Lưu comments vào database
            for comment_data in comments_data:
                content = comment_data.get('content', '')
                comment = Comment(
                    scrape_history_id=history.id,
                    username=comment_data.get('username', 'Unknown'),
                    content=content,
                    timestamp=comment_data.get('timestamp', 'N/A'),
                    likes=comment_data.get('likes', 0)
                )
                db.session.add(comment)
            
            # Cập nhật history status
            history.status = 'success'
            history.total_comments = len(comments_data)
            
            # Trừ lượt trial cho Free users (chỉ khi scrape thành công)
            if current_user.plan_type == 'free':
                current_user.use_trial()
            
            db.session.commit()
            
            # Cập nhật progress hoàn thành
            scraping_progress[user_id] = {
                'total': len(comments_data),
                'status': 'done',
                'message': 'Hoàn thành!'
            }
            
            return jsonify({
                'success': True,
                'message': f'Đã scrape được {len(comments_data)} comment',
                'data': {
                    'history_id': history.id,
                    'total_comments': len(comments_data),
                    'platform': platform,
                    'comments': comments_data[:10]  # Trả về 10 comment đầu tiên
                }
            })
            
        except BotDetectedException as e:
            history.status = 'failed'
            history.error_message = f"Bị phát hiện là bot: {str(e)}"
            db.session.commit()
            
            return jsonify({
                'success': False,
                'error': 'Bị phát hiện là bot. Vui lòng thử lại sau.'
            }), 429
        
        except CaptchaDetectedException as e:
            history.status = 'failed'
            history.error_message = f"Gặp Captcha: {str(e)}"
            db.session.commit()
            
            return jsonify({
                'success': False,
                'error': 'Gặp Captcha! Hãy thử upload cookie đã đăng nhập TikTok trong Settings.'
            }), 429
            
        except URLNotFoundException as e:
            history.status = 'failed'
            history.error_message = f"URL không tồn tại: {str(e)}"
            db.session.commit()
            
            return jsonify({
                'success': False,
                'error': 'URL không tồn tại hoặc đã bị xóa.'
            }), 404
            
        except ScraperException as e:
            history.status = 'failed'
            history.error_message = str(e)
            db.session.commit()
            
            return jsonify({
                'success': False,
                'error': f'Lỗi khi scrape: {str(e)}'
            }), 500
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Lỗi server: {str(e)}'
        }), 500


@api.route('/export/<int:history_id>')
@login_required
def export_excel(history_id):
    """
    API endpoint để xuất comment ra file Excel
    
    Args:
        history_id: ID của ScrapeHistory
        
    Returns:
        File Excel để download
    """
    # Kiểm tra quyền truy cập
    history = ScrapeHistory.query.filter_by(
        id=history_id,
        user_id=current_user.id
    ).first_or_404()
    
    # Lấy comments
    comments = history.comments.all()
    
    if not comments:
        return jsonify({
            'success': False,
            'error': 'Không có comment để xuất'
        }), 404
    
    # Chuyển đổi comments thành list dict
    comments_data = [comment.to_dict() for comment in comments]
    
    # Giới hạn 100 comments cho Free users
    download_limit = current_user.get_download_limit()
    if download_limit and len(comments_data) > download_limit:
        comments_data = comments_data[:download_limit]
    
    # Tạo file Excel
    scrape_info = {
        'platform': history.platform,
        'url': history.url,
        'scraped_at': history.created_at
    }
    
    excel_buffer = export_to_excel(comments_data, scrape_info)
    
    # Tạo tên file
    filename = generate_export_filename(history.platform)
    
    return send_file(
        excel_buffer,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name=filename
    )


@api.route('/history/<int:history_id>', methods=['DELETE'])
@login_required
def delete_history(history_id):
    """
    API endpoint để xóa lịch sử scrape
    
    Args:
        history_id: ID của ScrapeHistory
    """
    history = ScrapeHistory.query.filter_by(
        id=history_id,
        user_id=current_user.id
    ).first_or_404()
    
    db.session.delete(history)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Đã xóa lịch sử scrape'
    })


@api.route('/history/<int:history_id>/comments')
@login_required
def get_comments(history_id):
    """
    API endpoint để lấy danh sách comment của một lần scrape
    
    Args:
        history_id: ID của ScrapeHistory
    """
    history = ScrapeHistory.query.filter_by(
        id=history_id,
        user_id=current_user.id
    ).first_or_404()
    
    comments = history.comments.all()
    comments_data = [comment.to_dict() for comment in comments]
    
    return jsonify({
        'success': True,
        'data': {
            'history_id': history_id,
            'platform': history.platform,
            'url': history.url,
            'total': len(comments_data),
            'comments': comments_data
        }
    })


@api.route('/stats')
@login_required
def get_stats():
    """
    API endpoint để lấy thống kê của user
    """
    total_scrapes = ScrapeHistory.query.filter_by(user_id=current_user.id).count()
    total_comments = db.session.query(db.func.sum(ScrapeHistory.total_comments))\
        .filter_by(user_id=current_user.id).scalar() or 0
    success_scrapes = ScrapeHistory.query.filter_by(user_id=current_user.id, status='success').count()
    failed_scrapes = ScrapeHistory.query.filter_by(user_id=current_user.id, status='failed').count()
    
    # Thống kê theo platform
    tiktok_scrapes = ScrapeHistory.query.filter_by(user_id=current_user.id, platform='tiktok').count()
    facebook_scrapes = ScrapeHistory.query.filter_by(user_id=current_user.id, platform='facebook').count()
    
    return jsonify({
        'success': True,
        'data': {
            'total_scrapes': total_scrapes,
            'total_comments': total_comments,
            'success_scrapes': success_scrapes,
            'failed_scrapes': failed_scrapes,
            'tiktok_scrapes': tiktok_scrapes,
            'facebook_scrapes': facebook_scrapes
        }
    })


# ===========================================
# PROFILE ROUTES
# ===========================================

@main.route('/profile')
@login_required
def profile():
    """
    Trang Profile người dùng
    """
    return render_template('profile.html')


@main.route('/profile/update', methods=['POST'])
@login_required
def update_profile():
    """
    Cập nhật thông tin profile
    """
    username = request.form.get('username', '').strip()
    
    if not username:
        flash('Username không được để trống!', 'error')
        return redirect(url_for('main.profile'))
    
    # Kiểm tra username đã tồn tại chưa (trừ user hiện tại)
    existing_user = User.query.filter(User.username == username, User.id != current_user.id).first()
    if existing_user:
        flash('Username đã được sử dụng!', 'error')
        return redirect(url_for('main.profile'))
    
    current_user.username = username
    db.session.commit()
    flash('Cập nhật profile thành công!', 'success')
    return redirect(url_for('main.profile'))


@main.route('/profile/change-email', methods=['POST'])
@login_required
def change_email():
    """
    Đổi email - Rate limit: 7 ngày giữa các lần đổi
    """
    # Kiểm tra rate limit 7 ngày
    if current_user.last_email_change:
        days_since_last = (datetime.utcnow() - current_user.last_email_change).days
        if days_since_last < 7:
            days_remaining = 7 - days_since_last
            flash(f'Bạn chỉ có thể đổi email mỗi 7 ngày. (Còn {days_remaining} ngày)', 'error')
            return redirect(url_for('main.profile'))
    
    new_email = request.form.get('new_email', '').strip()
    confirm_email = request.form.get('confirm_email', '').strip()
    
    if not new_email or not confirm_email:
        flash('Vui lòng điền đầy đủ thông tin!', 'error')
        return redirect(url_for('main.profile'))
    
    if new_email != confirm_email:
        flash('Email xác nhận không khớp!', 'error')
        return redirect(url_for('main.profile'))
    
    # Kiểm tra email đã tồn tại chưa
    existing_email = User.query.filter(User.email == new_email, User.id != current_user.id).first()
    if existing_email:
        flash('Email đã được sử dụng!', 'error')
        return redirect(url_for('main.profile'))
    
    current_user.email = new_email
    current_user.last_email_change = datetime.utcnow()
    db.session.commit()
    flash('Đổi email thành công!', 'success')
    return redirect(url_for('main.profile'))


@main.route('/profile/change-password', methods=['POST'])
@login_required
def change_password_profile():
    """
    Đổi mật khẩu từ trang profile - Rate limit: 7 ngày giữa các lần đổi
    """
    # Kiểm tra rate limit 7 ngày
    if current_user.last_password_change:
        days_since_last = (datetime.utcnow() - current_user.last_password_change).days
        if days_since_last < 7:
            days_remaining = 7 - days_since_last
            flash(f'Bạn chỉ có thể đổi mật khẩu mỗi 7 ngày. (Còn {days_remaining} ngày)', 'error')
            return redirect(url_for('main.profile'))
    
    current_password = request.form.get('current_password', '')
    new_password = request.form.get('new_password', '')
    confirm_password = request.form.get('confirm_password', '')
    
    if not current_password or not new_password or not confirm_password:
        flash('Vui lòng điền đầy đủ thông tin!', 'error')
        return redirect(url_for('main.profile'))
    
    if not current_user.check_password(current_password):
        flash('Mật khẩu hiện tại không đúng!', 'error')
        return redirect(url_for('main.profile'))
    
    if new_password != confirm_password:
        flash('Mật khẩu xác nhận không khớp!', 'error')
        return redirect(url_for('main.profile'))
    
    if len(new_password) < 6:
        flash('Mật khẩu mới phải có ít nhất 6 ký tự!', 'error')
        return redirect(url_for('main.profile'))
    
    current_user.set_password(new_password)
    current_user.last_password_change = datetime.utcnow()
    db.session.commit()
    flash('Đổi mật khẩu thành công!', 'success')
    return redirect(url_for('main.profile'))


@main.route('/profile/delete-account', methods=['POST'])
@login_required
def delete_account():
    """
    Xóa tài khoản
    """
    password = request.form.get('password', '')
    
    if not current_user.check_password(password):
        flash('Mật khẩu không đúng!', 'error')
        return redirect(url_for('main.profile'))
    
    # Xóa các dữ liệu liên quan
    ScrapeHistory.query.filter_by(user_id=current_user.id).delete()
    
    # Xóa user
    db.session.delete(current_user)
    db.session.commit()
    
    logout_user()
    flash('Tài khoản đã được xóa thành công!', 'success')
    return redirect(url_for('auth.login'))


# ===========================================
# PRICING ROUTES
# ===========================================

@main.route('/pricing')
def pricing():
    """
    Trang bảng giá
    """
    return render_template('pricing.html')


@main.route('/contact-upgrade')
@login_required
def contact_upgrade():
    """
    Trang liên hệ nâng cấp Pro
    """
    flash('Vui lòng liên hệ Admin để nâng cấp lên Pro!', 'info')
    return redirect(url_for('main.pricing'))


# ===========================================
# ADMIN ROUTES
# ===========================================

@admin.route('/')
@login_required
@admin_required
def dashboard():
    """
    Admin Dashboard - Quản lý users
    """
    page = request.args.get('page', 1, type=int)
    search = request.args.get('search', '').strip()
    per_page = 20
    
    # Query với search
    query = User.query
    if search:
        query = query.filter(
            (User.username.ilike(f'%{search}%')) | 
            (User.email.ilike(f'%{search}%'))
        )
    
    # Lấy danh sách users với pagination
    pagination = query.order_by(User.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    users = pagination.items
    total_pages = pagination.pages
    
    # Thống kê
    stats = {
        'total_users': User.query.count(),
        'pro_users': User.query.filter_by(plan_type='pro').count(),
        'free_users': User.query.filter_by(plan_type='free').count(),
        'banned_users': User.query.filter_by(is_banned=True).count(),
    }
    
    # Lấy global proxy settings
    proxy_list = GlobalSettings.get('proxy_list', '')
    proxy_settings = {
        'enabled': GlobalSettings.get_bool('proxy_enabled', False),
        'list': proxy_list,
        'rotation': GlobalSettings.get('proxy_rotation', 'random'),
        'count': len([p for p in proxy_list.split('\n') if p.strip()]) if proxy_list else 0
    }
    
    return render_template('admin/dashboard.html', 
                          users=users, 
                          stats=stats,
                          current_page=page,
                          total_pages=total_pages,
                          search=search,
                          proxy_settings=proxy_settings)


@admin.route('/ban/<int:user_id>', methods=['POST'])
@login_required
@admin_required
def ban_user(user_id):
    """
    Ban user
    """
    user = User.query.get_or_404(user_id)
    
    if user.is_admin:
        flash('Không thể ban admin!', 'error')
        return redirect(url_for('admin.dashboard'))
    
    reason = request.form.get('reason', 'Vi phạm điều khoản sử dụng')
    user.is_banned = True
    user.ban_reason = reason
    user.banned_at = datetime.utcnow()
    db.session.commit()
    
    flash(f'Đã ban user {user.username}', 'success')
    return redirect(url_for('admin.dashboard'))


@admin.route('/unban/<int:user_id>', methods=['POST'])
@login_required
@admin_required
def unban_user(user_id):
    """
    Unban user
    """
    user = User.query.get_or_404(user_id)
    
    user.is_banned = False
    user.ban_reason = None
    user.banned_at = None
    db.session.commit()
    
    flash(f'Đã unban user {user.username}', 'success')
    return redirect(url_for('admin.dashboard'))


@admin.route('/upgrade/<int:user_id>', methods=['POST'])
@login_required
@admin_required
def upgrade_user(user_id):
    """
    Nâng cấp user lên Pro
    """
    user = User.query.get_or_404(user_id)
    
    user.plan_type = 'pro'
    user.plan_status = 'active'
    user.subscription_start = datetime.utcnow()
    user.subscription_end = datetime.utcnow() + timedelta(days=30)  # 30 ngày
    db.session.commit()
    
    flash(f'Đã nâng cấp {user.username} lên Pro (30 ngày)', 'success')
    return redirect(url_for('admin.dashboard'))


@admin.route('/downgrade/<int:user_id>', methods=['POST'])
@login_required
@admin_required
def downgrade_user(user_id):
    """
    Hạ cấp user về Free
    """
    user = User.query.get_or_404(user_id)
    
    user.plan_type = 'free'
    user.plan_status = 'active'
    user.trial_uses = user.max_trial_uses  # Reset trial
    user.subscription_start = None
    user.subscription_end = None
    db.session.commit()
    
    flash(f'Đã hạ cấp {user.username} về Free', 'success')
    return redirect(url_for('admin.dashboard'))


@admin.route('/reset-trial/<int:user_id>', methods=['POST'])
@login_required
@admin_required
def reset_trial(user_id):
    """
    Reset trial cho user
    """
    user = User.query.get_or_404(user_id)
    
    user.trial_uses = user.max_trial_uses
    user.plan_status = 'active'
    db.session.commit()
    
    flash(f'Đã reset trial cho {user.username}', 'success')
    return redirect(url_for('admin.dashboard'))


@admin.route('/save-proxy-settings', methods=['POST'])
@login_required
@admin_required
def save_proxy_settings():
    """
    Lưu cài đặt proxy toàn cục
    """
    proxy_enabled = request.form.get('proxy_enabled') == '1'
    proxy_list = request.form.get('proxy_list', '').strip()
    proxy_rotation = request.form.get('proxy_rotation', 'random')
    
    # Validate proxy_rotation
    if proxy_rotation not in ('random', 'sequential'):
        proxy_rotation = 'random'
    
    # Lưu vào GlobalSettings
    GlobalSettings.set('proxy_enabled', str(proxy_enabled).lower(), current_user.id)
    GlobalSettings.set('proxy_list', proxy_list, current_user.id)
    GlobalSettings.set('proxy_rotation', proxy_rotation, current_user.id)
    GlobalSettings.set('current_proxy_index', '0', current_user.id)  # Reset index
    
    # Đếm số proxy
    proxy_count = len([p for p in proxy_list.split('\n') if p.strip()]) if proxy_list else 0
    
    flash(f'Đã lưu cài đặt Proxy! ({proxy_count} proxy)', 'success')
    return redirect(url_for('admin.dashboard'))


@admin.route('/user/<int:user_id>')
@login_required
@admin_required
def view_user(user_id):
    """
    Xem chi tiết user
    """
    user = User.query.get_or_404(user_id)
    return render_template('admin/user_detail.html', user=user, now=datetime.utcnow())


@admin.route('/user/<int:user_id>/edit', methods=['POST'])
@login_required
@admin_required
def edit_user(user_id):
    """
    Sửa thông tin user
    """
    user = User.query.get_or_404(user_id)
    
    # Không cho sửa admin khác
    if user.is_admin and user.id != current_user.id:
        flash('Không thể sửa admin khác!', 'error')
        return redirect(url_for('admin.view_user', user_id=user_id))
    
    # Cập nhật username
    new_username = request.form.get('username', '').strip()
    if new_username and new_username != user.username:
        existing = User.query.filter(User.username == new_username, User.id != user.id).first()
        if existing:
            flash('Username đã tồn tại!', 'error')
            return redirect(url_for('admin.view_user', user_id=user_id))
        user.username = new_username
    
    # Cập nhật email
    new_email = request.form.get('email', '').strip()
    if new_email and new_email != user.email:
        existing = User.query.filter(User.email == new_email, User.id != user.id).first()
        if existing:
            flash('Email đã tồn tại!', 'error')
            return redirect(url_for('admin.view_user', user_id=user_id))
        user.email = new_email
    
    # Cập nhật password (nếu có nhập)
    new_password = request.form.get('password', '').strip()
    if new_password:
        if len(new_password) < 6:
            flash('Password phải có ít nhất 6 ký tự!', 'error')
            return redirect(url_for('admin.view_user', user_id=user_id))
        user.set_password(new_password)
    
    # Cập nhật trial uses
    trial_uses = request.form.get('trial_uses', type=int)
    if trial_uses is not None:
        user.trial_uses = trial_uses
    
    # Cập nhật plan type và ngày hết hạn
    plan_type = request.form.get('plan_type', 'free')
    user.plan_type = plan_type
    
    if plan_type == 'pro':
        subscription_end = request.form.get('subscription_end', '')
        if subscription_end:
            try:
                user.subscription_end = datetime.strptime(subscription_end, '%Y-%m-%d')
                if not user.subscription_start:
                    user.subscription_start = datetime.utcnow()
                user.plan_status = 'active'
            except ValueError:
                flash('Ngày hết hạn không hợp lệ!', 'error')
                return redirect(url_for('admin.view_user', user_id=user_id))
    else:
        user.subscription_start = None
        user.subscription_end = None
        user.plan_status = 'active'
    
    db.session.commit()
    flash(f'Đã cập nhật thông tin {user.username}!', 'success')
    return redirect(url_for('admin.view_user', user_id=user_id))


@admin.route('/user/<int:user_id>/delete', methods=['POST'])
@login_required
@admin_required
def delete_user(user_id):
    """
    Xóa user
    """
    try:
        user = User.query.get_or_404(user_id)
        
        if user.is_admin:
            flash('Không thể xóa admin!', 'error')
            return redirect(url_for('admin.dashboard'))
        
        username = user.username
        
        # Xóa comments trước (vì có FK đến scrape_histories)
        scrape_histories = ScrapeHistory.query.filter_by(user_id=user.id).all()
        for history in scrape_histories:
            Comment.query.filter_by(scrape_history_id=history.id).delete()
        
        # Xóa scrape histories
        ScrapeHistory.query.filter_by(user_id=user.id).delete()
        
        # Xóa user
        db.session.delete(user)
        db.session.commit()
        
        flash(f'Đã xóa user {username}!', 'success')
        return redirect(url_for('admin.dashboard'))
    except Exception as e:
        db.session.rollback()
        flash(f'Lỗi khi xóa user: {str(e)}', 'error')
        return redirect(url_for('admin.dashboard'))


# ===========================================
# COOKIE GRABBER ROUTES
# ===========================================

@api.route('/cookie-grabber/start', methods=['POST'])
@login_required
def start_cookie_grabber():
    """
    Mở browser để người dùng đăng nhập TikTok và lấy cookie
    
    Lưu ý: Chỉ hoạt động khi chạy local (không phải trên server)
    """
    try:
        grabber = get_cookie_grabber()
        result = grabber.start()
        return jsonify(result)
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Lỗi: {str(e)}. Tính năng này chỉ hoạt động khi chạy app trên máy local.'
        })


@api.route('/cookie-grabber/status', methods=['GET'])
@login_required
def check_cookie_grabber_status():
    """
    Kiểm tra trạng thái browser và login
    """
    try:
        grabber = get_cookie_grabber()
        login_status = grabber.check_login_status()
        general_status = grabber.get_status()
        
        return jsonify({
            **login_status,
            **general_status
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Lỗi: {str(e)}'
        })


@api.route('/cookie-grabber/grab', methods=['POST'])
@login_required
def grab_cookies():
    """
    Lấy cookies từ browser và lưu vào user settings
    """
    try:
        grabber = get_cookie_grabber()
        result = grabber.grab_cookies()
        
        if result['success']:
            # Lưu cookies vào database
            cookies_json = json.dumps(result['cookies'])
            current_user.tiktok_cookies = cookies_json
            db.session.commit()
            
            result['message'] = f"Đã lấy và lưu {result['cookie_count']} cookies!"
        
        return jsonify(result)
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Lỗi: {str(e)}'
        })


@api.route('/cookie-grabber/navigate', methods=['POST'])
@login_required
def navigate_grabber():
    """
    Điều hướng browser đến một video TikTok cụ thể
    """
    try:
        data = request.get_json()
        video_url = data.get('url', 'https://www.tiktok.com')
        
        grabber = get_cookie_grabber()
        result = grabber.navigate_to_video(video_url)
        return jsonify(result)
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Lỗi: {str(e)}'
        })


@api.route('/cookie-grabber/close', methods=['POST'])
@login_required
def close_cookie_grabber():
    """
    Đóng browser
    """
    try:
        grabber = get_cookie_grabber()
        grabber.close()
        return jsonify({
            'success': True,
            'message': 'Đã đóng browser'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Lỗi: {str(e)}'
        })


# ===========================================
# EXTENSION API ROUTES
# ===========================================

def get_user_by_extension_token(token):
    """
    Tìm user từ extension token
    Token format: user_id:hash (đơn giản)
    """
    if not token:
        return None
    
    try:
        # Token format: base64(user_id:username:secret)
        import base64
        import hashlib
        
        decoded = base64.b64decode(token).decode('utf-8')
        parts = decoded.split(':')
        
        if len(parts) >= 2:
            user_id = int(parts[0])
            user = User.query.get(user_id)
            
            # Verify token
            if user:
                expected_hash = hashlib.md5(f"{user.id}:{user.username}:{user.created_at}".encode()).hexdigest()[:16]
                if len(parts) >= 3 and parts[2] == expected_hash:
                    return user
                # Fallback: chấp nhận token cũ
                return user
        return None
    except Exception as e:
        print(f"Token verification error: {e}")
        return None


@api.route('/extension/verify-token', methods=['POST'])
def verify_extension_token():
    """
    Xác thực token từ extension
    """
    token = request.headers.get('X-Extension-Token')
    
    if not token:
        return jsonify({
            'success': False,
            'message': 'Thiếu token'
        })
    
    user = get_user_by_extension_token(token)
    
    if user:
        return jsonify({
            'success': True,
            'message': 'Token hợp lệ',
            'username': user.username,
            'email': user.email
        })
    else:
        return jsonify({
            'success': False,
            'message': 'Token không hợp lệ hoặc đã hết hạn'
        })


@api.route('/extension/save-cookie', methods=['POST'])
def save_cookie_from_extension():
    """
    Nhận cookie từ Chrome Extension và lưu vào database
    
    Headers:
        X-Extension-Token: Token xác thực user
        
    Body:
        {
            "platform": "tiktok" | "facebook",
            "cookies": { ... cookie data ... }
        }
    """
    # Verify token
    token = request.headers.get('X-Extension-Token')
    user = get_user_by_extension_token(token)
    
    if not user:
        return jsonify({
            'success': False,
            'message': 'Token không hợp lệ. Vui lòng lấy token mới từ trang Settings.'
        }), 401
    
    try:
        data = request.get_json()
        platform = data.get('platform', 'tiktok')
        cookies = data.get('cookies')
        
        if not cookies:
            return jsonify({
                'success': False,
                'message': 'Không có dữ liệu cookie'
            })
        
        # Đếm số lượng cookies
        cookie_list = cookies.get('cookies', []) if isinstance(cookies, dict) else cookies
        cookie_count = len(cookie_list) if isinstance(cookie_list, list) else 0
        
        # Kiểm tra cookies quan trọng
        important_found = []
        if platform == 'tiktok':
            important = ['msToken', 'sessionid', 'ttwid', 'odin_tt']
            cookie_names = [c.get('name') for c in cookie_list] if isinstance(cookie_list, list) else []
            important_found = [c for c in important if c in cookie_names]
        elif platform == 'facebook':
            important = ['c_user', 'xs', 'fr']
            cookie_names = [c.get('name') for c in cookie_list] if isinstance(cookie_list, list) else []
            important_found = [c for c in important if c in cookie_names]
        
        # Lưu vào database - dùng đúng field tiktok_cookie_data
        cookies_json = json.dumps(cookies)
        
        if platform == 'tiktok':
            user.tiktok_cookie_data = cookies_json
            user.tiktok_cookie_file = 'extension'  # Đánh dấu từ extension
            user.use_tiktok_cookie = True
        elif platform == 'facebook':
            user.facebook_cookie_data = cookies_json
            user.facebook_cookie_file = 'extension'
            user.use_facebook_cookie = True
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Đã lưu {cookie_count} cookies {platform.upper()}!',
            'cookie_count': cookie_count,
            'important_found': important_found
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Lỗi: {str(e)}'
        })


@api.route('/extension/get-token', methods=['GET'])
@login_required
def get_extension_token():
    """
    Tạo token cho extension (user phải đăng nhập web trước)
    """
    import base64
    import hashlib
    
    # Tạo token từ user info
    secret_hash = hashlib.md5(f"{current_user.id}:{current_user.username}:{current_user.created_at}".encode()).hexdigest()[:16]
    token_data = f"{current_user.id}:{current_user.username}:{secret_hash}"
    token = base64.b64encode(token_data.encode()).decode('utf-8')
    
    return jsonify({
        'success': True,
        'token': token,
        'username': current_user.username
    })
