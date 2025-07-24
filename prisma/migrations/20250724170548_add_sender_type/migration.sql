/*
  Warnings:

  - You are about to drop the column `roomId` on the `messages` table. All the data in the column will be lost.
  - Added the required column `sender_type` to the `messages` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SenderType" AS ENUM ('SELLER', 'CUSTOMER');

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_roomId_fkey";

-- AlterTable
ALTER TABLE "messages" DROP COLUMN "roomId",
ADD COLUMN     "room_id" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sender_type" "SenderType" NOT NULL;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
