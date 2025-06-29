import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../utils/supabase/admin';

// API route for uploading CSV files to renovaciones table

export async function POST(request) {
  try {
    // Get the form data from the request
    const formData = await request.formData();
    const file = formData.get('file');
    const userEmail = formData.get('userEmail');
    const userRole = formData.get('userRole');

    // Validate file exists
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate user email
    if (!userEmail) {
      return NextResponse.json(
        { error: 'User email is required' },
        { status: 400 }
      );
    }

    // Validate user role
    if (!userRole) {
      return NextResponse.json(
        { error: 'User role is required' },
        { status: 400 }
      );
    }

    // Validate file type (only CSV files)
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json(
        { error: 'Only CSV files are allowed' },
        { status: 400 }
      );
    }

    // Generate unique filename with timestamp and user identifier
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const userIdentifier = userEmail.split('@')[0];
    const fileName = `renovaciones_${userIdentifier}_${timestamp}_${file.name}`;

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload file to Supabase Storage (csv-files bucket)
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('csv-files')
      .upload(fileName, buffer, {
        contentType: 'text/csv'
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file to storage' },
        { status: 500 }
      );
    }

    // Process CSV and insert data into renovaciones table
    const csvText = buffer.toString('utf-8');
    const processResult = await processRenovacionesCSV(csvText, userEmail, userRole);

    if (!processResult.success) {
      // If data processing failed, delete the uploaded file
      await supabaseAdmin.storage
        .from('csv-files')
        .remove([fileName]);

      return NextResponse.json(
        { error: processResult.error },
        { status: 400 }
      );
    }

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Renovaciones file uploaded and processed successfully',
      fileName: fileName,
      recordsProcessed: processResult.recordsProcessed,
      fileUrl: uploadData.path
    });

  } catch (error) {
    console.error('Upload renovaciones route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Function to parse CSV properly handling quoted fields
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Don't forget the last field
  result.push(current.trim());
  
  return result.map(value => value.replace(/^"(.*)"$/, '$1')); // Remove surrounding quotes
}

// Function to process CSV data specifically for renovaciones table
async function processRenovacionesCSV(csvText, userEmail, userRole) {
  try {
    // Parse CSV data
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) {
      return { success: false, error: 'CSV file must have at least header and one data row' };
    }

    // Get header row and clean it
    const headers = parseCSVLine(lines[0]);
    console.log('Renovaciones Headers found:', headers);
    console.log('Number of headers:', headers.length);
    
    // Expected columns for renovaciones table based on the schema
    const expectedColumns = [
      'SOLICITUD', 'ACREDITADO', 'CREDITO', 'NOMBRE', 'COSTO AUTO', 'COSTO VIDA', 
      'TOTAL', 'SERIE', 'VIGENCIA AUTO', 'VIGENCIA VIDA', 'NO. POLIZA AUTO', 
      'NO. POLIZA VIDA', 'FECHA PROC Y EMISION', 'PLAN', 'Oficina', 'Modulo'
    ];
    
    // Validate that we have the required columns (at least some core ones)
    const requiredColumns = ['SOLICITUD', 'NOMBRE', 'CREDITO', 'VIGENCIA AUTO'];
    const missingRequired = requiredColumns.filter(col => 
      !headers.some(header => header.toLowerCase() === col.toLowerCase())
    );
    
    if (missingRequired.length > 0) {
      return { 
        success: false, 
        error: `CSV must contain the following required columns: ${missingRequired.join(', ')}` 
      };
    }
    
    // Process data rows
    const records = [];
    let recordsProcessed = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines

      const values = parseCSVLine(line);
      
      console.log(`Renovaciones Row ${i + 1}: found ${values.length} values, expected ${headers.length}`);
      
      if (values.length !== headers.length) {
        console.warn(`Row ${i + 1} has ${values.length} values but expected ${headers.length}.`);
        
        // Try to handle by padding with nulls or truncating
        if (values.length < headers.length) {
          // Pad with nulls if too few values
          while (values.length < headers.length) {
            values.push(null);
          }
          console.log(`Padded row ${i + 1} with nulls`);
        } else {
          // Truncate if too many values
          values.splice(headers.length);
          console.log(`Truncated row ${i + 1} to match header count`);
        }
      }

      // Create record object
      const record = {};
      headers.forEach((header, index) => {
        let value = values[index] || null;
        
        // Handle special cases for renovaciones data
        if (value === 'NaT' || value === 'NaN' || value === '') {
          value = null;
        }
        
        // Convert numeric strings to numbers for appropriate fields
        if (header.toLowerCase().includes('solicitud') || 
            header.toLowerCase().includes('acreditado') ||
            header.toLowerCase().includes('credito') ||
            header.toLowerCase().includes('costo') ||
            header.toLowerCase().includes('total') ||
            header.toLowerCase().includes('poliza') ||
            header.toLowerCase().includes('modulo')) {
          const numValue = parseFloat(value);
          if (!isNaN(numValue)) {
            value = numValue;
          }
        }
        
        record[header] = value;
      });

      records.push(record);
      recordsProcessed++;
    }

    if (records.length === 0) {
      return { success: false, error: 'No valid records found in CSV file' };
    }

    console.log('About to insert renovaciones records:', records.length);
    console.log('Sample renovaciones record:', JSON.stringify(records[0], null, 2));

    // Insert records into renovaciones table in batches
    const batchSize = 50; // Larger batch size for renovaciones
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      console.log(`Inserting renovaciones batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(records.length / batchSize)}`);
      
      const { data, error: insertError } = await supabaseAdmin
        .from('renovaciones')
        .insert(batch)
        .select();

      if (insertError) {
        console.error('Database insert error:', insertError);
        console.error('Tried to insert:', JSON.stringify(batch[0], null, 2));
        return { 
          success: false, 
          error: `Failed to insert renovaciones records: ${insertError.message}. Details: ${JSON.stringify(insertError)}` 
        };
      }
      
      console.log('Successfully inserted:', data?.length || 0, 'renovaciones records');
    }

    return { 
      success: true, 
      recordsProcessed: recordsProcessed 
    };

  } catch (error) {
    console.error('Renovaciones CSV processing error:', error);
    return { 
      success: false, 
      error: 'Failed to process renovaciones CSV data: ' + error.message 
    };
  }
}

// Only allow POST method
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' }, 
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed' }, 
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed' }, 
    { status: 405 }
  );
}
