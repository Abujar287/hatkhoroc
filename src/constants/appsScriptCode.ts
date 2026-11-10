// ====================================================================
// হাত খরচ (Hisab Kitab): গুগল শিট Apps Script কোড (Code.gs)
// ভার্সন: 7.0 (Unified 1-Tab Multi-User Architecture)
// ====================================================================

export const GOOGLE_APPS_SCRIPT_CODE_V7 = `// ====================================================================
// হাত খরচ (Hisab Kitab): গুগল শিট Apps Script কোড (Code.gs)
// ভার্সন: 7.0 (Unified 1-Tab Multi-User Architecture)
// প্রতিটি ইউজারের (যেমন: abujar287, munni) জন্য সম্পূর্ণ ডেটা একটি ট্যাবেই সংরক্ষিত হবে:
// [Entry: A-G] [Budget: I-M] [Category: O-P] [month mapping: R-V] [Tasks: X-AJ]
// কোনো এন্ট্রি ডিলিট করলে শুধুমাত্র সেই কলাম রেঞ্জ ডিলিট হবে, ডানের কলামের ডেটা অক্ষত থাকবে!
// ====================================================================

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var data = {};
    try {
      data = JSON.parse(e.postData.contents);
    } catch (err) {
      data = (e && e.parameter) ? e.parameter : {};
    }
    
    var tabName = (data.sheetTab || data.sheet || (e && e.parameter ? (e.parameter.sheetTab || e.parameter.sheet) : '') || 'abujar287').toString().trim();
    var sheet = getTargetSheet(ss, tabName);
    var action = (data.action || (e && e.parameter ? e.parameter.action : '') || '').toString().toLowerCase().trim();
    
    // ১. নতুন ইউজার ট্যাব তৈরি অ্যাকশন (CREATE TAB - যেমন munni)
    if (action === 'createtab') {
      ensureUnifiedTemplateHeaders(sheet);
      return ContentService.createTextOutput(JSON.stringify({
        result: 'success',
        sheetTab: sheet.getName(),
        message: 'ইউজার শিট ট্যাব প্রস্তুত: ' + sheet.getName()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ২. ট্রানজ্যাকশন এন্ট্রি রো মুছে ফেলা (DELETE ENTRY - শুধুমাত্র A-G কলাম রেঞ্জ ডিলিট ও শিফট আপ)
    if (action === 'delete' || data.isDelete === true) {
      return handleDeleteEntry(sheet, data, e ? e.parameter : null);
    }
    
    // ৩. ব্যাচ পুশ ব্যাকআপ (PUSH ALL TRANSACTIONS)
    if (action === 'pushall' && Array.isArray(data.transactions)) {
      for (var k = 0; k < data.transactions.length; k++) {
        var t = data.transactions[k];
        insertEntryIfNotExists(sheet, t.id, t.datetime || new Date().toLocaleString(), t.type, t.category, t.date, t.value, t.note || '');
      }
      return ContentService.createTextOutput(JSON.stringify({
        result: 'success',
        message: 'সব ডেটা সেভ হয়েছে',
        sheetTab: sheet.getName()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // ৪. ট্রানজ্যাকশন আপডেট (UPDATE ENTRY - শুধুমাত্র A-G কলাম আপডেট)
    if (action === 'update') {
      return handleUpdateEntry(sheet, data);
    }

    // ৫.১ একক ক্যাটাগরি যোগ করা (ADD CATEGORY - O-P কলামে অ্যাপেন্ড)
    if (action === 'addcategory') {
      var cName = String(data.category || '').trim();
      var cType = String(data.type || 'Expense').trim();
      if (cName) {
        insertCategoryIfNotExists(sheet, cType, cName);
      }
      return ContentService.createTextOutput(JSON.stringify({
        result: 'success',
        sheetTab: sheet.getName(),
        message: 'ক্যাটাগরি যুক্ত হয়েছে: ' + cName
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ৫.২ নির্দিষ্ট ক্যাটাগরি ডিলিট (DELETE CATEGORY - শুধুমাত্র O-P কলাম ডিলিট)
    if (action === 'deletecategory') {
      handleDeleteCategory(sheet, String(data.category || '').trim());
      return ContentService.createTextOutput(JSON.stringify({
        result: 'success',
        sheetTab: sheet.getName(),
        message: 'ক্যাটাগরি ডিলিট হয়েছে'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ৫.৩ সব ক্যাটাগরি নিরাপদ সিঙ্ক (SAVE CATEGORIES - O-P কলামে মার্জ)
    if (action === 'savecategories' || action === 'savecategory') {
      var cats = Array.isArray(data.categories) ? data.categories : [];
      var addedCount = 0;
      for (var c = 0; c < cats.length; c++) {
        var item = cats[c];
        if (item && item.category) {
          var cleanName = String(item.category).trim();
          if (cleanName && insertCategoryIfNotExists(sheet, item.type || 'Expense', cleanName)) {
            addedCount++;
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        result: 'success',
        sheetTab: sheet.getName(),
        message: 'ক্যাটাগরি নিরাপদ সিঙ্ক সম্পন্ন',
        added: addedCount
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ৫.৪ কাস্টম মান্থ ম্যাপিং ও ডিফল্ট মাস সিঙ্ক (SAVE MAPPINGS - R-V কলামে সেভ)
    if (action === 'savemappings' || action === 'setdefaultmonth' || action === 'updatedefaultmonth') {
      var defaultLabel = parseLabelString(data.defaultMonth || data.defaultLabel || data.default || '').toLowerCase();
      var maps = Array.isArray(data.mappings) ? data.mappings : [];

      for (var d = 0; d < maps.length; d++) {
        var mItem = maps[d];
        if (mItem && (mItem.isDefault === true || String(mItem.isDefault).toLowerCase() === 'true' || String(mItem.isDefault).toLowerCase() === 'default' || String(mItem.defaultMonth).toLowerCase() === 'default')) {
          defaultLabel = parseLabelString(mItem.label || '').toLowerCase();
          break;
        }
      }

      saveMonthMappingsToRange(sheet, maps, defaultLabel);

      return ContentService.createTextOutput(JSON.stringify({
        result: 'success',
        sheetTab: sheet.getName(),
        message: 'মান্থ ম্যাপিং ও বাজেট R-V কলামে সফলভাবে সিঙ্ক হয়েছে'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ৫.৫ বাজেট সেভ (SAVE BUDGET - I-M কলামে সেভ ও R-V কলামে মান্থ বাজেট আপডেট)
    if (action === 'savebudget' || action === 'setbudget') {
      var targetMonth = parseLabelString(data.month || data.defaultMonth || (e && e.parameter ? e.parameter.month : '') || '').toLowerCase();
      var budgetVal = Number(data.budget !== undefined ? data.budget : (e && e.parameter ? e.parameter.budget : 0)) || 0;
      
      saveBudgetToRange(sheet, targetMonth, budgetVal, data.categoryRows, data.categoryBudgets);

      return ContentService.createTextOutput(JSON.stringify({
        result: 'success',
        sheetTab: sheet.getName(),
        month: targetMonth,
        budget: budgetVal,
        message: 'বাজেট সফলভাবে I-M কলামে সেভ হয়েছে'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ৫.৬ টাস্ক যোগ ও সিঙ্ক (INSERT TASK - X-AJ কলামে সেভ)
    if (action === 'inserttask' || action === 'addtask') {
      var tId = data.id || ('task_' + Date.now());
      var tTitle = String(data.title || '').trim();
      var tDueDate = formatDateVal(data.dueDate) || String(data.dueDate || '');
      var tDueTime = String(data.dueTime || '09:00').trim();
      var tAmount = Number(data.amount || 0);
      var tCat = String(data.category || 'General').trim();
      var tPriority = String(data.priority || 'medium').trim();
      var tNotes = String(data.notes || '').trim();
      var tStatus = String(data.status || 'pending').trim();
      var tDays = Number(data.reminderDaysBefore || 1);
      var tNotify = (data.autoNotify === true || String(data.autoNotify).toLowerCase() === 'true') ? 'Yes' : 'No';
      var tCreatedBy = String(data.createdBy || sheet.getName()).trim();
      var tCreatedAt = String(data.createdAt || new Date().toISOString()).trim();

      insertTaskToRange(sheet, tId, tTitle, tDueDate, tDueTime, tAmount, tCat, tPriority, tNotes, tStatus, tDays, tNotify, tCreatedBy, tCreatedAt);

      return ContentService.createTextOutput(JSON.stringify({
        result: 'success',
        id: tId,
        sheetTab: sheet.getName(),
        message: 'টাস্ক সফলভাবে X-AJ কলামে সেভ হয়েছে'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ৫.৭ টাস্ক আপডেট (UPDATE TASK - X-AJ কলামে আপডেট)
    if (action === 'updatetask') {
      return handleUpdateTaskRange(sheet, data);
    }

    // ৫.৮ টাস্ক ডিলিট (DELETE TASK - শুধুমাত্র X-AJ কলাম ডিলিট ও শিফট আপ)
    if (action === 'deletetask') {
      return handleDeleteTaskRange(sheet, data, e ? e.parameter : null);
    }
    
    // ৬. নতুন ট্রানজ্যাকশন যোগ করা (INSERT ENTRY - A-G কলামে অ্যাপেন্ড)
    if (action === 'insert' || action === 'add' || action === 'create') {
      var id = data.id || ('ID-' + Date.now());
      var datetime = data.datetime || (new Date().toLocaleString());
      var type = data.type || 'Expense';
      var category = data.category || 'General';
      var date = data.date || (new Date().toISOString().split('T')[0]);
      var value = Number(data.value || 0);
      var note = data.note || '';
      
      insertEntryIfNotExists(sheet, id, datetime, type, category, date, value, note);
      
      return ContentService.createTextOutput(JSON.stringify({
        result: 'success',
        id: id,
        sheetTab: sheet.getName(),
        message: 'এন্ট্রি সফলভাবে A-G কলামে যোগ হয়েছে'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ result: 'unknown_action', sheetTab: sheet.getName() }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } finally {
    lock.releaseLock();
  }
}

// GET রিকোয়েস্ট হ্যান্ডলার
function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var params = (e && e.parameter) ? e.parameter : {};
  var tabName = (params.sheetTab || params.sheet || 'abujar287').toString().trim();
  var sheet = getTargetSheet(ss, tabName);
  var action = (params.action || '').toString().toLowerCase().trim();
  
  // ১. ট্যাব তৈরি
  if (action === 'createtab') {
    ensureUnifiedTemplateHeaders(sheet);
    return ContentService.createTextOutput(JSON.stringify({
      result: 'success',
      sheetTab: sheet.getName(),
      message: 'ইউজার শিট ট্যাব প্রস্তুত'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // ২. ট্রানজ্যাকশন ডিলিট (GET সাপোর্ট - শুধুমাত্র A-G কলাম ডিলিট)
  if (action === 'delete') {
    return handleDeleteEntry(sheet, params, params);
  }

  // ৩. GET এর মাধ্যমে এন্ট্রি ইনসার্ট
  if (action === 'insert' || action === 'add' || action === 'create') {
    var id = params.id || ('ID-' + Date.now());
    var datetime = params.datetime || (new Date().toLocaleString());
    var type = params.type || 'Expense';
    var category = params.category || 'General';
    var date = params.date || (new Date().toISOString().split('T')[0]);
    var value = Number(params.value || 0);
    var note = params.note || '';
    
    insertEntryIfNotExists(sheet, id, datetime, type, category, date, value, note);
    
    return ContentService.createTextOutput(JSON.stringify({
      result: 'success',
      id: id,
      sheetTab: sheet.getName(),
      message: 'এন্ট্রি সফলভাবে যোগ হয়েছে'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // ৪. এন্ট্রি আপডেট
  if (action === 'update') {
    return handleUpdateEntry(sheet, params);
  }

  // ৫. টাস্ক ডিলিট
  if (action === 'deletetask') {
    return handleDeleteTaskRange(sheet, params, params);
  }

  // ৬. নির্দিষ্ট মাসের বাজেট সেভ (GET পিন সাপোর্ট)
  if (action === 'savebudget' || action === 'setbudget') {
    var targetMonth = parseLabelString(params.month || params.defaultMonth || params.default || '').toLowerCase();
    var budgetVal = Number(params.budget || 0) || 0;
    saveBudgetToRange(sheet, targetMonth, budgetVal);
    return ContentService.createTextOutput(JSON.stringify({
      result: 'success',
      sheetTab: sheet.getName(),
      month: targetMonth,
      budget: budgetVal,
      message: 'বাজেট সফলভাবে সেট হয়েছে: ' + budgetVal
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // ৭. কাস্টম মান্থ ডিফল্ট সেট (GET পিন সাপোর্ট)
  if (action === 'setdefaultmonth' || action === 'updatedefaultmonth') {
    var targetDef = parseLabelString(params.defaultMonth || params.defaultLabel || params.default || params.month || '').toLowerCase();
    setDefaultMonthInRange(sheet, targetDef);
    return ContentService.createTextOutput(JSON.stringify({
      result: 'success',
      sheetTab: sheet.getName(),
      defaultMonth: targetDef,
      message: 'ডিফল্ট মাস সেট হয়েছে'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // ৮. ক্যাটাগরি যোগ ও ডিলিট (GET সাপোর্ট)
  if (action === 'addcategory') {
    var cName = String(params.category || '').trim();
    var cType = String(params.type || 'Expense').trim();
    if (cName) insertCategoryIfNotExists(sheet, cType, cName);
    return ContentService.createTextOutput(JSON.stringify({
      result: 'success',
      sheetTab: sheet.getName(),
      message: 'ক্যাটাগরি যুক্ত হয়েছে: ' + cName
    })).setMimeType(ContentService.MimeType.JSON);
  }
  if (action === 'deletecategory') {
    handleDeleteCategory(sheet, String(params.category || '').trim());
    return ContentService.createTextOutput(JSON.stringify({
      result: 'success',
      sheetTab: sheet.getName(),
      message: 'ক্যাটাগরি ডিলিট হয়েছে'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // ৯. নির্দিষ্ট ইউজারের সব ডেটা (Transactions, Budget, Categories, Month Mappings, Tasks) পড়া
  ensureUnifiedTemplateHeaders(sheet);
  
  var txData = readEntriesFromRange(sheet);
  var catData = readCategoriesFromRange(sheet, ss);
  var mapData = readMonthMappingsFromRange(sheet, ss);
  var budgetData = readBudgetsFromRange(sheet, ss);
  var taskData = readTasksFromRange(sheet, ss);

  return ContentService.createTextOutput(JSON.stringify({
    result: 'success',
    sheetTab: sheet.getName(),
    transactions: txData,
    categories: catData,
    monthMappings: mapData,
    categoryBudgets: budgetData,
    tasks: taskData,
    count: txData.length
  })).setMimeType(ContentService.MimeType.JSON);
}

// ====================================================================
// শিট ও টেমপ্লেট হেল্পার ফাংশন
// ====================================================================

function getTargetSheet(ss, tabName) {
  var name = tabName ? String(tabName).trim() : 'abujar287';
  if (!name) name = 'abujar287';
  
  var target = ss.getSheetByName(name);
  if (target) {
    ensureUnifiedTemplateHeaders(target);
    return target;
  }
  
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getName().trim().toLowerCase() === name.toLowerCase()) {
      ensureUnifiedTemplateHeaders(sheets[i]);
      return sheets[i];
    }
  }
  
  try {
    target = ss.insertSheet(name);
    createUnifiedTemplate(target);
    return target;
  } catch (err) {
    return ss.getActiveSheet();
  }
}

function createUnifiedTemplate(sheet) {
  if (sheet.getMaxColumns() < 38) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), 38 - sheet.getMaxColumns());
  }

  // Row 1: Merged Section Headers
  sheet.getRange(1, 1, 1, 7).merge().setValue('Entry').setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange(1, 9, 1, 5).merge().setValue('Budget').setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange(1, 15, 1, 2).merge().setValue('Category').setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange(1, 18, 1, 5).merge().setValue('month mapping').setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange(1, 24, 1, 13).merge().setValue('Tasks').setFontWeight('bold').setHorizontalAlignment('center');

  // Row 2: Column Names
  sheet.getRange(2, 1, 1, 7).setValues([['id', 'datetime', 'type', 'category', 'date', 'value', 'note']])
    .setFontWeight('bold').setHorizontalAlignment('center');
  
  sheet.getRange(2, 9, 1, 5).setValues([['Mapping Month', 'Category', 'Budget', 'Spend', 'Remain']])
    .setFontWeight('bold').setHorizontalAlignment('center');

  sheet.getRange(2, 15, 1, 2).setValues([['type', 'category']])
    .setFontWeight('bold').setHorizontalAlignment('center');

  sheet.getRange(2, 18, 1, 5).setValues([['Start Date', 'End Date', 'Mapping Month', 'default month', 'Budget']])
    .setFontWeight('bold').setHorizontalAlignment('center');

  sheet.getRange(2, 24, 1, 13).setValues([['ID', 'Title', 'Due Date', 'Due Time', 'Amount', 'Category', 'Priority', 'Notes', 'Status', 'Reminder Days', 'Auto Notify', 'Created By', 'Created At']])
    .setFontWeight('bold').setHorizontalAlignment('center');

  sheet.setFrozenRows(2);
  sheet.getRange(1, 1, 2, 36).setBorder(true, true, true, true, true, true);
  
  try {
    sheet.getRange(1, 1, Math.max(sheet.getMaxRows(), 50), 1).setNumberFormat('@');
    sheet.getRange(1, 5, Math.max(sheet.getMaxRows(), 50), 1).setNumberFormat('@');
    sheet.getRange(1, 24, Math.max(sheet.getMaxRows(), 50), 1).setNumberFormat('@');
    sheet.getRange(1, 26, Math.max(sheet.getMaxRows(), 50), 1).setNumberFormat('@');
  } catch (e) {}

  var defaultCats = [
    ['Expense', 'খাবার ও মুদি'],
    ['Expense', 'যাতায়াত ও ভ্রমণ'],
    ['Expense', 'বাসা ভাড়া'],
    ['Expense', 'বিল ও ইউটিলিটি'],
    ['Expense', 'চিকিৎসা ও ওষুধ'],
    ['Expense', 'শপিং ও কেনাকাটা'],
    ['Expense', 'বিনোদন'],
    ['Expense', 'অন্যান্য'],
    ['Income', 'বেতন'],
    ['Income', 'ব্যবসা'],
    ['Income', 'ফ্রিল্যান্সিং'],
    ['Income', 'বিনিয়োগ ও মুনাফা'],
    ['Income', 'উপহার'],
    ['Income', 'অন্যান্য']
  ];
  sheet.getRange(3, 15, defaultCats.length, 2).setValues(defaultCats);
}

function ensureUnifiedTemplateHeaders(sheet) {
  var row1Val = sheet.getRange(1, 1).getValue();
  var row2Val = sheet.getRange(2, 1).getValue();
  
  if (!row1Val || !row2Val || String(row1Val).toLowerCase() !== 'entry' || String(row2Val).toLowerCase() !== 'id') {
    createUnifiedTemplate(sheet);
  }
}

function getNextEmptyRowInRange(sheet, startCol, numCols) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 3;
  
  var values = sheet.getRange(3, startCol, Math.max(lastRow - 2, 1), numCols).getValues();
  for (var r = 0; r < values.length; r++) {
    var isEmpty = true;
    for (var c = 0; c < numCols; c++) {
      if (values[r][c] !== '' && values[r][c] !== null && values[r][c] !== undefined) {
        isEmpty = false;
        break;
      }
    }
    if (isEmpty) {
      return r + 3;
    }
  }
  return values.length + 3;
}

// ----------------------------------------------------
// ১. ENTRY ফাংশনস (A-G কলাম, Cols 1-7)
// ----------------------------------------------------

function insertEntryIfNotExists(sheet, id, datetime, type, category, date, value, note) {
  var lastRow = sheet.getLastRow();
  if (lastRow >= 3) {
    var ids = sheet.getRange(3, 1, lastRow - 2, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() === String(id).trim()) {
        return;
      }
    }
  }
  
  var targetRow = getNextEmptyRowInRange(sheet, 1, 7);
  sheet.getRange(targetRow, 1, 1, 7).setValues([[
    String(id),
    String(datetime),
    String(type),
    String(category),
    formatDateVal(date),
    Number(value) || 0,
    String(note || '')
  ]]);
  try {
    sheet.getRange(targetRow, 1, 1, 7).setBorder(true, true, true, true, true, true);
  } catch (e) {}
}

function handleUpdateEntry(sheet, data) {
  var id = String(data.id || '').trim();
  var lastRow = sheet.getLastRow();
  if (lastRow >= 3) {
    var ids = sheet.getRange(3, 1, lastRow - 2, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() === id) {
        var r = i + 3;
        sheet.getRange(r, 2, 1, 6).setValues([[
          String(data.datetime || new Date().toLocaleString()),
          String(data.type || 'Expense'),
          String(data.category || ''),
          formatDateVal(data.date),
          Number(data.value || 0),
          String(data.note || '')
        ]]);
        return ContentService.createTextOutput(JSON.stringify({
          result: 'success',
          sheetTab: sheet.getName(),
          message: 'এন্ট্রি আপডেট সম্পন্ন'
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
  }
  return ContentService.createTextOutput(JSON.stringify({
    result: 'not_found',
    sheetTab: sheet.getName()
  })).setMimeType(ContentService.MimeType.JSON);
}

function handleDeleteEntry(sheet, data, params) {
  var idToDelete = String(data.id || (params ? params.id : '') || '').trim();
  var lastRow = sheet.getLastRow();
  
  if (lastRow >= 3) {
    var vals = sheet.getRange(3, 1, lastRow - 2, 7).getValues();
    for (var i = vals.length - 1; i >= 0; i--) {
      var rowId = String(vals[i][0] || '').trim();
      var isMatch = false;
      
      if (idToDelete && rowId === idToDelete) {
        isMatch = true;
      } else if (!idToDelete && data.date && data.value) {
        if (formatDateVal(vals[i][4]) === formatDateVal(data.date) && Math.abs(Number(vals[i][5])) === Math.abs(Number(data.value))) {
          isMatch = true;
        }
      }
      
      if (isMatch) {
        var rowNumber = i + 3;
        // শুধুমাত্র কলাম A-G ডিলিট ও শিফট আপ, ডানের সব কলাম সম্পূর্ণ অক্ষত!
        sheet.getRange(rowNumber, 1, 1, 7).deleteCells(SpreadsheetApp.Dimension.ROWS);
        
        return ContentService.createTextOutput(JSON.stringify({
          result: 'success',
          sheetTab: sheet.getName(),
          message: 'এন্ট্রি সফলভাবে ডিলিট হয়েছে (A-G কলাম রেঞ্জ)',
          row: rowNumber
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    result: 'not_found',
    sheetTab: sheet.getName(),
    message: 'এন্ট্রি খুঁজে পাওয়া যায়নি'
  })).setMimeType(ContentService.MimeType.JSON);
}

function readEntriesFromRange(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 3) return [];
  
  var rows = sheet.getRange(3, 1, lastRow - 2, 7).getValues();
  var list = [];
  
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0] && !r[1] && !r[2] && !r[3] && !r[4] && !r[5]) continue;
    
    var txDate = formatDateVal(r[4]);
    list.push({
      id: String(r[0] || ('row-' + (i + 3))),
      rowNumber: i + 3,
      datetime: String(r[1] || ''),
      type: (String(r[2] || '').toLowerCase().indexOf('income') !== -1 || String(r[2] || '').indexOf('আয়') !== -1) ? 'Income' : 'Expense',
      category: String(r[3] || 'General'),
      date: txDate,
      value: Number(r[5]) || 0,
      note: String(r[6] || '')
    });
  }
  return list;
}

// ----------------------------------------------------
// ২. BUDGET ফাংশনস (I-M কলাম, Cols 9-13)
// ----------------------------------------------------

function saveBudgetToRange(sheet, monthLabel, totalBudget, catRows, catBudgets) {
  var cleanMonth = parseLabelString(monthLabel);
  var cleanMonthKey = cleanMonth.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  var lastRow = sheet.getLastRow();
  if (lastRow >= 3) {
    var mapVals = sheet.getRange(3, 18, lastRow - 2, 5).getValues();
    for (var m = 0; m < mapVals.length; m++) {
      var l = parseLabelString(mapVals[m][2]).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (l && cleanMonthKey && (l === cleanMonthKey || l.indexOf(cleanMonthKey) !== -1 || cleanMonthKey.indexOf(l) !== -1)) {
        sheet.getRange(m + 3, 22).setValue(totalBudget);
        break;
      }
    }
  }
  
  var rowsToProcess = [];
  if (Array.isArray(catRows) && catRows.length > 0) {
    for (var i = 0; i < catRows.length; i++) {
      var item = catRows[i];
      if (item && item.category) {
        rowsToProcess.push({
          category: String(item.category).trim(),
          budget: Number(item.budget) || 0,
          spend: Number(item.spend) || 0,
          remain: Number(item.remain !== undefined ? item.remain : ((Number(item.budget) || 0) - (Number(item.spend) || 0))) || 0
        });
      }
    }
  } else if (catBudgets && typeof catBudgets === 'object') {
    var keys = Object.keys(catBudgets);
    for (var k = 0; k < keys.length; k++) {
      var amt = Number(catBudgets[keys[k]]) || 0;
      if (amt > 0) {
        rowsToProcess.push({ category: keys[k], budget: amt, spend: 0, remain: amt });
      }
    }
  }
  
  if (rowsToProcess.length > 0) {
    var lastR = sheet.getLastRow();
    var existingMap = {};
    if (lastR >= 3) {
      var bVals = sheet.getRange(3, 9, lastR - 2, 5).getValues();
      for (var b = 0; b < bVals.length; b++) {
        var mKey = parseLabelString(bVals[b][0]).toLowerCase().replace(/[^a-z0-9]/g, '');
        var cKey = String(bVals[b][1] || '').trim().toLowerCase();
        if (mKey && cKey) {
          existingMap[mKey + '___' + cKey] = b + 3;
        }
      }
    }
    
    for (var p = 0; p < rowsToProcess.length; p++) {
      var proc = rowsToProcess[p];
      var lookup = cleanMonthKey + '___' + proc.category.toLowerCase();
      var targetR = existingMap[lookup];
      
      if (targetR) {
        sheet.getRange(targetR, 11, 1, 3).setValues([[proc.budget, proc.spend, proc.remain]]);
      } else {
        var newR = getNextEmptyRowInRange(sheet, 9, 5);
        sheet.getRange(newR, 9, 1, 5).setValues([[cleanMonth, proc.category, proc.budget, proc.spend, proc.remain]]);
        existingMap[lookup] = newR;
      }
    }
  }
}

function readBudgetsFromRange(sheet, ss) {
  var budgets = {};
  var lastRow = sheet.getLastRow();
  
  if (lastRow >= 3) {
    var vals = sheet.getRange(3, 9, lastRow - 2, 5).getValues();
    for (var i = 0; i < vals.length; i++) {
      var m = parseLabelString(vals[i][0]);
      var cat = String(vals[i][1] || '').trim();
      var val = Number(vals[i][2]) || 0;
      if (m && cat) {
        if (!budgets[m]) budgets[m] = {};
        budgets[m][cat] = val;
      }
    }
  }
  
  if (Object.keys(budgets).length === 0 && ss) {
    var legacyB = ss.getSheetByName('Budget');
    if (legacyB && legacyB.getLastRow() >= 2) {
      var bRows = legacyB.getDataRange().getValues();
      for (var j = 1; j < bRows.length; j++) {
        var lm = parseLabelString(bRows[j][0]);
        var lcat = String(bRows[j][1] || '').trim();
        var lval = Number(bRows[j][2]) || 0;
        if (lm && lcat) {
          if (!budgets[lm]) budgets[lm] = {};
          budgets[lm][lcat] = lval;
        }
      }
    }
  }
  
  return budgets;
}

// ----------------------------------------------------
// ৩. CATEGORY ফাংশনস (O-P কলাম, Cols 15-16)
// ----------------------------------------------------

function insertCategoryIfNotExists(sheet, type, category) {
  var clean = String(category || '').trim();
  if (!clean) return false;
  
  var lastRow = sheet.getLastRow();
  if (lastRow >= 3) {
    var cVals = sheet.getRange(3, 15, lastRow - 2, 2).getValues();
    for (var i = 0; i < cVals.length; i++) {
      if (String(cVals[i][1] || '').trim().toLowerCase() === clean.toLowerCase()) {
        return false;
      }
    }
  }
  
  var targetR = getNextEmptyRowInRange(sheet, 15, 2);
  sheet.getRange(targetR, 15, 1, 2).setValues([[type || 'Expense', clean]]);
  return true;
}

function handleDeleteCategory(sheet, categoryName) {
  var clean = String(categoryName || '').trim().toLowerCase();
  var lastRow = sheet.getLastRow();
  if (lastRow >= 3 && clean) {
    var cVals = sheet.getRange(3, 15, lastRow - 2, 2).getValues();
    for (var i = cVals.length - 1; i >= 0; i--) {
      if (String(cVals[i][1] || '').trim().toLowerCase() === clean) {
        sheet.getRange(i + 3, 15, 1, 2).deleteCells(SpreadsheetApp.Dimension.ROWS);
      }
    }
  }
}

function readCategoriesFromRange(sheet, ss) {
  var cats = [];
  var lastRow = sheet.getLastRow();
  var seen = {};
  
  if (lastRow >= 3) {
    var vals = sheet.getRange(3, 15, lastRow - 2, 2).getValues();
    for (var i = 0; i < vals.length; i++) {
      var cType = String(vals[i][0] || 'Expense').trim();
      var cName = String(vals[i][1] || '').trim();
      if (cName && !seen[cName.toLowerCase()]) {
        seen[cName.toLowerCase()] = true;
        cats.push({ type: cType, category: cName });
      }
    }
  }
  
  if (cats.length === 0 && ss) {
    var legacyC = ss.getSheetByName('Category');
    if (legacyC && legacyC.getLastRow() >= 2) {
      var rows = legacyC.getDataRange().getValues();
      for (var j = 1; j < rows.length; j++) {
        var t = String(rows[j][0] || 'Expense').trim();
        var n = String(rows[j][1] || '').trim();
        if (n && !seen[n.toLowerCase()]) {
          seen[n.toLowerCase()] = true;
          cats.push({ type: t, category: n });
        }
      }
    }
  }
  
  return cats;
}

// ----------------------------------------------------
// ৪. MONTH MAPPING ফাংশনস (R-V কলাম, Cols 18-22)
// ----------------------------------------------------

function saveMonthMappingsToRange(sheet, maps, defaultLabel) {
  if (!Array.isArray(maps)) maps = [];
  
  var existingMap = {};
  var lastRow = sheet.getLastRow();
  if (lastRow >= 3) {
    var vals = sheet.getRange(3, 18, lastRow - 2, 5).getValues();
    for (var r = 0; r < vals.length; r++) {
      var s = formatDateVal(vals[r][0]);
      var e = formatDateVal(vals[r][1]);
      var l = parseLabelString(vals[r][2]);
      var d = String(vals[r][3] || '').trim().toLowerCase();
      var b = (vals[r][4] !== undefined && vals[r][4] !== '') ? Number(vals[r][4]) : '';
      if (l) {
        existingMap[l.toLowerCase()] = {
          startDate: s,
          endDate: e,
          label: l,
          isDefault: d === 'default' || d === 'true',
          budget: b
        };
      }
    }
  }
  
  for (var k = 0; k < maps.length; k++) {
    var item = maps[k];
    if (item && item.label) {
      var cleanL = parseLabelString(item.label);
      var key = cleanL.toLowerCase();
      var isThisDef = item.isDefault === true || String(item.isDefault).toLowerCase() === 'true' || (defaultLabel && key === defaultLabel);
      var bVal = (item.budget !== undefined && item.budget !== null && item.budget !== '') ? Number(item.budget) : (existingMap[key] ? existingMap[key].budget : '');
      
      existingMap[key] = {
        startDate: formatDateVal(item.startDate) || (existingMap[key] ? existingMap[key].startDate : ''),
        endDate: formatDateVal(item.endDate) || (existingMap[key] ? existingMap[key].endDate : ''),
        label: cleanL,
        isDefault: isThisDef,
        budget: bVal
      };
      if (isThisDef) defaultLabel = key;
    }
  }
  
  var keys = Object.keys(existingMap);
  for (var i = 0; i < keys.length; i++) {
    var obj = existingMap[keys[i]];
    var isDef = (defaultLabel && keys[i] === defaultLabel) || obj.isDefault;
    var rowIdx = i + 3;
    sheet.getRange(rowIdx, 18, 1, 5).setValues([[
      obj.startDate,
      obj.endDate,
      obj.label,
      isDef ? 'default' : '',
      obj.budget !== '' ? obj.budget : ''
    ]]);
  }
}

function setDefaultMonthInRange(sheet, targetDef) {
  var cleanTarget = targetDef.toLowerCase().replace(/[^a-z0-9]/g, '');
  var lastRow = sheet.getLastRow();
  if (lastRow >= 3) {
    var vals = sheet.getRange(3, 18, lastRow - 2, 5).getValues();
    for (var r = 0; r < vals.length; r++) {
      var l = parseLabelString(vals[r][2]).toLowerCase().replace(/[^a-z0-9]/g, '');
      var isMatch = cleanTarget && (l === cleanTarget || (l.length >= 3 && cleanTarget.length >= 3 && (l.indexOf(cleanTarget) !== -1 || cleanTarget.indexOf(l) !== -1)));
      sheet.getRange(r + 3, 21).setValue(isMatch ? 'default' : '');
    }
  }
}

function readMonthMappingsFromRange(sheet, ss) {
  var list = [];
  var lastRow = sheet.getLastRow();
  
  if (lastRow >= 3) {
    var vals = sheet.getRange(3, 18, lastRow - 2, 5).getValues();
    for (var i = 0; i < vals.length; i++) {
      var start = formatDateVal(vals[i][0]);
      var end = formatDateVal(vals[i][1]);
      var label = parseLabelString(vals[i][2]);
      var rawDef = String(vals[i][3] || '').trim().toLowerCase();
      var isDef = rawDef === 'true' || rawDef === 'yes' || rawDef === 'default';
      var budget = (vals[i][4] !== undefined && vals[i][4] !== '') ? (Number(vals[i][4]) || 0) : 0;
      
      if (label && start && end) {
        list.push({
          startDate: start,
          endDate: end,
          label: label,
          isDefault: isDef,
          budget: budget
        });
      }
    }
  }
  
  if (list.length === 0 && ss) {
    var legacyM = ss.getSheetByName('month mapping');
    if (legacyM && legacyM.getLastRow() >= 2) {
      var rows = legacyM.getDataRange().getValues();
      for (var j = 1; j < rows.length; j++) {
        var s = formatDateVal(rows[j][0]);
        var e = formatDateVal(rows[j][1]);
        var lbl = parseLabelString(rows[j][2]);
        var def = String(rows[j][3] || '').trim().toLowerCase();
        var b = (rows[j][4] !== undefined && rows[j][4] !== '') ? (Number(rows[j][4]) || 0) : 0;
        if (lbl && s && e) {
          list.push({
            startDate: s,
            endDate: e,
            label: lbl,
            isDefault: def === 'true' || def === 'yes' || def === 'default',
            budget: b
          });
        }
      }
    }
  }
  
  return list;
}

// ----------------------------------------------------
// ৫. TASKS ফাংশনস (X-AJ কলাম, Cols 24-36)
// ----------------------------------------------------

function insertTaskToRange(sheet, id, title, dueDate, dueTime, amount, category, priority, notes, status, reminderDays, autoNotify, createdBy, createdAt) {
  var lastRow = sheet.getLastRow();
  if (lastRow >= 3) {
    var ids = sheet.getRange(3, 24, lastRow - 2, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() === String(id).trim()) {
        return;
      }
    }
  }
  
  var targetRow = getNextEmptyRowInRange(sheet, 24, 13);
  sheet.getRange(targetRow, 24, 1, 13).setValues([[
    String(id),
    String(title),
    formatDateVal(dueDate),
    String(dueTime || '09:00'),
    Number(amount) || 0,
    String(category || 'General'),
    String(priority || 'medium'),
    String(notes || ''),
    String(status || 'pending'),
    Number(reminderDays) || 1,
    String(autoNotify || 'Yes'),
    String(createdBy || sheet.getName()),
    String(createdAt || new Date().toISOString())
  ]]);
  try {
    sheet.getRange(targetRow, 24, 1, 13).setBorder(true, true, true, true, true, true);
  } catch (e) {}
}

function handleUpdateTaskRange(sheet, data) {
  var id = String(data.id || '').trim();
  var lastRow = sheet.getLastRow();
  if (lastRow >= 3) {
    var ids = sheet.getRange(3, 24, lastRow - 2, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() === id) {
        var r = i + 3;
        sheet.getRange(r, 25, 1, 12).setValues([[
          String(data.title || ''),
          formatDateVal(data.dueDate),
          String(data.dueTime || '09:00'),
          Number(data.amount || 0),
          String(data.category || 'General'),
          String(data.priority || 'medium'),
          String(data.notes || ''),
          String(data.status || 'pending'),
          Number(data.reminderDaysBefore || 1),
          (data.autoNotify === true || String(data.autoNotify).toLowerCase() === 'true') ? 'Yes' : 'No',
          String(data.createdBy || sheet.getName()),
          String(data.createdAt || new Date().toISOString())
        ]]);
        return ContentService.createTextOutput(JSON.stringify({
          result: 'success',
          sheetTab: sheet.getName(),
          message: 'টাস্ক আপডেট সম্পন্ন'
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
  }
  return ContentService.createTextOutput(JSON.stringify({
    result: 'not_found',
    sheetTab: sheet.getName()
  })).setMimeType(ContentService.MimeType.JSON);
}

function handleDeleteTaskRange(sheet, data, params) {
  var idToDelete = String(data.id || (params ? params.id : '') || '').trim();
  var lastRow = sheet.getLastRow();
  
  if (lastRow >= 3) {
    var vals = sheet.getRange(3, 24, lastRow - 2, 13).getValues();
    for (var i = vals.length - 1; i >= 0; i--) {
      var rowId = String(vals[i][0] || '').trim();
      var isMatch = false;
      
      if (idToDelete && rowId === idToDelete) {
        isMatch = true;
      } else if (!idToDelete && data.title && data.amount) {
        if (String(vals[i][1]).trim() === String(data.title).trim() && Math.abs(Number(vals[i][4])) === Math.abs(Number(data.amount))) {
          isMatch = true;
        }
      }
      
      if (isMatch) {
        var rowNumber = i + 3;
        sheet.getRange(rowNumber, 24, 1, 13).deleteCells(SpreadsheetApp.Dimension.ROWS);
        
        return ContentService.createTextOutput(JSON.stringify({
          result: 'success',
          sheetTab: sheet.getName(),
          message: 'টাস্ক সফলভাবে ডিলিট হয়েছে (X-AJ কলাম রেঞ্জ)',
          row: rowNumber
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    result: 'not_found',
    sheetTab: sheet.getName(),
    message: 'টাস্ক খুঁজে পাওয়া যায়নি'
  })).setMimeType(ContentService.MimeType.JSON);
}

function readTasksFromRange(sheet, ss) {
  var list = [];
  var lastRow = sheet.getLastRow();
  
  if (lastRow >= 3) {
    var vals = sheet.getRange(3, 24, lastRow - 2, 13).getValues();
    for (var i = 0; i < vals.length; i++) {
      var id = String(vals[i][0] || '');
      var title = String(vals[i][1] || '').trim();
      if (!title) continue;
      
      var dDate = formatDateVal(vals[i][2]);
      var dTime = String(vals[i][3] || '09:00').trim();
      var amt = Number(vals[i][4]) || 0;
      var cat = String(vals[i][5] || 'General').trim();
      var prio = String(vals[i][6] || 'medium').trim().toLowerCase();
      var nts = String(vals[i][7] || '').trim();
      var stat = String(vals[i][8] || 'pending').trim().toLowerCase();
      var rem = Number(vals[i][9]) || 1;
      var autoN = String(vals[i][10] || '').toLowerCase();
      var isAuto = autoN !== 'no' && autoN !== 'false';
      var cBy = String(vals[i][11] || sheet.getName()).trim();
      var cAt = String(vals[i][12] || '').trim();
      
      list.push({
        id: id || ('task_' + (i + 3)),
        title: title,
        dueDate: dDate,
        dueTime: dTime,
        amount: amt,
        category: cat,
        priority: prio,
        notes: nts,
        status: (stat.indexOf('complete') !== -1 || stat.indexOf('paid') !== -1 || stat.indexOf('done') !== -1) ? 'completed' : 'pending',
        reminderDaysBefore: rem,
        autoNotify: isAuto,
        createdBy: cBy,
        createdAt: cAt
      });
    }
  }
  
  if (list.length === 0 && ss) {
    var legacyT = ss.getSheetByName('Tasks');
    if (legacyT && legacyT.getLastRow() >= 2) {
      var rows = legacyT.getDataRange().getValues();
      for (var j = 1; j < rows.length; j++) {
        var lTitle = String(rows[j][1] || '').trim();
        if (lTitle) {
          list.push({
            id: String(rows[j][0] || ('task_legacy_' + j)),
            title: lTitle,
            dueDate: formatDateVal(rows[j][2]),
            dueTime: String(rows[j][3] || '09:00').trim(),
            amount: Number(rows[j][4]) || 0,
            category: String(rows[j][5] || 'General'),
            priority: String(rows[j][6] || 'medium').toLowerCase(),
            notes: String(rows[j][7] || ''),
            status: String(rows[j][8] || 'pending').toLowerCase().indexOf('complete') !== -1 ? 'completed' : 'pending',
            reminderDaysBefore: Number(rows[j][9]) || 1,
            autoNotify: String(rows[j][10] || '').toLowerCase() !== 'no',
            createdBy: String(rows[j][11] || sheet.getName()),
            createdAt: String(rows[j][12] || '')
          });
        }
      }
    }
  }
  
  return list;
}

// ----------------------------------------------------
// ইউটিলিটি ফাংশনস
// ----------------------------------------------------

function parseLabelString(val) {
  if (!val) return '';
  if (val instanceof Date) {
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[val.getMonth()] + '-' + val.getFullYear();
  }
  var str = String(val).trim();
  if (str.indexOf('GMT') !== -1 || str.indexOf('Standard Time') !== -1) {
    var d = new Date(str);
    if (!isNaN(d.getTime())) {
      var ms = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return ms[d.getMonth()] + '-' + d.getFullYear();
    }
  }
  return str;
}

function formatDateVal(val) {
  if (!val) return '';
  if (val instanceof Date) {
    var y = val.getFullYear();
    var m = String(val.getMonth() + 1).padStart(2, '0');
    var d = String(val.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }
  var str = String(val).trim();
  if (str.indexOf('GMT') !== -1 || str.indexOf('Standard Time') !== -1) {
    var dateObj = new Date(str);
    if (!isNaN(dateObj.getTime())) {
      var y2 = dateObj.getFullYear();
      var m2 = String(dateObj.getMonth() + 1).padStart(2, '0');
      var d2 = String(dateObj.getDate()).padStart(2, '0');
      return y2 + '-' + m2 + '-' + d2;
    }
  }
  return str;
}
`;
