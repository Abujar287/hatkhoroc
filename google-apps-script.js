// ====================================================================
// হাত খরচ (Hisab Kitab): গুগল শিট Apps Script কোড (Code.gs)
// ভার্সন: 7.0 (Unified 1-Tab Multi-User Architecture)
// প্রতিটি ইউজারের (যেমন: abujar287, munni) জন্য সম্পূর্ণ ডেটা একটি ট্যাবেই সংরক্ষিত হবে:
// [Entry: A-G] [Budget: I-M] [Category: O-P] [month mapping: R-V] [Tasks: X-AJ] [Users: AL-AQ] [Upcoming 3 Month: AS-AV] [Bou Gift: AX-AZ]
// কোনো এন্ট্রি ডিলিট করলে শুধুমাত্র সেই কলাম রেঞ্জ ডিলিট হবে, ডানের কলামের ডেটা অক্ষত থাকবে!
// ====================================================================

function doPost(e) {
  e = e || {};
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var data = {};
    if (e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (err) {
        data = (e && e.parameter) ? e.parameter : {};
      }
    } else {
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

    // ৫.৭ ইউজার লিস্ট পাওয়া (GET USERS - AL:AQ কলাম থেকে)
    if (action === 'getusers' || action === 'users') {
      return ContentService.createTextOutput(JSON.stringify({
        result: 'success',
        users: readUsersFromRange(ss)
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ৫.৮ ইউজার ডিটেইলস সংরক্ষণ (SAVE USER - AL:AQ কলামে)
    if (action === 'saveuser') {
      saveUserToRange(ss, data);
      return ContentService.createTextOutput(JSON.stringify({
        result: 'success',
        sheetTab: sheet.getName(),
        message: 'ইউজার ডিটেইলস সফলভাবে সেভ হয়েছে'
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

    // ৫.৯ আগামী ৩ মাসের প্ল্যান সেভ (SAVE UPCOMING 3 MONTH - AS2:AV কলামে ফর্মুলাসহ সেভ)
    if (action === 'saveupcoming3month' || action === 'upcoming3month') {
      saveUpcoming3MonthToRange(sheet, data);
      return ContentService.createTextOutput(JSON.stringify({
        result: 'success',
        sheetTab: sheet.getName(),
        message: 'আগামী ৩ মাসের প্ল্যান AS2:AV কলামে সেভ হয়েছে'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ৫.১০ বউ গিফট ডেটা সেভ (SAVE BOU GIFT - AX:AZ কলামে সেভ, পুরোনো ডাটা অক্ষত রেখে)
    if (action === 'savebougift' || action === 'bougift') {
      var bouRows = Array.isArray(data.bouGift) ? data.bouGift : (Array.isArray(data.rows) ? data.rows : []);
      saveBouGiftToRange(sheet, bouRows);
      return ContentService.createTextOutput(JSON.stringify({
        result: 'success',
        sheetTab: sheet.getName(),
        message: 'বউ গিফট ডেটা AX:AZ কলামে সেভ হয়েছে'
      })).setMimeType(ContentService.MimeType.JSON);
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

  // ১.৫ ইউজার লিস্ট
  if (action === 'getusers') {
    return ContentService.createTextOutput(JSON.stringify({
      result: 'success',
      users: readUsersFromRange(ss)
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

  // ৯. নির্দিষ্ট ইউজারের সব ডেটা (Transactions, Budget, Categories, Month Mappings, Tasks, Users, Upcoming 3 Month) পড়া
  ensureUnifiedTemplateHeaders(sheet);
  
  var txData = readEntriesFromRange(sheet);
  var catData = readCategoriesFromRange(sheet, ss);
  var mapData = readMonthMappingsFromRange(sheet, ss);
  var budgetData = readBudgetsFromRange(sheet, ss);
  var taskData = readTasksFromRange(sheet, ss);
  var userData = readUsersFromRange(ss);
  var upcoming3MData = readUpcoming3MonthFromRange(sheet);
  var bouGiftData = readBouGiftFromRange(sheet);

  return ContentService.createTextOutput(JSON.stringify({
    result: 'success',
    sheetTab: sheet.getName(),
    transactions: txData,
    categories: catData,
    monthMappings: mapData,
    categoryBudgets: budgetData,
    tasks: taskData,
    users: userData,
    upcoming3Month: upcoming3MData,
    bouGift: bouGiftData,
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
  if (sheet.getMaxColumns() < 52) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), 52 - sheet.getMaxColumns());
  }

  // Row 1: Merged Section Headers
  sheet.getRange(1, 1, 1, 7).merge().setValue('Entry').setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange(1, 9, 1, 5).merge().setValue('Budget').setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange(1, 15, 1, 2).merge().setValue('Category').setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange(1, 18, 1, 5).merge().setValue('month mapping').setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange(1, 24, 1, 13).merge().setValue('Tasks').setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange(1, 38, 1, 6).merge().setValue('User Details').setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange(1, 45, 1, 4).merge().setValue('Upcoming 3 Month').setFontWeight('bold').setHorizontalAlignment('center');

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

  sheet.getRange(2, 38, 1, 6).setValues([['Full Name', 'username', 'password', 'sheet tab name', 'role', 'access tab']])
    .setFontWeight('bold').setHorizontalAlignment('center');

  sheet.getRange(2, 45, 1, 4).setValues([['Category', '', '', '']])
    .setFontWeight('bold').setHorizontalAlignment('center');

  sheet.setFrozenRows(2);
  sheet.getRange(1, 1, 2, 43).setBorder(true, true, true, true, true, true);
  sheet.getRange(1, 45, 2, 4).setBorder(true, true, true, true, true, true);
  ensureBouGiftHeaders(sheet);
  
  try {
    sheet.getRange(1, 1, Math.max(sheet.getMaxRows(), 50), 1).setNumberFormat('@');
    sheet.getRange(1, 5, Math.max(sheet.getMaxRows(), 50), 1).setNumberFormat('@');
    sheet.getRange(1, 24, Math.max(sheet.getMaxRows(), 50), 1).setNumberFormat('@');
    sheet.getRange(1, 26, Math.max(sheet.getMaxRows(), 50), 1).setNumberFormat('@');
  } catch (e) {}

  var defaultCats = [
    ['Expense', 'Personal'],
    ['Expense', 'WiFi & Internet'],
    ['Expense', 'Others Expense'],
    ['Expense', 'Medicines'],
    ['Income', 'Borrowed Money'],
    ['Income', 'Others Income'],
    ['Income', 'Salary'],
    ['Expense', 'Room Rent'],
    ['Expense', "Family's Cost"],
    ['Expense', 'Official'],
    ['Expense', 'Electricity'],
    ['Income', 'Previous Month Arrears'],
    ['Expense', 'Shopping']
  ];
  sheet.getRange(3, 15, defaultCats.length, 2).setValues(defaultCats);
}

function ensureBouGiftHeaders(sheet) {
  if (sheet.getMaxColumns() < 52) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), 52 - sheet.getMaxColumns());
  }
  var bouHdr = String(sheet.getRange(1, 50).getValue() || '').trim().toLowerCase();
  var bouSub = String(sheet.getRange(6, 50).getValue() || '').trim().toLowerCase();
  if (bouHdr !== 'bou gift' || bouSub !== 'month') {
    try { sheet.getRange(1, 50, 1, 3).breakApart(); } catch (e) {}
    sheet.getRange(1, 50, 1, 3).merge().setValue('Bou Gift').setFontWeight('bold').setHorizontalAlignment('center');
    sheet.getRange(2, 50, 3, 2).setValues([
      ['Total Amount', '=SUM(AY7:AY)'],
      ['Give', '=SUM(AZ7:AZ)'],
      ['Due', '=AY2-AY3']
    ]).setFontWeight('bold');
    sheet.getRange(6, 50, 1, 3).setValues([['Month', 'Budget', 'Give']])
      .setFontWeight('bold').setHorizontalAlignment('center');
    try {
      sheet.getRange(2, 51, 3, 1).setNumberFormat('#,##0');
      sheet.getRange(1, 50, 4, 3).setBorder(true, true, true, true, true, true);
      sheet.getRange(6, 50, 1, 3).setBorder(true, true, true, true, true, true);
    } catch (e) {}
  }
}

function ensureUnifiedTemplateHeaders(sheet) {
  var row1Val = sheet.getRange(1, 1).getValue();
  var row2Val = sheet.getRange(2, 1).getValue();
  
  if (!row1Val || !row2Val || String(row1Val).toLowerCase() !== 'entry' || String(row2Val).toLowerCase() !== 'id') {
    createUnifiedTemplate(sheet);
    return;
  }

  if (sheet.getMaxColumns() < 52) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), 52 - sheet.getMaxColumns());
  }
  var u3Header = sheet.getRange(1, 45).getValue();
  if (!u3Header || String(u3Header).toLowerCase() !== 'upcoming 3 month') {
    sheet.getRange(1, 45, 1, 4).merge().setValue('Upcoming 3 Month').setFontWeight('bold').setHorizontalAlignment('center');
    var u3Col2 = sheet.getRange(2, 45).getValue();
    if (!u3Col2) {
      sheet.getRange(2, 45, 1, 4).setValues([['Category', '', '', '']]).setFontWeight('bold').setHorizontalAlignment('center');
    }
    try {
      sheet.getRange(1, 45, 2, 4).setBorder(true, true, true, true, true, true);
    } catch (e) {}
  }
  ensureBouGiftHeaders(sheet);
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

  if (cats.length === 0) {
    var defaultCats = [
      ['Expense', 'Personal'],
      ['Expense', 'WiFi & Internet'],
      ['Expense', 'Others Expense'],
      ['Expense', 'Medicines'],
      ['Income', 'Borrowed Money'],
      ['Income', 'Others Income'],
      ['Income', 'Salary'],
      ['Expense', 'Room Rent'],
      ['Expense', "Family's Cost"],
      ['Expense', 'Official'],
      ['Expense', 'Electricity'],
      ['Income', 'Previous Month Arrears'],
      ['Expense', 'Shopping']
    ];
    sheet.getRange(3, 15, defaultCats.length, 2).setValues(defaultCats);
    for (var j = 0; j < defaultCats.length; j++) {
      cats.push({ type: defaultCats[j][0], category: defaultCats[j][1] });
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

// ইউজার ডিটেইলস সংরক্ষণ বা আপডেট (AL:AQ কলাম রেঞ্জ)
function saveUserToRange(ss, data) {
  var mainSheet = ss.getSheetByName('abujar287');
  if (!mainSheet) {
    mainSheet = ss.getSheets()[0];
    if (mainSheet) {
      try { mainSheet.setName('abujar287'); } catch (err) {}
    } else {
      mainSheet = ss.insertSheet('abujar287');
    }
  }
  ensureUnifiedTemplateHeaders(mainSheet);

  var fullName = String(data.fullName || data.displayName || '').trim();
  var username = String(data.username || '').trim().toLowerCase();
  var password = String(data.password || '').trim();
  var userSheetTab = String(data.userSheetTab || data.sheetTab || username).trim();
  var role = String(data.role || 'user').trim();
  var accessTab = String(data.accessTab || 'Summary, Details, Add Entry, Setting').trim();

  if (!username) return;

  var lastRow = mainSheet.getLastRow();
  var foundRow = -1;

  if (lastRow >= 3) {
    var userVals = mainSheet.getRange(3, 39, lastRow - 2, 1).getValues(); // Column AM (39) is username
    for (var i = 0; i < userVals.length; i++) {
      if (String(userVals[i][0] || '').trim().toLowerCase() === username) {
        foundRow = i + 3;
        break;
      }
    }
  }

  if (foundRow > 0) {
    mainSheet.getRange(foundRow, 38, 1, 6).setValues([[fullName, username, password, userSheetTab, role, accessTab]]);
  } else {
    var targetRow = getNextEmptyRowInRange(mainSheet, 38, 6);
    mainSheet.getRange(targetRow, 38, 1, 6).setValues([[fullName, username, password, userSheetTab, role, accessTab]]);
    try {
      mainSheet.getRange(targetRow, 38, 1, 6).setBorder(true, true, true, true, true, true);
    } catch (e) {}
  }
}
function readUsersFromRange(ss) {
  var mainSheet = getTargetSheet(ss, 'abujar287');
  if (!mainSheet) return [];
  
  var lastRow = mainSheet.getLastRow();
  var users = [];
  if (lastRow >= 3) {
    // Read columns AL (38) to AQ (43)
    var vals = mainSheet.getRange(3, 38, lastRow - 2, 6).getValues();
    for (var i = 0; i < vals.length; i++) {
      var r = vals[i];
      var colAL = String(r[0] || '').trim();
      var colAM = String(r[1] || '').trim();
      var colAN = String(r[2] || '').trim();
      var colAO = String(r[3] || '').trim();
      var colAP = String(r[4] || '').trim();
      var colAQ = String(r[5] || '').trim();
      
      // If row has any data in AL:AQ
      if (colAL || colAM || colAN || colAO) {
        var username = colAM || colAL;
        // Skip header if repeated
        if (username.toLowerCase() === 'username' || username.toLowerCase() === 'full name') {
          continue;
        }
        var displayName = colAL || colAM || username;
        var password = colAN || '123456';
        var sheetTab = colAO || username;
        var role = colAP || 'member';
        var rawAllowed = colAQ || 'summary,entry,details,budget,upcoming_cost,settings';
        var allowedTabs = rawAllowed.split(',').map(function(s){return s.trim().toLowerCase();}).filter(function(s){return s !== '';});
        
        users.push({
          displayName: displayName,
          username: username,
          password: password,
          sheetTab: sheetTab,
          role: role,
          allowedTabs: allowedTabs
        });
      }
    }
  }
  return users;
}

// ----------------------------------------------------
// ৬. UPCOMING 3 MONTH ফাংশনস (AS2:AV কলাম, Cols 45-48)
// ----------------------------------------------------

function formatBouMonthLabel(val) {
  if (!val) return '';
  if (val instanceof Date) {
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var d = String(val.getDate()).padStart(2, '0');
    var m = months[val.getMonth()] || '';
    var y = String(val.getFullYear()).slice(-2);
    return d + '-' + m + '-' + y;
  }
  var str = String(val).trim();
  if (str.indexOf('GMT') !== -1 || str.indexOf('Standard Time') !== -1) {
    var dt = new Date(str);
    if (!isNaN(dt.getTime())) {
      var ms = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return String(dt.getDate()).padStart(2, '0') + '-' + (ms[dt.getMonth()] || '') + '-' + String(dt.getFullYear()).slice(-2);
    }
  }
  return str;
}

function saveUpcoming3MonthToRange(sheet, data) {
  if (sheet.getMaxColumns() < 48) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), 48 - sheet.getMaxColumns());
  }
  ensureUnifiedTemplateHeaders(sheet);

  var mLabels = Array.isArray(data.monthLabels) ? data.monthLabels : ['', '', ''];
  var m1 = mLabels[0] ? String(mLabels[0]).trim() : '';
  var m2 = mLabels[1] ? String(mLabels[1]).trim() : '';
  var m3 = mLabels[2] ? String(mLabels[2]).trim() : '';

  var cats = Array.isArray(data.categories) ? data.categories : [];
  var catValues = (data.categoryValues && typeof data.categoryValues === 'object') ? data.categoryValues : {};
  var sal = Array.isArray(data.salary) ? data.salary : [0, 0, 0];
  var have = Array.isArray(data.have) ? data.have : [0, 0, 0];
  var loan = Array.isArray(data.loan) ? data.loan : [0, 0, 0];
  var bkashTotal = Number(data.bkashLoanTotal) || 0;

  var targetCats = [];
  for (var i = 0; i < cats.length; i++) {
    var cName = String(cats[i] || '').trim();
    if (!cName) continue;
    var vals = Array.isArray(catValues[cName]) ? catValues[cName] : [0, 0, 0];
    targetCats.push({
      name: cName,
      v1: Number(vals[0]) || 0,
      v2: Number(vals[1]) || 0,
      v3: Number(vals[2]) || 0
    });
  }
  if (targetCats.length === 0) {
    targetCats.push({ name: 'Room Rent', v1: 0, v2: 0, v3: 0 });
  }

  // Check if existing AS3:AV structure matches target categories & key rows
  // If structure matches, update ONLY changed data cells in-place!
  var forceRebuild = data.forceRebuild === true || String(data.forceRebuild).toLowerCase() === 'true';
  var lastRow = sheet.getLastRow();
  var canUpdateInPlace = !forceRebuild && lastRow >= 3;
  var existingCats = [];
  var rowMap = {};

  if (canUpdateInPlace) {
    var existingRangeVals = sheet.getRange(3, 45, lastRow - 2, 4).getValues();
    var inCatSection = true;
    for (var r = 0; r < existingRangeVals.length; r++) {
      var lbl = String(existingRangeVals[r][0] || '').trim();
      var rNum = r + 3;
      if (!lbl) continue;
      var low = lbl.toLowerCase();

      if (low === 'bou gift') {
        canUpdateInPlace = false;
        break;
      } else if (low === 'salary') {
        inCatSection = false;
        rowMap.salary = { row: rNum, vals: existingRangeVals[r] };
      } else if (low === 'have') {
        inCatSection = false;
        rowMap.have = { row: rNum, vals: existingRangeVals[r] };
      } else if (low === 'loan') {
        inCatSection = false;
        rowMap.loan = { row: rNum, vals: existingRangeVals[r] };
      } else if (low === 'bkash loan total') {
        inCatSection = false;
        rowMap.bkashTotal = { row: rNum, vals: existingRangeVals[r] };
      } else if (low === 'total' || low === 'arrear' || low === 'bkash loan payment' || low === 'final due') {
        inCatSection = false;
      } else if (inCatSection) {
        existingCats.push({ name: lbl, nameLower: low, row: rNum, vals: existingRangeVals[r] });
      }
    }

    if (
      canUpdateInPlace &&
      (existingCats.length !== targetCats.length ||
      !rowMap.salary || !rowMap.have || !rowMap.loan || !rowMap.bkashTotal)
    ) {
      canUpdateInPlace = false;
    } else if (canUpdateInPlace) {
      for (var c = 0; c < targetCats.length; c++) {
        if (existingCats[c].nameLower !== targetCats[c].name.toLowerCase()) {
          canUpdateInPlace = false;
          break;
        }
      }
    }
  }

  if (canUpdateInPlace) {
    var curHeaders = sheet.getRange(2, 45, 1, 4).getValues()[0];
    if (
      String(curHeaders[0] || '').trim() !== 'Category' ||
      parseLabelString(curHeaders[1]) !== m1 ||
      parseLabelString(curHeaders[2]) !== m2 ||
      parseLabelString(curHeaders[3]) !== m3
    ) {
      sheet.getRange(2, 45, 1, 4)
        .setValues([['Category', m1, m2, m3]])
        .setFontWeight('bold')
        .setHorizontalAlignment('center');
    }

    for (var idx = 0; idx < targetCats.length; idx++) {
      var tc = targetCats[idx];
      var ec = existingCats[idx];
      if (
        (Number(ec.vals[1]) || 0) !== tc.v1 ||
        (Number(ec.vals[2]) || 0) !== tc.v2 ||
        (Number(ec.vals[3]) || 0) !== tc.v3
      ) {
        sheet.getRange(ec.row, 46, 1, 3).setValues([[tc.v1, tc.v2, tc.v3]]);
      }
    }

    var sal1 = Number(sal[0]) || 0, sal2 = Number(sal[1]) || 0, sal3 = Number(sal[2]) || 0;
    if ((Number(rowMap.salary.vals[1]) || 0) !== sal1 || (Number(rowMap.salary.vals[2]) || 0) !== sal2 || (Number(rowMap.salary.vals[3]) || 0) !== sal3) {
      sheet.getRange(rowMap.salary.row, 46, 1, 3).setValues([[sal1, sal2, sal3]]);
    }

    var h1 = Number(have[0]) || 0, h2 = Number(have[1]) || 0, h3 = Number(have[2]) || 0;
    if ((Number(rowMap.have.vals[1]) || 0) !== h1 || (Number(rowMap.have.vals[2]) || 0) !== h2 || (Number(rowMap.have.vals[3]) || 0) !== h3) {
      sheet.getRange(rowMap.have.row, 46, 1, 3).setValues([[h1, h2, h3]]);
    }

    var l1 = Number(loan[0]) || 0, l2 = Number(loan[1]) || 0, l3 = Number(loan[2]) || 0;
    if ((Number(rowMap.loan.vals[1]) || 0) !== l1 || (Number(rowMap.loan.vals[2]) || 0) !== l2 || (Number(rowMap.loan.vals[3]) || 0) !== l3) {
      sheet.getRange(rowMap.loan.row, 46, 1, 3).setValues([[l1, l2, l3]]);
    }

    if ((Number(rowMap.bkashTotal.vals[1]) || 0) !== bkashTotal) {
      sheet.getRange(rowMap.bkashTotal.row, 46).setValue(bkashTotal);
    }
    return;
  }

  // Full rebuild ONLY inside AS3:AV (only when AS3:AV empty OR categories added/removed)
  if (lastRow >= 3) {
    sheet.getRange(3, 45, lastRow - 2, 4).breakApart().clearContent().setBorder(false, false, false, false, false, false);
  }

  sheet.getRange(2, 45, 1, 4)
    .setValues([['Category', m1, m2, m3]])
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  var allRows = [];
  var catStartRow = 3;
  for (var k = 0; k < targetCats.length; k++) {
    allRows.push([targetCats[k].name, targetCats[k].v1, targetCats[k].v2, targetCats[k].v3]);
  }
  var catEndRow = catStartRow + allRows.length - 1;

  allRows.push(['', '', '', '']);
  var rSal = catStartRow + allRows.length;
  allRows.push(['Salary', Number(sal[0]) || 0, Number(sal[1]) || 0, Number(sal[2]) || 0]);
  var rHave = catStartRow + allRows.length;
  allRows.push(['Have', Number(have[0]) || 0, Number(have[1]) || 0, Number(have[2]) || 0]);
  var rLoan = catStartRow + allRows.length;
  allRows.push(['Loan', Number(loan[0]) || 0, Number(loan[1]) || 0, Number(loan[2]) || 0]);

  var rTotal = catStartRow + allRows.length;
  allRows.push([
    'Total',
    '=SUM(AT' + rSal + ':AT' + rLoan + ')',
    '=SUM(AU' + rSal + ':AU' + rLoan + ')',
    '=SUM(AV' + rSal + ':AV' + rLoan + ')'
  ]);

  var rArrear = catStartRow + allRows.length;
  allRows.push([
    'Arrear',
    '=AT' + rTotal + '-SUM(AT' + catStartRow + ':AT' + catEndRow + ')',
    '=AU' + rTotal + '-SUM(AU' + catStartRow + ':AU' + catEndRow + ')',
    '=AV' + rTotal + '-SUM(AV' + catStartRow + ':AV' + catEndRow + ')'
  ]);

  allRows.push(['', '', '', '']);
  var rBkashTot = catStartRow + allRows.length;
  allRows.push(['Bkash Loan Total', bkashTotal, '', '']);

  var rBkashPay = catStartRow + allRows.length;
  allRows.push([
    'Bkash Loan Payment',
    '=SUMIF($AS$' + catStartRow + ':$AS$' + catEndRow + ',"*Bkash*",AT' + catStartRow + ':AT' + catEndRow + ')',
    '=SUMIF($AS$' + catStartRow + ':$AS$' + catEndRow + ',"*Bkash*",AU' + catStartRow + ':AU' + catEndRow + ')',
    '=SUMIF($AS$' + catStartRow + ':$AS$' + catEndRow + ',"*Bkash*",AV' + catStartRow + ':AV' + catEndRow + ')'
  ]);

  var rFinalDue = catStartRow + allRows.length;
  allRows.push([
    'Final Due',
    '=AT' + rBkashTot + '-AT' + rBkashPay,
    '=AT' + rFinalDue + '-AU' + rBkashPay,
    '=AU' + rFinalDue + '-AV' + rBkashPay
  ]);

  var totalWritten = allRows.length;
  sheet.getRange(3, 45, totalWritten, 4).setValues(allRows);

  try {
    sheet.getRange(catStartRow, 45, catEndRow - catStartRow + 1, 4).setBorder(true, true, true, true, true, true).setFontWeight('normal');
    sheet.getRange(catEndRow + 1, 45, 1, 4).setBorder(false, false, false, false, false, false);
    sheet.getRange(rSal, 45, 5, 4).setBorder(true, true, true, true, true, true).setFontWeight('normal');
    sheet.getRange(rTotal, 45, 2, 4).setFontWeight('bold');
    sheet.getRange(rArrear + 1, 45, 1, 4).setBorder(false, false, false, false, false, false);
    sheet.getRange(rBkashTot, 45, 3, 4).setBorder(true, true, true, true, true, true).setFontWeight('normal');
    sheet.getRange(rFinalDue, 45, 1, 4).setFontWeight('bold');
    sheet.getRange(3, 46, totalWritten, 3).setNumberFormat('#,##0');
  } catch (e) {}
}

function readUpcoming3MonthFromRange(sheet) {
  if (sheet.getMaxColumns() < 48) return null;
  var lastRow = sheet.getLastRow();
  if (lastRow < 3) return null;

  var vals = sheet.getRange(2, 45, lastRow - 1, 4).getValues();
  if (!vals || vals.length < 2) return null;

  var monthLabels = [
    parseLabelString(vals[0][1]),
    parseLabelString(vals[0][2]),
    parseLabelString(vals[0][3])
  ];

  var categories = [];
  var categoryValues = {};
  var salary = [0, 0, 0];
  var have = [0, 0, 0];
  var loan = [0, 0, 0];
  var bkashLoanTotal = 0;
  var inCategories = true;
  var hasFunding = false;

  for (var i = 1; i < vals.length; i++) {
    var row = vals[i];
    var label = String(row[0] || '').trim();
    if (!label) continue;

    var lower = label.toLowerCase();
    var v1 = Number(row[1]) || 0;
    var v2 = Number(row[2]) || 0;
    var v3 = Number(row[3]) || 0;

    if (lower === 'bou gift') {
      break;
    } else if (lower === 'salary') {
      inCategories = false;
      salary = [v1, v2, v3];
      if (v1 || v2 || v3) hasFunding = true;
    } else if (lower === 'have') {
      inCategories = false;
      have = [v1, v2, v3];
      if (v1 || v2 || v3) hasFunding = true;
    } else if (lower === 'loan') {
      inCategories = false;
      loan = [v1, v2, v3];
      if (v1 || v2 || v3) hasFunding = true;
    } else if (lower === 'total' || lower === 'arrear' || lower === 'bkash loan payment' || lower === 'final due') {
      inCategories = false;
    } else if (lower === 'bkash loan total') {
      inCategories = false;
      bkashLoanTotal = v1;
    } else if (inCategories) {
      categories.push(label);
      categoryValues[label] = [v1, v2, v3];
    }
  }

  if (categories.length === 0 && !hasFunding && bkashLoanTotal === 0) {
    return null;
  }

  return {
    monthLabels: monthLabels,
    categories: categories,
    categoryValues: categoryValues,
    salary: salary,
    have: have,
    loan: loan,
    bkashLoanTotal: bkashLoanTotal
  };
}

// ----------------------------------------------------
// ৭. BOU GIFT ফাংশনস (AX:AZ কলাম, Cols 50-52)
//    - পুরোনো ডাটা কখনো মুছবে না
//    - নতুন মাস আসলে নিচে Append হবে
//    - কোনো মাসের Give পরিবর্তন হলে শুধু ঐ সেল আপডেট হবে
// ----------------------------------------------------

function normalizeBouMonthKeySheet(val) {
  var str = formatBouMonthLabel(val);
  if (!str) return '';
  var lower = str.toLowerCase();
  var months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  var mIdx = -1;
  for (var i = 0; i < months.length; i++) {
    if (lower.indexOf(months[i]) !== -1) {
      mIdx = i + 1;
      break;
    }
  }
  if (mIdx === -1) return lower;
  var yr4 = lower.match(/(20\d{2})/);
  var yr2 = lower.match(/(?:-|\/|\s)(\d{2})$/);
  var year = yr4 ? Number(yr4[1]) : (yr2 ? (2000 + Number(yr2[1])) : 2026);
  return year + '-' + String(mIdx).padStart(2, '0');
}

function saveBouGiftToRange(sheet, bouGiftArray) {
  ensureBouGiftHeaders(sheet);
  if (!Array.isArray(bouGiftArray) || bouGiftArray.length === 0) return;

  var lastRow = sheet.getLastRow();
  var existingByKey = {};
  var lastBouDataRow = 6;

  if (lastRow >= 7) {
    var existingVals = sheet.getRange(7, 50, lastRow - 6, 3).getValues();
    for (var i = 0; i < existingVals.length; i++) {
      var rawMonth = existingVals[i][0];
      if (!rawMonth) continue;
      var formattedLabel = formatBouMonthLabel(rawMonth);
      var key = normalizeBouMonthKeySheet(formattedLabel);
      var rowNum = i + 7;
      if (rowNum > lastBouDataRow) lastBouDataRow = rowNum;
      if (key) {
        existingByKey[key] = {
          row: rowNum,
          month: formattedLabel,
          budget: Number(existingVals[i][1]) || 0,
          give: Number(existingVals[i][2]) || 0
        };
      }
    }
  }

  var nextAppendRow = lastBouDataRow + 1;

  for (var j = 0; j < bouGiftArray.length; j++) {
    var item = bouGiftArray[j];
    if (!item || !item.month) continue;
    var mLabel = String(item.month).trim();
    var mKey = normalizeBouMonthKeySheet(mLabel);
    var budgetVal = Number(item.budget) || 0;
    var giveVal = Number(item.give) || 0;

    if (mKey && existingByKey[mKey]) {
      var ex = existingByKey[mKey];
      // Update ONLY the changed cell(s), leaving all existing rows untouched
      if (ex.budget !== budgetVal) {
        sheet.getRange(ex.row, 51).setValue(budgetVal);
      }
      if (ex.give !== giveVal) {
        sheet.getRange(ex.row, 52).setValue(giveVal);
      }
    } else {
      // Append new month strictly at the bottom below existing rows
      sheet.getRange(nextAppendRow, 50, 1, 3).setValues([[mLabel, budgetVal, giveVal]]);
      try {
        sheet.getRange(nextAppendRow, 50).setNumberFormat('@');
        sheet.getRange(nextAppendRow, 51, 1, 2).setNumberFormat('#,##0');
        sheet.getRange(nextAppendRow, 50, 1, 3).setBorder(true, true, true, true, true, true).setFontWeight('normal');
      } catch (e) {}
      if (mKey) {
        existingByKey[mKey] = { row: nextAppendRow, month: mLabel, budget: budgetVal, give: giveVal };
      }
      nextAppendRow++;
    }
  }
}

function readBouGiftFromRange(sheet) {
  if (sheet.getMaxColumns() < 52) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow < 7) return [];

  var vals = sheet.getRange(7, 50, lastRow - 6, 3).getValues();
  var list = [];
  for (var i = 0; i < vals.length; i++) {
    var mRaw = vals[i][0];
    if (!mRaw) continue;
    var mLabel = formatBouMonthLabel(mRaw);
    if (!mLabel) continue;
    list.push({
      month: mLabel,
      budget: Number(vals[i][1]) || 0,
      give: Number(vals[i][2]) || 0
    });
  }
  return list;
}


// ম্যানুয়াল টেস্ট বা শিট প্রাথমিক সেটআপের জন্য (Apps Script Editor থেকে সরাসরি রান করার জন্য)
function setupSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var mainSheet = getTargetSheet(ss, 'abujar287');
  ensureUnifiedTemplateHeaders(mainSheet);
  Logger.log('Sheet setup complete!');
}
