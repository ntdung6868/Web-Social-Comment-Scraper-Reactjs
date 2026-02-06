-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "plan_type" TEXT NOT NULL DEFAULT 'FREE',
    "plan_status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "trial_uses" INTEGER NOT NULL DEFAULT 3,
    "max_trial_uses" INTEGER NOT NULL DEFAULT 3,
    "subscription_start" DATETIME,
    "subscription_end" DATETIME,
    "is_banned" BOOLEAN NOT NULL DEFAULT false,
    "ban_reason" TEXT,
    "banned_at" DATETIME,
    "reset_token" TEXT,
    "reset_token_expiry" DATETIME,
    "last_password_change" DATETIME,
    "last_email_change" DATETIME,
    "last_password_reset_request" DATETIME,
    "tiktok_cookie_file" TEXT,
    "tiktok_cookie_data" TEXT,
    "tiktok_cookie_user_agent" TEXT,
    "tiktok_cookie_valid_at" DATETIME,
    "tiktok_cookie_status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "use_tiktok_cookie" BOOLEAN NOT NULL DEFAULT false,
    "facebook_cookie_file" TEXT,
    "facebook_cookie_data" TEXT,
    "facebook_cookie_user_agent" TEXT,
    "facebook_cookie_valid_at" DATETIME,
    "facebook_cookie_status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "use_facebook_cookie" BOOLEAN NOT NULL DEFAULT false,
    "proxy_enabled" BOOLEAN NOT NULL DEFAULT false,
    "proxy_list" TEXT,
    "proxy_rotation" TEXT NOT NULL DEFAULT 'RANDOM',
    "current_proxy_index" INTEGER NOT NULL DEFAULT 0,
    "headless_mode" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "token_hash" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "revoked_at" DATETIME,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "device_info" TEXT,
    CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "scrape_histories" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "platform" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "total_comments" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "scrape_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "comments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "scrape_history_id" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "timestamp" TEXT,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "scraped_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "comments_scrape_history_id_fkey" FOREIGN KEY ("scrape_history_id") REFERENCES "scrape_histories" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "global_settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "value" TEXT,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" INTEGER
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_reset_token_key" ON "users"("reset_token");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "scrape_histories_user_id_idx" ON "scrape_histories"("user_id");

-- CreateIndex
CREATE INDEX "scrape_histories_created_at_idx" ON "scrape_histories"("created_at");

-- CreateIndex
CREATE INDEX "comments_scrape_history_id_idx" ON "comments"("scrape_history_id");

-- CreateIndex
CREATE UNIQUE INDEX "global_settings_key_key" ON "global_settings"("key");

-- CreateIndex
CREATE INDEX "global_settings_key_idx" ON "global_settings"("key");
