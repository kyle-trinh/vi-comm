/*
  Warnings:

  - A unique constraint covering the columns `[name,province]` on the table `ListingCity` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ListingCity_name_province_key" ON "ListingCity"("name", "province");
