import { db } from '../db';
import { selicRatesTable, electricityBillsTable } from '../db/schema';
import { type ElectricityBill, type SelicRate } from '../schema';
import { gte, lte, and, asc, eq } from 'drizzle-orm';

/**
 * Handler for calculating SELIC corrections on electricity bill values
 * This handler should:
 * 1. Get the bill date from the electricity bill
 * 2. Fetch historical SELIC rates from the database
 * 3. Calculate the accumulated correction from bill date to current date
 * 4. Apply the correction to the total amount
 * 5. Update the bill record with the corrected amount
 */
export async function calculateSelicCorrection(bill: ElectricityBill): Promise<ElectricityBill> {
  try {
    // Validate input data
    if (!bill.bill_date || !bill.total_amount) {
      throw new Error('Bill date and total amount are required for SELIC correction');
    }

    const billDate = new Date(bill.bill_date);
    const currentDate = new Date();

    // If bill is from current month or future, no correction needed
    if (billDate >= currentDate) {
      // Update database with original amount as corrected amount
      const updateResult = await db.update(electricityBillsTable)
        .set({
          corrected_amount: bill.total_amount.toString()
        })
        .where(eq(electricityBillsTable.id, bill.id))
        .returning()
        .execute();

      const updatedBill = updateResult[0];
      
      return {
        ...updatedBill,
        total_amount: parseFloat(updatedBill.total_amount || '0'),
        energy_consumption: parseFloat(updatedBill.energy_consumption || '0'),
        corrected_amount: parseFloat(updatedBill.corrected_amount || '0'),
        bill_date: updatedBill.bill_date || new Date()
      };
    }

    // Get SELIC rates for the period
    const selicRates = await getSelicRatesForPeriod(billDate, currentDate);

    if (selicRates.length === 0) {
      // No SELIC data available, update with original amount
      const updateResult = await db.update(electricityBillsTable)
        .set({
          corrected_amount: bill.total_amount.toString()
        })
        .where(eq(electricityBillsTable.id, bill.id))
        .returning()
        .execute();

      const updatedBill = updateResult[0];
      
      return {
        ...updatedBill,
        total_amount: parseFloat(updatedBill.total_amount || '0'),
        energy_consumption: parseFloat(updatedBill.energy_consumption || '0'),
        corrected_amount: parseFloat(updatedBill.corrected_amount || '0'),
        bill_date: updatedBill.bill_date || new Date()
      };
    }

    // Calculate accumulated correction factor
    const correctionFactor = calculateAccumulatedCorrection(selicRates, billDate, currentDate);
    
    // Apply correction to total amount
    const correctedAmount = bill.total_amount * correctionFactor;

    // Update the bill record in database
    const updateResult = await db.update(electricityBillsTable)
      .set({
        corrected_amount: correctedAmount.toString() // Convert to string for numeric column
      })
      .where(eq(electricityBillsTable.id, bill.id))
      .returning()
      .execute();

    const updatedBill = updateResult[0];
    
    return {
      ...updatedBill,
      total_amount: parseFloat(updatedBill.total_amount || '0'),
      energy_consumption: parseFloat(updatedBill.energy_consumption || '0'),
      corrected_amount: parseFloat(updatedBill.corrected_amount || '0'),
      bill_date: updatedBill.bill_date || new Date() // Handle null bill_date
    };
  } catch (error) {
    console.error('SELIC correction calculation failed:', error);
    throw error;
  }
}

/**
 * Helper function to get SELIC rates for a specific date range
 * This function should:
 * 1. Query the selic_rates table for the specified date range
 * 2. Return rates ordered by date
 */
export async function getSelicRatesForPeriod(startDate: Date, endDate: Date): Promise<SelicRate[]> {
  try {
    const results = await db.select()
      .from(selicRatesTable)
      .where(
        and(
          gte(selicRatesTable.date, startDate),
          lte(selicRatesTable.date, endDate)
        )
      )
      .orderBy(asc(selicRatesTable.date))
      .execute();

    return results.map(result => ({
      ...result,
      rate: parseFloat(result.rate) // Convert string to number for numeric column
    }));
  } catch (error) {
    console.error('Failed to fetch SELIC rates:', error);
    throw error;
  }
}

/**
 * Helper function to calculate accumulated correction factor
 * Applies monthly SELIC rates compounded over the period
 */
function calculateAccumulatedCorrection(selicRates: SelicRate[], startDate: Date, endDate: Date): number {
  if (selicRates.length === 0) {
    return 1.0; // No correction if no rates available
  }

  let correctionFactor = 1.0;
  
  // Group rates by month and apply compound correction
  const monthlyRates = new Map<string, number>();
  
  selicRates.forEach(rate => {
    const monthKey = `${rate.date.getFullYear()}-${rate.date.getMonth()}`;
    monthlyRates.set(monthKey, rate.rate);
  });

  // Calculate correction for each month from start to current
  const current = new Date(startDate);
  const end = new Date(endDate);
  
  while (current < end) {
    const monthKey = `${current.getFullYear()}-${current.getMonth()}`;
    const monthlyRate = monthlyRates.get(monthKey) || 0;
    
    // Apply monthly correction: (1 + monthly_rate)
    correctionFactor *= (1 + monthlyRate);
    
    // Move to next month
    current.setMonth(current.getMonth() + 1);
  }

  return correctionFactor;
}