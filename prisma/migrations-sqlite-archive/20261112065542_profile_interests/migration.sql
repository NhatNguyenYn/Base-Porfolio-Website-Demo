-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ProfileTranslation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shortBio" TEXT NOT NULL,
    "longBio" TEXT NOT NULL DEFAULT '',
    "interests" TEXT NOT NULL DEFAULT '',
    "philosophy" TEXT NOT NULL DEFAULT '',
    "futureGoals" TEXT NOT NULL DEFAULT '',
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    CONSTRAINT "ProfileTranslation_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ProfileTranslation" ("fullName", "futureGoals", "id", "locale", "longBio", "philosophy", "profileId", "seoDescription", "seoTitle", "shortBio", "title") SELECT "fullName", "futureGoals", "id", "locale", "longBio", "philosophy", "profileId", "seoDescription", "seoTitle", "shortBio", "title" FROM "ProfileTranslation";
DROP TABLE "ProfileTranslation";
ALTER TABLE "new_ProfileTranslation" RENAME TO "ProfileTranslation";
CREATE INDEX "ProfileTranslation_locale_idx" ON "ProfileTranslation"("locale");
CREATE UNIQUE INDEX "ProfileTranslation_profileId_locale_key" ON "ProfileTranslation"("profileId", "locale");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
