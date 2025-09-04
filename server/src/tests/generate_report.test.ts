import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { uploadBatchesTable, electricityBillsTable } from '../db/schema';
import { type GenerateReportInput } from '../schema';
import { generateReport, exportToExcel, exportToCSV } from '../handlers/generate_report';
import { eq } from 'drizzle-orm';

describe('generateReport', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should generate report for upload batch with bills', async () => {
    // Create test upload batch
    const uploadBatch = await db.insert(uploadBatchesTable)
      .values({
        filename: 'test_batch.zip',
        total_files: 3,
        processed_files: 3,
        failed_files: 0,
        status: 'completed'
      })
      .returning()
      .execute();

    const uploadId = uploadBatch[0].id;

    // Create test bills
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
          total_amount: '87.25',
          energy_consumption: '105.30',
          bill_date: new Date('2023-02-15'),
          corrected_amount: '95.50',
          extraction_status: 'success',
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
          error_message: 'Failed to extract data'
        }
      ])
      .execute();

    const input: GenerateReportInput = {
      upload_id: uploadId,
      format: 'excel'
    };

    const result = await generateReport(input);

    // Verify bills data
    expect(result.bills).toHaveLength(3);
    expect(result.bills[0].filename).toBe('bill_001.pdf');
    expect(result.bills[0].total_amount).toBe(125.50);
    expect(result.bills[0].energy_consumption).toBe(150.75);
    expect(result.bills[0].corrected_amount).toBe(138.05);
    expect(result.bills[0].extraction_status).toBe('success');

    expect(result.bills[1].total_amount).toBe(87.25);
    expect(result.bills[1].energy_consumption).toBe(105.30);
    expect(result.bills[1].corrected_amount).toBe(95.50);

    expect(result.bills[2].extraction_status).toBe('error');
    expect(result.bills[2].error_message).toBe('Failed to extract data');
    expect(result.bills[2].total_amount).toBe(0);
    expect(result.bills[2].energy_consumption).toBe(0);
    expect(result.bills[2].corrected_amount).toBe(null);

    // Verify summary calculations
    expect(result.summary.total_bills).toBe(3);
    expect(result.summary.successful_extractions).toBe(2);
    expect(result.summary.failed_extractions).toBe(1);
    expect(result.summary.total_original_amount).toBe(212.75); // 125.50 + 87.25
    expect(result.summary.total_corrected_amount).toBe(233.55); // 138.05 + 95.50
    expect(result.summary.total_energy_consumption).toBe(256.05); // 150.75 + 105.30
  });

  it('should generate report with no bills', async () => {
    // Create empty upload batch
    const uploadBatch = await db.insert(uploadBatchesTable)
      .values({
        filename: 'empty_batch.zip',
        total_files: 0,
        processed_files: 0,
        failed_files: 0,
        status: 'completed'
      })
      .returning()
      .execute();

    const input: GenerateReportInput = {
      upload_id: uploadBatch[0].id,
      format: 'csv'
    };

    const result = await generateReport(input);

    expect(result.bills).toHaveLength(0);
    expect(result.summary.total_bills).toBe(0);
    expect(result.summary.successful_extractions).toBe(0);
    expect(result.summary.failed_extractions).toBe(0);
    expect(result.summary.total_original_amount).toBe(0);
    expect(result.summary.total_corrected_amount).toBe(0);
    expect(result.summary.total_energy_consumption).toBe(0);
  });

  it('should handle bills with null numeric values correctly', async () => {
    // Create upload batch
    const uploadBatch = await db.insert(uploadBatchesTable)
      .values({
        filename: 'partial_batch.zip',
        total_files: 2,
        processed_files: 1,
        failed_files: 1,
        status: 'completed'
      })
      .returning()
      .execute();

    const uploadId = uploadBatch[0].id;

    // Create bills with partial data
    await db.insert(electricityBillsTable)
      .values([
        {
          filename: 'complete_bill.pdf',
          upload_id: uploadId,
          total_amount: '100.00',
          energy_consumption: '120.00',
          bill_date: new Date('2023-01-15'),
          corrected_amount: '110.00',
          extraction_status: 'success',
          error_message: null
        },
        {
          filename: 'incomplete_bill.pdf',
          upload_id: uploadId,
          total_amount: null,
          energy_consumption: null,
          bill_date: null,
          corrected_amount: null,
          extraction_status: 'pending',
          error_message: null
        }
      ])
      .execute();

    const input: GenerateReportInput = {
      upload_id: uploadId,
      format: 'excel'
    };

    const result = await generateReport(input);

    expect(result.bills).toHaveLength(2);
    
    // Check successful bill
    expect(result.bills[0].total_amount).toBe(100.00);
    expect(result.bills[0].energy_consumption).toBe(120.00);
    expect(result.bills[0].corrected_amount).toBe(110.00);

    // Check incomplete bill - should have default values
    expect(result.bills[1].total_amount).toBe(0);
    expect(result.bills[1].energy_consumption).toBe(0);
    expect(result.bills[1].corrected_amount).toBe(null);

    // Summary should only include successful extractions
    expect(result.summary.total_bills).toBe(2);
    expect(result.summary.successful_extractions).toBe(1);
    expect(result.summary.failed_extractions).toBe(0);
    expect(result.summary.total_original_amount).toBe(100.00);
    expect(result.summary.total_corrected_amount).toBe(110.00);
    expect(result.summary.total_energy_consumption).toBe(120.00);
  });

  it('should throw error when upload batch does not exist', async () => {
    const input: GenerateReportInput = {
      upload_id: 999999, // Non-existent ID
      format: 'csv'
    };

    await expect(generateReport(input)).rejects.toThrow(/Upload batch with ID 999999 not found/i);
  });

  it('should save bills to database correctly', async () => {
    // Create upload batch and bills
    const uploadBatch = await db.insert(uploadBatchesTable)
      .values({
        filename: 'verify_batch.zip',
        total_files: 1,
        processed_files: 1,
        failed_files: 0,
        status: 'completed'
      })
      .returning()
      .execute();

    const uploadId = uploadBatch[0].id;

    await db.insert(electricityBillsTable)
      .values({
        filename: 'verify_bill.pdf',
        upload_id: uploadId,
        total_amount: '75.99',
        energy_consumption: '89.50',
        bill_date: new Date('2023-03-15'),
        corrected_amount: '82.15',
        extraction_status: 'success',
        error_message: null
      })
      .execute();

    const input: GenerateReportInput = {
      upload_id: uploadId,
      format: 'excel'
    };

    const result = await generateReport(input);

    // Verify data was saved correctly by querying database directly
    const savedBills = await db.select()
      .from(electricityBillsTable)
      .where(eq(electricityBillsTable.upload_id, uploadId))
      .execute();

    expect(savedBills).toHaveLength(1);
    expect(savedBills[0].filename).toBe('verify_bill.pdf');
    expect(parseFloat(savedBills[0].total_amount!)).toBe(75.99);
    expect(parseFloat(savedBills[0].energy_consumption!)).toBe(89.50);
    expect(parseFloat(savedBills[0].corrected_amount!)).toBe(82.15);
    expect(savedBills[0].extraction_status).toBe('success');

    // Verify handler returned correct data
    expect(result.bills[0].total_amount).toBe(75.99);
    expect(result.bills[0].energy_consumption).toBe(89.50);
    expect(result.bills[0].corrected_amount).toBe(82.15);
  });
});

describe('exportToExcel', () => {
  it('should export report data to Excel format', async () => {
    const mockReport = {
      bills: [
        {
          id: 1,
          filename: 'test_bill.pdf',
          upload_id: 1,
          total_amount: 125.50,
          energy_consumption: 150.75,
          bill_date: new Date('2023-01-15'),
          corrected_amount: 138.05,
          extraction_status: 'success' as const,
          error_message: null,
          created_at: new Date('2023-01-01')
        }
      ],
      summary: {
        total_bills: 1,
        successful_extractions: 1,
        failed_extractions: 0,
        total_original_amount: 125.50,
        total_corrected_amount: 138.05,
        total_energy_consumption: 150.75
      }
    };

    const buffer = await exportToExcel(mockReport);

    expect(buffer).toBeInstanceOf(Buffer);
    const content = buffer.toString('utf-8');
    
    // Verify headers are included
    expect(content).toContain('ID,Filename,Upload ID,Total Amount,Energy Consumption');
    
    // Verify data is included
    expect(content).toContain('1,test_bill.pdf,1,125.50,150.75');
    expect(content).toContain('2023-01-15,138.05,success');
    
    // Verify summary section
    expect(content).toContain('SUMMARY');
    expect(content).toContain('Total Bills,1');
    expect(content).toContain('Successful Extractions,1');
    expect(content).toContain('Total Original Amount,125.50');
  });
});

describe('exportToCSV', () => {
  it('should export report data to CSV format', async () => {
    const mockReport = {
      bills: [
        {
          id: 2,
          filename: 'bill with spaces.pdf',
          upload_id: 1,
          total_amount: 87.25,
          energy_consumption: 105.30,
          bill_date: new Date('2023-02-15'),
          corrected_amount: null,
          extraction_status: 'error' as const,
          error_message: 'Error with "quotes"',
          created_at: new Date('2023-02-01')
        }
      ],
      summary: {
        total_bills: 1,
        successful_extractions: 0,
        failed_extractions: 1,
        total_original_amount: 0,
        total_corrected_amount: 0,
        total_energy_consumption: 0
      }
    };

    const buffer = await exportToCSV(mockReport);

    expect(buffer).toBeInstanceOf(Buffer);
    const content = buffer.toString('utf-8');
    
    // Verify headers
    expect(content).toContain('ID,Filename,Upload ID,Total Amount,Energy Consumption');
    
    // Verify quoted filename (contains spaces)
    expect(content).toContain('"bill with spaces.pdf"');
    
    // Verify data formatting
    expect(content).toContain('2,"bill with spaces.pdf",1,87.25,105.30');
    expect(content).toContain('error,"Error with ""quotes"""');
    
    // Verify null values are handled
    expect(content).toContain('2023-02-15,,error');
  });

  it('should handle empty report', async () => {
    const emptyReport = {
      bills: [],
      summary: {
        total_bills: 0,
        successful_extractions: 0,
        failed_extractions: 0,
        total_original_amount: 0,
        total_corrected_amount: 0,
        total_energy_consumption: 0
      }
    };

    const buffer = await exportToCSV(emptyReport);
    const content = buffer.toString('utf-8');
    
    // Should contain headers but no data rows
    expect(content).toContain('ID,Filename,Upload ID');
    expect(content.split('\n')).toHaveLength(1); // Only header line
  });
});