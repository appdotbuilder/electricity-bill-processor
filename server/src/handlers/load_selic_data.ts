import { db } from '../db';
import { selicRatesTable } from '../db/schema';
import { type SelicRate } from '../schema';
import { eq, desc } from 'drizzle-orm';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Handler for loading historical SELIC data from CSV file
 * This handler should:
 * 1. Read SELIC data from a pre-existing CSV file
 * 2. Parse and validate the data format
 * 3. Insert or update records in the selic_rates table
 * 4. Handle duplicate dates appropriately
 * 5. Return count of loaded records
 */
export async function loadSelicData(): Promise<{ loaded: number; skipped: number; errors: number }> {
  try {
    const csvPath = join(process.cwd(), 'data', 'selic_rates.csv');
    
    if (!existsSync(csvPath)) {
      console.error('SELIC data file not found:', csvPath);
      return { loaded: 0, skipped: 0, errors: 1 };
    }

    const csvContent = readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    // Skip header row
    const dataLines = lines.slice(1);
    
    let loaded = 0;
    let skipped = 0;
    let errors = 0;

    // Get existing dates to avoid duplicates
    const existingRates = await db.select({ date: selicRatesTable.date })
      .from(selicRatesTable)
      .execute();
    
    const existingDates = new Set(
      existingRates.map(rate => rate.date.toISOString().split('T')[0])
    );

    for (const line of dataLines) {
      try {
        const [dateStr, rateStr] = line.split(',').map(col => col.trim());
        
        if (!dateStr || !rateStr) {
          errors++;
          continue;
        }

        const date = new Date(dateStr);
        const rate = parseFloat(rateStr);

        // Validate data
        if (isNaN(date.getTime()) || isNaN(rate)) {
          errors++;
          continue;
        }

        // Check for duplicates
        const dateKey = date.toISOString().split('T')[0];
        if (existingDates.has(dateKey)) {
          skipped++;
          continue;
        }

        // Insert new record
        await db.insert(selicRatesTable)
          .values({
            date: date,
            rate: rate.toString() // Convert number to string for numeric column
          })
          .execute();

        existingDates.add(dateKey); // Add to set to prevent duplicates in this batch
        loaded++;

      } catch (error) {
        console.error('Error processing SELIC rate line:', line, error);
        errors++;
      }
    }

    return { loaded, skipped, errors };

  } catch (error) {
    console.error('SELIC data loading failed:', error);
    throw error;
  }
}

/**
 * Helper function to get all available SELIC rates
 * This function should:
 * 1. Query all SELIC rates from the database
 * 2. Return rates ordered by date
 * 3. Used for validation and reporting purposes
 */
export async function getAllSelicRates(): Promise<SelicRate[]> {
  try {
    const results = await db.select()
      .from(selicRatesTable)
      .orderBy(selicRatesTable.date)
      .execute();

    // Convert numeric fields back to numbers before returning
    return results.map(rate => ({
      ...rate,
      rate: parseFloat(rate.rate) // Convert string back to number
    }));

  } catch (error) {
    console.error('Failed to get all SELIC rates:', error);
    throw error;
  }
}

/**
 * Helper function to get the most recent SELIC rate
 * This function should:
 * 1. Query the most recent SELIC rate from the database
 * 2. Used for current period corrections
 */
export async function getLatestSelicRate(): Promise<SelicRate | null> {
  try {
    const results = await db.select()
      .from(selicRatesTable)
      .orderBy(desc(selicRatesTable.date))
      .limit(1)
      .execute();

    if (results.length === 0) {
      return null;
    }

    // Convert numeric fields back to numbers before returning
    const rate = results[0];
    return {
      ...rate,
      rate: parseFloat(rate.rate) // Convert string back to number
    };

  } catch (error) {
    console.error('Failed to get latest SELIC rate:', error);
    throw error;
  }
}