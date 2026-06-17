-- Account-backed resource saves (sync across devices)

-- CreateTable
CREATE TABLE "saved_resources" (
    "user_id" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "saved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_resources_pkey" PRIMARY KEY ("user_id", "resource_id")
);

-- CreateIndex
CREATE INDEX "saved_resources_user_saved_at_idx" ON "saved_resources"("user_id", "saved_at");

-- AddForeignKey
ALTER TABLE "saved_resources" ADD CONSTRAINT "saved_resources_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_resources" ADD CONSTRAINT "saved_resources_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
