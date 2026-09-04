-- SystemSetting table for storing admin-configurable settings (SMTP, APIs, etc.)
CREATE TABLE IF NOT EXISTS "system_settings" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insert default SMTP settings
INSERT INTO "system_settings" ("key", "value", "category", "updated_at") VALUES
    ('smtp_host', '', 'smtp', CURRENT_TIMESTAMP),
    ('smtp_port', '587', 'smtp', CURRENT_TIMESTAMP),
    ('smtp_user', '', 'smtp', CURRENT_TIMESTAMP),
    ('smtp_pass', '', 'smtp', CURRENT_TIMESTAMP),
    ('smtp_from', 'GymAura <noreply@gymaura.com>', 'smtp', CURRENT_TIMESTAMP),
    ('smtp_enabled', 'false', 'smtp', CURRENT_TIMESTAMP),
    ('app_name', 'GymAura', 'general', CURRENT_TIMESTAMP),
    ('default_max_clients', '10', 'general', CURRENT_TIMESTAMP),
    ('require_email_verify', 'false', 'general', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
