import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { electricityBillsTable, uploadBatchesTable } from '../db/schema';
import { type ProcessBillInput } from '../schema';
import { processBill } from '../handlers/process_bill';
import { eq } from 'drizzle-orm';

describe('processBill', () => {
  let testUploadId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create a test upload batch
    const uploadResult = await db.insert(uploadBatchesTable)
      .values({
        filename: 'test-bills.zip',
        total_files: 3,
        processed_files: 0,
        failed_files: 0,
        status: 'processing'
      })
      .returning()
      .execute();
    
    testUploadId = uploadResult[0].id;
  });

  afterEach(resetDB);

  describe('PDF file processing', () => {
    it('should successfully process a PDF file', async () => {
      const testInput: ProcessBillInput = {
        upload_id: testUploadId,
        filename: 'electricity-bill-july.pdf',
        file_buffer: Buffer.from('PDF content here')
      };

      const result = await processBill(testInput);

      expect(result.filename).toEqual('electricity-bill-july.pdf');
      expect(result.upload_id).toEqual(testUploadId);
      expect(result.total_amount).toEqual(123.45);
      expect(result.energy_consumption).toEqual(180);
      expect(result.bill_date).toBeInstanceOf(Date);
      expect(result.extraction_status).toEqual('success');
      expect(result.error_message).toBeNull();
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('should extract custom amounts from PDF with test markers', async () => {
      const testInput: ProcessBillInput = {
        upload_id: testUploadId,
        filename: 'test-bill.pdf',
        file_buffer: Buffer.from('TEST_AMOUNT TEST_CONSUMPTION TEST_DATE PDF content')
      };

      const result = await processBill(testInput);

      expect(result.total_amount).toEqual(156.78);
      expect(result.energy_consumption).toEqual(234);
      expect(result.bill_date).toEqual(new Date('2023-08-15'));
      expect(result.extraction_status).toEqual('success');
    });

    it('should handle PDF processing errors', async () => {
      const testInput: ProcessBillInput = {
        upload_id: testUploadId,
        filename: 'corrupted-bill.pdf',
        file_buffer: Buffer.from('INVALID_PDF corrupted data')
      };

      const result = await processBill(testInput);

      expect(result.filename).toEqual('corrupted-bill.pdf');
      expect(result.extraction_status).toEqual('error');
      expect(result.error_message).toEqual('Invalid PDF format');
      expect(result.total_amount).toEqual(0);
      expect(result.energy_consumption).toEqual(0);
    });
  });

  describe('Image file processing', () => {
    it('should successfully process a JPG image file', async () => {
      const testInput: ProcessBillInput = {
        upload_id: testUploadId,
        filename: 'scanned-bill.jpg',
        file_buffer: Buffer.from('Image binary data here')
      };

      const result = await processBill(testInput);

      expect(result.filename).toEqual('scanned-bill.jpg');
      expect(result.upload_id).toEqual(testUploadId);
      expect(result.total_amount).toEqual(87.65);
      expect(result.energy_consumption).toEqual(145);
      expect(result.bill_date).toBeInstanceOf(Date);
      expect(result.extraction_status).toEqual('success');
      expect(result.error_message).toBeNull();
    });

    it('should process PNG files correctly', async () => {
      const testInput: ProcessBillInput = {
        upload_id: testUploadId,
        filename: 'bill-image.png',
        file_buffer: Buffer.from('PNG image data')
      };

      const result = await processBill(testInput);

      expect(result.filename).toEqual('bill-image.png');
      expect(result.extraction_status).toEqual('success');
      expect(typeof result.total_amount).toEqual('number');
      expect(typeof result.energy_consumption).toEqual('number');
    });

    it('should extract custom amounts from images with OCR markers', async () => {
      const testInput: ProcessBillInput = {
        upload_id: testUploadId,
        filename: 'ocr-test.jpeg',
        file_buffer: Buffer.from('OCR_AMOUNT OCR_CONSUMPTION OCR_DATE image data')
      };

      const result = await processBill(testInput);

      expect(result.total_amount).toEqual(98.76);
      expect(result.energy_consumption).toEqual(156);
      expect(result.bill_date).toEqual(new Date('2023-09-20'));
      expect(result.extraction_status).toEqual('success');
    });

    it('should handle OCR processing errors', async () => {
      const testInput: ProcessBillInput = {
        upload_id: testUploadId,
        filename: 'unreadable.tiff',
        file_buffer: Buffer.from('UNREADABLE_IMAGE poor quality image')
      };

      const result = await processBill(testInput);

      expect(result.filename).toEqual('unreadable.tiff');
      expect(result.extraction_status).toEqual('error');
      expect(result.error_message).toEqual('Image text is unreadable');
      expect(result.total_amount).toEqual(0);
    });
  });

  describe('File type validation', () => {
    it('should reject unsupported file types', async () => {
      const testInput: ProcessBillInput = {
        upload_id: testUploadId,
        filename: 'document.docx',
        file_buffer: Buffer.from('Word document content')
      };

      const result = await processBill(testInput);

      expect(result.extraction_status).toEqual('error');
      expect(result.error_message).toEqual('Unsupported file type: docx');
      expect(result.total_amount).toEqual(0);
      expect(result.energy_consumption).toEqual(0);
    });

    it('should handle files without extensions', async () => {
      const testInput: ProcessBillInput = {
        upload_id: testUploadId,
        filename: 'bill-no-extension',
        file_buffer: Buffer.from('Unknown file format')
      };

      const result = await processBill(testInput);

      expect(result.extraction_status).toEqual('error');
      expect(result.error_message).toMatch(/unsupported file type/i);
    });
  });

  describe('Database operations', () => {
    it('should save bill data to database', async () => {
      const testInput: ProcessBillInput = {
        upload_id: testUploadId,
        filename: 'test-save.pdf',
        file_buffer: Buffer.from('PDF content')
      };

      const result = await processBill(testInput);

      // Verify data was saved to database
      const bills = await db.select()
        .from(electricityBillsTable)
        .where(eq(electricityBillsTable.id, result.id))
        .execute();

      expect(bills).toHaveLength(1);
      const savedBill = bills[0];
      
      expect(savedBill.filename).toEqual('test-save.pdf');
      expect(savedBill.upload_id).toEqual(testUploadId);
      expect(parseFloat(savedBill.total_amount || '0')).toEqual(123.45);
      expect(parseFloat(savedBill.energy_consumption || '0')).toEqual(180);
      expect(savedBill.extraction_status).toEqual('success');
      expect(savedBill.created_at).toBeInstanceOf(Date);
    });

    it('should handle non-existent upload batch', async () => {
      const testInput: ProcessBillInput = {
        upload_id: 99999, // Non-existent upload ID
        filename: 'orphan-bill.pdf',
        file_buffer: Buffer.from('PDF content')
      };

      await expect(processBill(testInput)).rejects.toThrow(/upload batch.*not found/i);
    });

    it('should save error details to database', async () => {
      const testInput: ProcessBillInput = {
        upload_id: testUploadId,
        filename: 'error-test.pdf',
        file_buffer: Buffer.from('CORRUPTED_DATA invalid content')
      };

      const result = await processBill(testInput);

      // Verify error was saved to database
      const bills = await db.select()
        .from(electricityBillsTable)
        .where(eq(electricityBillsTable.id, result.id))
        .execute();

      const savedBill = bills[0];
      expect(savedBill.extraction_status).toEqual('error');
      expect(savedBill.error_message).toEqual('Corrupted PDF data');
      expect(savedBill.total_amount).toBeNull();
      expect(savedBill.energy_consumption).toBeNull();
    });
  });

  describe('Data type conversions', () => {
    it('should properly convert numeric fields', async () => {
      const testInput: ProcessBillInput = {
        upload_id: testUploadId,
        filename: 'conversion-test.pdf',
        file_buffer: Buffer.from('TEST_AMOUNT TEST_CONSUMPTION')
      };

      const result = await processBill(testInput);

      // Verify return types are numbers
      expect(typeof result.total_amount).toEqual('number');
      expect(typeof result.energy_consumption).toEqual('number');
      expect(result.total_amount).toBeGreaterThan(0);
      expect(result.energy_consumption).toBeGreaterThan(0);
    });

    it('should handle null numeric values correctly', async () => {
      const testInput: ProcessBillInput = {
        upload_id: testUploadId,
        filename: 'null-test.txt', // Unsupported type to trigger error
        file_buffer: Buffer.from('unsupported content')
      };

      const result = await processBill(testInput);

      expect(result.total_amount).toEqual(0); // Converted from null
      expect(result.energy_consumption).toEqual(0); // Converted from null
      expect(result.corrected_amount).toBeNull(); // Should remain null
    });
  });

  describe('Processing different image formats', () => {
    const imageFormats = ['jpg', 'jpeg', 'png', 'tiff', 'bmp'];

    imageFormats.forEach(format => {
      it(`should process ${format.toUpperCase()} files correctly`, async () => {
        const testInput: ProcessBillInput = {
          upload_id: testUploadId,
          filename: `test-bill.${format}`,
          file_buffer: Buffer.from(`${format} image data`)
        };

        const result = await processBill(testInput);

        expect(result.filename).toEqual(`test-bill.${format}`);
        expect(result.extraction_status).toEqual('success');
        expect(result.total_amount).toBeGreaterThan(0);
        expect(result.energy_consumption).toBeGreaterThan(0);
      });
    });
  });
});