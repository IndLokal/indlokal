-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CategoryType" AS ENUM ('CATEGORY', 'PERSONA');

-- CreateEnum
CREATE TYPE "CommunityStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'UNVERIFIED', 'CLAIMED');

-- CreateEnum
CREATE TYPE "ClaimState" AS ENUM ('UNCLAIMED', 'CLAIM_PENDING', 'CLAIMED');

-- CreateEnum
CREATE TYPE "ContentSource" AS ENUM ('ADMIN_SEED', 'COMMUNITY_SUBMITTED', 'IMPORTED', 'USER_SUGGESTED');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('UPCOMING', 'ONGOING', 'PAST', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('WHATSAPP', 'TELEGRAM', 'WEBSITE', 'FACEBOOK', 'INSTAGRAM', 'EMAIL', 'MEETUP', 'YOUTUBE', 'LINKEDIN', 'OTHER');

-- CreateEnum
CREATE TYPE "ActivitySignalType" AS ENUM ('EVENT_CREATED', 'PROFILE_UPDATED', 'MEMBER_COUNT_CHANGED', 'LINK_VERIFIED', 'EVENT_IMPORTED', 'EXTERNAL_MENTION');

-- CreateEnum
CREATE TYPE "TrustSignalEntityType" AS ENUM ('COMMUNITY', 'EVENT');

-- CreateEnum
CREATE TYPE "TrustSignalType" AS ENUM ('ADMIN_VERIFIED', 'COMMUNITY_CLAIMED', 'USER_REPORTED_ACCURATE', 'USER_REPORTED_STALE', 'EDITORIAL_REVIEWED');

-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('RELATED_COMMUNITY', 'SISTER_CHAPTER', 'CO_HOSTED', 'PARENT_CHILD', 'SAME_ORGANIZER');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('CONSULAR_SERVICE', 'OFFICIAL_EVENT', 'GOVERNMENT_INFO', 'VISA_SERVICE', 'CITY_REGISTRATION', 'DRIVING', 'HOUSING', 'HEALTH_DOCTORS', 'FAMILY_CHILDREN', 'JOBS_CAREERS', 'TAX_FINANCE', 'BUSINESS_SETUP', 'GROCERY_FOOD', 'COMMUNITY_RESOURCE');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'COMMUNITY_ADMIN', 'PLATFORM_ADMIN');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('IOS', 'ANDROID', 'WEB');

-- CreateEnum
CREATE TYPE "NotificationTopic" AS ENUM ('CITY_NEW_EVENT', 'COMMUNITY_UPDATE', 'SAVED_EVENT_REMINDER', 'FESTIVAL', 'WEEKLY_DIGEST', 'ORGANIZER_RSVP', 'ORGANIZER_SUBMISSION', 'REENGAGEMENT');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('PUSH', 'EMAIL', 'INBOX');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('VIEW', 'CLICK_ACCESS', 'SAVE', 'SHARE', 'REPORT', 'SEARCH');

-- CreateEnum
CREATE TYPE "InteractionEntityType" AS ENUM ('COMMUNITY', 'EVENT', 'RESOURCE');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('STALE_INFO', 'BROKEN_LINK', 'INCORRECT_DETAILS', 'SUGGEST_COMMUNITY', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'REVIEWED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ContentLogAction" AS ENUM ('CREATED', 'UPDATED', 'VERIFIED', 'ARCHIVED', 'SCORE_REFRESHED');

-- CreateEnum
CREATE TYPE "PipelineEntityType" AS ENUM ('EVENT', 'COMMUNITY');

-- CreateEnum
CREATE TYPE "PipelineItemStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'MERGED');

-- CreateEnum
CREATE TYPE "PipelineReviewKind" AS ENUM ('DISCOVERY', 'ENRICHMENT');

-- CreateEnum
CREATE TYPE "PipelineSourceType" AS ENUM ('EVENTBRITE', 'FACEBOOK', 'INSTAGRAM', 'WEBSITE_SCRAPE', 'CGI_MUNICH', 'INDOEUROPEAN', 'GOOGLE_ALERT', 'GOOGLE_SEARCH', 'DUCKDUCKGO', 'MEETUP', 'COMMUNITY_SUGGESTION', 'DB_COMMUNITY', 'USER_SUBMITTED');

-- CreateEnum
CREATE TYPE "KeywordSuggestionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "cities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'Germany',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "population" INTEGER,
    "diaspora_density_estimate" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Berlin',
    "is_metro_primary" BOOLEAN NOT NULL DEFAULT false,
    "metro_region_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "CategoryType" NOT NULL DEFAULT 'CATEGORY',
    "parent_id" TEXT,
    "icon" TEXT,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "description_long" TEXT,
    "city_id" TEXT NOT NULL,
    "persona_segments" TEXT[],
    "languages" TEXT[],
    "founded_year" INTEGER,
    "member_count_approx" INTEGER,
    "status" "CommunityStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "claim_state" "ClaimState" NOT NULL DEFAULT 'UNCLAIMED',
    "claimed_by_user_id" TEXT,
    "merged_into_id" TEXT,
    "redirect_slug" TEXT,
    "logo_url" TEXT,
    "cover_image_url" TEXT,
    "metadata" JSONB,
    "source" "ContentSource" NOT NULL DEFAULT 'ADMIN_SEED',
    "activity_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trust_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completeness_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "score_breakdown" JSONB,
    "is_trending" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_activity_at" TIMESTAMP(3),
    "last_enriched_at" TIMESTAMP(3),

    CONSTRAINT "communities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_categories" (
    "community_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,

    CONSTRAINT "community_categories_pkey" PRIMARY KEY ("community_id","category_id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "community_id" TEXT,
    "city_id" TEXT NOT NULL,
    "venue_name" TEXT,
    "venue_address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrence_rule" TEXT,
    "is_online" BOOLEAN NOT NULL DEFAULT false,
    "online_link" TEXT,
    "registration_url" TEXT,
    "cost" TEXT,
    "image_url" TEXT,
    "status" "EventStatus" NOT NULL DEFAULT 'UPCOMING',
    "source" "ContentSource" NOT NULL DEFAULT 'ADMIN_SEED',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_categories" (
    "event_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,

    CONSTRAINT "event_categories_pkey" PRIMARY KEY ("event_id","category_id")
);

-- CreateTable
CREATE TABLE "access_channels" (
    "id" TEXT NOT NULL,
    "community_id" TEXT NOT NULL,
    "channel_type" "ChannelType" NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "last_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_signals" (
    "id" TEXT NOT NULL,
    "community_id" TEXT NOT NULL,
    "signal_type" "ActivitySignalType" NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "activity_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trust_signals" (
    "id" TEXT NOT NULL,
    "entity_type" "TrustSignalEntityType" NOT NULL,
    "community_id" TEXT,
    "event_id" TEXT,
    "signal_type" "TrustSignalType" NOT NULL,
    "created_by" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trust_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relationship_edges" (
    "id" TEXT NOT NULL,
    "source_community_id" TEXT NOT NULL,
    "target_community_id" TEXT NOT NULL,
    "relationship_type" "RelationshipType" NOT NULL,
    "strength" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relationship_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resources" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "resource_type" "ResourceType" NOT NULL,
    "city_id" TEXT NOT NULL,
    "url" TEXT,
    "description" TEXT,
    "valid_from" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),
    "source" "ContentSource" NOT NULL DEFAULT 'ADMIN_SEED',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT,
    "city_id" TEXT,
    "persona_segments" TEXT[],
    "preferred_languages" TEXT[],
    "onboarding_complete" BOOLEAN NOT NULL DEFAULT false,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "google_id" TEXT,
    "apple_id" TEXT,
    "avatar_url" TEXT,
    "session_token" TEXT,
    "session_token_expiry" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "magic_link_tokens" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "magic_link_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "device_id" TEXT,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "rotated_to_id" TEXT,
    "user_agent" TEXT,
    "ip" TEXT,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "installation_id" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "expo_push_token" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Berlin',
    "app_version" TEXT,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "user_id" TEXT NOT NULL,
    "topic" "NotificationTopic" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id","topic","channel")
);

-- CreateTable
CREATE TABLE "quiet_hours" (
    "user_id" TEXT NOT NULL,
    "start_min" INTEGER NOT NULL DEFAULT 1320,
    "end_min" INTEGER NOT NULL DEFAULT 480,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Berlin',

    CONSTRAINT "quiet_hours_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "notification_outbox" (
    "id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "topic" "NotificationTopic" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "payload" JSONB NOT NULL,
    "score_at_enqueue" DOUBLE PRECISION,
    "not_before" TIMESTAMP(3),
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "scheduled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),

    CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbox_items" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "topic" "NotificationTopic" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "deep_link" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbox_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_interactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "session_id" TEXT,
    "entity_type" "InteractionEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "interaction_type" "InteractionType" NOT NULL,
    "city_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_reports" (
    "id" TEXT NOT NULL,
    "report_type" "ReportType" NOT NULL,
    "community_id" TEXT,
    "suggested_name" TEXT,
    "city_id" TEXT,
    "details" TEXT,
    "reporter_email" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_communities" (
    "user_id" TEXT NOT NULL,
    "community_id" TEXT NOT NULL,
    "saved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_communities_pkey" PRIMARY KEY ("user_id","community_id")
);

-- CreateTable
CREATE TABLE "saved_events" (
    "user_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "saved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_events_pkey" PRIMARY KEY ("user_id","event_id")
);

-- CreateTable
CREATE TABLE "content_logs" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" "ContentLogAction" NOT NULL,
    "source" "ContentSource" NOT NULL DEFAULT 'ADMIN_SEED',
    "changed_by" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_items" (
    "id" TEXT NOT NULL,
    "entity_type" "PipelineEntityType" NOT NULL,
    "status" "PipelineItemStatus" NOT NULL DEFAULT 'PENDING',
    "review_kind" "PipelineReviewKind" NOT NULL DEFAULT 'DISCOVERY',
    "source_type" "PipelineSourceType" NOT NULL,
    "source_url" TEXT,
    "raw_content" TEXT,
    "extracted_data" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "city_id" TEXT NOT NULL,
    "matched_entity_id" TEXT,
    "match_score" DOUBLE PRECISION,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_notes" TEXT,
    "auto_approved" BOOLEAN NOT NULL DEFAULT false,
    "auto_approval_reason" TEXT,
    "target_entity_id" TEXT,
    "created_entity_id" TEXT,
    "image_key" TEXT,
    "submitted_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keyword_suggestions" (
    "id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "normalized_keyword" TEXT NOT NULL,
    "status" "KeywordSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "source_count" INTEGER NOT NULL DEFAULT 0,
    "evidence" JSONB,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "keyword_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cities_slug_key" ON "cities"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "communities_slug_key" ON "communities"("slug");

-- CreateIndex
CREATE INDEX "communities_city_id_idx" ON "communities"("city_id");

-- CreateIndex
CREATE INDEX "communities_activity_score_idx" ON "communities"("activity_score");

-- CreateIndex
CREATE INDEX "communities_status_idx" ON "communities"("status");

-- CreateIndex
CREATE INDEX "communities_city_id_status_idx" ON "communities"("city_id", "status");

-- CreateIndex
CREATE INDEX "communities_claim_state_idx" ON "communities"("claim_state");

-- CreateIndex
CREATE INDEX "communities_merged_into_id_idx" ON "communities"("merged_into_id");

-- CreateIndex
CREATE INDEX "communities_redirect_slug_idx" ON "communities"("redirect_slug");

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE INDEX "events_city_id_starts_at_idx" ON "events"("city_id", "starts_at");

-- CreateIndex
CREATE INDEX "events_community_id_idx" ON "events"("community_id");

-- CreateIndex
CREATE INDEX "events_community_id_starts_at_idx" ON "events"("community_id", "starts_at");

-- CreateIndex
CREATE INDEX "events_status_idx" ON "events"("status");

-- CreateIndex
CREATE INDEX "events_starts_at_idx" ON "events"("starts_at");

-- CreateIndex
CREATE INDEX "access_channels_community_id_idx" ON "access_channels"("community_id");

-- CreateIndex
CREATE INDEX "activity_signals_community_id_occurred_at_idx" ON "activity_signals"("community_id", "occurred_at");

-- CreateIndex
CREATE INDEX "trust_signals_community_id_idx" ON "trust_signals"("community_id");

-- CreateIndex
CREATE INDEX "trust_signals_event_id_idx" ON "trust_signals"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "relationship_edges_source_community_id_target_community_id__key" ON "relationship_edges"("source_community_id", "target_community_id", "relationship_type");

-- CreateIndex
CREATE UNIQUE INDEX "resources_slug_key" ON "resources"("slug");

-- CreateIndex
CREATE INDEX "resources_city_id_idx" ON "resources"("city_id");

-- CreateIndex
CREATE INDEX "resources_resource_type_idx" ON "resources"("resource_type");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_apple_id_key" ON "users"("apple_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_session_token_key" ON "users"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "magic_link_tokens_token_hash_key" ON "magic_link_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "magic_link_tokens_user_id_idx" ON "magic_link_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "devices_expo_push_token_idx" ON "devices"("expo_push_token");

-- CreateIndex
CREATE UNIQUE INDEX "devices_user_id_installation_id_key" ON "devices"("user_id", "installation_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_outbox_idempotency_key_key" ON "notification_outbox"("idempotency_key");

-- CreateIndex
CREATE INDEX "notification_outbox_status_scheduled_at_idx" ON "notification_outbox"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "notification_outbox_user_id_idx" ON "notification_outbox"("user_id");

-- CreateIndex
CREATE INDEX "inbox_items_user_id_created_at_idx" ON "inbox_items"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "user_interactions_entity_type_entity_id_idx" ON "user_interactions"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "user_interactions_user_id_idx" ON "user_interactions"("user_id");

-- CreateIndex
CREATE INDEX "user_interactions_city_id_created_at_idx" ON "user_interactions"("city_id", "created_at");

-- CreateIndex
CREATE INDEX "content_reports_status_created_at_idx" ON "content_reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "content_reports_community_id_idx" ON "content_reports"("community_id");

-- CreateIndex
CREATE INDEX "content_logs_entity_type_entity_id_idx" ON "content_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "content_logs_created_at_idx" ON "content_logs"("created_at");

-- CreateIndex
CREATE INDEX "pipeline_items_status_created_at_idx" ON "pipeline_items"("status", "created_at");

-- CreateIndex
CREATE INDEX "pipeline_items_city_id_idx" ON "pipeline_items"("city_id");

-- CreateIndex
CREATE INDEX "pipeline_items_entity_type_status_idx" ON "pipeline_items"("entity_type", "status");

-- CreateIndex
CREATE INDEX "pipeline_items_review_kind_status_idx" ON "pipeline_items"("review_kind", "status");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_key_key" ON "media_assets"("key");

-- CreateIndex
CREATE INDEX "media_assets_created_by_idx" ON "media_assets"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "keyword_suggestions_keyword_key" ON "keyword_suggestions"("keyword");

-- CreateIndex
CREATE UNIQUE INDEX "keyword_suggestions_normalized_keyword_key" ON "keyword_suggestions"("normalized_keyword");

-- CreateIndex
CREATE INDEX "keyword_suggestions_status_created_at_idx" ON "keyword_suggestions"("status", "created_at");

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_metro_region_id_fkey" FOREIGN KEY ("metro_region_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communities" ADD CONSTRAINT "communities_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communities" ADD CONSTRAINT "communities_claimed_by_user_id_fkey" FOREIGN KEY ("claimed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communities" ADD CONSTRAINT "communities_merged_into_id_fkey" FOREIGN KEY ("merged_into_id") REFERENCES "communities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_categories" ADD CONSTRAINT "community_categories_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_categories" ADD CONSTRAINT "community_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_categories" ADD CONSTRAINT "event_categories_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_categories" ADD CONSTRAINT "event_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_channels" ADD CONSTRAINT "access_channels_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_signals" ADD CONSTRAINT "activity_signals_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_signals" ADD CONSTRAINT "trust_signals_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_signals" ADD CONSTRAINT "trust_signals_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationship_edges" ADD CONSTRAINT "relationship_edges_source_community_id_fkey" FOREIGN KEY ("source_community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationship_edges" ADD CONSTRAINT "relationship_edges_target_community_id_fkey" FOREIGN KEY ("target_community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "magic_link_tokens" ADD CONSTRAINT "magic_link_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiet_hours" ADD CONSTRAINT "quiet_hours_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbox_items" ADD CONSTRAINT "inbox_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_interactions" ADD CONSTRAINT "user_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_interactions" ADD CONSTRAINT "user_interactions_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_communities" ADD CONSTRAINT "saved_communities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_communities" ADD CONSTRAINT "saved_communities_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_events" ADD CONSTRAINT "saved_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_events" ADD CONSTRAINT "saved_events_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_items" ADD CONSTRAINT "pipeline_items_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

