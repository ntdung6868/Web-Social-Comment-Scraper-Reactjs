# ===========================================
# auth.py - Xử lý Authentication
# ===========================================
# File này chứa các form và logic xử lý đăng ký/đăng nhập
# Sử dụng Flask-Login và Flask-WTF để bảo mật

from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, BooleanField, SubmitField
from wtforms.validators import (
    DataRequired, 
    Email, 
    EqualTo, 
    Length, 
    ValidationError,
    Regexp
)
from app.models import User


class LoginForm(FlaskForm):
    """
    Form Đăng nhập
    
    Fields:
        username: Tên đăng nhập
        password: Mật khẩu
        remember_me: Ghi nhớ đăng nhập
    """
    username = StringField('Tên đăng nhập', validators=[
        DataRequired(message='Vui lòng nhập tên đăng nhập'),
        Length(min=3, max=80, message='Tên đăng nhập từ 3-80 ký tự')
    ])
    
    password = PasswordField('Mật khẩu', validators=[
        DataRequired(message='Vui lòng nhập mật khẩu')
    ])
    
    remember_me = BooleanField('Ghi nhớ đăng nhập')
    
    submit = SubmitField('Đăng nhập')


class RegisterForm(FlaskForm):
    """
    Form Đăng ký tài khoản mới
    
    Fields:
        username: Tên đăng nhập (unique)
        email: Email (unique)
        password: Mật khẩu
        password2: Xác nhận mật khẩu
    """
    username = StringField('Tên đăng nhập', validators=[
        DataRequired(message='Vui lòng nhập tên đăng nhập'),
        Length(min=3, max=80, message='Tên đăng nhập từ 3-80 ký tự'),
        Regexp(
            r'^[a-zA-Z0-9_]+$',
            message='Tên đăng nhập chỉ được chứa chữ cái, số và dấu gạch dưới'
        )
    ])
    
    email = StringField('Email', validators=[
        DataRequired(message='Vui lòng nhập email'),
        Email(message='Email không hợp lệ'),
        Length(max=120, message='Email không quá 120 ký tự')
    ])
    
    password = PasswordField('Mật khẩu', validators=[
        DataRequired(message='Vui lòng nhập mật khẩu'),
        Length(min=8, message='Mật khẩu ít nhất 8 ký tự')
    ])
    
    password2 = PasswordField('Xác nhận mật khẩu', validators=[
        DataRequired(message='Vui lòng xác nhận mật khẩu'),
        EqualTo('password', message='Mật khẩu không khớp')
    ])
    
    submit = SubmitField('Đăng ký')
    
    def validate_username(self, username):
        """
        Kiểm tra tên đăng nhập đã tồn tại chưa
        
        Args:
            username: Field tên đăng nhập
            
        Raises:
            ValidationError: Nếu tên đăng nhập đã tồn tại
        """
        user = User.query.filter_by(username=username.data).first()
        if user:
            raise ValidationError('Tên đăng nhập đã được sử dụng. Vui lòng chọn tên khác.')
    
    def validate_email(self, email):
        """
        Kiểm tra email đã tồn tại chưa
        
        Args:
            email: Field email
            
        Raises:
            ValidationError: Nếu email đã tồn tại
        """
        user = User.query.filter_by(email=email.data).first()
        if user:
            raise ValidationError('Email đã được sử dụng. Vui lòng dùng email khác.')


class ScrapeForm(FlaskForm):
    """
    Form nhập URL để scrape
    
    Fields:
        url: URL video TikTok hoặc Facebook
        platform: Chọn nền tảng
    """
    url = StringField('URL Video', validators=[
        DataRequired(message='Vui lòng nhập URL video'),
        Length(max=500, message='URL không quá 500 ký tự')
    ])
    
    submit = SubmitField('Bắt đầu Scrape')
    
    def validate_url(self, url):
        """
        Kiểm tra URL có hợp lệ không
        
        Args:
            url: Field URL
            
        Raises:
            ValidationError: Nếu URL không phải TikTok hoặc Facebook
        """
        valid_domains = ['tiktok.com', 'facebook.com', 'fb.watch', 'www.tiktok.com', 'www.facebook.com']
        url_lower = url.data.lower()
        
        if not any(domain in url_lower for domain in valid_domains):
            raise ValidationError('URL phải là link từ TikTok hoặc Facebook')
