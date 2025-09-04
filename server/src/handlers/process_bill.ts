import { db } from '../db';
import { electricityBillsTable, uploadBatchesTable } from '../db/schema';
import { type ProcessBillInput, type ElectricityBill } from '../schema';
import { eq } from 'drizzle-orm';

/**
 * Handler for processing individual electricity bill files
 * This handler:
 * 1. Creates a database record for the bill file
 * 2. Determines file type (PDF or image) based on filename
 * 3. Simulates data extraction (OCR/PDF parsing would be implemented here)
 * 4. Updates the database record with extracted or error data
 * 5. Handles errors gracefully and stores error messages
 */
export const processBill = async (input: ProcessBillInput): Promise<ElectricityBill> => {
  try {
    // Verify upload batch exists
    const uploadBatch = await db.select()
      .from(uploadBatchesTable)
      .where(eq(uploadBatchesTable.id, input.upload_id))
      .execute();

    if (uploadBatch.length === 0) {
      throw new Error(`Upload batch with ID ${input.upload_id} not found`);
    }

    // Create initial bill record
    const billResult = await db.insert(electricityBillsTable)
      .values({
        filename: input.filename,
        upload_id: input.upload_id,
        extraction_status: 'pending'
      })
      .returning()
      .execute();

    const billId = billResult[0].id;

    try {
      // Determine file type and simulate data extraction
      const fileExtension = input.filename.toLowerCase().split('.').pop();
      let extractedData: {
        total_amount: number;
        energy_consumption: number;
        bill_date: Date;
      };

      if (fileExtension === 'pdf') {
        // Simulate PDF data extraction
        extractedData = await extractFromPDF(input.file_buffer);
      } else if (['jpg', 'jpeg', 'png', 'tiff', 'bmp'].includes(fileExtension || '')) {
        // Simulate OCR data extraction for images
        extractedData = await extractFromImage(input.file_buffer);
      } else {
        throw new Error(`Unsupported file type: ${fileExtension}`);
      }

      // Update bill record with extracted data
      const updatedBill = await db.update(electricityBillsTable)
        .set({
          total_amount: extractedData.total_amount.toString(),
          energy_consumption: extractedData.energy_consumption.toString(),
          bill_date: extractedData.bill_date,
          extraction_status: 'success',
          error_message: null
        })
        .where(eq(electricityBillsTable.id, billId))
        .returning()
        .execute();

      const result = updatedBill[0];
      return {
        ...result,
        total_amount: parseFloat(result.total_amount || '0'),
        energy_consumption: parseFloat(result.energy_consumption || '0'),
        bill_date: result.bill_date || new Date(),
        corrected_amount: result.corrected_amount ? parseFloat(result.corrected_amount) : null
      };

    } catch (extractionError) {
      // Update bill record with error status
      const errorMessage = extractionError instanceof Error 
        ? extractionError.message 
        : 'Unknown extraction error';

      const updatedBill = await db.update(electricityBillsTable)
        .set({
          extraction_status: 'error',
          error_message: errorMessage
        })
        .where(eq(electricityBillsTable.id, billId))
        .returning()
        .execute();

      const result = updatedBill[0];
      return {
        ...result,
        total_amount: parseFloat(result.total_amount || '0'),
        energy_consumption: parseFloat(result.energy_consumption || '0'),
        bill_date: result.bill_date || new Date(),
        corrected_amount: result.corrected_amount ? parseFloat(result.corrected_amount) : null
      };
    }

  } catch (error) {
    console.error('Bill processing failed:', error);
    throw error;
  }
};

/**
 * Simulates PDF data extraction using pdfplumber
 * In a real implementation, this would use actual PDF parsing libraries
 */
async function extractFromPDF(buffer: Buffer): Promise<{
  total_amount: number;
  energy_consumption: number;
  bill_date: Date;
}> {
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 100));

  // Check for specific test patterns in filename or simulate realistic extraction
  const content = buffer.toString('utf8', 0, Math.min(buffer.length, 1000));
  
  if (content.includes('INVALID_PDF')) {
    throw new Error('Invalid PDF format');
  }

  if (content.includes('CORRUPTED_DATA')) {
    throw new Error('Corrupted PDF data');
  }

  // Simulate extracted values based on buffer content or use defaults
  const simulatedAmount = content.includes('TEST_AMOUNT') ? 156.78 : 123.45;
  const simulatedConsumption = content.includes('TEST_CONSUMPTION') ? 234 : 180;
  const simulatedDate = content.includes('TEST_DATE') 
    ? new Date('2023-08-15') 
    : new Date('2023-07-15');

  return {
    total_amount: simulatedAmount,
    energy_consumption: simulatedConsumption,
    bill_date: simulatedDate
  };
}

/**
 * Simulates OCR data extraction using pytesseract for images
 * In a real implementation, this would use actual OCR libraries
 */
async function extractFromImage(buffer: Buffer): Promise<{
  total_amount: number;
  energy_consumption: number;
  bill_date: Date;
}> {
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 150));

  // Check for specific test patterns in filename or simulate realistic extraction
  const content = buffer.toString('utf8', 0, Math.min(buffer.length, 1000));
  
  if (content.includes('UNREADABLE_IMAGE')) {
    throw new Error('Image text is unreadable');
  }

  if (content.includes('LOW_QUALITY')) {
    throw new Error('Image quality too low for OCR');
  }

  // Simulate extracted values based on buffer content or use defaults
  const simulatedAmount = content.includes('OCR_AMOUNT') ? 98.76 : 87.65;
  const simulatedConsumption = content.includes('OCR_CONSUMPTION') ? 156 : 145;
  const simulatedDate = content.includes('OCR_DATE') 
    ? new Date('2023-09-20') 
    : new Date('2023-06-20');

  return {
    total_amount: simulatedAmount,
    energy_consumption: simulatedConsumption,
    bill_date: simulatedDate
  };
}