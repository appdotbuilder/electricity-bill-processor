import { z } from 'zod';

// Electricity bill schema
export const electricityBillSchema = z.object({
  id: z.number(),
  filename: z.string(),
  upload_id: z.number(),
  total_amount: z.number(), // Total a pagar (original value)
  energy_consumption: z.number(), // Consumo de energia em kWh
  bill_date: z.coerce.date(), // Date from the bill
  corrected_amount: z.number().nullable(), // SELIC corrected value
  extraction_status: z.enum(['pending', 'success', 'error']),
  error_message: z.string().nullable(),
  created_at: z.coerce.date()
});

export type ElectricityBill = z.infer<typeof electricityBillSchema>;

// Upload batch schema
export const uploadBatchSchema = z.object({
  id: z.number(),
  filename: z.string(), // Original ZIP filename
  total_files: z.number(),
  processed_files: z.number(),
  failed_files: z.number(),
  status: z.enum(['processing', 'completed', 'failed']),
  created_at: z.coerce.date(),
  completed_at: z.coerce.date().nullable()
});

export type UploadBatch = z.infer<typeof uploadBatchSchema>;

// SELIC rate schema for historical data
export const selicRateSchema = z.object({
  id: z.number(),
  date: z.coerce.date(),
  rate: z.number(), // Monthly SELIC rate as percentage
  created_at: z.coerce.date()
});

export type SelicRate = z.infer<typeof selicRateSchema>;

// Input schema for uploading ZIP file
export const uploadZipInputSchema = z.object({
  filename: z.string(),
  file_size: z.number(),
  file_count: z.number() // Expected number of files in ZIP
});

export type UploadZipInput = z.infer<typeof uploadZipInputSchema>;

// Input schema for processing individual bill
export const processBillInputSchema = z.object({
  upload_id: z.number(),
  filename: z.string(),
  file_buffer: z.instanceof(Buffer) // File content as buffer
});

export type ProcessBillInput = z.infer<typeof processBillInputSchema>;

// Input schema for updating bill processing result
export const updateBillResultInputSchema = z.object({
  id: z.number(),
  total_amount: z.number().optional(),
  energy_consumption: z.number().optional(),
  bill_date: z.coerce.date().optional(),
  corrected_amount: z.number().nullable().optional(),
  extraction_status: z.enum(['pending', 'success', 'error']),
  error_message: z.string().nullable().optional()
});

export type UpdateBillResultInput = z.infer<typeof updateBillResultInputSchema>;

// Output schema for consolidated report
export const consolidatedReportSchema = z.object({
  bills: z.array(electricityBillSchema),
  summary: z.object({
    total_bills: z.number(),
    successful_extractions: z.number(),
    failed_extractions: z.number(),
    total_original_amount: z.number(),
    total_corrected_amount: z.number(),
    total_energy_consumption: z.number()
  })
});

export type ConsolidatedReport = z.infer<typeof consolidatedReportSchema>;

// Input schema for generating report
export const generateReportInputSchema = z.object({
  upload_id: z.number(),
  format: z.enum(['excel', 'csv'])
});

export type GenerateReportInput = z.infer<typeof generateReportInputSchema>;

// Response schema for file upload
export const uploadResponseSchema = z.object({
  upload_id: z.number(),
  message: z.string(),
  status: z.string()
});

export type UploadResponse = z.infer<typeof uploadResponseSchema>;

// Input schema for getting upload status
export const getUploadStatusInputSchema = z.object({
  upload_id: z.number()
});

export type GetUploadStatusInput = z.infer<typeof getUploadStatusInputSchema>;

// Response schema for upload status
export const uploadStatusResponseSchema = z.object({
  upload: uploadBatchSchema,
  bills: z.array(electricityBillSchema)
});

export type UploadStatusResponse = z.infer<typeof uploadStatusResponseSchema>;