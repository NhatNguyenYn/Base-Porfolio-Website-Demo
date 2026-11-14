-- CreateTable
CREATE TABLE "Survey" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "coverMediaId" TEXT,
    "themePreset" TEXT NOT NULL DEFAULT 'minimal',
    "layout" TEXT NOT NULL DEFAULT 'centered',
    "progressStyle" TEXT NOT NULL DEFAULT 'bar',
    "primaryColor" TEXT,
    "accentColor" TEXT,
    "backgroundColor" TEXT,
    "surfaceColor" TEXT,
    "textColor" TEXT,
    "buttonStyle" TEXT NOT NULL DEFAULT 'solid',
    "borderRadius" TEXT NOT NULL DEFAULT 'md',
    "estimatedMinutes" INTEGER,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "isBookingIntake" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Survey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyTranslation" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "introduction" TEXT NOT NULL DEFAULT '',
    "completionMessage" TEXT NOT NULL DEFAULT '',
    "privacyNotice" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "SurveyTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveySection" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SurveySection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveySectionTranslation" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "SurveySectionTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyQuestion" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "sectionId" TEXT,
    "type" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "minLength" INTEGER,
    "maxLength" INTEGER,
    "minRating" INTEGER,
    "maxRating" INTEGER,

    CONSTRAINT "SurveyQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyQuestionTranslation" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "placeholder" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "SurveyQuestionTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyQuestionOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SurveyQuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyQuestionOptionTranslation" (
    "id" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "SurveyQuestionOptionTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyResponse" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "respondentKey" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyAnswer" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "optionId" TEXT,
    "value" TEXT NOT NULL,

    CONSTRAINT "SurveyAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingService" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "intakeSurveyId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingServiceTranslation" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "BookingServiceTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingSlot" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "referenceCode" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "surveyResponseId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "flowerCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Survey_slug_key" ON "Survey"("slug");

-- CreateIndex
CREATE INDEX "Survey_status_publishedAt_idx" ON "Survey"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "Survey_deletedAt_idx" ON "Survey"("deletedAt");

-- CreateIndex
CREATE INDEX "SurveyTranslation_locale_idx" ON "SurveyTranslation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyTranslation_surveyId_locale_key" ON "SurveyTranslation"("surveyId", "locale");

-- CreateIndex
CREATE INDEX "SurveySection_surveyId_order_idx" ON "SurveySection"("surveyId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "SurveySectionTranslation_sectionId_locale_key" ON "SurveySectionTranslation"("sectionId", "locale");

-- CreateIndex
CREATE INDEX "SurveyQuestion_surveyId_order_idx" ON "SurveyQuestion"("surveyId", "order");

-- CreateIndex
CREATE INDEX "SurveyQuestion_sectionId_order_idx" ON "SurveyQuestion"("sectionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyQuestionTranslation_questionId_locale_key" ON "SurveyQuestionTranslation"("questionId", "locale");

-- CreateIndex
CREATE INDEX "SurveyQuestionOption_questionId_order_idx" ON "SurveyQuestionOption"("questionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyQuestionOption_questionId_value_key" ON "SurveyQuestionOption"("questionId", "value");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyQuestionOptionTranslation_optionId_locale_key" ON "SurveyQuestionOptionTranslation"("optionId", "locale");

-- CreateIndex
CREATE INDEX "SurveyResponse_surveyId_submittedAt_idx" ON "SurveyResponse"("surveyId", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyResponse_surveyId_respondentKey_key" ON "SurveyResponse"("surveyId", "respondentKey");

-- CreateIndex
CREATE INDEX "SurveyAnswer_responseId_questionId_idx" ON "SurveyAnswer"("responseId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingService_slug_key" ON "BookingService"("slug");

-- CreateIndex
CREATE INDEX "BookingService_active_order_idx" ON "BookingService"("active", "order");

-- CreateIndex
CREATE UNIQUE INDEX "BookingServiceTranslation_serviceId_locale_key" ON "BookingServiceTranslation"("serviceId", "locale");

-- CreateIndex
CREATE INDEX "BookingSlot_serviceId_startsAt_status_idx" ON "BookingSlot"("serviceId", "startsAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BookingSlot_serviceId_startsAt_key" ON "BookingSlot"("serviceId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_referenceCode_key" ON "Booking"("referenceCode");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_surveyResponseId_key" ON "Booking"("surveyResponseId");

-- CreateIndex
CREATE INDEX "Booking_status_createdAt_idx" ON "Booking"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Booking_serviceId_idx" ON "Booking"("serviceId");

-- CreateIndex
CREATE INDEX "Booking_email_idx" ON "Booking"("email");

-- AddForeignKey
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyTranslation" ADD CONSTRAINT "SurveyTranslation_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveySection" ADD CONSTRAINT "SurveySection_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveySectionTranslation" ADD CONSTRAINT "SurveySectionTranslation_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "SurveySection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyQuestion" ADD CONSTRAINT "SurveyQuestion_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyQuestion" ADD CONSTRAINT "SurveyQuestion_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "SurveySection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyQuestionTranslation" ADD CONSTRAINT "SurveyQuestionTranslation_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "SurveyQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyQuestionOption" ADD CONSTRAINT "SurveyQuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "SurveyQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyQuestionOptionTranslation" ADD CONSTRAINT "SurveyQuestionOptionTranslation_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "SurveyQuestionOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyAnswer" ADD CONSTRAINT "SurveyAnswer_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "SurveyResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyAnswer" ADD CONSTRAINT "SurveyAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "SurveyQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyAnswer" ADD CONSTRAINT "SurveyAnswer_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "SurveyQuestionOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingService" ADD CONSTRAINT "BookingService_intakeSurveyId_fkey" FOREIGN KEY ("intakeSurveyId") REFERENCES "Survey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingServiceTranslation" ADD CONSTRAINT "BookingServiceTranslation_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "BookingService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSlot" ADD CONSTRAINT "BookingSlot_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "BookingService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "BookingService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "BookingSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_surveyResponseId_fkey" FOREIGN KEY ("surveyResponseId") REFERENCES "SurveyResponse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Partial unique indexes (Prisma has no partial-index syntax — hand-added).
-- One ACTIVE booking per slot: a cancelled/completed booking keeps its slotId
-- as history, but the slot can be re-booked.
CREATE UNIQUE INDEX "Booking_slotId_active_key"
  ON "Booking" ("slotId") WHERE "status" IN ('pending', 'confirmed');
-- One ACTIVE booking per flower: the flower is freed on cancel/complete.
CREATE UNIQUE INDEX "Booking_flowerCode_active_key"
  ON "Booking" ("flowerCode") WHERE "status" IN ('pending', 'confirmed');
