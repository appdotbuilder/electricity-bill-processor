import { db } from '../db';
import { uploadBatchesTable, electricityBillsTable } from '../db/schema';
import { type GetUploadStatusInput, type UploadStatusResponse } from '../schema';
import { eq } from 'drizzle-orm';

/**
 * Handler for getting the status of an upload batch and its associated bills
 * This handler should:
 * 1. Fetch the upload batch record by ID
 * 2. Fetch all associated electricity bills
 * 3. Return comprehensive status information
 * 4. Include processing progress and any error details
 */
export async function getUploadStatus(input: GetUploadStatusInput): Promise<UploadStatusResponse> {
  try {
    // Fetch the upload batch record by ID
    const uploadResults = await db.select()
      .from(uploadBatchesTable)
      .where(eq(uploadBatchesTable.id, input.upload_id))
      .execute();

    if (uploadResults.length === 0) {
      throw new Error(`Upload batch with ID ${input.upload_id} not found`);
    }

    const upload = uploadResults[0];

    // Fetch all associated electricity bills
    const billResults = await db.select()
      .from(electricityBillsTable)
      .where(eq(electricityBillsTable.upload_id, input.upload_id))
      .execute();

    // Convert numeric fields back to numbers for the bills
    // Handle nullable fields by providing defaults for pending/failed extractions
    const bills = billResults.map(bill => ({
      ...bill,
      total_amount: bill.total_amount ? parseFloat(bill.total_amount) : 0,
      energy_consumption: bill.energy_consumption ? parseFloat(bill.energy_consumption) : 0,
      bill_date: bill.bill_date || new Date(),
      corrected_amount: bill.corrected_amount ? parseFloat(bill.corrected_amount) : null
    }));

    // Return the comprehensive status information
    return {
      upload,
      bills
    };
  } catch (error) {
    console.error('Getting upload status failed:', error);
    throw error;
  }
}