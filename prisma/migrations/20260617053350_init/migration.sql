-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING');

-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'TRIAL');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED', 'TRIAL');

-- CreateEnum
CREATE TYPE "BranchStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO', 'LOGO', 'BANNER', 'THUMBNAIL', 'ICON');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('TICKET_KIOSK', 'TICKET_PRINTER', 'QUEUE_DISPLAY', 'COUNTER_DISPLAY', 'OPERATOR_KEYBOARD', 'QR_SCANNER', 'MEDIA_DISPLAY');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ONLINE', 'OFFLINE', 'MAINTENANCE', 'UNREGISTERED');

-- CreateEnum
CREATE TYPE "QueueType" AS ENUM ('SEQUENTIAL', 'PRIORITY', 'SMART', 'APPOINTMENT');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('WAITING', 'CALLED', 'SERVING', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'TRANSFERRED');

-- CreateEnum
CREATE TYPE "QrCodeType" AS ENUM ('QUEUE', 'ORDER', 'CHECK_IN', 'PAGE', 'PROMOTION', 'PAYMENT', 'DEVICE');

-- CreateEnum
CREATE TYPE "QrTargetType" AS ENUM ('TICKET', 'ORDER', 'PAGE', 'BRANCH', 'PRODUCT', 'SERVICE');

-- CreateEnum
CREATE TYPE "PageStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ComponentType" AS ENUM ('TEXT', 'HEADING', 'IMAGE', 'VIDEO', 'BUTTON', 'FORM', 'MAP', 'QUEUE_BUTTON', 'ORDER_BUTTON', 'PRODUCT_GRID', 'FAQ', 'CAROUSEL', 'BANNER', 'HTML', 'QR_BLOCK', 'CONTACT_BLOCK', 'DIVIDER', 'SPACER');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID', 'PARTIAL', 'REFUNDED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'CLICK', 'PAYME', 'UZUM', 'STRIPE', 'PAYPAL', 'TELEGRAM_PAY');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('PUSH', 'SMS', 'EMAIL', 'TELEGRAM');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'DELIVERED', 'READ');

-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('PLATFORM_ADMIN', 'COMPANY_ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR', 'OPERATOR', 'CONTENT_MANAGER', 'VIEWER', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AdvertisementStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SCHEDULED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'ARRIVED', 'EXPIRED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'OUT_OF_STOCK', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'CALL_NEXT', 'COMPLETE_SERVICE', 'TRANSFER', 'PRINT_TICKET', 'SCAN_QR', 'DEVICE_CONNECT', 'DEVICE_DISCONNECT', 'PAYMENT', 'REFUND', 'PUBLISH_PAGE', 'TOGGLE_STATUS');

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "monthly_price" DECIMAL(12,2) NOT NULL,
    "yearly_price" DECIMAL(12,2) NOT NULL,
    "max_branches" INTEGER NOT NULL DEFAULT 1,
    "max_users" INTEGER NOT NULL DEFAULT 5,
    "max_devices" INTEGER NOT NULL DEFAULT 10,
    "max_storage_gb" INTEGER NOT NULL DEFAULT 5,
    "online_queue_enabled" BOOLEAN NOT NULL DEFAULT false,
    "ordering_enabled" BOOLEAN NOT NULL DEFAULT false,
    "analytics_enabled" BOOLEAN NOT NULL DEFAULT false,
    "custom_domain_enabled" BOOLEAN NOT NULL DEFAULT false,
    "api_access_enabled" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_subscriptions" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "payment_method" "PaymentMethod",
    "amount_paid" DECIMAL(12,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_users" (
    "id" UUID NOT NULL,
    "first_name" VARCHAR(80) NOT NULL,
    "last_name" VARCHAR(80) NOT NULL,
    "email" VARCHAR(200) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_roles" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_permissions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "module" VARCHAR(80) NOT NULL,

    CONSTRAINT "platform_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_user_roles" (
    "platform_user_id" UUID NOT NULL,
    "platform_role_id" UUID NOT NULL,

    CONSTRAINT "platform_user_roles_pkey" PRIMARY KEY ("platform_user_id","platform_role_id")
);

-- CreateTable
CREATE TABLE "platform_role_permissions" (
    "platform_role_id" UUID NOT NULL,
    "platform_permission_id" UUID NOT NULL,

    CONSTRAINT "platform_role_permissions_pkey" PRIMARY KEY ("platform_role_id","platform_permission_id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "logo_media_id" UUID,
    "primary_color" VARCHAR(10),
    "secondary_color" VARCHAR(10),
    "phone" VARCHAR(30),
    "email" VARCHAR(200),
    "website" VARCHAR(255),
    "address" TEXT,
    "timezone" VARCHAR(60) NOT NULL DEFAULT 'Asia/Tashkent',
    "locale" VARCHAR(10) NOT NULL DEFAULT 'uz',
    "status" "CompanyStatus" NOT NULL DEFAULT 'TRIAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_users" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID,
    "first_name" VARCHAR(80) NOT NULL,
    "last_name" VARCHAR(80) NOT NULL,
    "email" VARCHAR(200) NOT NULL,
    "phone" VARCHAR(30),
    "password_hash" VARCHAR(255) NOT NULL,
    "avatar_url" VARCHAR(500),
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_roles" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "type" "RoleType" NOT NULL DEFAULT 'CUSTOM',
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_permissions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "module" VARCHAR(80) NOT NULL,

    CONSTRAINT "company_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_user_roles" (
    "company_user_id" UUID NOT NULL,
    "company_role_id" UUID NOT NULL,

    CONSTRAINT "company_user_roles_pkey" PRIMARY KEY ("company_user_id","company_role_id")
);

-- CreateTable
CREATE TABLE "company_role_permissions" (
    "company_role_id" UUID NOT NULL,
    "company_permission_id" UUID NOT NULL,

    CONSTRAINT "company_role_permissions_pkey" PRIMARY KEY ("company_role_id","company_permission_id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "user_type" VARCHAR(30) NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "ip_address" VARCHAR(50),
    "user_agent" VARCHAR(500),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "phone" VARCHAR(30),
    "email" VARCHAR(200),
    "address" TEXT,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "working_hours" JSONB,
    "timezone" VARCHAR(60),
    "status" "BranchStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_files" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "uploaded_by_id" UUID,
    "uploaded_by_type" VARCHAR(30),
    "type" "MediaType" NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "path" VARCHAR(500) NOT NULL,
    "cdn_url" VARCHAR(500),
    "thumbnail_url" VARCHAR(500),
    "duration_seconds" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "alt_text" VARCHAR(255),
    "metadata" JSONB,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "themes" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "primary_color" VARCHAR(10),
    "secondary_color" VARCHAR(10),
    "accent_color" VARCHAR(10),
    "background_color" VARCHAR(10),
    "text_color" VARCHAR(10),
    "font_family" VARCHAR(80),
    "border_radius" VARCHAR(20),
    "logo_media_id" UUID,
    "favicon_media_id" UUID,
    "custom_css" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "themes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pages" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "title" VARCHAR(255),
    "description" TEXT,
    "seo_title" VARCHAR(255),
    "seo_description" TEXT,
    "status" "PageStatus" NOT NULL DEFAULT 'DRAFT',
    "is_homepage" BOOLEAN NOT NULL DEFAULT false,
    "template" VARCHAR(80),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_versions" (
    "id" UUID NOT NULL,
    "page_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID,
    "snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_components" (
    "id" UUID NOT NULL,
    "page_version_id" UUID NOT NULL,
    "component_type" "ComponentType" NOT NULL,
    "parent_component_id" UUID,
    "x_position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "y_position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "width" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "height" DOUBLE PRECISION,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "col_span" INTEGER NOT NULL DEFAULT 12,
    "row_span" INTEGER NOT NULL DEFAULT 1,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "settings" JSONB,
    "styles" JSONB,
    "mobile_styles" JSONB,
    "animations" JSONB,
    "media_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "page_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menus" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "parent_id" UUID,
    "name" VARCHAR(120) NOT NULL,
    "label" VARCHAR(120),
    "icon_media_id" UUID,
    "icon_class" VARCHAR(80),
    "url" VARCHAR(500),
    "page_id" UUID,
    "target" VARCHAR(20),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "requires_auth" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "icon_media_id" UUID,
    "color" VARCHAR(10),
    "estimated_time_mins" INTEGER,
    "working_hours" JSONB,
    "priority_level" INTEGER NOT NULL DEFAULT 0,
    "status" "ServiceStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queue_groups" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "service_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "prefix" VARCHAR(10) NOT NULL,
    "number_format" VARCHAR(80) NOT NULL DEFAULT '{PREFIX}{NUM:3}',
    "queue_type" "QueueType" NOT NULL DEFAULT 'SEQUENTIAL',
    "daily_limit" INTEGER,
    "daily_reset_time" VARCHAR(10),
    "current_number" INTEGER NOT NULL DEFAULT 0,
    "priority_weight" INTEGER NOT NULL DEFAULT 0,
    "online_enabled" BOOLEAN NOT NULL DEFAULT false,
    "auto_recall_enabled" BOOLEAN NOT NULL DEFAULT false,
    "auto_recall_after_sec" INTEGER NOT NULL DEFAULT 30,
    "no_show_after_sec" INTEGER NOT NULL DEFAULT 300,
    "working_hours" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "queue_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counters" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "number" INTEGER NOT NULL,
    "description" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counter_queues" (
    "counter_id" UUID NOT NULL,
    "queue_group_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "counter_queues_pkey" PRIMARY KEY ("counter_id","queue_group_id")
);

-- CreateTable
CREATE TABLE "counter_sessions" (
    "id" UUID NOT NULL,
    "counter_id" UUID NOT NULL,
    "company_user_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "counter_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_templates" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "logo_media_id" UUID,
    "layout" JSONB NOT NULL,
    "width_mm" INTEGER NOT NULL DEFAULT 80,
    "height_mm" INTEGER NOT NULL DEFAULT 150,
    "footer_text" TEXT,
    "show_qr" BOOLEAN NOT NULL DEFAULT true,
    "show_barcode" BOOLEAN NOT NULL DEFAULT false,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" UUID NOT NULL,
    "queue_group_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "counter_id" UUID,
    "counter_session_id" UUID,
    "reservation_id" UUID,
    "customer_id" UUID,
    "served_by_id" UUID,
    "ticket_number" VARCHAR(30) NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'WAITING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "called_at" TIMESTAMP(3),
    "serving_started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "wait_time_sec" INTEGER,
    "service_time_sec" INTEGER,
    "is_online" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_history" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "from_status" "TicketStatus",
    "to_status" "TicketStatus" NOT NULL,
    "changed_by" UUID,
    "changed_type" VARCHAR(30),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queue_reservations" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "queue_group_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "reservation_time" TIMESTAMP(3) NOT NULL,
    "arrival_deadline" TIMESTAMP(3) NOT NULL,
    "arrival_method" VARCHAR(30),
    "confirmed_at" TIMESTAMP(3),
    "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "queue_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qr_codes" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID,
    "code" VARCHAR(100) NOT NULL,
    "type" "QrCodeType" NOT NULL,
    "target_type" "QrTargetType",
    "target_id" UUID,
    "image_media_id" UUID,
    "background_color" VARCHAR(10),
    "foreground_color" VARCHAR(10),
    "expires_at" TIMESTAMP(3),
    "scan_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qr_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qr_scans" (
    "id" UUID NOT NULL,
    "qr_code_id" UUID NOT NULL,
    "customer_id" UUID,
    "device_id" UUID,
    "ip_address" VARCHAR(50),
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qr_scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "first_name" VARCHAR(80),
    "last_name" VARCHAR(80),
    "phone" VARCHAR(30),
    "email" VARCHAR(200),
    "avatar_media_id" UUID,
    "birth_date" TIMESTAMP(3),
    "fcm_token" VARCHAR(500),
    "telegram_id" BIGINT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_favorites" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "parent_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "image_media_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "category_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "discount_price" DECIMAL(12,2),
    "sku" VARCHAR(100),
    "image_media_id" UUID,
    "preparation_time_mins" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_modifiers" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_modifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carts" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" UUID NOT NULL,
    "cart_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_item_modifiers" (
    "cart_item_id" UUID NOT NULL,
    "product_modifier_id" UUID NOT NULL,

    CONSTRAINT "cart_item_modifiers_pkey" PRIMARY KEY ("cart_item_id","product_modifier_id")
);

-- CreateTable
CREATE TABLE "order_stages" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "color" VARCHAR(10),
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_final" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "customer_id" UUID,
    "queue_ticket_id" UUID,
    "order_number" VARCHAR(30) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "payment_method" "PaymentMethod",
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "estimated_ready_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "total_price" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item_modifiers" (
    "order_item_id" UUID NOT NULL,
    "product_modifier_id" UUID NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "order_item_modifiers_pkey" PRIMARY KEY ("order_item_id","product_modifier_id")
);

-- CreateTable
CREATE TABLE "order_stage_history" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "stage_id" UUID NOT NULL,
    "entered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(3),
    "changed_by" UUID,

    CONSTRAINT "order_stage_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "external_id" VARCHAR(200),
    "gateway" VARCHAR(50),
    "payload" JSONB,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "counter_id" UUID,
    "device_type" "DeviceType" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "serial_number" VARCHAR(100),
    "ip_address" VARCHAR(50),
    "mac_address" VARCHAR(20),
    "firmware_version" VARCHAR(50),
    "auth_token" VARCHAR(255),
    "settings" JSONB,
    "status" "DeviceStatus" NOT NULL DEFAULT 'UNREGISTERED',
    "last_heartbeat" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_health_logs" (
    "id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "cpu_usage" DOUBLE PRECISION,
    "memory_usage" DOUBLE PRECISION,
    "disk_usage" DOUBLE PRECISION,
    "temperature" DOUBLE PRECISION,
    "uptime_seconds" INTEGER,
    "network_latency_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_health_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advertisements" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "media_id" UUID NOT NULL,
    "duration_sec" INTEGER NOT NULL DEFAULT 10,
    "url" VARCHAR(500),
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "status" "AdvertisementStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advertisements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_advertisements" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "advertisement_id" UUID NOT NULL,
    "device_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branch_advertisements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "title" VARCHAR(255),
    "body" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "customer_id" UUID,
    "template_id" UUID,
    "channel" "NotificationChannel" NOT NULL,
    "title" VARCHAR(255),
    "body" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "sent_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surveys" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_surveys" (
    "branch_id" UUID NOT NULL,
    "survey_id" UUID NOT NULL,

    CONSTRAINT "branch_surveys_pkey" PRIMARY KEY ("branch_id","survey_id")
);

-- CreateTable
CREATE TABLE "survey_questions" (
    "id" UUID NOT NULL,
    "survey_id" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "options" JSONB,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "survey_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_responses" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "customer_id" UUID,
    "ticket_id" UUID,
    "answer" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_snapshots" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID,
    "snapshot_date" DATE NOT NULL,
    "total_tickets" INTEGER NOT NULL DEFAULT 0,
    "completed_tickets" INTEGER NOT NULL DEFAULT 0,
    "cancelled_tickets" INTEGER NOT NULL DEFAULT 0,
    "no_show_tickets" INTEGER NOT NULL DEFAULT 0,
    "online_tickets" INTEGER NOT NULL DEFAULT 0,
    "avg_wait_time_sec" INTEGER,
    "avg_service_time_sec" INTEGER,
    "peak_hour" INTEGER,
    "total_orders" INTEGER NOT NULL DEFAULT 0,
    "total_revenue" DECIMAL(14,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "company_id" UUID,
    "platform_user_id" UUID,
    "company_user_id" UUID,
    "actor_type" VARCHAR(30),
    "action" "AuditAction" NOT NULL,
    "entity_type" VARCHAR(80),
    "entity_id" UUID,
    "branch_id" UUID,
    "ip_address" VARCHAR(50),
    "user_agent" VARCHAR(500),
    "before_state" JSONB,
    "after_state" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "company_subscriptions_company_id_idx" ON "company_subscriptions"("company_id");

-- CreateIndex
CREATE INDEX "company_subscriptions_status_idx" ON "company_subscriptions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "platform_users_email_key" ON "platform_users"("email");

-- CreateIndex
CREATE INDEX "platform_users_email_idx" ON "platform_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "platform_roles_name_key" ON "platform_roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "platform_permissions_code_key" ON "platform_permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");

-- CreateIndex
CREATE INDEX "companies_slug_idx" ON "companies"("slug");

-- CreateIndex
CREATE INDEX "companies_status_idx" ON "companies"("status");

-- CreateIndex
CREATE INDEX "company_users_company_id_idx" ON "company_users"("company_id");

-- CreateIndex
CREATE INDEX "company_users_branch_id_idx" ON "company_users"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_users_company_id_email_key" ON "company_users"("company_id", "email");

-- CreateIndex
CREATE INDEX "company_roles_company_id_idx" ON "company_roles"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_roles_company_id_name_key" ON "company_roles"("company_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "company_permissions_code_key" ON "company_permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_user_type_idx" ON "refresh_tokens"("user_id", "user_type");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "branches_company_id_idx" ON "branches"("company_id");

-- CreateIndex
CREATE INDEX "media_files_company_id_idx" ON "media_files"("company_id");

-- CreateIndex
CREATE INDEX "media_files_type_idx" ON "media_files"("type");

-- CreateIndex
CREATE INDEX "themes_company_id_idx" ON "themes"("company_id");

-- CreateIndex
CREATE INDEX "pages_company_id_idx" ON "pages"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "pages_company_id_slug_key" ON "pages"("company_id", "slug");

-- CreateIndex
CREATE INDEX "page_versions_page_id_idx" ON "page_versions"("page_id");

-- CreateIndex
CREATE INDEX "page_components_page_version_id_idx" ON "page_components"("page_version_id");

-- CreateIndex
CREATE INDEX "page_components_parent_component_id_idx" ON "page_components"("parent_component_id");

-- CreateIndex
CREATE INDEX "menus_company_id_idx" ON "menus"("company_id");

-- CreateIndex
CREATE INDEX "menus_parent_id_idx" ON "menus"("parent_id");

-- CreateIndex
CREATE INDEX "services_company_id_idx" ON "services"("company_id");

-- CreateIndex
CREATE INDEX "queue_groups_company_id_idx" ON "queue_groups"("company_id");

-- CreateIndex
CREATE INDEX "queue_groups_branch_id_idx" ON "queue_groups"("branch_id");

-- CreateIndex
CREATE INDEX "counters_company_id_idx" ON "counters"("company_id");

-- CreateIndex
CREATE INDEX "counters_branch_id_idx" ON "counters"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "counters_branch_id_number_key" ON "counters"("branch_id", "number");

-- CreateIndex
CREATE INDEX "counter_sessions_counter_id_idx" ON "counter_sessions"("counter_id");

-- CreateIndex
CREATE INDEX "ticket_templates_company_id_idx" ON "ticket_templates"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_reservation_id_key" ON "tickets"("reservation_id");

-- CreateIndex
CREATE INDEX "tickets_queue_group_id_idx" ON "tickets"("queue_group_id");

-- CreateIndex
CREATE INDEX "tickets_branch_id_idx" ON "tickets"("branch_id");

-- CreateIndex
CREATE INDEX "tickets_status_idx" ON "tickets"("status");

-- CreateIndex
CREATE INDEX "tickets_ticket_number_idx" ON "tickets"("ticket_number");

-- CreateIndex
CREATE INDEX "ticket_history_ticket_id_idx" ON "ticket_history"("ticket_id");

-- CreateIndex
CREATE INDEX "queue_reservations_customer_id_idx" ON "queue_reservations"("customer_id");

-- CreateIndex
CREATE INDEX "queue_reservations_queue_group_id_idx" ON "queue_reservations"("queue_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "qr_codes_code_key" ON "qr_codes"("code");

-- CreateIndex
CREATE INDEX "qr_codes_company_id_idx" ON "qr_codes"("company_id");

-- CreateIndex
CREATE INDEX "qr_codes_code_idx" ON "qr_codes"("code");

-- CreateIndex
CREATE INDEX "qr_scans_qr_code_id_idx" ON "qr_scans"("qr_code_id");

-- CreateIndex
CREATE INDEX "customers_company_id_idx" ON "customers"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_company_id_phone_key" ON "customers"("company_id", "phone");

-- CreateIndex
CREATE INDEX "customer_favorites_customer_id_idx" ON "customer_favorites"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_favorites_customer_id_company_id_branch_id_key" ON "customer_favorites"("customer_id", "company_id", "branch_id");

-- CreateIndex
CREATE INDEX "product_categories_company_id_idx" ON "product_categories"("company_id");

-- CreateIndex
CREATE INDEX "products_company_id_idx" ON "products"("company_id");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "product_modifiers_product_id_idx" ON "product_modifiers"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "carts_customer_id_company_id_key" ON "carts"("customer_id", "company_id");

-- CreateIndex
CREATE INDEX "cart_items_cart_id_idx" ON "cart_items"("cart_id");

-- CreateIndex
CREATE INDEX "order_stages_company_id_idx" ON "order_stages"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_queue_ticket_id_key" ON "orders"("queue_ticket_id");

-- CreateIndex
CREATE INDEX "orders_company_id_idx" ON "orders"("company_id");

-- CreateIndex
CREATE INDEX "orders_branch_id_idx" ON "orders"("branch_id");

-- CreateIndex
CREATE INDEX "orders_order_number_idx" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_stage_history_order_id_idx" ON "order_stage_history"("order_id");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

-- CreateIndex
CREATE INDEX "devices_company_id_idx" ON "devices"("company_id");

-- CreateIndex
CREATE INDEX "devices_branch_id_idx" ON "devices"("branch_id");

-- CreateIndex
CREATE INDEX "device_health_logs_device_id_idx" ON "device_health_logs"("device_id");

-- CreateIndex
CREATE INDEX "advertisements_company_id_idx" ON "advertisements"("company_id");

-- CreateIndex
CREATE INDEX "branch_advertisements_branch_id_idx" ON "branch_advertisements"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "branch_advertisements_branch_id_advertisement_id_key" ON "branch_advertisements"("branch_id", "advertisement_id");

-- CreateIndex
CREATE INDEX "notification_templates_company_id_idx" ON "notification_templates"("company_id");

-- CreateIndex
CREATE INDEX "notifications_customer_id_idx" ON "notifications"("customer_id");

-- CreateIndex
CREATE INDEX "notifications_status_idx" ON "notifications"("status");

-- CreateIndex
CREATE INDEX "surveys_company_id_idx" ON "surveys"("company_id");

-- CreateIndex
CREATE INDEX "survey_questions_survey_id_idx" ON "survey_questions"("survey_id");

-- CreateIndex
CREATE INDEX "survey_responses_question_id_idx" ON "survey_responses"("question_id");

-- CreateIndex
CREATE INDEX "analytics_snapshots_company_id_idx" ON "analytics_snapshots"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_snapshots_company_id_branch_id_snapshot_date_key" ON "analytics_snapshots"("company_id", "branch_id", "snapshot_date");

-- CreateIndex
CREATE INDEX "audit_logs_company_id_idx" ON "audit_logs"("company_id");

-- CreateIndex
CREATE INDEX "audit_logs_platform_user_id_idx" ON "audit_logs"("platform_user_id");

-- CreateIndex
CREATE INDEX "audit_logs_company_user_id_idx" ON "audit_logs"("company_user_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "company_subscriptions" ADD CONSTRAINT "company_subscriptions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_subscriptions" ADD CONSTRAINT "company_subscriptions_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_user_roles" ADD CONSTRAINT "platform_user_roles_platform_user_id_fkey" FOREIGN KEY ("platform_user_id") REFERENCES "platform_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_user_roles" ADD CONSTRAINT "platform_user_roles_platform_role_id_fkey" FOREIGN KEY ("platform_role_id") REFERENCES "platform_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_role_permissions" ADD CONSTRAINT "platform_role_permissions_platform_role_id_fkey" FOREIGN KEY ("platform_role_id") REFERENCES "platform_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_role_permissions" ADD CONSTRAINT "platform_role_permissions_platform_permission_id_fkey" FOREIGN KEY ("platform_permission_id") REFERENCES "platform_permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_logo_media_id_fkey" FOREIGN KEY ("logo_media_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_users" ADD CONSTRAINT "company_users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_users" ADD CONSTRAINT "company_users_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_roles" ADD CONSTRAINT "company_roles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_user_roles" ADD CONSTRAINT "company_user_roles_company_user_id_fkey" FOREIGN KEY ("company_user_id") REFERENCES "company_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_user_roles" ADD CONSTRAINT "company_user_roles_company_role_id_fkey" FOREIGN KEY ("company_role_id") REFERENCES "company_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_role_permissions" ADD CONSTRAINT "company_role_permissions_company_role_id_fkey" FOREIGN KEY ("company_role_id") REFERENCES "company_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_role_permissions" ADD CONSTRAINT "company_role_permissions_company_permission_id_fkey" FOREIGN KEY ("company_permission_id") REFERENCES "company_permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "themes" ADD CONSTRAINT "themes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "themes" ADD CONSTRAINT "themes_logo_media_id_fkey" FOREIGN KEY ("logo_media_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "themes" ADD CONSTRAINT "themes_favicon_media_id_fkey" FOREIGN KEY ("favicon_media_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_versions" ADD CONSTRAINT "page_versions_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_versions" ADD CONSTRAINT "page_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "company_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_components" ADD CONSTRAINT "page_components_page_version_id_fkey" FOREIGN KEY ("page_version_id") REFERENCES "page_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_components" ADD CONSTRAINT "page_components_parent_component_id_fkey" FOREIGN KEY ("parent_component_id") REFERENCES "page_components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_components" ADD CONSTRAINT "page_components_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menus" ADD CONSTRAINT "menus_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menus" ADD CONSTRAINT "menus_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "menus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menus" ADD CONSTRAINT "menus_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menus" ADD CONSTRAINT "menus_icon_media_id_fkey" FOREIGN KEY ("icon_media_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_icon_media_id_fkey" FOREIGN KEY ("icon_media_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_groups" ADD CONSTRAINT "queue_groups_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_groups" ADD CONSTRAINT "queue_groups_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_groups" ADD CONSTRAINT "queue_groups_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counters" ADD CONSTRAINT "counters_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counters" ADD CONSTRAINT "counters_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counter_queues" ADD CONSTRAINT "counter_queues_counter_id_fkey" FOREIGN KEY ("counter_id") REFERENCES "counters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counter_queues" ADD CONSTRAINT "counter_queues_queue_group_id_fkey" FOREIGN KEY ("queue_group_id") REFERENCES "queue_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counter_sessions" ADD CONSTRAINT "counter_sessions_counter_id_fkey" FOREIGN KEY ("counter_id") REFERENCES "counters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counter_sessions" ADD CONSTRAINT "counter_sessions_company_user_id_fkey" FOREIGN KEY ("company_user_id") REFERENCES "company_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_templates" ADD CONSTRAINT "ticket_templates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_templates" ADD CONSTRAINT "ticket_templates_logo_media_id_fkey" FOREIGN KEY ("logo_media_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_queue_group_id_fkey" FOREIGN KEY ("queue_group_id") REFERENCES "queue_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_counter_id_fkey" FOREIGN KEY ("counter_id") REFERENCES "counters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_counter_session_id_fkey" FOREIGN KEY ("counter_session_id") REFERENCES "counter_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "queue_reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_served_by_id_fkey" FOREIGN KEY ("served_by_id") REFERENCES "company_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_history" ADD CONSTRAINT "ticket_history_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_reservations" ADD CONSTRAINT "queue_reservations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_reservations" ADD CONSTRAINT "queue_reservations_queue_group_id_fkey" FOREIGN KEY ("queue_group_id") REFERENCES "queue_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_reservations" ADD CONSTRAINT "queue_reservations_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_image_media_id_fkey" FOREIGN KEY ("image_media_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_scans" ADD CONSTRAINT "qr_scans_qr_code_id_fkey" FOREIGN KEY ("qr_code_id") REFERENCES "qr_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_scans" ADD CONSTRAINT "qr_scans_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_scans" ADD CONSTRAINT "qr_scans_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_avatar_media_id_fkey" FOREIGN KEY ("avatar_media_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_favorites" ADD CONSTRAINT "customer_favorites_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_image_media_id_fkey" FOREIGN KEY ("image_media_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_image_media_id_fkey" FOREIGN KEY ("image_media_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_modifiers" ADD CONSTRAINT "product_modifiers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_item_modifiers" ADD CONSTRAINT "cart_item_modifiers_cart_item_id_fkey" FOREIGN KEY ("cart_item_id") REFERENCES "cart_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_item_modifiers" ADD CONSTRAINT "cart_item_modifiers_product_modifier_id_fkey" FOREIGN KEY ("product_modifier_id") REFERENCES "product_modifiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_stages" ADD CONSTRAINT "order_stages_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_queue_ticket_id_fkey" FOREIGN KEY ("queue_ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_modifiers" ADD CONSTRAINT "order_item_modifiers_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_modifiers" ADD CONSTRAINT "order_item_modifiers_product_modifier_id_fkey" FOREIGN KEY ("product_modifier_id") REFERENCES "product_modifiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_stage_history" ADD CONSTRAINT "order_stage_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_stage_history" ADD CONSTRAINT "order_stage_history_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "order_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_counter_id_fkey" FOREIGN KEY ("counter_id") REFERENCES "counters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_health_logs" ADD CONSTRAINT "device_health_logs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advertisements" ADD CONSTRAINT "advertisements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advertisements" ADD CONSTRAINT "advertisements_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_advertisements" ADD CONSTRAINT "branch_advertisements_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_advertisements" ADD CONSTRAINT "branch_advertisements_advertisement_id_fkey" FOREIGN KEY ("advertisement_id") REFERENCES "advertisements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_advertisements" ADD CONSTRAINT "branch_advertisements_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "notification_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_surveys" ADD CONSTRAINT "branch_surveys_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_surveys" ADD CONSTRAINT "branch_surveys_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_questions" ADD CONSTRAINT "survey_questions_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "survey_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_snapshots" ADD CONSTRAINT "analytics_snapshots_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_snapshots" ADD CONSTRAINT "analytics_snapshots_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_platform_user_id_fkey" FOREIGN KEY ("platform_user_id") REFERENCES "platform_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_company_user_id_fkey" FOREIGN KEY ("company_user_id") REFERENCES "company_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
