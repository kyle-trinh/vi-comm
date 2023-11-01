-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Listing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "listingCategoryId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    CONSTRAINT "Listing_listingCategoryId_fkey" FOREIGN KEY ("listingCategoryId") REFERENCES "ListingCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Listing_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "ListingCity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Listing_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Listing" ("cityId", "createdAt", "description", "id", "isFeatured", "listingCategoryId", "ownerId", "title", "updatedAt") SELECT "cityId", "createdAt", "description", "id", "isFeatured", "listingCategoryId", "ownerId", "title", "updatedAt" FROM "Listing";
DROP TABLE "Listing";
ALTER TABLE "new_Listing" RENAME TO "Listing";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
