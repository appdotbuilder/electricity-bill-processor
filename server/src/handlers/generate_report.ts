import { db } from '../db';
import { electricityBillsTable, uploadBatchesTable } from '../db/schema';
import { type GenerateReportInput, type ConsolidatedReport } from '../schema';
import { eq } from 'drizzle-orm';

/**
 * Handler for generating consolidated reports of electricity bill data
 * This handler:
 * 1. Fetches all bills for the specified upload batch
 * 2. Calculates summary statistics (totals, averages, etc.)
 * 3. Returns consolidated report data
 */
export async function generateReport(input: GenerateReportInput): Promise<ConsolidatedReport> {
  try {
    // Verify upload batch exists
    const uploadBatch = await db.select()
      .from(uploadBatchesTable)
      .where(eq(uploadBatchesTable.id, input.upload_id))
      .execute();

    if (uploadBatch.length === 0) {
      throw new Error(`Upload batch with ID ${input.upload_id} not found`);
    }

    // Fetch all bills for the upload batch
    const bills = await db.select()
      .from(electricityBillsTable)
      .where(eq(electricityBillsTable.upload_id, input.upload_id))
      .execute();

    // Convert numeric fields from strings to numbers and handle null dates
    const convertedBills = bills.map(bill => ({
      ...bill,
      total_amount: bill.total_amount ? parseFloat(bill.total_amount) : 0,
      energy_consumption: bill.energy_consumption ? parseFloat(bill.energy_consumption) : 0,
      corrected_amount: bill.corrected_amount ? parseFloat(bill.corrected_amount) : null,
      bill_date: bill.bill_date || new Date() // Provide default date for null values
    }));

    // Calculate summary statistics
    const totalBills = convertedBills.length;
    const successfulExtractions = convertedBills.filter(bill => bill.extraction_status === 'success').length;
    const failedExtractions = convertedBills.filter(bill => bill.extraction_status === 'error').length;

    // Calculate totals only from successfully processed bills
    const successfulBills = convertedBills.filter(bill => bill.extraction_status === 'success');
    
    const totalOriginalAmount = successfulBills.reduce((sum, bill) => sum + (bill.total_amount || 0), 0);
    const totalCorrectedAmount = successfulBills.reduce((sum, bill) => sum + (bill.corrected_amount || bill.total_amount || 0), 0);
    const totalEnergyConsumption = successfulBills.reduce((sum, bill) => sum + (bill.energy_consumption || 0), 0);

    return {
      bills: convertedBills,
      summary: {
        total_bills: totalBills,
        successful_extractions: successfulExtractions,
        failed_extractions: failedExtractions,
        total_original_amount: totalOriginalAmount,
        total_corrected_amount: totalCorrectedAmount,
        total_energy_consumption: totalEnergyConsumption
      }
    };
  } catch (error) {
    console.error('Report generation failed:', error);
    throw error;
  }
}

/**
 * Helper function to export report data to Excel format
 * This function would:
 * 1. Create Excel workbook with bill data
 * 2. Include summary sheet with aggregate statistics
 * 3. Format numbers and dates appropriately
 * 4. Return file buffer for download
 * 
 * Note: In a real implementation, you would use a library like 'exceljs' or 'xlsx'
 */
export async function exportToExcel(report: ConsolidatedReport): Promise<Buffer> {
  // Create Excel-like CSV content as a simple implementation
  const headers = ['ID', 'Filename', 'Upload ID', 'Total Amount', 'Energy Consumption (kWh)', 'Bill Date', 'Corrected Amount', 'Status', 'Error Message', 'Created At'];
  
  const rows = report.bills.map(bill => [
    bill.id.toString(),
    bill.filename,
    bill.upload_id.toString(),
    bill.total_amount.toFixed(2),
    bill.energy_consumption.toFixed(2),
    bill.bill_date ? bill.bill_date.toISOString().split('T')[0] : '',
    bill.corrected_amount ? bill.corrected_amount.toFixed(2) : '',
    bill.extraction_status,
    bill.error_message || '',
    bill.created_at.toISOString().split('T')[0]
  ]);

  // Add summary section
  const summaryRows = [
    [''],
    ['SUMMARY'],
    ['Total Bills', report.summary.total_bills.toString()],
    ['Successful Extractions', report.summary.successful_extractions.toString()],
    ['Failed Extractions', report.summary.failed_extractions.toString()],
    ['Total Original Amount', report.summary.total_original_amount.toFixed(2)],
    ['Total Corrected Amount', report.summary.total_corrected_amount.toFixed(2)],
    ['Total Energy Consumption', report.summary.total_energy_consumption.toFixed(2)]
  ];

  const allRows = [headers, ...rows, ...summaryRows];
  const csvContent = allRows.map(row => row.join(',')).join('\n');
  
  return Buffer.from(csvContent, 'utf-8');
}

/**
 * Helper function to export report data to CSV format
 * This function:
 * 1. Converts bill data to CSV format
 * 2. Includes headers and proper formatting
 * 3. Handles special characters and encoding
 * 4. Returns file buffer for download
 */
export async function exportToCSV(report: ConsolidatedReport): Promise<Buffer> {
  const headers = ['ID', 'Filename', 'Upload ID', 'Total Amount', 'Energy Consumption (kWh)', 'Bill Date', 'Corrected Amount', 'Status', 'Error Message', 'Created At'];
  
  const rows = report.bills.map(bill => [
    bill.id.toString(),
    `"${bill.filename}"`, // Quote filename to handle special characters
    bill.upload_id.toString(),
    bill.total_amount.toFixed(2),
    bill.energy_consumption.toFixed(2),
    bill.bill_date ? bill.bill_date.toISOString().split('T')[0] : '',
    bill.corrected_amount ? bill.corrected_amount.toFixed(2) : '',
    bill.extraction_status,
    bill.error_message ? `"${bill.error_message.replace(/"/g, '""')}"` : '', // Escape quotes
    bill.created_at.toISOString().split('T')[0]
  ]);

  const allRows = [headers, ...rows];
  const csvContent = allRows.map(row => row.join(',')).join('\n');
  
  return Buffer.from(csvContent, 'utf-8');
}