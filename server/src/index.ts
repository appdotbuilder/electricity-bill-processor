import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';

// Import schema types
import {
  uploadZipInputSchema,
  getUploadStatusInputSchema,
  generateReportInputSchema,
  updateBillResultInputSchema,
  processBillInputSchema
} from './schema';

// Import handlers
import { uploadZip } from './handlers/upload_zip';
import { processBill } from './handlers/process_bill';
import { calculateSelicCorrection } from './handlers/calculate_selic_correction';
import { getUploadStatus } from './handlers/get_upload_status';
import { generateReport } from './handlers/generate_report';
import { loadSelicData, getAllSelicRates, getLatestSelicRate } from './handlers/load_selic_data';
import { updateBillResult, updateUploadBatchProgress } from './handlers/update_bill_result';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check endpoint
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Upload ZIP file containing electricity bills
  uploadZip: publicProcedure
    .input(uploadZipInputSchema)
    .mutation(({ input }) => uploadZip(input)),

  // Process individual electricity bill file
  processBill: publicProcedure
    .input(processBillInputSchema)
    .mutation(({ input }) => processBill(input)),

  // Get status of upload batch and associated bills
  getUploadStatus: publicProcedure
    .input(getUploadStatusInputSchema)
    .query(({ input }) => getUploadStatus(input)),

  // Generate consolidated report (Excel/CSV)
  generateReport: publicProcedure
    .input(generateReportInputSchema)
    .query(({ input }) => generateReport(input)),

  // Update bill processing result
  updateBillResult: publicProcedure
    .input(updateBillResultInputSchema)
    .mutation(({ input }) => updateBillResult(input)),

  // Load historical SELIC data from CSV
  loadSelicData: publicProcedure
    .mutation(() => loadSelicData()),

  // Get all available SELIC rates
  getAllSelicRates: publicProcedure
    .query(() => getAllSelicRates()),

  // Get the most recent SELIC rate
  getLatestSelicRate: publicProcedure
    .query(() => getLatestSelicRate()),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();