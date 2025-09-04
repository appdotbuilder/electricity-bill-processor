import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { selicRatesTable } from '../db/schema';
import { loadSelicData, getAllSelicRates, getLatestSelicRate } from '../handlers/load_selic_data';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

describe('load_selic_data', () => {
  const testDataDir = join(process.cwd(), 'data');
  const testCsvPath = join(testDataDir, 'selic_rates.csv');

  beforeEach(async () => {
    await createDB();
    
    // Create test data directory if it doesn't exist
    if (!existsSync(testDataDir)) {
      mkdirSync(testDataDir, { recursive: true });
    }
  });

  afterEach(async () => {
    await resetDB();
    
    // Clean up test CSV file
    if (existsSync(testCsvPath)) {
      rmSync(testCsvPath);
    }
  });

  describe('loadSelicData', () => {
    it('should load SELIC data from CSV file', async () => {
      // Create test CSV file
      const csvContent = `date,rate
2023-01-01,0.0125
2023-02-01,0.0110
2023-03-01,0.0095`;

      writeFileSync(testCsvPath, csvContent);

      const result = await loadSelicData();

      expect(result.loaded).toBe(3);
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(0);

      // Verify data was inserted
      const rates = await db.select()
        .from(selicRatesTable)
        .execute();

      expect(rates).toHaveLength(3);
      expect(parseFloat(rates[0].rate)).toBe(0.0125);
      expect(parseFloat(rates[1].rate)).toBe(0.0110);
      expect(parseFloat(rates[2].rate)).toBe(0.0095);
    });

    it('should skip duplicate dates', async () => {
      // Insert existing record
      await db.insert(selicRatesTable)
        .values({
          date: new Date('2023-01-01'),
          rate: '0.0100'
        })
        .execute();

      // Create CSV with duplicate and new records
      const csvContent = `date,rate
2023-01-01,0.0125
2023-02-01,0.0110`;

      writeFileSync(testCsvPath, csvContent);

      const result = await loadSelicData();

      expect(result.loaded).toBe(1); // Only new record
      expect(result.skipped).toBe(1); // Duplicate skipped
      expect(result.errors).toBe(0);

      // Verify original record unchanged
      const rates = await db.select()
        .from(selicRatesTable)
        .execute();

      expect(rates).toHaveLength(2);
      
      // Find the original record and verify it wasn't changed
      const originalRecord = rates.find(r => 
        r.date.toISOString().split('T')[0] === '2023-01-01'
      );
      expect(parseFloat(originalRecord!.rate)).toBe(0.0100); // Original value preserved
    });

    it('should handle invalid data and count errors', async () => {
      const csvContent = `date,rate
2023-01-01,0.0125
invalid-date,0.0110
2023-03-01,invalid-rate
2023-04-01,
,0.0095`;

      writeFileSync(testCsvPath, csvContent);

      const result = await loadSelicData();

      expect(result.loaded).toBe(1); // Only valid record
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(4); // 4 invalid records

      // Verify only valid data was inserted
      const rates = await db.select()
        .from(selicRatesTable)
        .execute();

      expect(rates).toHaveLength(1);
      expect(parseFloat(rates[0].rate)).toBe(0.0125);
    });

    it('should handle missing CSV file', async () => {
      // Don't create the CSV file

      const result = await loadSelicData();

      expect(result.loaded).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(1);
    });

    it('should handle empty CSV file', async () => {
      const csvContent = `date,rate`;
      writeFileSync(testCsvPath, csvContent);

      const result = await loadSelicData();

      expect(result.loaded).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(0);
    });
  });

  describe('getAllSelicRates', () => {
    it('should return all SELIC rates ordered by date', async () => {
      // Insert test data in random order
      await db.insert(selicRatesTable)
        .values([
          { date: new Date('2023-03-01'), rate: '0.0095' },
          { date: new Date('2023-01-01'), rate: '0.0125' },
          { date: new Date('2023-02-01'), rate: '0.0110' }
        ])
        .execute();

      const rates = await getAllSelicRates();

      expect(rates).toHaveLength(3);
      
      // Verify ordering by date (ascending)
      expect(rates[0].date.toISOString().split('T')[0]).toBe('2023-01-01');
      expect(rates[1].date.toISOString().split('T')[0]).toBe('2023-02-01');
      expect(rates[2].date.toISOString().split('T')[0]).toBe('2023-03-01');
      
      // Verify numeric conversion
      expect(typeof rates[0].rate).toBe('number');
      expect(rates[0].rate).toBe(0.0125);
      expect(rates[1].rate).toBe(0.0110);
      expect(rates[2].rate).toBe(0.0095);
    });

    it('should return empty array when no rates exist', async () => {
      const rates = await getAllSelicRates();

      expect(rates).toHaveLength(0);
    });

    it('should include all required fields', async () => {
      await db.insert(selicRatesTable)
        .values({
          date: new Date('2023-01-01'),
          rate: '0.0125'
        })
        .execute();

      const rates = await getAllSelicRates();

      expect(rates).toHaveLength(1);
      expect(rates[0].id).toBeDefined();
      expect(rates[0].date).toBeInstanceOf(Date);
      expect(rates[0].rate).toBe(0.0125);
      expect(rates[0].created_at).toBeInstanceOf(Date);
    });
  });

  describe('getLatestSelicRate', () => {
    it('should return the most recent SELIC rate', async () => {
      // Insert test data
      await db.insert(selicRatesTable)
        .values([
          { date: new Date('2023-01-01'), rate: '0.0125' },
          { date: new Date('2023-03-01'), rate: '0.0095' }, // Latest
          { date: new Date('2023-02-01'), rate: '0.0110' }
        ])
        .execute();

      const latestRate = await getLatestSelicRate();

      expect(latestRate).not.toBeNull();
      expect(latestRate!.date.toISOString().split('T')[0]).toBe('2023-03-01');
      expect(latestRate!.rate).toBe(0.0095);
      expect(typeof latestRate!.rate).toBe('number');
    });

    it('should return null when no rates exist', async () => {
      const latestRate = await getLatestSelicRate();

      expect(latestRate).toBeNull();
    });

    it('should include all required fields', async () => {
      await db.insert(selicRatesTable)
        .values({
          date: new Date('2023-01-01'),
          rate: '0.0125'
        })
        .execute();

      const latestRate = await getLatestSelicRate();

      expect(latestRate).not.toBeNull();
      expect(latestRate!.id).toBeDefined();
      expect(latestRate!.date).toBeInstanceOf(Date);
      expect(latestRate!.rate).toBe(0.0125);
      expect(latestRate!.created_at).toBeInstanceOf(Date);
    });

    it('should handle single record', async () => {
      await db.insert(selicRatesTable)
        .values({
          date: new Date('2023-06-01'),
          rate: '0.0080'
        })
        .execute();

      const latestRate = await getLatestSelicRate();

      expect(latestRate).not.toBeNull();
      expect(latestRate!.rate).toBe(0.0080);
      expect(latestRate!.date.toISOString().split('T')[0]).toBe('2023-06-01');
    });
  });
});