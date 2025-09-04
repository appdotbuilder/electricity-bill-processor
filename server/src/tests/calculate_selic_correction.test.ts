import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { selicRatesTable, electricityBillsTable, uploadBatchesTable } from '../db/schema';
import { type ElectricityBill } from '../schema';
import { calculateSelicCorrection, getSelicRatesForPeriod } from '../handlers/calculate_selic_correction';
import { eq } from 'drizzle-orm';

// Test data setup helpers
async function createTestUploadBatch() {
  const result = await db.insert(uploadBatchesTable)
    .values({
      filename: 'test-bills.zip',
      total_files: 1,
      processed_files: 0,
      failed_files: 0,
      status: 'processing'
    })
    .returning()
    .execute();

  return result[0];
}

async function createTestBill(uploadId: number, billDate: Date, totalAmount: number): Promise<ElectricityBill> {
  const result = await db.insert(electricityBillsTable)
    .values({
      filename: 'test-bill.pdf',
      upload_id: uploadId,
      total_amount: totalAmount.toString(),
      energy_consumption: '150.50',
      bill_date: billDate,
      corrected_amount: null,
      extraction_status: 'success',
      error_message: null
    })
    .returning()
    .execute();

  const bill = result[0];
  return {
    ...bill,
    total_amount: parseFloat(bill.total_amount || '0'),
    energy_consumption: parseFloat(bill.energy_consumption || '0'),
    corrected_amount: bill.corrected_amount ? parseFloat(bill.corrected_amount) : null,
    bill_date: bill.bill_date || billDate
  };
}

async function createTestSelicRates() {
  // Create historical SELIC rates for testing
  const rates = [
    { date: new Date('2023-01-01'), rate: 0.0125 }, // 1.25% monthly
    { date: new Date('2023-02-01'), rate: 0.0130 }, // 1.30% monthly
    { date: new Date('2023-03-01'), rate: 0.0120 }, // 1.20% monthly
    { date: new Date('2023-04-01'), rate: 0.0115 }, // 1.15% monthly
    { date: new Date('2024-01-01'), rate: 0.0110 }, // 1.10% monthly
  ];

  for (const rate of rates) {
    await db.insert(selicRatesTable)
      .values({
        date: rate.date,
        rate: rate.rate.toString(),
      })
      .execute();
  }
}

describe('calculateSelicCorrection', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should calculate SELIC correction for a bill with valid data', async () => {
    // Setup test data
    const uploadBatch = await createTestUploadBatch();
    const billDate = new Date('2023-01-15'); // January 2023
    const originalAmount = 100.00;
    
    await createTestSelicRates();
    const bill = await createTestBill(uploadBatch.id, billDate, originalAmount);

    // Execute correction
    const result = await calculateSelicCorrection(bill);

    // Verify basic properties
    expect(result.id).toEqual(bill.id);
    expect(result.filename).toEqual(bill.filename);
    expect(result.total_amount).toEqual(originalAmount);
    expect(result.corrected_amount).toBeDefined();
    expect(typeof result.corrected_amount).toBe('number');
    expect(result.corrected_amount!).toBeGreaterThan(originalAmount); // Should be higher due to inflation correction
  });

  it('should update database with corrected amount', async () => {
    // Setup test data
    const uploadBatch = await createTestUploadBatch();
    const billDate = new Date('2023-02-15');
    const originalAmount = 250.75;
    
    await createTestSelicRates();
    const bill = await createTestBill(uploadBatch.id, billDate, originalAmount);

    // Execute correction
    const result = await calculateSelicCorrection(bill);

    // Verify database was updated
    const updatedBills = await db.select()
      .from(electricityBillsTable)
      .where(eq(electricityBillsTable.id, bill.id))
      .execute();

    expect(updatedBills).toHaveLength(1);
    expect(parseFloat(updatedBills[0].corrected_amount!)).toEqual(result.corrected_amount!);
  });

  it('should return original amount when bill date is current or future', async () => {
    // Setup test data with future date
    const uploadBatch = await createTestUploadBatch();
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 2); // 2 months in future
    
    const originalAmount = 150.00;
    const bill = await createTestBill(uploadBatch.id, futureDate, originalAmount);

    // Execute correction
    const result = await calculateSelicCorrection(bill);

    // Should return original amount for future bills
    expect(result.corrected_amount).toBeDefined();
    expect(result.corrected_amount!).toEqual(originalAmount);
  });

  it('should handle bills without SELIC rate data', async () => {
    // Setup test data without creating SELIC rates
    const uploadBatch = await createTestUploadBatch();
    const billDate = new Date('2020-01-15'); // Date with no SELIC data
    const originalAmount = 200.00;
    
    const bill = await createTestBill(uploadBatch.id, billDate, originalAmount);

    // Execute correction
    const result = await calculateSelicCorrection(bill);

    // Should return original amount when no SELIC data available
    expect(result.corrected_amount).toBeDefined();
    expect(result.corrected_amount!).toEqual(originalAmount);
  });

  it('should throw error for bill without required data', async () => {
    const uploadBatch = await createTestUploadBatch();
    
    // Create bill with missing bill_date
    const result = await db.insert(electricityBillsTable)
      .values({
        filename: 'incomplete-bill.pdf',
        upload_id: uploadBatch.id,
        total_amount: '100.00',
        energy_consumption: '150.50',
        bill_date: null, // Missing bill date
        corrected_amount: null,
        extraction_status: 'success',
        error_message: null
      })
      .returning()
      .execute();

    const incompleteBill = {
      ...result[0],
      total_amount: parseFloat(result[0].total_amount || '0'),
      energy_consumption: parseFloat(result[0].energy_consumption || '0'),
      corrected_amount: null,
      bill_date: null
    };

    // Should throw error for missing required data
    await expect(calculateSelicCorrection(incompleteBill as any))
      .rejects
      .toThrow(/Bill date and total amount are required/i);
  });

  it('should handle compound interest calculation correctly', async () => {
    // Setup test data with known rates for precise calculation testing
    const uploadBatch = await createTestUploadBatch();
    const billDate = new Date('2023-01-01');
    const originalAmount = 1000.00;

    // Create specific rates for calculation verification
    await db.insert(selicRatesTable)
      .values([
        { date: new Date('2023-01-01'), rate: '0.01' }, // 1% monthly
        { date: new Date('2023-02-01'), rate: '0.01' }, // 1% monthly
      ])
      .execute();

    const bill = await createTestBill(uploadBatch.id, billDate, originalAmount);

    // Execute correction
    const result = await calculateSelicCorrection(bill);

    // With 1% monthly rate for 2 months: 1000 * (1.01)^2 ≈ 1020.10
    expect(result.corrected_amount!).toBeGreaterThan(1020);
    expect(result.corrected_amount!).toBeLessThan(1021);
  });
});

describe('getSelicRatesForPeriod', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should fetch SELIC rates for specified date range', async () => {
    await createTestSelicRates();

    const startDate = new Date('2023-01-01');
    const endDate = new Date('2023-03-31');

    const rates = await getSelicRatesForPeriod(startDate, endDate);

    expect(rates).toHaveLength(3); // January, February, March 2023
    expect(rates[0].date).toEqual(new Date('2023-01-01'));
    expect(rates[1].date).toEqual(new Date('2023-02-01'));
    expect(rates[2].date).toEqual(new Date('2023-03-01'));
    
    // Verify rates are numbers, not strings
    rates.forEach(rate => {
      expect(typeof rate.rate).toBe('number');
    });
  });

  it('should return rates ordered by date', async () => {
    await createTestSelicRates();

    const startDate = new Date('2022-12-01');
    const endDate = new Date('2024-02-01');

    const rates = await getSelicRatesForPeriod(startDate, endDate);

    // Verify ascending order
    for (let i = 1; i < rates.length; i++) {
      expect(rates[i].date >= rates[i - 1].date).toBe(true);
    }
  });

  it('should return empty array when no rates exist in range', async () => {
    await createTestSelicRates();

    const startDate = new Date('2025-01-01'); // Future date range
    const endDate = new Date('2025-12-31');

    const rates = await getSelicRatesForPeriod(startDate, endDate);

    expect(rates).toHaveLength(0);
  });

  it('should handle single day range correctly', async () => {
    await createTestSelicRates();

    const singleDate = new Date('2023-02-01');

    const rates = await getSelicRatesForPeriod(singleDate, singleDate);

    expect(rates).toHaveLength(1);
    expect(rates[0].date).toEqual(singleDate);
  });
});