-- CreateTable
CREATE TABLE "web_handoff_tokens" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "next" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "web_handoff_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "web_handoff_tokens_token_hash_key" ON "web_handoff_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "web_handoff_tokens_user_id_idx" ON "web_handoff_tokens"("user_id");

-- AddForeignKey
ALTER TABLE "web_handoff_tokens" ADD CONSTRAINT "web_handoff_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
