/**
 * GOOGLE APPS SCRIPT BACKEND for ShroomTrack ERP
 * 
 * INSTRUCTIONS:
 * 1. Create a new Google Sheet.
 * 2. Add columns: ID, Status, SourceFarm, DateReceived, RawWeight, SpoiledWeight, NetWeight, WashStart, DryingEnd, PackedDate, Recipe, PackCount, ProcessConfig.
 * 3. Go to Extensions > Apps Script.
 * 4. Paste this code.
 * 5. Deploy > New Deployment > Type: Web App > Execute as: Me > Who has access: Anyone.
 * 6. Copy the Web App URL and paste it into the Settings page of the app.
 */

function doGet(e) {
  const action = e.parameter.action;
  
  if (action === 'GET_BATCHES') {
    return getBatches();
  }
  
  return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Invalid Action" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const action = data.action;
  const payload = data.payload;

  if (action === 'CREATE_BATCH') {
    return createBatch(payload);
  }
  
  if (action === 'UPDATE_BATCH') {
    return updateBatch(payload);
  }

  if (action === 'IMPORT_BATCHES') {
    return importBatches(payload);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Invalid Action" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getBatches() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const rows = sheet.getDataRange().getValues();
  const headers = rows.shift(); // Remove headers
  
  const batches = rows.map(row => {
    let processConfig = null;
    try {
      processConfig = row[12] ? JSON.parse(row[12]) : null;
    } catch (e) {}

    return {
      id: row[0],
      status: row[1],
      sourceFarm: row[2],
      dateReceived: row[3],
      rawWeightKg: Number(row[4]),
      spoiledWeightKg: Number(row[5]),
      netWeightKg: Number(row[6]),
      // Col 7 (H) & 8 (I) were legacy start/end times, we use processConfig now mostly
      packedDate: row[9],
      recipeType: row[10],
      packCount: Number(row[11]),
      processConfig: processConfig
    };
  });
  
  return response({ success: true, data: batches });
}

function createBatch(batch) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  sheet.appendRow([
    batch.id,
    batch.status,
    batch.sourceFarm,
    batch.dateReceived,
    batch.rawWeightKg,
    batch.spoiledWeightKg,
    batch.netWeightKg,
    '', '', '', '', '', '' // Empty processing/packing/config columns
  ]);
  
  return response({ success: true, data: batch });
}

function updateBatch(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  
  // Find row by ID (Column 0)
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === payload.id) {
      const rowIndex = i + 1;
      
      // Update Status (Col 2 -> index 1)
      sheet.getRange(rowIndex, 2).setValue(payload.status);
      
      // Update other fields based on status logic
      if (payload.packedDate) sheet.getRange(rowIndex, 10).setValue(payload.packedDate);
      if (payload.recipeType) sheet.getRange(rowIndex, 11).setValue(payload.recipeType);
      if (payload.packCount) sheet.getRange(rowIndex, 12).setValue(payload.packCount);
      if (payload.processConfig) sheet.getRange(rowIndex, 13).setValue(JSON.stringify(payload.processConfig));
      
      return response({ success: true, data: payload });
    }
  }
  return response({ success: false, message: "Batch not found" });
}

function importBatches(batches) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  const existingIds = new Set();
  
  // Skip header to find existing IDs
  for (let i = 1; i < data.length; i++) {
    existingIds.add(String(data[i][0]));
  }
  
  const newRows = [];
  
  batches.forEach(batch => {
    // Only add if ID does not exist
    if (!existingIds.has(String(batch.id))) {
       newRows.push([
        batch.id,
        batch.status,
        batch.sourceFarm,
        batch.dateReceived,
        batch.rawWeightKg,
        batch.spoiledWeightKg,
        batch.netWeightKg,
        '', '', 
        batch.packedDate || '',
        batch.recipeType || '',
        batch.packCount || '',
        batch.processConfig ? JSON.stringify(batch.processConfig) : ''
      ]);
      // Add to set to prevent duplicates within the import payload itself
      existingIds.add(String(batch.id));
    }
  });
  
  if (newRows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
    return response({ success: true, message: `Successfully imported ${newRows.length} batches.` });
  }
  
  return response({ success: true, message: "No new batches to import (duplicates skipped)." });
}

function response(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}