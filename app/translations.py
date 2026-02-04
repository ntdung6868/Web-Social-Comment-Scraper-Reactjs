# ===========================================
# translations.py - Hệ thống đa ngôn ngữ
# ===========================================
# File này quản lý tất cả các bản dịch cho website

TRANSLATIONS = {
    'vi': {
        # === Chung ===
        'app_name': 'Web Scraper',
        'app_description': 'Công cụ cào comment TikTok/Facebook',
        'all_rights_reserved': 'Đã đăng ký bản quyền.',
        
        # === Navigation ===
        'nav_dashboard': 'Dashboard',
        'nav_settings': 'Cài đặt',
        'nav_logout': 'Đăng xuất',
        
        # === Auth ===
        'login': 'Đăng nhập',
        'register': 'Đăng ký',
        'login_title': 'Đăng nhập',
        'register_title': 'Tạo tài khoản mới',
        'login_subtitle': 'Đăng nhập để sử dụng công cụ cào comment',
        'register_subtitle': 'Đăng ký để bắt đầu sử dụng Web Scraper',
        'username': 'Tên đăng nhập / Email',
        'username_placeholder': 'Nhập username hoặc email',
        'username_hint': 'Chỉ chữ cái, số và gạch dưới',
        'email': 'Email',
        'email_placeholder': 'email@example.com',
        'password': 'Mật khẩu',
        'password_placeholder': 'Nhập mật khẩu',
        'password_hint': 'Tối thiểu 8 ký tự',
        'confirm_password': 'Xác nhận mật khẩu',
        'confirm_password_placeholder': 'Nhập lại mật khẩu',
        'remember_me': 'Ghi nhớ đăng nhập',
        'no_account': 'Chưa có tài khoản?',
        'register_now': 'Đăng ký ngay',
        'have_account': 'Đã có tài khoản?',
        'terms_agree': 'Tôi đồng ý với',
        'terms_of_service': 'Điều khoản sử dụng',
        'login_required': 'Vui lòng đăng nhập để truy cập trang này.',
        
        # === Forgot/Reset Password ===
        'forgot_password': 'Quên mật khẩu?',
        'forgot_password_title': 'Quên mật khẩu',
        'forgot_password_subtitle': 'Nhập email để nhận link đặt lại mật khẩu',
        'forgot_password_hint': 'Chúng tôi sẽ gửi link đặt lại mật khẩu đến email này',
        'send_reset_link': 'Gửi link đặt lại',
        'back_to_login': 'Quay lại đăng nhập',
        'reset_password_title': 'Đặt lại mật khẩu',
        'reset_password_subtitle': 'Nhập mật khẩu mới cho tài khoản của bạn',
        'new_password': 'Mật khẩu mới',
        'new_password_placeholder': 'Nhập mật khẩu mới',
        'reset_password_btn': 'Đặt lại mật khẩu',
        
        # === Dashboard ===
        'dashboard_title': 'Dashboard',
        'welcome_back': 'Chào mừng bạn quay trở lại,',
        'total_scrapes': 'Tổng lần scrape',
        'total_comments': 'Tổng comment',
        'success_count': 'Thành công',
        
        # === Scrape Form ===
        'scrape_comment': 'Scrape Comment',
        'scrape_hint': 'Nhập URL video TikTok hoặc Facebook để bắt đầu',
        'video_url': 'URL Video',
        'url_placeholder': 'https://www.tiktok.com/@user/video/... hoặc https://www.facebook.com/...',
        'start_scrape': 'Bắt đầu Scrape',
        'scraping': 'Đang scrape...',
        'supported': 'Hỗ trợ:',
        'scraped_comments': 'Đã cào: {count} bình luận',
        'completed_comments': 'Hoàn thành: {count} bình luận',
        
        # === History ===
        'scrape_history': 'Lịch sử Scrape',
        'platform': 'Platform',
        'url': 'URL',
        'comments': 'Comments',
        'status': 'Trạng thái',
        'time': 'Thời gian',
        'actions': 'Thao tác',
        'status_success': 'Thành công',
        'status_failed': 'Thất bại',
        'status_processing': 'Đang xử lý',
        'view_comments': 'Xem Comments',
        'export_excel': 'Xuất Excel',
        'delete': 'Xóa',
        'no_history': 'Chưa có lịch sử scrape nào',
        'no_history_hint': 'Nhập URL và bắt đầu scrape để xem kết quả',
        
        # === Pagination ===
        'page': 'Trang',
        'of': 'của',
        'previous': '← Trước',
        'next': 'Sau →',
        
        # === Modal ===
        'comments_list': 'Danh sách Comments',
        'no_comments': 'Không có comment nào',
        
        # === Settings ===
        'settings_title': 'Cài đặt',
        'settings_subtitle': 'Cấu hình cookie và proxy để scrape hiệu quả hơn',
        
        # === Cookie Settings ===
        'tiktok_cookie': 'Cookie TikTok',
        'tiktok_cookie_desc': 'Dùng để scrape comment TikTok',
        'facebook_cookie': 'Cookie Facebook',
        'facebook_cookie_desc': 'Dùng để scrape comment Facebook',
        'file': 'File',
        'cookies': 'Cookies',
        'cookie_status': 'Trạng thái',
        'active': 'Đang bật',
        'inactive': 'Đã tắt',
        'enable': 'Bật',
        'disable': 'Tắt',
        'delete_cookie': 'Xóa',
        'click_to_select': 'Click để chọn file',
        'cookie_json': 'Cookie (.json)',
        'confirm_delete_tiktok': 'Xóa cookie TikTok?',
        'confirm_delete_facebook': 'Xóa cookie Facebook?',
        
        # === Proxy Settings ===
        'proxy_settings': 'Proxy Settings',
        'proxy_settings_desc': 'Cấu hình proxy để tránh bị ban IP khi scrape số lượng lớn',
        'proxy_count': 'Số lượng proxy',
        'rotation_mode': 'Chế độ xoay',
        'proxy_status': 'Trạng thái',
        'delete_all': 'Xóa tất cả',
        'confirm_delete_proxy': 'Xóa tất cả proxy?',
        'proxy_list': 'Danh sách Proxy',
        'proxy_list_hint': 'mỗi dòng 1 proxy',
        'proxy_placeholder': 'http://ip:port\nhttp://user:pass@ip:port\nsocks5://ip:port\nip:port',
        'proxy_support': 'Hỗ trợ: HTTP, HTTPS, SOCKS4, SOCKS5. Có hoặc không có authentication.',
        'rotation_random': 'Random',
        'rotation_random_desc': 'ngẫu nhiên',
        'rotation_sequential': 'Sequential',
        'rotation_sequential_desc': 'tuần tự',
        'save_proxy': 'Lưu Proxy',
        
        # === Proxy Tips ===
        'proxy_tips_title': 'Gợi ý sử dụng Proxy',
        'proxy_tip_1': 'Sử dụng proxy residential để tránh bị phát hiện',
        'proxy_tip_2': 'Nên có nhiều proxy để xoay vòng (tránh ban 1 IP)',
        'proxy_tip_3': 'Proxy datacenter có thể dễ bị chặn hơn',
        'proxy_tip_4': 'Kiểm tra proxy còn hoạt động trước khi sử dụng',
        
        # === Scraper Settings ===
        'scraper_settings': 'Scraper Settings',
        'scraper_settings_desc': 'Cấu hình chế độ scrape và xử lý captcha',
        'headless_mode': 'Chế độ Headless',
        'on': 'BẬT',
        'off': 'TẮT',
        'headless_tip_title': 'Khi nào nên TẮT chế độ Headless?',
        'headless_tip_1': 'TikTok hay hiện captcha: Tắt headless để giải captcha thủ công',
        
        # === Cookie Guide ===
        'cookie_guide_title': 'Hướng dẫn lấy Cookie',
        'cookie_guide_step1': 'Cài đặt extension:',
        'cookie_guide_step1_desc': 'Tải',
        'cookie_guide_or': 'hoặc',
        'cookie_guide_step2': 'Đăng nhập:',
        'cookie_guide_step2_desc': 'Mở tiktok.com hoặc facebook.com và đăng nhập tài khoản',
        'cookie_guide_step3': 'Export Cookie:',
        'cookie_guide_step3_desc': 'Click vào extension > Export (JSON)',
        'cookie_guide_step4': 'Upload:',
        'cookie_guide_step4_desc': 'Upload file JSON vào đúng nền tảng ở trên',
        'security_note_title': 'Lưu ý bảo mật',
        'security_note': 'Cookie chứa thông tin đăng nhập. Không chia sẻ với người khác!',
        
        # === History Detail ===
        'scrape_detail': 'Chi tiết Scrape',
        'original_url': 'URL gốc',
        'scrape_time': 'Thời gian scrape',
        'stt': 'STT',
        'content': 'Nội dung',
        'likes': 'Likes',
        
        # === Toast Messages ===
        'please_enter_url': 'Vui lòng nhập URL video',
        'invalid_url': 'URL phải là link từ TikTok hoặc Facebook',
        'scrape_success': 'Đã scrape được {count} comment!',
        'error_occurred': 'Có lỗi xảy ra',
        'connection_error': 'Lỗi kết nối. Vui lòng thử lại!',
        'delete_success': 'Đã xóa thành công!',
        'confirm_delete_history': 'Bạn có chắc muốn xóa lịch sử này?',
        'loading': 'Đang tải...',
        
        # === JavaScript Toast Messages ===
        'toast_enter_url': 'Vui lòng nhập URL video',
        'toast_invalid_url': 'URL phải là link từ TikTok hoặc Facebook',
        'toast_scrape_success': 'Đã scrape được {count} comment!',
        'toast_error': 'Có lỗi xảy ra',
        'toast_connection_error': 'Lỗi kết nối server. Vui lòng thử lại.',
        'toast_confirm_delete': 'Bạn có chắc muốn xóa lịch sử này?',
        'toast_delete_success': 'Đã xóa lịch sử thành công',
        'toast_copied': 'Đã copy vào clipboard',
        'toast_copy_failed': 'Không thể copy',
        'loading_comments': 'Đang tải comments...',
        'scraped': 'Đã cào',
        'completed': 'Hoàn thành',
        
        # === Relative Time ===
        'just_now': 'Vừa xong',
        'minutes_ago': '{count} phút trước',
        'hours_ago': '{count} giờ trước',
        'days_ago': '{count} ngày trước',
        
        # === Language ===
        'language': 'Ngôn ngữ',
        'vietnamese': 'Tiếng Việt',
        'english': 'English',
        'chinese': '简体中文',
        'japanese': '日本語',
        
        # === Theme ===
        'theme': 'Giao diện',
        'theme_light': 'Sáng',
        'theme_dark': 'Tối',
        'theme_system': 'Hệ thống',
        
        # === Pricing ===
        'pricing_title': 'Bảng giá',
        'pricing_subtitle': 'Chọn gói phù hợp với nhu cầu của bạn',
        'current_plan': 'Gói hiện tại',
        'trials_remaining': 'lượt còn lại',
        'forever': 'Mãi mãi',
        'month': 'tháng',
        'most_popular': 'Phổ biến nhất',
        'get_started_free': 'Bắt đầu miễn phí',
        'upgrade_now': 'Nâng cấp ngay',
        'free_feature_1': '3 lượt dùng thử',
        'free_feature_2': 'Tối đa 100 comment/lần tải',
        'free_feature_3': 'Hỗ trợ TikTok & Facebook',
        'pro_feature_1': 'Không giới hạn lượt scrape',
        'pro_feature_2': 'Không giới hạn comment tải về',
        'pro_feature_3': 'Ưu tiên hỗ trợ',
        'pro_feature_4': 'Xuất file Excel không giới hạn',
        'faq_title': 'Câu hỏi thường gặp',
        'faq_q1': 'Free plan có những giới hạn gì?',
        'faq_a1': 'Bạn có 3 lượt dùng thử, mỗi lần chỉ tải được tối đa 100 comment.',
        'faq_q2': 'Làm sao để nâng cấp lên Pro?',
        'faq_a2': 'Liên hệ admin qua email hoặc nhắn tin trực tiếp để được hỗ trợ nâng cấp.',
        'faq_q3': 'Pro plan có thời hạn bao lâu?',
        'faq_a3': 'Pro plan có thời hạn 30 ngày kể từ ngày kích hoạt.',
        
        # === Plan Status ===
        'plan_free': 'Gói miễn phí',
        'plan_pro': 'Gói Pro',
        'plan_active': 'Đang hoạt động',
        'plan_expired': 'Đã hết hạn',
        'trial_remaining': 'Còn {count}/{max} lượt dùng thử',
        'upgrade_to_continue': 'Nâng cấp để tiếp tục sử dụng',
        'account_banned': 'Tài khoản đã bị khóa',
    },
    
    'en': {
        # === General ===
        'app_name': 'Web Scraper',
        'app_description': 'TikTok/Facebook Comment Scraping Tool',
        'all_rights_reserved': 'All rights reserved.',
        
        # === Navigation ===
        'nav_dashboard': 'Dashboard',
        'nav_settings': 'Settings',
        'nav_logout': 'Logout',
        
        # === Auth ===
        'login': 'Login',
        'register': 'Register',
        'login_title': 'Login',
        'register_title': 'Create New Account',
        'login_subtitle': 'Login to use the comment scraping tool',
        'register_subtitle': 'Register to start using Web Scraper',
        'username': 'Username / Email',
        'username_placeholder': 'Enter username or email',
        'username_hint': 'Letters, numbers and underscores only',
        'email': 'Email',
        'email_placeholder': 'email@example.com',
        'password': 'Password',
        'password_placeholder': 'Enter password',
        'password_hint': 'Minimum 8 characters',
        'confirm_password': 'Confirm Password',
        'confirm_password_placeholder': 'Re-enter password',
        'remember_me': 'Remember me',
        'no_account': "Don't have an account?",
        'register_now': 'Register now',
        'have_account': 'Already have an account?',
        'terms_agree': 'I agree to the',
        'terms_of_service': 'Terms of Service',
        'login_required': 'Please login to access this page.',
        
        # === Forgot/Reset Password ===
        'forgot_password': 'Forgot password?',
        'forgot_password_title': 'Forgot Password',
        'forgot_password_subtitle': 'Enter your email to receive a password reset link',
        'forgot_password_hint': 'We will send a password reset link to this email',
        'send_reset_link': 'Send Reset Link',
        'back_to_login': 'Back to Login',
        'reset_password_title': 'Reset Password',
        'reset_password_subtitle': 'Enter a new password for your account',
        'new_password': 'New Password',
        'new_password_placeholder': 'Enter new password',
        'reset_password_btn': 'Reset Password',
        
        # === Dashboard ===
        'dashboard_title': 'Dashboard',
        'welcome_back': 'Welcome back,',
        'total_scrapes': 'Total Scrapes',
        'total_comments': 'Total Comments',
        'success_count': 'Successful',
        
        # === Scrape Form ===
        'scrape_comment': 'Scrape Comments',
        'scrape_hint': 'Enter TikTok or Facebook video URL to start',
        'video_url': 'Video URL',
        'url_placeholder': 'https://www.tiktok.com/@user/video/... or https://www.facebook.com/...',
        'start_scrape': 'Start Scrape',
        'scraping': 'Scraping...',
        'supported': 'Supported:',
        'scraped_comments': 'Scraped: {count} comments',
        'completed_comments': 'Completed: {count} comments',
        
        # === History ===
        'scrape_history': 'Scrape History',
        'platform': 'Platform',
        'url': 'URL',
        'comments': 'Comments',
        'status': 'Status',
        'time': 'Time',
        'actions': 'Actions',
        'status_success': 'Success',
        'status_failed': 'Failed',
        'status_processing': 'Processing',
        'view_comments': 'View Comments',
        'export_excel': 'Export Excel',
        'delete': 'Delete',
        'no_history': 'No scrape history yet',
        'no_history_hint': 'Enter URL and start scraping to see results',
        
        # === Pagination ===
        'page': 'Page',
        'of': 'of',
        'previous': '← Previous',
        'next': 'Next →',
        
        # === Modal ===
        'comments_list': 'Comments List',
        'no_comments': 'No comments',
        
        # === Settings ===
        'settings_title': 'Settings',
        'settings_subtitle': 'Configure cookies and proxy for more efficient scraping',
        
        # === Cookie Settings ===
        'tiktok_cookie': 'TikTok Cookie',
        'tiktok_cookie_desc': 'Used to scrape TikTok comments',
        'facebook_cookie': 'Facebook Cookie',
        'facebook_cookie_desc': 'Used to scrape Facebook comments',
        'file': 'File',
        'cookies': 'Cookies',
        'cookie_status': 'Status',
        'active': 'Active',
        'inactive': 'Inactive',
        'enable': 'Enable',
        'disable': 'Disable',
        'delete_cookie': 'Delete',
        'click_to_select': 'Click to select file',
        'cookie_json': 'Cookie (.json)',
        'confirm_delete_tiktok': 'Delete TikTok cookie?',
        'confirm_delete_facebook': 'Delete Facebook cookie?',
        
        # === Proxy Settings ===
        'proxy_settings': 'Proxy Settings',
        'proxy_settings_desc': 'Configure proxy to avoid IP bans when scraping large volumes',
        'proxy_count': 'Proxy count',
        'rotation_mode': 'Rotation mode',
        'proxy_status': 'Status',
        'delete_all': 'Delete all',
        'confirm_delete_proxy': 'Delete all proxies?',
        'proxy_list': 'Proxy List',
        'proxy_list_hint': 'one proxy per line',
        'proxy_placeholder': 'http://ip:port\nhttp://user:pass@ip:port\nsocks5://ip:port\nip:port',
        'proxy_support': 'Supported: HTTP, HTTPS, SOCKS4, SOCKS5. With or without authentication.',
        'rotation_random': 'Random',
        'rotation_random_desc': 'random',
        'rotation_sequential': 'Sequential',
        'rotation_sequential_desc': 'sequential',
        'save_proxy': 'Save Proxy',
        
        # === Proxy Tips ===
        'proxy_tips_title': 'Proxy Usage Tips',
        'proxy_tip_1': 'Use residential proxies to avoid detection',
        'proxy_tip_2': 'Use multiple proxies for rotation (avoid single IP ban)',
        'proxy_tip_3': 'Datacenter proxies may be blocked more easily',
        'proxy_tip_4': 'Verify proxy is working before use',
        
        # === Scraper Settings ===
        'scraper_settings': 'Scraper Settings',
        'scraper_settings_desc': 'Configure scraping mode and captcha handling',
        'headless_mode': 'Headless Mode',
        'on': 'ON',
        'off': 'OFF',
        'headless_tip_title': 'When to turn OFF Headless mode?',
        'headless_tip_1': 'TikTok shows captcha: Turn off headless to solve captcha manually',
        
        # === Cookie Guide ===
        'cookie_guide_title': 'How to Get Cookies',
        'cookie_guide_step1': 'Install extension:',
        'cookie_guide_step1_desc': 'Download',
        'cookie_guide_or': 'or',
        'cookie_guide_step2': 'Login:',
        'cookie_guide_step2_desc': 'Open tiktok.com or facebook.com and login to your account',
        'cookie_guide_step3': 'Export Cookie:',
        'cookie_guide_step3_desc': 'Click on extension > Export (JSON)',
        'cookie_guide_step4': 'Upload:',
        'cookie_guide_step4_desc': 'Upload JSON file to the correct platform above',
        'security_note_title': 'Security Note',
        'security_note': 'Cookies contain login information. Do not share with others!',
        
        # === History Detail ===
        'scrape_detail': 'Scrape Details',
        'original_url': 'Original URL',
        'scrape_time': 'Scrape time',
        'stt': 'No.',
        'content': 'Content',
        'likes': 'Likes',
        
        # === Toast Messages ===
        'please_enter_url': 'Please enter video URL',
        'invalid_url': 'URL must be a TikTok or Facebook link',
        'scrape_success': 'Successfully scraped {count} comments!',
        'error_occurred': 'An error occurred',
        'connection_error': 'Connection error. Please try again!',
        'delete_success': 'Deleted successfully!',
        'confirm_delete_history': 'Are you sure you want to delete this history?',
        'loading': 'Loading...',
        
        # === JavaScript Toast Messages ===
        'toast_enter_url': 'Please enter video URL',
        'toast_invalid_url': 'URL must be a TikTok or Facebook link',
        'toast_scrape_success': 'Successfully scraped {count} comments!',
        'toast_error': 'An error occurred',
        'toast_connection_error': 'Server connection error. Please try again.',
        'toast_confirm_delete': 'Are you sure you want to delete this history?',
        'toast_delete_success': 'History deleted successfully',
        'toast_copied': 'Copied to clipboard',
        'toast_copy_failed': 'Cannot copy',
        'loading_comments': 'Loading comments...',
        'scraped': 'Scraped',
        'completed': 'Completed',
        
        # === Relative Time ===
        'just_now': 'Just now',
        'minutes_ago': '{count} minutes ago',
        'hours_ago': '{count} hours ago',
        'days_ago': '{count} days ago',
        
        # === Language ===
        'language': 'Language',
        'vietnamese': 'Tiếng Việt',
        'english': 'English',
        'chinese': '简体中文',
        'japanese': '日本語',
        
        # === Theme ===
        'theme': 'Theme',
        'theme_light': 'Light',
        'theme_dark': 'Dark',
        'theme_system': 'System',
        
        # === Pricing ===
        'pricing_title': 'Pricing',
        'pricing_subtitle': 'Choose the plan that fits your needs',
        'current_plan': 'Current Plan',
        'trials_remaining': 'trials remaining',
        'forever': 'Forever',
        'month': 'month',
        'most_popular': 'Most Popular',
        'get_started_free': 'Get started for free',
        'upgrade_now': 'Upgrade Now',
        'free_feature_1': '3 trial uses',
        'free_feature_2': 'Max 100 comments/download',
        'free_feature_3': 'TikTok & Facebook support',
        'pro_feature_1': 'Unlimited scrapes',
        'pro_feature_2': 'Unlimited comments download',
        'pro_feature_3': 'Priority support',
        'pro_feature_4': 'Unlimited Excel exports',
        'faq_title': 'Frequently Asked Questions',
        'faq_q1': 'What are the limitations of Free plan?',
        'faq_a1': 'You have 3 trial uses, max 100 comments per download.',
        'faq_q2': 'How to upgrade to Pro?',
        'faq_a2': 'Contact admin via email or direct message for upgrade assistance.',
        'faq_q3': 'How long does Pro plan last?',
        'faq_a3': 'Pro plan lasts 30 days from activation date.',
        
        # === Plan Status ===
        'plan_free': 'Free Plan',
        'plan_pro': 'Pro Plan',
        'plan_active': 'Active',
        'plan_expired': 'Expired',
        'trial_remaining': '{count}/{max} trials remaining',
        'upgrade_to_continue': 'Upgrade to continue',
        'account_banned': 'Account banned',
    },
    
    'zh': {
        # === General ===
        'app_name': 'Web Scraper',
        'app_description': 'TikTok/Facebook评论抓取工具',
        'all_rights_reserved': '版权所有。',
        
        # === Navigation ===
        'nav_dashboard': '仪表板',
        'nav_settings': '设置',
        'nav_logout': '退出登录',
        
        # === Auth ===
        'login': '登录',
        'register': '注册',
        'login_title': '登录',
        'register_title': '创建新账户',
        'login_subtitle': '登录以使用评论抓取工具',
        'register_subtitle': '注册开始使用Web Scraper',
        'username': '用户名 / 邮箱',
        'username_placeholder': '输入用户名或邮箱',
        'username_hint': '仅限字母、数字和下划线',
        'email': '邮箱',
        'email_placeholder': 'email@example.com',
        'password': '密码',
        'password_placeholder': '输入密码',
        'password_hint': '至少8个字符',
        'confirm_password': '确认密码',
        'confirm_password_placeholder': '再次输入密码',
        'remember_me': '记住我',
        'no_account': '还没有账户？',
        'register_now': '立即注册',
        'have_account': '已有账户？',
        'terms_agree': '我同意',
        'terms_of_service': '服务条款',
        'login_required': '请登录以访问此页面。',
        
        # === Forgot/Reset Password ===
        'forgot_password': '忘记密码？',
        'forgot_password_title': '忘记密码',
        'forgot_password_subtitle': '输入您的邮箱以接收密码重置链接',
        'forgot_password_hint': '我们将向此邮箱发送密码重置链接',
        'send_reset_link': '发送重置链接',
        'back_to_login': '返回登录',
        'reset_password_title': '重置密码',
        'reset_password_subtitle': '为您的账户输入新密码',
        'new_password': '新密码',
        'new_password_placeholder': '输入新密码',
        'reset_password_btn': '重置密码',
        
        # === Dashboard ===
        'dashboard_title': '仪表板',
        'welcome_back': '欢迎回来，',
        'total_scrapes': '总抓取次数',
        'total_comments': '总评论数',
        'success_count': '成功',
        
        # === Scrape Form ===
        'scrape_comment': '抓取评论',
        'scrape_hint': '输入TikTok或Facebook视频链接开始',
        'video_url': '视频链接',
        'url_placeholder': 'https://www.tiktok.com/@user/video/... 或 https://www.facebook.com/...',
        'start_scrape': '开始抓取',
        'scraping': '正在抓取...',
        'supported': '支持：',
        'scraped_comments': '已抓取：{count}条评论',
        'completed_comments': '完成：{count}条评论',
        
        # === History ===
        'scrape_history': '抓取历史',
        'platform': '平台',
        'url': '链接',
        'comments': '评论',
        'status': '状态',
        'time': '时间',
        'actions': '操作',
        'status_success': '成功',
        'status_failed': '失败',
        'status_processing': '处理中',
        'view_comments': '查看评论',
        'export_excel': '导出Excel',
        'delete': '删除',
        'no_history': '暂无抓取历史',
        'no_history_hint': '输入链接并开始抓取以查看结果',
        
        # === Pagination ===
        'page': '第',
        'of': '页，共',
        'previous': '← 上一页',
        'next': '下一页 →',
        
        # === Modal ===
        'comments_list': '评论列表',
        'no_comments': '暂无评论',
        
        # === Settings ===
        'settings_title': '设置',
        'settings_subtitle': '配置Cookie和代理以提高抓取效率',
        
        # === Cookie Settings ===
        'tiktok_cookie': 'TikTok Cookie',
        'tiktok_cookie_desc': '用于抓取TikTok评论',
        'facebook_cookie': 'Facebook Cookie',
        'facebook_cookie_desc': '用于抓取Facebook评论',
        'file': '文件',
        'cookies': 'Cookies',
        'cookie_status': '状态',
        'active': '已启用',
        'inactive': '已禁用',
        'enable': '启用',
        'disable': '禁用',
        'delete_cookie': '删除',
        'click_to_select': '点击选择文件',
        'cookie_json': 'Cookie (.json)',
        'confirm_delete_tiktok': '删除TikTok Cookie？',
        'confirm_delete_facebook': '删除Facebook Cookie？',
        
        # === Proxy Settings ===
        'proxy_settings': '代理设置',
        'proxy_settings_desc': '配置代理以避免大量抓取时IP被封',
        'proxy_count': '代理数量',
        'rotation_mode': '轮换模式',
        'proxy_status': '状态',
        'delete_all': '全部删除',
        'confirm_delete_proxy': '删除所有代理？',
        'proxy_list': '代理列表',
        'proxy_list_hint': '每行一个代理',
        'proxy_placeholder': 'http://ip:port\nhttp://user:pass@ip:port\nsocks5://ip:port\nip:port',
        'proxy_support': '支持：HTTP、HTTPS、SOCKS4、SOCKS5。可带或不带认证。',
        'rotation_random': '随机',
        'rotation_random_desc': '随机',
        'rotation_sequential': '顺序',
        'rotation_sequential_desc': '顺序',
        'save_proxy': '保存代理',
        
        # === Proxy Tips ===
        'proxy_tips_title': '代理使用提示',
        'proxy_tip_1': '使用住宅代理以避免被检测',
        'proxy_tip_2': '使用多个代理进行轮换（避免单IP被封）',
        'proxy_tip_3': '数据中心代理可能更容易被封',
        'proxy_tip_4': '使用前请验证代理是否可用',
        
        # === Scraper Settings ===
        'scraper_settings': '抓取器设置',
        'scraper_settings_desc': '配置抓取模式和验证码处理',
        'headless_mode': '无头模式',
        'on': '开',
        'off': '关',
        'headless_tip_title': '何时关闭无头模式？',
        'headless_tip_1': 'TikTok显示验证码时：关闭无头模式以手动解决验证码',
        
        # === Cookie Guide ===
        'cookie_guide_title': '获取Cookie指南',
        'cookie_guide_step1': '安装扩展：',
        'cookie_guide_step1_desc': '下载',
        'cookie_guide_or': '或',
        'cookie_guide_step2': '登录：',
        'cookie_guide_step2_desc': '打开tiktok.com或facebook.com并登录账户',
        'cookie_guide_step3': '导出Cookie：',
        'cookie_guide_step3_desc': '点击扩展 > Export (JSON)',
        'cookie_guide_step4': '上传：',
        'cookie_guide_step4_desc': '将JSON文件上传到上方对应平台',
        'security_note_title': '安全提示',
        'security_note': 'Cookie包含登录信息。请勿与他人分享！',
        
        # === History Detail ===
        'scrape_detail': '抓取详情',
        'original_url': '原始链接',
        'scrape_time': '抓取时间',
        'stt': '序号',
        'content': '内容',
        'likes': '点赞',
        
        # === Toast Messages ===
        'please_enter_url': '请输入视频链接',
        'invalid_url': '链接必须是TikTok或Facebook链接',
        'scrape_success': '成功抓取{count}条评论！',
        'error_occurred': '发生错误',
        'connection_error': '连接错误。请重试！',
        'delete_success': '删除成功！',
        'confirm_delete_history': '确定要删除此历史记录吗？',
        'loading': '加载中...',
        
        # === JavaScript Toast Messages ===
        'toast_enter_url': '请输入视频链接',
        'toast_invalid_url': '链接必须是TikTok或Facebook链接',
        'toast_scrape_success': '成功抓取{count}条评论！',
        'toast_error': '发生错误',
        'toast_connection_error': '服务器连接错误。请重试。',
        'toast_confirm_delete': '确定要删除此历史记录吗？',
        'toast_delete_success': '历史记录删除成功',
        'toast_copied': '已复制到剪贴板',
        'toast_copy_failed': '无法复制',
        'loading_comments': '正在加载评论...',
        'scraped': '已抓取',
        'completed': '已完成',
        
        # === Relative Time ===
        'just_now': '刚刚',
        'minutes_ago': '{count}分钟前',
        'hours_ago': '{count}小时前',
        'days_ago': '{count}天前',
        
        # === Language ===
        'language': '语言',
        'vietnamese': 'Tiếng Việt',
        'english': 'English',
        'chinese': '简体中文',
        'japanese': '日本語',
        
        # === Theme ===
        'theme': '主题',
        'theme_light': '浅色',
        'theme_dark': '深色',
        'theme_system': '跟随系统',
    },
    
    'ja': {
        # === General ===
        'app_name': 'Web Scraper',
        'app_description': 'TikTok/Facebookコメント取得ツール',
        'all_rights_reserved': '全著作権所有。',
        
        # === Navigation ===
        'nav_dashboard': 'ダッシュボード',
        'nav_settings': '設定',
        'nav_logout': 'ログアウト',
        
        # === Auth ===
        'login': 'ログイン',
        'register': '登録',
        'login_title': 'ログイン',
        'register_title': '新規アカウント作成',
        'login_subtitle': 'コメント取得ツールを使用するにはログインしてください',
        'register_subtitle': 'Web Scraperを使い始めるには登録してください',
        'username': 'ユーザー名 / メール',
        'username_placeholder': 'ユーザー名またはメールを入力',
        'username_hint': '英数字とアンダースコアのみ',
        'email': 'メール',
        'email_placeholder': 'email@example.com',
        'password': 'パスワード',
        'password_placeholder': 'パスワードを入力',
        'password_hint': '8文字以上',
        'confirm_password': 'パスワード確認',
        'confirm_password_placeholder': 'パスワードを再入力',
        'remember_me': 'ログイン状態を保持',
        'no_account': 'アカウントをお持ちでないですか？',
        'register_now': '今すぐ登録',
        'have_account': 'すでにアカウントをお持ちですか？',
        'terms_agree': '同意します',
        'terms_of_service': '利用規約',
        'login_required': 'このページにアクセスするにはログインしてください。',
        
        # === Forgot/Reset Password ===
        'forgot_password': 'パスワードをお忘れですか？',
        'forgot_password_title': 'パスワードを忘れた',
        'forgot_password_subtitle': 'パスワードリセットリンクを受け取るためにメールを入力してください',
        'forgot_password_hint': 'このメールにパスワードリセットリンクを送信します',
        'send_reset_link': 'リセットリンクを送信',
        'back_to_login': 'ログインに戻る',
        'reset_password_title': 'パスワードをリセット',
        'reset_password_subtitle': 'アカウントの新しいパスワードを入力してください',
        'new_password': '新しいパスワード',
        'new_password_placeholder': '新しいパスワードを入力',
        'reset_password_btn': 'パスワードをリセット',
        
        # === Dashboard ===
        'dashboard_title': 'ダッシュボード',
        'welcome_back': 'おかえりなさい、',
        'total_scrapes': '総取得回数',
        'total_comments': '総コメント数',
        'success_count': '成功',
        
        # === Scrape Form ===
        'scrape_comment': 'コメント取得',
        'scrape_hint': 'TikTokまたはFacebookの動画URLを入力して開始',
        'video_url': '動画URL',
        'url_placeholder': 'https://www.tiktok.com/@user/video/... または https://www.facebook.com/...',
        'start_scrape': '取得開始',
        'scraping': '取得中...',
        'supported': '対応：',
        'scraped_comments': '取得済み：{count}件のコメント',
        'completed_comments': '完了：{count}件のコメント',
        
        # === History ===
        'scrape_history': '取得履歴',
        'platform': 'プラットフォーム',
        'url': 'URL',
        'comments': 'コメント',
        'status': 'ステータス',
        'time': '時間',
        'actions': '操作',
        'status_success': '成功',
        'status_failed': '失敗',
        'status_processing': '処理中',
        'view_comments': 'コメント表示',
        'export_excel': 'Excel出力',
        'delete': '削除',
        'no_history': '取得履歴がありません',
        'no_history_hint': 'URLを入力して取得を開始すると結果が表示されます',
        
        # === Pagination ===
        'page': 'ページ',
        'of': '/',
        'previous': '← 前へ',
        'next': '次へ →',
        
        # === Modal ===
        'comments_list': 'コメント一覧',
        'no_comments': 'コメントがありません',
        
        # === Settings ===
        'settings_title': '設定',
        'settings_subtitle': 'Cookieとプロキシを設定してより効率的に取得',
        
        # === Cookie Settings ===
        'tiktok_cookie': 'TikTok Cookie',
        'tiktok_cookie_desc': 'TikTokコメント取得に使用',
        'facebook_cookie': 'Facebook Cookie',
        'facebook_cookie_desc': 'Facebookコメント取得に使用',
        'file': 'ファイル',
        'cookies': 'Cookies',
        'cookie_status': 'ステータス',
        'active': '有効',
        'inactive': '無効',
        'enable': '有効化',
        'disable': '無効化',
        'delete_cookie': '削除',
        'click_to_select': 'クリックしてファイルを選択',
        'cookie_json': 'Cookie (.json)',
        'confirm_delete_tiktok': 'TikTok Cookieを削除しますか？',
        'confirm_delete_facebook': 'Facebook Cookieを削除しますか？',
        
        # === Proxy Settings ===
        'proxy_settings': 'プロキシ設定',
        'proxy_settings_desc': '大量取得時のIPブロックを避けるためにプロキシを設定',
        'proxy_count': 'プロキシ数',
        'rotation_mode': 'ローテーションモード',
        'proxy_status': 'ステータス',
        'delete_all': 'すべて削除',
        'confirm_delete_proxy': 'すべてのプロキシを削除しますか？',
        'proxy_list': 'プロキシリスト',
        'proxy_list_hint': '1行に1つのプロキシ',
        'proxy_placeholder': 'http://ip:port\nhttp://user:pass@ip:port\nsocks5://ip:port\nip:port',
        'proxy_support': '対応：HTTP、HTTPS、SOCKS4、SOCKS5。認証あり/なし両対応。',
        'rotation_random': 'ランダム',
        'rotation_random_desc': 'ランダム',
        'rotation_sequential': '順次',
        'rotation_sequential_desc': '順次',
        'save_proxy': 'プロキシ保存',
        
        # === Proxy Tips ===
        'proxy_tips_title': 'プロキシ使用のヒント',
        'proxy_tip_1': '検出を避けるためにレジデンシャルプロキシを使用',
        'proxy_tip_2': 'ローテーション用に複数のプロキシを使用（単一IPブロック回避）',
        'proxy_tip_3': 'データセンタープロキシはブロックされやすい',
        'proxy_tip_4': '使用前にプロキシが動作することを確認',
        
        # === Scraper Settings ===
        'scraper_settings': 'スクレイパー設定',
        'scraper_settings_desc': '取得モードとキャプチャ処理を設定',
        'headless_mode': 'ヘッドレスモード',
        'on': 'オン',
        'off': 'オフ',
        'headless_tip_title': 'ヘッドレスモードをオフにするタイミング',
        'headless_tip_1': 'TikTokがキャプチャを表示：手動でキャプチャを解決するためにヘッドレスをオフ',
        
        # === Cookie Guide ===
        'cookie_guide_title': 'Cookie取得ガイド',
        'cookie_guide_step1': '拡張機能をインストール：',
        'cookie_guide_step1_desc': 'ダウンロード',
        'cookie_guide_or': 'または',
        'cookie_guide_step2': 'ログイン：',
        'cookie_guide_step2_desc': 'tiktok.comまたはfacebook.comを開いてアカウントにログイン',
        'cookie_guide_step3': 'Cookieエクスポート：',
        'cookie_guide_step3_desc': '拡張機能をクリック > Export (JSON)',
        'cookie_guide_step4': 'アップロード：',
        'cookie_guide_step4_desc': '上記の対応するプラットフォームにJSONファイルをアップロード',
        'security_note_title': 'セキュリティ注意',
        'security_note': 'Cookieにはログイン情報が含まれています。他人と共有しないでください！',
        
        # === History Detail ===
        'scrape_detail': '取得詳細',
        'original_url': '元のURL',
        'scrape_time': '取得時間',
        'stt': '番号',
        'content': '内容',
        'likes': 'いいね',
        
        # === Toast Messages ===
        'please_enter_url': '動画URLを入力してください',
        'invalid_url': 'URLはTikTokまたはFacebookのリンクである必要があります',
        'scrape_success': '{count}件のコメントを取得しました！',
        'error_occurred': 'エラーが発生しました',
        'connection_error': '接続エラー。もう一度お試しください！',
        'delete_success': '削除しました！',
        'confirm_delete_history': 'この履歴を削除してもよろしいですか？',
        'loading': '読み込み中...',
        
        # === JavaScript Toast Messages ===
        'toast_enter_url': '動画URLを入力してください',
        'toast_invalid_url': 'URLはTikTokまたはFacebookのリンクである必要があります',
        'toast_scrape_success': '{count}件のコメントを取得しました！',
        'toast_error': 'エラーが発生しました',
        'toast_connection_error': 'サーバー接続エラー。もう一度お試しください。',
        'toast_confirm_delete': 'この履歴を削除してもよろしいですか？',
        'toast_delete_success': '履歴を削除しました',
        'toast_copied': 'クリップボードにコピーしました',
        'toast_copy_failed': 'コピーできません',
        'loading_comments': 'コメント読み込み中...',
        'scraped': '取得済み',
        'completed': '完了',
        
        # === Relative Time ===
        'just_now': 'たった今',
        'minutes_ago': '{count}分前',
        'hours_ago': '{count}時間前',
        'days_ago': '{count}日前',
        
        # === Language ===
        'language': '言語',
        'vietnamese': 'Tiếng Việt',
        'english': 'English',
        'chinese': '简体中文',
        'japanese': '日本語',
        
        # === Theme ===
        'theme': 'テーマ',
        'theme_light': 'ライト',
        'theme_dark': 'ダーク',
        'theme_system': 'システム',
    }
}


def get_translation(lang: str, key: str, **kwargs) -> str:
    """
    Lấy bản dịch theo key và ngôn ngữ
    
    Args:
        lang: Mã ngôn ngữ (vi, en)
        key: Key của bản dịch
        **kwargs: Các biến cần thay thế trong bản dịch
        
    Returns:
        str: Bản dịch hoặc key nếu không tìm thấy
    """
    # Mặc định tiếng Việt nếu ngôn ngữ không hỗ trợ
    if lang not in TRANSLATIONS:
        lang = 'vi'
    
    # Lấy bản dịch
    text = TRANSLATIONS[lang].get(key, key)
    
    # Thay thế các biến
    if kwargs:
        for k, v in kwargs.items():
            text = text.replace('{' + k + '}', str(v))
    
    return text


def get_all_translations(lang: str) -> dict:
    """
    Lấy tất cả bản dịch cho một ngôn ngữ
    
    Args:
        lang: Mã ngôn ngữ (vi, en)
        
    Returns:
        dict: Dictionary chứa tất cả bản dịch
    """
    if lang not in TRANSLATIONS:
        lang = 'vi'
    return TRANSLATIONS[lang]
