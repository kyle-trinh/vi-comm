/*
  Warnings:

  - Added the required column `slug` to the `ListingCategory` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ListingCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ListingCategory" ("createdAt", "description", "id", "title", "updatedAt") SELECT "createdAt", "description", "id", "title", "updatedAt" FROM "ListingCategory";
DROP TABLE "ListingCategory";
ALTER TABLE "new_ListingCategory" RENAME TO "ListingCategory";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
