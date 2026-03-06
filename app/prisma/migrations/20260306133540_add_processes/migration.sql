-- CreateTable
CREATE TABLE "process_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "process_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "processes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "processes" ADD CONSTRAINT "processes_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "process_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
