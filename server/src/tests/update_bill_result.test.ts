import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { electricityBillsTable, uploadBatchesTable } from '../db/schema';
import { type UpdateBillResultInput } from '../schema';
import { updateBillResult, updateUploadBatchProgress } from '../handlers/update_bill_result';
import { eq } from 'drizzle-orm';

describe('updateBillResult', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create test upload batch
  const createTestBatch = async () => {
    const batches = await db.insert(uploadBatchesTable)
      .values({
        filename: 'test_batch.zip',
        total_files: 3,
        processed_files: 0,
        failed_files: 0,
        status: 'processing'
      })
      .returning()
      .execute();
    return batches[0];
  };

  // Helper function to create test bill
  const createTestBill = async (uploadId: number) => {
    const bills = await db.insert(electricityBillsTable)
      .values({
        filename: 'test_bill.pdf',
        upload_id: uploadId,
        extraction_status: 'pending'
      })
      .returning()
      .execute();
    return bills[0];
  };

  it('should update bill with successful extraction data', async () => {
    // Create test data
    const batch = await createTestBatch();
    const bill = await createTestBill(batch.id);

    const updateInput: UpdateBillResultInput = {
      id: bill.id,
      total_amount: 150.75,
      energy_consumption: 300.5,
      bill_date: new Date('2023-10-15'),
      corrected_amount: 165.25,
      extraction_status: 'success'
    };

    const result = await updateBillResult(updateInput);

    // Verify the returned result
    expect(result.id).toEqual(bill.id);
    expect(result.total_amount).toEqual(150.75);
    expect(result.energy_consumption).toEqual(300.5);
    expect(result.bill_date).toEqual(new Date('2023-10-15'));
    expect(result.corrected_amount).toEqual(165.25);
    expect(result.extraction_status).toEqual('success');
    expect(result.error_message).toBeNull();

    // Verify data was saved to database
    const savedBills = await db.select()
      .from(electricityBillsTable)
      .where(eq(electricityBillsTable.id, bill.id))
      .execute();

    const savedBill = savedBills[0];
    expect(parseFloat(savedBill.total_amount!)).toEqual(150.75);
    expect(parseFloat(savedBill.energy_consumption!)).toEqual(300.5);
    expect(savedBill.bill_date).toEqual(new Date('2023-10-15'));
    expect(parseFloat(savedBill.corrected_amount!)).toEqual(165.25);
    expect(savedBill.extraction_status).toEqual('success');
  });

  it('should update bill with error status and message', async () => {
    const batch = await createTestBatch();
    const bill = await createTestBill(batch.id);

    const updateInput: UpdateBillResultInput = {
      id: bill.id,
      extraction_status: 'error',
      error_message: 'Failed to extract data from PDF'
    };

    const result = await updateBillResult(updateInput);

    expect(result.id).toEqual(bill.id);
    expect(result.extraction_status).toEqual('error');
    expect(result.error_message).toEqual('Failed to extract data from PDF');
    expect(result.total_amount).toEqual(0); // Default value when not provided

    // Verify in database
    const savedBills = await db.select()
      .from(electricityBillsTable)
      .where(eq(electricityBillsTable.id, bill.id))
      .execute();

    expect(savedBills[0].extraction_status).toEqual('error');
    expect(savedBills[0].error_message).toEqual('Failed to extract data from PDF');
  });

  it('should update only provided fields', async () => {
    const batch = await createTestBatch();
    const bill = await createTestBill(batch.id);

    // First update with partial data
    const partialInput: UpdateBillResultInput = {
      id: bill.id,
      total_amount: 100.50,
      extraction_status: 'success'
    };

    const result = await updateBillResult(partialInput);

    expect(result.total_amount).toEqual(100.50);
    expect(result.energy_consumption).toEqual(0); // Default when not provided
    expect(result.extraction_status).toEqual('success');

    // Verify only specified fields were updated
    const savedBills = await db.select()
      .from(electricityBillsTable)
      .where(eq(electricityBillsTable.id, bill.id))
      .execute();

    const savedBill = savedBills[0];
    expect(parseFloat(savedBill.total_amount!)).toEqual(100.50);
    expect(savedBill.energy_consumption).toBeNull(); // Wasn't provided, so remains null
    expect(savedBill.extraction_status).toEqual('success');
  });

  it('should handle null corrected_amount', async () => {
    const batch = await createTestBatch();
    const bill = await createTestBill(batch.id);

    const updateInput: UpdateBillResultInput = {
      id: bill.id,
      total_amount: 75.25,
      corrected_amount: null,
      extraction_status: 'success'
    };

    const result = await updateBillResult(updateInput);

    expect(result.corrected_amount).toBeNull();

    // Verify in database
    const savedBills = await db.select()
      .from(electricityBillsTable)
      .where(eq(electricityBillsTable.id, bill.id))
      .execute();

    expect(savedBills[0].corrected_amount).toBeNull();
  });

  it('should update batch progress when bill status changes from pending', async () => {
    const batch = await createTestBatch();
    const bill = await createTestBill(batch.id);

    const updateInput: UpdateBillResultInput = {
      id: bill.id,
      total_amount: 120.00,
      extraction_status: 'success'
    };

    await updateBillResult(updateInput);

    // Verify batch progress was updated
    const updatedBatches = await db.select()
      .from(uploadBatchesTable)
      .where(eq(uploadBatchesTable.id, batch.id))
      .execute();

    const updatedBatch = updatedBatches[0];
    expect(updatedBatch.processed_files).toEqual(1);
    expect(updatedBatch.failed_files).toEqual(0);
  });

  it('should throw error for non-existent bill', async () => {
    const updateInput: UpdateBillResultInput = {
      id: 99999,
      extraction_status: 'success'
    };

    await expect(updateBillResult(updateInput)).rejects.toThrow(/Bill with ID 99999 not found/i);
  });
});

describe('updateUploadBatchProgress', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update batch progress for successful processing', async () => {
    // Create test batch
    const batches = await db.insert(uploadBatchesTable)
      .values({
        filename: 'test.zip',
        total_files: 3,
        processed_files: 0,
        failed_files: 0,
        status: 'processing'
      })
      .returning()
      .execute();

    const batch = batches[0];

    await updateUploadBatchProgress(batch.id, true);

    // Verify progress was updated
    const updatedBatches = await db.select()
      .from(uploadBatchesTable)
      .where(eq(uploadBatchesTable.id, batch.id))
      .execute();

    const updatedBatch = updatedBatches[0];
    expect(updatedBatch.processed_files).toEqual(1);
    expect(updatedBatch.failed_files).toEqual(0);
    expect(updatedBatch.status).toEqual('processing'); // Still processing
    expect(updatedBatch.completed_at).toBeNull();
  });

  it('should update batch progress for failed processing', async () => {
    const batches = await db.insert(uploadBatchesTable)
      .values({
        filename: 'test.zip',
        total_files: 2,
        processed_files: 0,
        failed_files: 0,
        status: 'processing'
      })
      .returning()
      .execute();

    const batch = batches[0];

    await updateUploadBatchProgress(batch.id, false);

    const updatedBatches = await db.select()
      .from(uploadBatchesTable)
      .where(eq(uploadBatchesTable.id, batch.id))
      .execute();

    const updatedBatch = updatedBatches[0];
    expect(updatedBatch.processed_files).toEqual(1);
    expect(updatedBatch.failed_files).toEqual(1);
    expect(updatedBatch.status).toEqual('processing');
  });

  it('should mark batch as completed when all files processed', async () => {
    const batches = await db.insert(uploadBatchesTable)
      .values({
        filename: 'test.zip',
        total_files: 2,
        processed_files: 1, // Already processed 1 file
        failed_files: 0,
        status: 'processing'
      })
      .returning()
      .execute();

    const batch = batches[0];

    await updateUploadBatchProgress(batch.id, true);

    const updatedBatches = await db.select()
      .from(uploadBatchesTable)
      .where(eq(uploadBatchesTable.id, batch.id))
      .execute();

    const updatedBatch = updatedBatches[0];
    expect(updatedBatch.processed_files).toEqual(2);
    expect(updatedBatch.failed_files).toEqual(0);
    expect(updatedBatch.status).toEqual('completed');
    expect(updatedBatch.completed_at).toBeInstanceOf(Date);
  });

  it('should mark batch as completed when reaching total files with some failures', async () => {
    const batches = await db.insert(uploadBatchesTable)
      .values({
        filename: 'test.zip',
        total_files: 3,
        processed_files: 2,
        failed_files: 1,
        status: 'processing'
      })
      .returning()
      .execute();

    const batch = batches[0];

    await updateUploadBatchProgress(batch.id, false); // This failure completes the batch

    const updatedBatches = await db.select()
      .from(uploadBatchesTable)
      .where(eq(uploadBatchesTable.id, batch.id))
      .execute();

    const updatedBatch = updatedBatches[0];
    expect(updatedBatch.processed_files).toEqual(3);
    expect(updatedBatch.failed_files).toEqual(2);
    expect(updatedBatch.status).toEqual('completed');
    expect(updatedBatch.completed_at).toBeInstanceOf(Date);
  });

  it('should throw error for non-existent upload batch', async () => {
    await expect(updateUploadBatchProgress(99999, true))
      .rejects.toThrow(/Upload batch with ID 99999 not found/i);
  });
});