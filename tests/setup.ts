// Tests never touch the development database.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://postgres:postgres@127.0.0.1:5433/portfolio_test?schema=public";
process.env.AUTH_SECRET = process.env.AUTH_SECRET || "test-secret-not-used-in-production";
process.env.UPLOAD_DIR = process.env.UPLOAD_DIR || "./storage/test-uploads";
