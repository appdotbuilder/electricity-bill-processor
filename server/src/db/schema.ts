import { serial, text, pgTable, timestamp, numeric, integer, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums for status fields
export const extractionStatusEnum = pgEnum('extraction_status', ['pending', 'success', 'error']);
export const uploadStatusEnum = pgEnum('upload_status', ['processing', 'completed', 'failed']);

// Upload batches table - tracks ZIP file uploads
export const uploadBatchesTable = pgTable('upload_batches', {
  id: serial('id').primaryKey(),
  filename: text('filename').notNull(), // Original ZIP filename
  total_files: integer('total_files').notNull(),
  processed_files: integer('processed_files').notNull().default(0),
  failed_files: integer('failed_files').notNull().default(0),
  status: uploadStatusEnum('status').notNull().default('processing'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  completed_at: timestamp('completed_at'), // Nullable - set when processing completes
});

// Electricity bills table - stores individual bill data
export const electricityBillsTable = pgTable('electricity_bills', {
  id: serial('id').primaryKey(),
  filename: text('filename').notNull(), // Individual file name within ZIP
  upload_id: integer('upload_id').notNull(), // Foreign key to upload_batches
  total_amount: numeric('total_amount', { precision: 10, scale: 2 }), // Total a pagar (nullable until extracted)
  energy_consumption: numeric('energy_consumption', { precision: 10, scale: 2 }), // kWh consumption (nullable until extracted)
  bill_date: timestamp('bill_date'), // Date from bill (nullable until extracted)
  corrected_amount: numeric('corrected_amount', { precision: 10, scale: 2 }), // SELIC corrected value (nullable)
  extraction_status: extractionStatusEnum('extraction_status').notNull().default('pending'),
  error_message: text('error_message'), // Error details if extraction fails (nullable)
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// SELIC rates table - historical SELIC data for corrections
export const selicRatesTable = pgTable('selic_rates', {
  id: serial('id').primaryKey(),
  date: timestamp('date').notNull(), // Month/year for the rate
  rate: numeric('rate', { precision: 6, scale: 4 }).notNull(), // Monthly SELIC rate as percentage (e.g., 0.0125 for 1.25%)
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Relations between tables
export const uploadBatchesRelations = relations(uploadBatchesTable, ({ many }) => ({
  bills: many(electricityBillsTable),
}));

export const electricityBillsRelations = relations(electricityBillsTable, ({ one }) => ({
  uploadBatch: one(uploadBatchesTable, {
    fields: [electricityBillsTable.upload_id],
    references: [uploadBatchesTable.id],
  }),
}));

// TypeScript types for table operations
export type UploadBatch = typeof uploadBatchesTable.$inferSelect; // For SELECT operations
export type NewUploadBatch = typeof uploadBatchesTable.$inferInsert; // For INSERT operations

export type ElectricityBill = typeof electricityBillsTable.$inferSelect; // For SELECT operations
export type NewElectricityBill = typeof electricityBillsTable.$inferInsert; // For INSERT operations

export type SelicRate = typeof selicRatesTable.$inferSelect; // For SELECT operations
export type NewSelicRate = typeof selicRatesTable.$inferInsert; // For INSERT operations

// Export all tables and relations for proper query building
export const tables = {
  uploadBatches: uploadBatchesTable,
  electricityBills: electricityBillsTable,
  selicRates: selicRatesTable
};

export const tableRelations = {
  uploadBatchesRelations,
  electricityBillsRelations
};