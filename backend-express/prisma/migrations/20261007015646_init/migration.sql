-- CreateTable
CREATE TABLE "UserTestt" (
    "email" TEXT NOT NULL,
    "id" SERIAL NOT NULL,
    "name" TEXT,

    CONSTRAINT "UserTestt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserTestt_email_key" ON "UserTestt"("email");
