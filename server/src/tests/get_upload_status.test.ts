import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { uploadBatchesTable, electricityBillsTable } from '../db/schema';
import { type GetUploadStatusInput } from '../schema';
import { getUploadStatus } from '../handlers/get_upload_status';
import { eq } from 'drizzle-orm';

describe('getUploadStatus', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should get upload status with associated bills', async () => {
    // Create test upload batch
    const uploadResult = await db.insert(uploadBatchesTable)
      .values({
        filename: 'test_bills.zip',
        total_files: 3,
        processed_files: 2,
        failed_files: 1,
        status: 'processing'
      })
      .returning()
      .execute();

    const uploadId = uploadResult[0].id;

    // Create test bills associated with the upload
    await db.insert(electricityBillsTable)
      .values([
        {
          filename: 'bill_001.pdf',
          upload_id: uploadId,
          total_amount: '125.50',
          energy_consumption: '150.75',
          bill_date: new Date('2023-01-15'),
          corrected_amount: '138.05',
          extraction_status: 'success',
          error_message: null
        },
        {
          filename: 'bill_002.pdf',
          upload_id: uploadId,
          total_amount: '200.25',
          energy_consumption: '225.30',
          bill_date: new Date('2023-02-15'),
          corrected_amount: null,
          extraction_status: 'pending',
          error_message: null
        },
        {
          filename: 'bill_003.pdf',
          upload_id: uploadId,
          total_amount: null,
          energy_consumption: null,
          bill_date: null,
          corrected_amount: null,
          extraction_status: 'error',
          error_message: 'Failed to extract data from PDF'
        }
      ])
      .execute();

    const input: GetUploadStatusInput = {
      upload_id: uploadId
    };

    const result = await getUploadStatus(input);

    // Verify upload batch information
    expect(result.upload.id).toEqual(uploadId);
    expect(result.upload.filename).toEqual('test_bills.zip');
    expect(result.upload.total_files).toEqual(3);
    expect(result.upload.processed_files).toEqual(2);
    expect(result.upload.failed_files).toEqual(1);
    expect(result.upload.status).toEqual('processing');
    expect(result.upload.created_at).toBeInstanceOf(Date);
    expect(result.upload.completed_at).toBeNull();

    // Verify bills information
    expect(result.bills).toHaveLength(3);
    
    // Check successful bill
    const successBill = result.bills.find(b => b.filename === 'bill_001.pdf');
    expect(successBill).toBeDefined();
    expect(successBill?.total_amount).toEqual(125.50);
    expect(typeof successBill?.total_amount).toBe('number');
    expect(successBill?.energy_consumption).toEqual(150.75);
    expect(typeof successBill?.energy_consumption).toBe('number');
    expect(successBill?.corrected_amount).toEqual(138.05);
    expect(typeof successBill?.corrected_amount).toBe('number');
    expect(successBill?.extraction_status).toEqual('success');
    expect(successBill?.error_message).toBeNull();

    // Check pending bill
    const pendingBill = result.bills.find(b => b.filename === 'bill_002.pdf');
    expect(pendingBill).toBeDefined();
    expect(pendingBill?.total_amount).toEqual(200.25);
    expect(typeof pendingBill?.total_amount).toBe('number');
    expect(pendingBill?.energy_consumption).toEqual(225.30);
    expect(typeof pendingBill?.energy_consumption).toBe('number');
    expect(pendingBill?.corrected_amount).toBeNull();
    expect(pendingBill?.extraction_status).toEqual('pending');
    expect(pendingBill?.error_message).toBeNull();

    // Check failed bill - should have default values for missing data
    const failedBill = result.bills.find(b => b.filename === 'bill_003.pdf');
    expect(failedBill).toBeDefined();
    expect(failedBill?.total_amount).toEqual(0); // Default value for null
    expect(failedBill?.energy_consumption).toEqual(0); // Default value for null
    expect(failedBill?.bill_date).toBeInstanceOf(Date); // Default current date
    expect(failedBill?.corrected_amount).toBeNull();
    expect(failedBill?.extraction_status).toEqual('error');
    expect(failedBill?.error_message).toEqual('Failed to extract data from PDF');
  });

  it('should handle upload batch with no bills', async () => {
    // Create upload batch without bills
    const uploadResult = await db.insert(uploadBatchesTable)
      .values({
        filename: 'empty_batch.zip',
        total_files: 0,
        processed_files: 0,
        failed_files: 0,
        status: 'completed'
      })
      .returning()
      .execute();

    const input: GetUploadStatusInput = {
      upload_id: uploadResult[0].id
    };

    const result = await getUploadStatus(input);

    expect(result.upload.id).toEqual(uploadResult[0].id);
    expect(result.upload.filename).toEqual('empty_batch.zip');
    expect(result.upload.total_files).toEqual(0);
    expect(result.upload.status).toEqual('completed');
    expect(result.bills).toHaveLength(0);
  });

  it('should handle completed upload batch', async () => {
    // Create completed upload batch
    const completedAt = new Date('2023-01-15T10:30:00Z');
    const uploadResult = await db.insert(uploadBatchesTable)
      .values({
        filename: 'completed_batch.zip',
        total_files: 2,
        processed_files: 2,
        failed_files: 0,
        status: 'completed',
        completed_at: completedAt
      })
      .returning()
      .execute();

    const input: GetUploadStatusInput = {
      upload_id: uploadResult[0].id
    };

    const result = await getUploadStatus(input);

    expect(result.upload.status).toEqual('completed');
    expect(result.upload.completed_at).toEqual(completedAt);
    expect(result.upload.processed_files).toEqual(2);
    expect(result.upload.failed_files).toEqual(0);
  });

  it('should throw error for non-existent upload batch', async () => {
    const input: GetUploadStatusInput = {
      upload_id: 99999 // Non-existent ID
    };

    await expect(getUploadStatus(input)).rejects.toThrow(/Upload batch with ID 99999 not found/);
  });

  it('should verify data persistence in database', async () => {
    // Create upload batch
    const uploadResult = await db.insert(uploadBatchesTable)
      .values({
        filename: 'persistence_test.zip',
        total_files: 1,
        processed_files: 1,
        failed_files: 0,
        status: 'completed'
      })
      .returning()
      .execute();

    const uploadId = uploadResult[0].id;

    // Create bill
    await db.insert(electricityBillsTable)
      .values({
        filename: 'test_bill.pdf',
        upload_id: uploadId,
        total_amount: '99.99',
        energy_consumption: '120.50',
        bill_date: new Date('2023-03-15'),
        corrected_amount: '105.25',
        extraction_status: 'success',
        error_message: null
      })
      .execute();

    // Call handler
    const input: GetUploadStatusInput = { upload_id: uploadId };
    const result = await getUploadStatus(input);

    // Verify data was correctly retrieved from database
    const dbUpload = await db.select()
      .from(uploadBatchesTable)
      .where(eq(uploadBatchesTable.id, uploadId))
      .execute();

    const dbBills = await db.select()
      .from(electricityBillsTable)
      .where(eq(electricityBillsTable.upload_id, uploadId))
      .execute();

    expect(dbUpload).toHaveLength(1);
    expect(dbUpload[0].filename).toEqual('persistence_test.zip');
    expect(dbBills).toHaveLength(1);
    expect(dbBills[0].filename).toEqual('test_bill.pdf');
    expect(parseFloat(dbBills[0].total_amount!)).toEqual(99.99);

    // Verify handler correctly converted numeric values
    expect(result.bills[0].total_amount).toEqual(99.99);
    expect(typeof result.bills[0].total_amount).toBe('number');
    expect(result.bills[0].energy_consumption).toEqual(120.50);
    expect(typeof result.bills[0].energy_consumption).toBe('number');
  });
});