-- Business Connect — curated pilot enquiry intake.
--
-- A trust-first, pilot-scoped intake table (NOT a public marketplace, directory,
-- or automated matching system). Every row belongs to a pilot via "pilot_slug";
-- the engine is pilot-agnostic, so launching another pilot adds rows, not schema.
-- Submissions are private: reviewed and introduced manually, never auto-published.

-- CreateEnum
-- PENDING_CONFIRMATION is the initial (system) state: the enquiry is saved but the
-- contact email has not yet confirmed it via the double opt-in link. It becomes a
-- reviewable enquiry (NEW) only after confirmation.
CREATE TYPE "BusinessConnectStatus" AS ENUM ('PENDING_CONFIRMATION', 'NEW', 'REVIEWED', 'SHORTLISTED', 'MATCHED', 'REJECTED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "business_connect_submissions" (
    "id" TEXT NOT NULL,
    "pilot_slug" TEXT NOT NULL,
    "participant_type" TEXT NOT NULL,
    "looking_for" TEXT[],
    "looking_for_other" TEXT,
    "offering" TEXT[],
    "offering_other" TEXT,
    "company_name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "business_description" TEXT NOT NULL,
    "specific_ask" TEXT NOT NULL,
    "contact_name" TEXT NOT NULL,
    "contact_email" TEXT NOT NULL,
    "website" TEXT,
    "linkedin_url" TEXT,
    "phone" TEXT,
    "preferred_geography" TEXT,
    -- Trust / event context. The membership field is pilot-agnostic
    -- ("is_partner_member"); each pilot supplies its own question label.
    "attending_event" TEXT NOT NULL,
    "is_partner_member" TEXT NOT NULL,
    "referred_by" TEXT,
    "associated_chapter_or_org" TEXT,
    -- Explicit consent, never pre-checked. "consent_policy_version" records the
    -- privacy-notice version shown at collection time (GDPR auditability,
    -- PRD-0033); it is always supplied per-pilot by the application.
    "consent_to_review" BOOLEAN NOT NULL,
    "consent_manual_intro_understanding" BOOLEAN NOT NULL,
    "consent_to_share_selected_info" BOOLEAN NOT NULL DEFAULT false,
    "consent_policy_version" TEXT NOT NULL,
    -- Double opt-in email-ownership proof. Anonymous submitters have no account,
    -- so a row starts as PENDING_CONFIRMATION with the SHA-256 hash of a one-time
    -- link token; clicking the emailed link sets "email_confirmed_at" and promotes
    -- the row to NEW.
    "email_confirmation_token_hash" TEXT,
    "email_confirmed_at" TIMESTAMP(3),
    -- Invite-only access: the enquiry is tied to the per-email invite that
    -- admitted it (see "business_connect_invites"). Recorded for traceability.
    "invite_id" TEXT,
    "status" "BusinessConnectStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "admin_notes" TEXT,
    "match_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_connect_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- Invite-only access gate. Business Connect is not a public form: the pilot's
-- community organizer issues a per-email invite, and only a valid, unexpired,
-- unused invite token unlocks the submit form (with the contact email locked to
-- the invited address). Only the SHA-256 hash of the token is stored.
CREATE TABLE "business_connect_invites" (
    "id" TEXT NOT NULL,
    "pilot_slug" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "community_id" TEXT NOT NULL,
    "invited_by_user_id" TEXT NOT NULL,
    "note" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_connect_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "business_connect_submissions_email_confirmation_token_hash_key" ON "business_connect_submissions"("email_confirmation_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "business_connect_submissions_invite_id_key" ON "business_connect_submissions"("invite_id");

-- CreateIndex
CREATE INDEX "business_connect_submissions_pilot_slug_status_created_at_idx" ON "business_connect_submissions"("pilot_slug", "status", "created_at");

-- CreateIndex
CREATE INDEX "business_connect_submissions_status_created_at_idx" ON "business_connect_submissions"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "business_connect_invites_token_hash_key" ON "business_connect_invites"("token_hash");

-- CreateIndex
CREATE INDEX "business_connect_invites_community_id_created_at_idx" ON "business_connect_invites"("community_id", "created_at");

-- CreateIndex
CREATE INDEX "business_connect_invites_pilot_slug_email_idx" ON "business_connect_invites"("pilot_slug", "email");

-- AddForeignKey
ALTER TABLE "business_connect_submissions" ADD CONSTRAINT "business_connect_submissions_invite_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "business_connect_invites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_connect_invites" ADD CONSTRAINT "business_connect_invites_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_connect_invites" ADD CONSTRAINT "business_connect_invites_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
