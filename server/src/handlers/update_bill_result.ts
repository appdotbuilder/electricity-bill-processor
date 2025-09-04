import { db } from '../db';
import { electricityBillsTable, uploadBatchesTable } from '../db/schema';
import { type UpdateBillResultInput, type ElectricityBill } from '../schema';
import { eq, and, sql } from 'drizzle-orm';

/**
 * Handler for updating electricity bill processing results
 * This handler:
 * 1. Updates an existing bill record with extraction results
 * 2. Handles both successful extractions and error cases
 * 3. Validates input data before updating
 * 4. Updates the parent upload batch progress counters
 * 5. Returns the updated bill record
 */
export async function updateBillResult(input: UpdateBillResultInput): Promise<ElectricityBill> {
  try {
    // Verify the bill exists and get its current state
    const existingBills = await db.select()
      .from(electricityBillsTable)
      .where(eq(electricityBillsTable.id, input.id))
      .execute();

    if (existingBills.length === 0) {
      throw new Error(`Bill with ID ${input.id} not found`);
    }

    const existingBill = existingBills[0];

    // Build update object with only provided fields
    const updateData: any = {
      extraction_status: input.extraction_status
    };

    // Only update fields that were provided in the input
    if (input.total_amount !== undefined) {
      updateData.total_amount = input.total_amount.toString();
    }
    if (input.energy_consumption !== undefined) {
      updateData.energy_consumption = input.energy_consumption.toString();
    }
    if (input.bill_date !== undefined) {
      updateData.bill_date = input.bill_date;
    }
    if (input.corrected_amount !== undefined) {
      updateData.corrected_amount = input.corrected_amount ? input.corrected_amount.toString() : null;
    }
    if (input.error_message !== undefined) {
      updateData.error_message = input.error_message;
    }

    // Update the bill record
    const updatedBills = await db.update(electricityBillsTable)
      .set(updateData)
      .where(eq(electricityBillsTable.id, input.id))
      .returning()
      .execute();

    const updatedBill = updatedBills[0];

    // Update batch progress if the extraction status changed
    const wasSuccessful = input.extraction_status === 'success';
    const wasPending = existingBill.extraction_status === 'pending';
    
    if (wasPending) {
      await updateUploadBatchProgress(existingBill.upload_id, wasSuccessful);
    }

    // Convert numeric fields back to numbers and handle nullable fields
    return {
      ...updatedBill,
      total_amount: updatedBill.total_amount ? parseFloat(updatedBill.total_amount) : 0,
      energy_consumption: updatedBill.energy_consumption ? parseFloat(updatedBill.energy_consumption) : 0,
      bill_date: updatedBill.bill_date || new Date(), // Ensure bill_date is always a Date
      corrected_amount: updatedBill.corrected_amount ? parseFloat(updatedBill.corrected_amount) : null
    };
  } catch (error) {
    console.error('Bill result update failed:', error);
    throw error;
  }
}

/**
 * Helper function to update upload batch progress
 * This function:
 * 1. Updates processed_files and failed_files counters
 * 2. Sets batch status to 'completed' when all files are processed
 * 3. Sets completed_at timestamp when processing finishes
 */
export async function updateUploadBatchProgress(uploadId: number, isSuccess: boolean): Promise<void> {
  try {
    // Get current batch state
    const batches = await db.select()
      .from(uploadBatchesTable)
      .where(eq(uploadBatchesTable.id, uploadId))
      .execute();

    if (batches.length === 0) {
      throw new Error(`Upload batch with ID ${uploadId} not found`);
    }

    const batch = batches[0];

    // Calculate new counters
    const newProcessedFiles = batch.processed_files + 1;
    const newFailedFiles = batch.failed_files + (isSuccess ? 0 : 1);

    // Determine if batch is complete
    const isComplete = newProcessedFiles >= batch.total_files;
    const newStatus = isComplete ? 'completed' : 'processing';

    // Build update object
    const updateData: any = {
      processed_files: newProcessedFiles,
      failed_files: newFailedFiles,
      status: newStatus
    };

    // Set completed_at timestamp if batch is complete
    if (isComplete) {
      updateData.completed_at = new Date();
    }

    // Update the batch record
    await db.update(uploadBatchesTable)
      .set(updateData)
      .where(eq(uploadBatchesTable.id, uploadId))
      .execute();
  } catch (error) {
    console.error('Upload batch progress update failed:', error);
    throw error;
  }
}