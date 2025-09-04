import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { uploadBatchesTable, electricityBillsTable } from '../db/schema';
import { type UploadZipInput } from '../schema';
import { uploadZip } from '../handlers/upload_zip';
import { eq } from 'drizzle-orm';

// Test input data
const testInput: UploadZipInput = {
  filename: 'electricity_bills_2023.zip',
  file_size: 2048000, // 2MB
  file_count: 5
};

describe('uploadZip', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create upload batch record', async () => {
    const result = await uploadZip(testInput);

    expect(result.upload_id).toBeDefined();
    expect(result.upload_id).toBeGreaterThan(0);
    expect(result.message).toContain('electricity_bills_2023.zip');
    expect(result.message).toContain('Processing 5 files');
    expect(result.status).toEqual('processing');
  });

  it('should save upload batch to database', async () => {
    const result = await uploadZip(testInput);

    const uploadBatches = await db.select()
      .from(uploadBatchesTable)
      .where(eq(uploadBatchesTable.id, result.upload_id))
      .execute();

    expect(uploadBatches).toHaveLength(1);
    const batch = uploadBatches[0];
    
    expect(batch.filename).toEqual('electricity_bills_2023.zip');
    expect(batch.total_files).toEqual(5);
    expect(batch.processed_files).toEqual(0);
    expect(batch.failed_files).toEqual(0);
    expect(batch.status).toEqual('processing');
    expect(batch.created_at).toBeInstanceOf(Date);
    expect(batch.completed_at).toBeNull();
  });

  it('should create electricity bill records for each file', async () => {
    const result = await uploadZip(testInput);

    const bills = await db.select()
      .from(electricityBillsTable)
      .where(eq(electricityBillsTable.upload_id, result.upload_id))
      .execute();

    expect(bills).toHaveLength(5);
    
    bills.forEach((bill, index) => {
      expect(bill.filename).toEqual(`bill_${index + 1}.pdf`);
      expect(bill.upload_id).toEqual(result.upload_id);
      expect(bill.extraction_status).toEqual('pending');
      expect(bill.total_amount).toBeNull();
      expect(bill.energy_consumption).toBeNull();
      expect(bill.bill_date).toBeNull();
      expect(bill.corrected_amount).toBeNull();
      expect(bill.error_message).toBeNull();
      expect(bill.created_at).toBeInstanceOf(Date);
    });
  });

  it('should handle single file ZIP', async () => {
    const singleFileInput: UploadZipInput = {
      filename: 'single_bill.zip',
      file_size: 512000,
      file_count: 1
    };

    const result = await uploadZip(singleFileInput);

    // Check upload batch
    const uploadBatches = await db.select()
      .from(uploadBatchesTable)
      .where(eq(uploadBatchesTable.id, result.upload_id))
      .execute();

    expect(uploadBatches).toHaveLength(1);
    expect(uploadBatches[0].total_files).toEqual(1);

    // Check bill records
    const bills = await db.select()
      .from(electricityBillsTable)
      .where(eq(electricityBillsTable.upload_id, result.upload_id))
      .execute();

    expect(bills).toHaveLength(1);
    expect(bills[0].filename).toEqual('bill_1.pdf');
  });

  it('should handle empty ZIP file', async () => {
    const emptyZipInput: UploadZipInput = {
      filename: 'empty.zip',
      file_size: 1024,
      file_count: 0
    };

    const result = await uploadZip(emptyZipInput);

    // Check upload batch is created
    const uploadBatches = await db.select()
      .from(uploadBatchesTable)
      .where(eq(uploadBatchesTable.id, result.upload_id))
      .execute();

    expect(uploadBatches).toHaveLength(1);
    expect(uploadBatches[0].total_files).toEqual(0);

    // Check no bill records are created
    const bills = await db.select()
      .from(electricityBillsTable)
      .where(eq(electricityBillsTable.upload_id, result.upload_id))
      .execute();

    expect(bills).toHaveLength(0);
  });

  it('should handle large ZIP file with many files', async () => {
    const largeZipInput: UploadZipInput = {
      filename: 'large_batch_2023.zip',
      file_size: 50000000, // 50MB
      file_count: 100
    };

    const result = await uploadZip(largeZipInput);

    // Check upload batch
    const uploadBatches = await db.select()
      .from(uploadBatchesTable)
      .where(eq(uploadBatchesTable.id, result.upload_id))
      .execute();

    expect(uploadBatches).toHaveLength(1);
    expect(uploadBatches[0].total_files).toEqual(100);

    // Check all bill records are created
    const bills = await db.select()
      .from(electricityBillsTable)
      .where(eq(electricityBillsTable.upload_id, result.upload_id))
      .execute();

    expect(bills).toHaveLength(100);
    
    // Verify filename pattern
    bills.forEach((bill, index) => {
      expect(bill.filename).toEqual(`bill_${index + 1}.pdf`);
      expect(bill.extraction_status).toEqual('pending');
    });
  });

  it('should create multiple upload batches independently', async () => {
    const input1: UploadZipInput = {
      filename: 'batch1.zip',
      file_size: 1000000,
      file_count: 3
    };

    const input2: UploadZipInput = {
      filename: 'batch2.zip',
      file_size: 2000000,
      file_count: 7
    };

    const result1 = await uploadZip(input1);
    const result2 = await uploadZip(input2);

    // Should have different upload IDs
    expect(result1.upload_id).not.toEqual(result2.upload_id);

    // Check first batch
    const bills1 = await db.select()
      .from(electricityBillsTable)
      .where(eq(electricityBillsTable.upload_id, result1.upload_id))
      .execute();

    expect(bills1).toHaveLength(3);

    // Check second batch
    const bills2 = await db.select()
      .from(electricityBillsTable)
      .where(eq(electricityBillsTable.upload_id, result2.upload_id))
      .execute();

    expect(bills2).toHaveLength(7);

    // Verify total records in database
    const allBatches = await db.select().from(uploadBatchesTable).execute();
    expect(allBatches).toHaveLength(2);

    const allBills = await db.select().from(electricityBillsTable).execute();
    expect(allBills).toHaveLength(10);
  });
});