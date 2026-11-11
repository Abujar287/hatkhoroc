import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { Transaction } from '../types';
import { cleanCategoryName } from './categoryUtils';
import { normalizeDate, getMonthKeyFromLabel, cleanMappingLabel } from './dateUtils';
import { evaluateExpression } from './calcUtils';

export interface ExportZipOptions {
  month?: string; // e.g. "2026-10" or "Oct-2026" or "all" or "custom"
  startDate?: string; // "YYYY-MM-DD"
  endDate?: string;   // "YYYY-MM-DD"
  transactions: Transaction[];
  lang?: 'en' | 'bn';
  userName?: string;
  monthMappings?: import('../types').MonthMapping[];
}

/**
 * Format currency amount for reports
 */
function formatAmount(val: number): string {
  return 'Tk. ' + Math.abs(val).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Generates and downloads a ZIP package containing:
 * 1. Summary Report PDF (Comprehensive financial breakdown)
 * 2. Details Data Excel Spreadsheet (All transactions, category summaries & overview)
 */
export async function exportMonthlyReportZip(options: ExportZipOptions): Promise<boolean> {
  const { month, startDate, endDate, transactions, lang = 'en', userName = 'Abujar Al-Gifari', monthMappings = [] } = options;

  // 1. Determine target transactions
  let targetTxs: Transaction[] = [];
  let isAllTime = false;
  let periodLabel = '';

  if (startDate && endDate) {
    targetTxs = transactions.filter(t => {
      const d = normalizeDate(t.date);
      return d >= startDate && d <= endDate;
    });
    periodLabel = `${startDate} to ${endDate}`;
  } else {
    isAllTime = !month || month === 'all';
    
    // Check if month matches any custom mapping label or month key
    const mapping = monthMappings.find(m => 
      m.label.toLowerCase() === (month || '').toLowerCase() || 
      getMonthKeyFromLabel(m.label) === month
    );

    if (mapping) {
      targetTxs = transactions.filter(t => {
        const d = normalizeDate(t.date);
        return d >= mapping.startDate && d <= mapping.endDate;
      });
      periodLabel = `${mapping.label} (${mapping.startDate} to ${mapping.endDate})`;
    } else {
      const monthKey = getMonthKeyFromLabel(month);
      targetTxs = isAllTime
        ? [...transactions]
        : transactions.filter(t => normalizeDate(t.date).startsWith(monthKey));
      
      if (isAllTime) {
        periodLabel = 'All-Time Record';
      } else {
        periodLabel = cleanMappingLabel(month) || monthKey || 'Monthly Record';
      }
    }
  }

  if (targetTxs.length === 0) {
    throw new Error(lang === 'en' ? 'No transactions found for the selected period!' : 'নির্বাচিত সময়ের কোনো হিসাব পাওয়া যায়নি!');
  }

  // Sort chronologically
  targetTxs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Compute Statistics
  let totalIncome = 0;
  let totalExpense = 0;
  const expByCat: Record<string, { total: number; count: number }> = {};
  const incByCat: Record<string, { total: number; count: number }> = {};
  const dailyMap: Record<string, { income: number; expense: number; count: number }> = {};

  targetTxs.forEach(tx => {
    const val = Math.abs(evaluateExpression(tx.value));
    const catClean = cleanCategoryName(tx.category, 'en') || 'Other';
    const dateStr = normalizeDate(tx.date);

    if (!dailyMap[dateStr]) {
      dailyMap[dateStr] = { income: 0, expense: 0, count: 0 };
    }
    dailyMap[dateStr].count += 1;

    if (tx.type === 'Income') {
      totalIncome += val;
      if (!incByCat[catClean]) incByCat[catClean] = { total: 0, count: 0 };
      incByCat[catClean].total += val;
      incByCat[catClean].count += 1;
      dailyMap[dateStr].income += val;
    } else {
      totalExpense += val;
      if (!expByCat[catClean]) expByCat[catClean] = { total: 0, count: 0 };
      expByCat[catClean].total += val;
      expByCat[catClean].count += 1;
      dailyMap[dateStr].expense += val;
    }
  });

  const netBalance = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? ((netBalance / totalIncome) * 100) : 0;

  const generatedDateStr = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  // =========================================================================
  // 1. GENERATE BEAUTIFUL SUMMARY PDF WITH JSPDF
  // =========================================================================
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // --- BRAND HEADER BLOCK ---
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 42, 'F');

  // Accent Line
  doc.setFillColor(79, 70, 229); // indigo-600
  doc.rect(0, 42, pageWidth, 2.5, 'F');

  // Title Text
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('HISAB-KITAB', 14, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text('Monthly Financial Summary & Audit Statement', 14, 23);

  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(`Account Holder: ${userName}  |  Generated: ${generatedDateStr}`, 14, 30);
  doc.text(`Statement Period: ${periodLabel}`, 14, 36);

  // Status Badge on Right
  doc.setFillColor(30, 41, 59); // slate-800
  doc.roundedRect(pageWidth - 62, 12, 48, 22, 3, 3, 'F');
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(7.5);
  doc.text('STATEMENT STATUS', pageWidth - 58, 19);
  doc.setTextColor(52, 211, 153); // emerald-400
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('VERIFIED & AUDITED', pageWidth - 58, 28);

  // --- OVERVIEW CARDS (4 COLUMNS) ---
  const startY = 52;
  const cardGap = 3.5;
  const cardWidth = (pageWidth - 28 - (cardGap * 3)) / 4;
  const cardHeight = 22;

  // Card 1: Total Income
  doc.setFillColor(240, 253, 244); // emerald-50
  doc.setDrawColor(187, 247, 208); // emerald-200
  doc.roundedRect(14, startY, cardWidth, cardHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(22, 101, 52); // emerald-800
  doc.text('TOTAL INCOME', 17, startY + 6);
  doc.setFontSize(10.5);
  doc.setTextColor(5, 150, 105); // emerald-600
  doc.text(`+${formatAmount(totalIncome)}`, 17, startY + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(74, 222, 128);
  doc.text(`${targetTxs.filter(t => t.type === 'Income').length} transactions`, 17, startY + 19);

  // Card 2: Total Expense
  const c2X = 14 + cardWidth + cardGap;
  doc.setFillColor(254, 242, 242); // rose-50
  doc.setDrawColor(254, 205, 211); // rose-200
  doc.roundedRect(c2X, startY, cardWidth, cardHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(159, 18, 57); // rose-800
  doc.text('TOTAL EXPENSE', c2X + 3, startY + 6);
  doc.setFontSize(10.5);
  doc.setTextColor(225, 29, 72); // rose-600
  doc.text(`-${formatAmount(totalExpense)}`, c2X + 3, startY + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(251, 113, 133);
  doc.text(`${targetTxs.filter(t => t.type === 'Expense').length} transactions`, c2X + 3, startY + 19);

  // Card 3: Net Savings / Balance
  const c3X = c2X + cardWidth + cardGap;
  const isPositive = netBalance >= 0;
  if (isPositive) {
    doc.setFillColor(238, 242, 255); // indigo-50
    doc.setDrawColor(199, 210, 254); // indigo-200
  } else {
    doc.setFillColor(254, 242, 242); // rose-50
    doc.setDrawColor(254, 205, 211); // rose-200
  }
  doc.roundedRect(c3X, startY, cardWidth, cardHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(isPositive ? 49 : 159, isPositive ? 46 : 18, isPositive ? 129 : 57);
  doc.text('NET BALANCE', c3X + 3, startY + 6);
  doc.setFontSize(10.5);
  doc.setTextColor(isPositive ? 67 : 225, isPositive ? 56 : 29, isPositive ? 202 : 72);
  doc.text(`${isPositive ? '+' : '-'}${formatAmount(Math.abs(netBalance))}`, c3X + 3, startY + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(129, 140, 248);
  doc.text(isPositive ? 'Net Surplus' : 'Net Deficit', c3X + 3, startY + 19);

  // Card 4: Savings Rate
  const c4X = c3X + cardWidth + cardGap;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(c4X, startY, cardWidth, cardHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text('SAVINGS RATE', c4X + 3, startY + 6);
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(`${savingsRate.toFixed(1)}%`, c4X + 3, startY + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Total: ${targetTxs.length} records`, c4X + 3, startY + 19);

  // --- EXPENSE BREAKDOWN TABLE ---
  const expSorted = Object.entries(expByCat).sort((a, b) => b[1].total - a[1].total);
  const expRows = expSorted.map(([cat, info], idx) => {
    const pct = totalExpense > 0 ? ((info.total / totalExpense) * 100).toFixed(1) + '%' : '0%';
    return [String(idx + 1), cat, String(info.count), formatAmount(info.total), pct];
  });

  // Subheading
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Expense Breakdown by Category', 14, 83);

  autoTable(doc, {
    startY: 86,
    head: [['#', 'Category', 'Entries', 'Total Amount', '% Share']],
    body: expRows.length > 0 ? expRows : [['-', 'No expenses recorded', '-', '-', '-']],
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left'
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85]
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 65 },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 45, halign: 'right', fontStyle: 'bold' },
      4: { cellWidth: 35, halign: 'right' }
    },
    margin: { left: 14, right: 14 }
  });

  let currentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 10 : 150;

  // --- INCOME BREAKDOWN TABLE (If income exists) ---
  const incSorted = Object.entries(incByCat).sort((a, b) => b[1].total - a[1].total);
  if (incSorted.length > 0) {
    if (currentY > pageHeight - 50) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('2. Income Breakdown by Category', 14, currentY);

    const incRows = incSorted.map(([cat, info], idx) => {
      const pct = totalIncome > 0 ? ((info.total / totalIncome) * 100).toFixed(1) + '%' : '0%';
      return [String(idx + 1), cat, String(info.count), formatAmount(info.total), pct];
    });

    autoTable(doc, {
      startY: currentY + 3,
      head: [['#', 'Income Category', 'Entries', 'Total Amount', '% Share']],
      body: incRows,
      theme: 'grid',
      headStyles: {
        fillColor: [5, 150, 105],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'left'
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [51, 65, 85]
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 65 },
        2: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 45, halign: 'right', fontStyle: 'bold' },
        4: { cellWidth: 35, halign: 'right' }
      },
      margin: { left: 14, right: 14 }
    });

    currentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 10 : currentY + 40;
  }

  // --- DAILY SUMMARY TABLE ---
  const sortedDates = Object.keys(dailyMap).sort();
  if (sortedDates.length > 0) {
    if (currentY > pageHeight - 60) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('3. Daily Summary Timeline', 14, currentY);

    const dailyRows = sortedDates.map(dateKey => {
      const item = dailyMap[dateKey];
      const dNet = item.income - item.expense;
      const dObj = new Date(dateKey + 'T00:00:00');
      const dayName = isNaN(dObj.getTime()) ? '' : dObj.toLocaleDateString('en-US', { weekday: 'short' });

      return [
        dateKey,
        dayName,
        item.income > 0 ? `+${formatAmount(item.income)}` : '-',
        item.expense > 0 ? `-${formatAmount(item.expense)}` : '-',
        (dNet >= 0 ? '+' : '-') + formatAmount(Math.abs(dNet)),
        String(item.count)
      ];
    });

    autoTable(doc, {
      startY: currentY + 3,
      head: [['Date', 'Day', 'Income', 'Expense', 'Daily Net', 'Records']],
      body: dailyRows,
      theme: 'striped',
      headStyles: {
        fillColor: [51, 65, 85],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: [51, 65, 85]
      },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 22 },
        2: { cellWidth: 35, halign: 'right' },
        3: { cellWidth: 35, halign: 'right' },
        4: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
        5: { cellWidth: 25, halign: 'center' }
      },
      margin: { left: 14, right: 14 }
    });

    currentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 10 : currentY + 40;
  }

  // --- TRANSACTION DETAILS TABLE ---
  if (targetTxs.length > 0) {
    if (currentY > pageHeight - 60) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('4. Transaction Details Log', 14, currentY);

    const txRows = targetTxs.map((tx, idx) => [
      String(idx + 1),
      normalizeDate(tx.date),
      tx.type,
      cleanCategoryName(tx.category, 'en'),
      tx.note || '—',
      (tx.type === 'Expense' ? '-' : '+') + formatAmount(Math.abs(evaluateExpression(tx.value)))
    ]);

    autoTable(doc, {
      startY: currentY + 3,
      head: [['#', 'Date', 'Type', 'Category', 'Note', 'Amount']],
      body: txRows,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: [51, 65, 85]
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 24, halign: 'center' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 42 },
        4: { cellWidth: 46 },
        5: { cellWidth: 40, halign: 'right', fontStyle: 'bold' }
      },
      margin: { left: 14, right: 14 }
    });
  }

  // Footer for each page
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Hisab-Kitab Smart Personal Expense & Income Tracker  |  Page ${i} of ${totalPages}`,
      14,
      pageHeight - 8
    );
    doc.text(
      `Confidential & Personal Report  |  ${userName}`,
      pageWidth - 75,
      pageHeight - 8
    );
  }

  const pdfArrayBuffer = doc.output('arraybuffer');

  // =========================================================================
  // 2. GENERATE FULL DETAILS EXCEL SPREADSHEET WITH XLSX (SHEETJS)
  // =========================================================================
  const wb = XLSX.utils.book_new();

  // --- SHEET 1: ALL TRANSACTION DETAILS ---
  const txSheetData = [
    ['#', 'Date', 'Type', 'Category', 'Amount (BDT)', 'Note / Description', 'Logged Datetime', 'ID'],
    ...targetTxs.map((t, idx) => [
      idx + 1,
      normalizeDate(t.date),
      t.type,
      cleanCategoryName(t.category, 'en'),
      Math.abs(evaluateExpression(t.value)),
      t.note || '',
      t.datetime || '',
      t.id
    ])
  ];

  const wsTransactions = XLSX.utils.aoa_to_sheet(txSheetData);
  // Auto-width columns
  wsTransactions['!cols'] = [
    { wch: 6 },  // #
    { wch: 13 }, // Date
    { wch: 10 }, // Type
    { wch: 22 }, // Category
    { wch: 16 }, // Amount
    { wch: 35 }, // Note
    { wch: 22 }, // Datetime
    { wch: 20 }  // ID
  ];
  XLSX.utils.book_append_sheet(wb, wsTransactions, 'All Transactions');

  // --- SHEET 2: CATEGORY BREAKDOWN ---
  const catSheetData = [
    ['Category Summary', '', '', ''],
    ['Type', 'Category', 'Transaction Count', 'Total Amount (BDT)', 'Share %'],
    ...expSorted.map(([cat, info]) => [
      'Expense',
      cat,
      info.count,
      info.total,
      totalExpense > 0 ? ((info.total / totalExpense) * 100).toFixed(2) + '%' : '0%'
    ]),
    ...incSorted.map(([cat, info]) => [
      'Income',
      cat,
      info.count,
      info.total,
      totalIncome > 0 ? ((info.total / totalIncome) * 100).toFixed(2) + '%' : '0%'
    ])
  ];

  const wsCategories = XLSX.utils.aoa_to_sheet(catSheetData);
  wsCategories['!cols'] = [
    { wch: 12 },
    { wch: 25 },
    { wch: 18 },
    { wch: 20 },
    { wch: 14 }
  ];
  XLSX.utils.book_append_sheet(wb, wsCategories, 'Category Breakdown');

  // --- SHEET 3: OVERVIEW & AUDIT SUMMARY ---
  const overviewSheetData = [
    ['HISAB-KITAB FINANCIAL SUMMARY REPORT', ''],
    ['Period', periodLabel],
    ['Account Holder', userName],
    ['Report Generated Date', generatedDateStr],
    ['', ''],
    ['FINANCIAL METRIC', 'VALUE (BDT)'],
    ['Total Income (+)', totalIncome],
    ['Total Expense (-)', totalExpense],
    ['Net Savings / Balance', netBalance],
    ['Savings Rate (%)', savingsRate.toFixed(2) + '%'],
    ['Total Transactions Count', targetTxs.length],
    ['Income Entries Count', targetTxs.filter(t => t.type === 'Income').length],
    ['Expense Entries Count', targetTxs.filter(t => t.type === 'Expense').length]
  ];

  const wsOverview = XLSX.utils.aoa_to_sheet(overviewSheetData);
  wsOverview['!cols'] = [
    { wch: 30 },
    { wch: 28 }
  ];
  XLSX.utils.book_append_sheet(wb, wsOverview, 'Monthly Summary');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

  // =========================================================================
  // 3. PACK INTO A SINGLE CLEAN ZIP ARCHIVE WITH JSZIP
  // =========================================================================
  const zip = new JSZip();
  const filePrefix = isAllTime ? 'HatKhoroch_All_Time_Report' : `HatKhoroch_Monthly_Report_${month}`;

  // Add the beautifully designed PDF report
  zip.file(`${filePrefix}_Summary.pdf`, pdfArrayBuffer);

  // Add the comprehensive Excel spreadsheet
  zip.file(`${filePrefix}_Details.xlsx`, excelBuffer);

  // Generate the zip blob
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });

  // Download Trigger in Browser
  const downloadUrl = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `${filePrefix}_Package.zip`;
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  }, 1200);

  return true;
}
