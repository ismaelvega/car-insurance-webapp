import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../utils/supabase/admin';

// API route for uploading CSV files to validaciones table

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
    const fileName = `validaciones_${userIdentifier}_${timestamp}_${file.name}`;

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

    // Process CSV and insert data into database
    const csvText = buffer.toString('utf-8');
    const processResult = await processCSVData(csvText, userEmail, userRole);

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
      message: 'File uploaded and processed successfully',
      fileName: fileName,
      recordsProcessed: processResult.recordsProcessed,
      fileUrl: uploadData.path
    });

  } catch (error) {
    console.error('Upload route error:', error);
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

// Function to process CSV data and insert into validaciones table
async function processCSVData(csvText, userEmail, userRole) {
  try {
    // Parse CSV data
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) {
      return { success: false, error: 'CSV file must have at least header and one data row' };
    }

    // Get header row and clean it
    const headers = parseCSVLine(lines[0]);
    console.log('Validaciones Headers found:', headers);
    console.log('Number of headers:', headers.length);
    
    // Process data rows
    const records = [];
    let recordsProcessed = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines

      const values = parseCSVLine(line);
      
      console.log(`Row ${i + 1}: found ${values.length} values, expected ${headers.length}`);
      
      if (values.length !== headers.length) {
        console.warn(`Row ${i + 1} has ${values.length} values but expected ${headers.length}.`);
        console.warn(`Values: [${values.slice(0, 5).join(', ')}...]`); // Show first 5 values for debugging
        
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
        record[header] = values[index] || null;
      });

      records.push(record);
      recordsProcessed++;
    }

    if (records.length === 0) {
      return { success: false, error: 'No valid records found in CSV file' };
    }

    console.log('About to insert validaciones records:', records.length);
    console.log('Sample validaciones record:', JSON.stringify(records[0], null, 2));
    console.log('Headers found:', headers);

    // Insert records into validaciones table in batches
    const batchSize = 1; // Reduce batch size for debugging
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      console.log(`Inserting validaciones batch ${i + 1} of ${Math.ceil(records.length / batchSize)}`);
      
      const { data, error: insertError } = await supabaseAdmin
        .from('validaciones')
        .insert(batch)
        .select();

      if (insertError) {
        console.error('Database insert error:', insertError);
        console.error('Tried to insert:', JSON.stringify(batch[0], null, 2));
        return { 
          success: false, 
          error: `Failed to insert records: ${insertError.message}. Details: ${JSON.stringify(insertError)}` 
        };
      }
      
      console.log('Successfully inserted:', data?.length || 0, 'validaciones records');
    }

    return { 
      success: true, 
      recordsProcessed: recordsProcessed 
    };

  } catch (error) {
    console.error('CSV processing error:', error);
    return { 
      success: false, 
      error: 'Failed to process CSV data' 
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
