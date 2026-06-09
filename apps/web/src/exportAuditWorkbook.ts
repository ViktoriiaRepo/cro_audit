import ExcelJS from 'exceljs';
import type { Assessment, DemoAudit, DemoAuditItem, Impact, PriorityLabel } from './types';

const assessmentLabels: Record<Assessment, string> = {
  good: 'Good',
  can_be_improved: 'Can be improved',
  bad: 'Bad',
  irrelevant: 'Irrelevant',
};

const impactLabels: Record<Impact, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const priorityLabels: PriorityLabel[] = ['High', 'Medium', 'Low'];
const categoryOrder = [
  'General',
  'Header',
  'Footer',
  'Home page',
  'Collection page',
  'Product page',
  'Cart',
  'Checkout page',
  'Thank you page',
  'Customer support',
];

const categoryIcons: Record<string, string> = {
  General: '⚙',
  Header: '🧭',
  Footer: '⚓',
  'Home page': '⌂',
  'Collection page': '▣',
  'Product page': '🏷',
  Cart: '🛒',
  'Checkout page': '💳',
  'Thank you page': '✓',
  'Customer support': '☎',
};

const assessmentStyles: Record<string, Pick<ExcelJS.Style, 'fill' | 'font'>> = {
  Good: {
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DCFCE7' } },
    font: { color: { argb: '166534' } },
  },
  'Can be improved': {
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF3C7' } },
    font: { color: { argb: '92400E' } },
  },
  Bad: {
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FECACA' } },
    font: { color: { argb: '991B1B' } },
  },
  Irrelevant: {
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E5E7EB' } },
    font: { color: { argb: '374151' } },
  },
};

const priorityStyles: Record<string, Pick<ExcelJS.Style, 'fill' | 'font'>> = {
  Done: {
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'BBF7D0' } },
    font: { color: { argb: '15803D' }, bold: true },
  },
  High: {
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FCA5A5' } },
    font: { color: { argb: '991B1B' }, bold: true },
  },
  Medium: {
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FED7AA' } },
    font: { color: { argb: 'C2410C' }, bold: true },
  },
  Low: {
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF3C7' } },
    font: { color: { argb: 'B45309' }, bold: true },
  },
};

function fileSafeValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/https?:\/\//g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function setHeaderRow(row: ExcelJS.Row) {
  row.height = 22;
  row.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '1D4ED8' },
    };
    cell.font = {
      color: { argb: 'FFFFFF' },
      bold: true,
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };
    cell.border = {
      top: { style: 'thin', color: { argb: '93C5FD' } },
      left: { style: 'thin', color: { argb: '93C5FD' } },
      bottom: { style: 'thin', color: { argb: '93C5FD' } },
      right: { style: 'thin', color: { argb: '93C5FD' } },
    };
  });
}

function applyDropdownValidation(cell: ExcelJS.Cell, values: string[]) {
  cell.dataValidation = {
    type: 'list',
    allowBlank: true,
    formulae: [`"${values.join(',')}"`],
    showErrorMessage: true,
    errorTitle: 'Invalid value',
    error: 'Choose one of the dropdown values.',
  };
}

function applyCellStyle(cell: ExcelJS.Cell, style: Pick<ExcelJS.Style, 'fill' | 'font'>) {
  cell.fill = style.fill;
  cell.font = style.font;
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
}

function applyCategoryRow(row: ExcelJS.Row, category: string) {
  row.height = 24;
  row.getCell(1).value = `${categoryIcons[category] ?? '•'}  ${category}`;
  row.worksheet.mergeCells(row.number, 1, row.number, 14);

  for (let columnNumber = 1; columnNumber <= 14; columnNumber += 1) {
    const cell = row.getCell(columnNumber);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'F1F5F9' },
    };
    cell.font = {
      bold: true,
      color: { argb: '0F172A' },
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'left',
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'CBD5E1' } },
      left: { style: 'thin', color: { argb: 'CBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
      right: { style: 'thin', color: { argb: 'CBD5E1' } },
    };
  }
}

function groupAuditItems(items: DemoAuditItem[]) {
  const grouped = new Map<string, DemoAuditItem[]>();

  for (const item of items) {
    const category = item.category || 'Uncategorized';
    const categoryItems = grouped.get(category) ?? [];
    categoryItems.push(item);
    grouped.set(category, categoryItems);
  }

  const orderedGroups = categoryOrder
    .filter((category) => grouped.has(category))
    .map((category) => [category, grouped.get(category) ?? []] as const);

  const extraGroups = [...grouped.entries()].filter(([category]) => !categoryOrder.includes(category));

  return [...orderedGroups, ...extraGroups];
}

function applyAssessmentConditionalFormatting(sheet: ExcelJS.Worksheet, endRow: number) {
  sheet.addConditionalFormatting({
    ref: `D2:D${endRow}`,
    rules: [
      {
        type: 'expression',
        priority: 1,
        formulae: ['D2="Good"'],
        style: {
          fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'DCFCE7' }, fgColor: { argb: 'DCFCE7' } },
          font: { color: { argb: '166534' } },
        },
      },
      {
        type: 'expression',
        priority: 2,
        formulae: ['D2="Can be improved"'],
        style: {
          fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FEF3C7' }, fgColor: { argb: 'FEF3C7' } },
          font: { color: { argb: '92400E' } },
        },
      },
      {
        type: 'expression',
        priority: 3,
        formulae: ['D2="Bad"'],
        style: {
          fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FECACA' }, fgColor: { argb: 'FECACA' } },
          font: { color: { argb: '991B1B' } },
        },
      },
      {
        type: 'expression',
        priority: 4,
        formulae: ['D2="Irrelevant"'],
        style: {
          fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'E5E7EB' }, fgColor: { argb: 'E5E7EB' } },
          font: { color: { argb: '111827' } },
        },
      },
    ],
  });

  sheet.addConditionalFormatting({
    ref: `N2:N${endRow}`,
    rules: [
      {
        type: 'expression',
        priority: 5,
        formulae: ['N2="High"'],
        style: {
          fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FECACA' }, fgColor: { argb: 'FECACA' } },
          font: { color: { argb: '991B1B' }, bold: true },
        },
      },
      {
        type: 'expression',
        priority: 6,
        formulae: ['N2="Medium"'],
        style: {
          fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FEF3C7' }, fgColor: { argb: 'FEF3C7' } },
          font: { color: { argb: '92400E' }, bold: true },
        },
      },
      {
        type: 'expression',
        priority: 7,
        formulae: ['N2="Low"'],
        style: {
          fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'DCFCE7' }, fgColor: { argb: 'DCFCE7' } },
          font: { color: { argb: '166534' }, bold: true },
        },
      },
    ],
  });
}

function applyPriorityConditionalFormatting(sheet: ExcelJS.Worksheet, endRow: number) {
  sheet.addConditionalFormatting({
    ref: `J2:J${endRow}`,
    rules: [
      {
        type: 'expression',
        priority: 8,
        formulae: ['J2="High"'],
        style: {
          fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FECACA' }, fgColor: { argb: 'FECACA' } },
          font: { color: { argb: '991B1B' }, bold: true },
        },
      },
      {
        type: 'expression',
        priority: 9,
        formulae: ['J2="Medium"'],
        style: {
          fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FEF3C7' }, fgColor: { argb: 'FEF3C7' } },
          font: { color: { argb: '92400E' }, bold: true },
        },
      },
      {
        type: 'expression',
        priority: 10,
        formulae: ['J2="Low"'],
        style: {
          fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'DCFCE7' }, fgColor: { argb: 'DCFCE7' } },
          font: { color: { argb: '166534' }, bold: true },
        },
      },
      {
        type: 'expression',
        priority: 11,
        formulae: ['J2="Done"'],
        style: {
          fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'BBF7D0' }, fgColor: { argb: 'BBF7D0' } },
          font: { color: { argb: '15803D' }, bold: true },
        },
      },
    ],
  });
}

function applyDoneConditionalFormatting(sheet: ExcelJS.Worksheet, endRow: number) {
  sheet.addConditionalFormatting({
    ref: `A2:N${endRow}`,
    rules: [
      {
        type: 'expression',
        priority: 12,
        formulae: ['$A2=TRUE'],
        style: {
          fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'D1FAE5' }, fgColor: { argb: 'D1FAE5' } },
          font: { color: { argb: '065F46' }, strike: true },
        },
      },
    ],
  });
}

function applyImpactDataBars(sheet: ExcelJS.Worksheet, endRow: number) {
  sheet.addConditionalFormatting({
    ref: `E2:E${endRow}`,
    rules: [
      {
        type: 'dataBar',
        priority: 13,
        showValue: false,
        gradient: false,
        minLength: 15,
        maxLength: 100,
        cfvo: [
          { type: 'num', value: 0 },
          { type: 'num', value: 1 },
        ],
        style: {
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '60A5FA' } },
        },
      },
    ],
  });
}

function scoreFormula(row: number) {
  return `IF(COUNTIFS(Audit!$D$2:$D$${row},"<>Irrelevant",Audit!$D$2:$D$${row},"<>")=0,100,ROUND(100-(((COUNTIF(Audit!$D$2:$D$${row},"Can be improved")*2)+(COUNTIF(Audit!$D$2:$D$${row},"Bad")*3))/(COUNTIFS(Audit!$D$2:$D$${row},"<>Irrelevant",Audit!$D$2:$D$${row},"<>")*3)*100),0))`;
}

function assessmentScoreFormula(row: number) {
  return `E${row}`;
}

function priorityScoreFormula(row: number) {
  return `K${row}+IF(D${row}="Can be improved",2,IF(D${row}="Bad",3,0))`;
}

function priorityLabelFormula(row: number) {
  return `IF(M${row}<1.1,"Low",IF(M${row}>1.7,"High","Medium"))`;
}

function visiblePriorityFormula(row: number) {
  return `IF(A${row}=TRUE,"Done",N${row})`;
}

function itemPriorityValue(item: DemoAuditItem) {
  return priorityLabels.includes(item.priorityLabel) ? item.priorityLabel : 'Medium';
}

export async function downloadAuditWorkbook(audit: DemoAudit): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Shopify CRO Audit MVP';
  workbook.created = new Date(audit.updatedAt);
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const auditSheet = workbook.addWorksheet('Audit', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  auditSheet.columns = [
    { key: 'done', width: 8 },
    { key: 'number', width: 6 },
    { key: 'item', width: 34 },
    { key: 'assessment', width: 18 },
    { key: 'impact', width: 14 },
    { key: 'example', width: 30 },
    { key: 'notes', width: 28 },
    { key: 'findings', width: 34 },
    { key: 'pageUrl', width: 36 },
    { key: 'priority', width: 16 },
    { key: 'impactScore', width: 14 },
    { key: 'fullImpactScore', width: 16 },
    { key: 'priorityScore', width: 14 },
    { key: 'priorityLabel', width: 16 },
  ];

  auditSheet.addRow([
    'Done',
    '#',
    'Item',
    'Assessment',
    'Impact',
    'Example',
    'Notes',
    'Findings & Recommendations',
    'Page / URL',
    'Priority',
    'Impact Score',
    'Full Impact Score',
    'Priority Score',
    'Priority Label',
  ]);

  setHeaderRow(auditSheet.getRow(1));

  for (const [category, categoryItems] of groupAuditItems(audit.items)) {
    applyCategoryRow(auditSheet.addRow([]), category);

    for (const item of categoryItems) {
      const rowNumber = auditSheet.rowCount + 1;
      const assessmentLabel = assessmentLabels[item.assessment];
      const priorityLabel = itemPriorityValue(item);
      const row = auditSheet.addRow([
        false,
        item.itemNumber,
        item.itemLabel,
        assessmentLabel,
        item.impactScore,
        item.example,
        item.notes,
        item.findingsAndRecommendations,
        item.pageUrl,
        { formula: visiblePriorityFormula(rowNumber), result: priorityLabel },
        { formula: assessmentScoreFormula(rowNumber), result: item.impactScore },
        { formula: `K${rowNumber}`, result: item.fullImpactScore },
        { formula: priorityScoreFormula(rowNumber), result: item.priorityScore },
        { formula: priorityLabelFormula(rowNumber), result: item.priorityLabel },
      ]);

      row.eachCell((cell, columnNumber) => {
        cell.alignment = {
          vertical: 'top',
          wrapText: true,
        };

        if (columnNumber === 1 || columnNumber === 2 || columnNumber === 5 || columnNumber >= 10) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }

        if (columnNumber === 5 || columnNumber === 11 || columnNumber === 12 || columnNumber === 13) {
          cell.numFmt = '0.0';
        }

        cell.border = {
          top: { style: 'thin', color: { argb: 'E5E7EB' } },
          left: { style: 'thin', color: { argb: 'E5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'E5E7EB' } },
          right: { style: 'thin', color: { argb: 'E5E7EB' } },
        };
      });

      applyDropdownValidation(row.getCell(4), Object.values(assessmentLabels));
      applyCellStyle(row.getCell(4), assessmentStyles[assessmentLabel] ?? assessmentStyles.Irrelevant!);
      applyCellStyle(row.getCell(10), priorityStyles[priorityLabel] ?? priorityStyles.Medium!);
      applyCellStyle(row.getCell(14), priorityStyles[item.priorityLabel] ?? priorityStyles.Medium!);

      row.getCell(1).font = { color: { argb: '64748B' }, bold: true };
      row.getCell(1).numFmt = 'BOOLEAN';
      row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E5E7EB' } };
      row.getCell(11).numFmt = '0.0';
      row.getCell(12).numFmt = '0.0';
      row.getCell(13).numFmt = '0.0';
    }
  }

  const lastAuditRow = auditSheet.rowCount;
  auditSheet.autoFilter = {
    from: 'A1',
    to: `N${lastAuditRow}`,
  };

  applyAssessmentConditionalFormatting(auditSheet, lastAuditRow);
  applyPriorityConditionalFormatting(auditSheet, lastAuditRow);
  applyDoneConditionalFormatting(auditSheet, lastAuditRow);
  applyImpactDataBars(auditSheet, lastAuditRow);

  const summarySheet = workbook.addWorksheet('Summary', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  summarySheet.columns = [
    { key: 'metric', width: 34 },
    { key: 'value', width: 28 },
  ];

  summarySheet.addRow(['Metric', 'Value']);
  setHeaderRow(summarySheet.getRow(1));

  const doneRange = `Audit!$A$2:$A$${lastAuditRow}`;
  const assessmentRange = `Audit!$D$2:$D$${lastAuditRow}`;
  const priorityRange = `Audit!$J$2:$J$${lastAuditRow}`;
  const overallFormula = scoreFormula(lastAuditRow);
  const summaryRows: Array<[string, string | number | Date | { formula: string; result: string | number }]> = [
    ['Store URL', audit.storeUrl],
    ['Scan Date', new Date(audit.updatedAt)],
    ['Audit Score', { formula: overallFormula, result: audit.overallScore }],
    ['Overall Performance Score', { formula: overallFormula, result: audit.performanceScore }],
    ['Total High Priority Findings', { formula: `COUNTIF(${priorityRange},"High")`, result: audit.items.filter((item) => item.priorityLabel === 'High').length }],
    ['Total Medium Priority Findings', { formula: `COUNTIF(${priorityRange},"Medium")`, result: audit.items.filter((item) => item.priorityLabel === 'Medium').length }],
    ['Total Low Priority Findings', { formula: `COUNTIF(${priorityRange},"Low")`, result: audit.items.filter((item) => item.priorityLabel === 'Low').length }],
    ['Total Done', { formula: `COUNTIF(${doneRange},TRUE)`, result: 0 }],
    ['Total Good', { formula: `COUNTIF(${assessmentRange},"Good")`, result: audit.items.filter((item) => item.assessment === 'good').length }],
    ['Total Can Be Improved', { formula: `COUNTIF(${assessmentRange},"Can be improved")`, result: audit.items.filter((item) => item.assessment === 'can_be_improved').length }],
    ['Total Bad', { formula: `COUNTIF(${assessmentRange},"Bad")`, result: audit.items.filter((item) => item.assessment === 'bad').length }],
  ];

  summaryRows.forEach(([metric, value]) => {
    const row = summarySheet.addRow([metric, value]);
    row.getCell(1).font = { bold: true, color: { argb: '0F172A' } };
    row.getCell(1).border = {
      top: { style: 'thin', color: { argb: 'E2E8F0' } },
      left: { style: 'thin', color: { argb: 'E2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
      right: { style: 'thin', color: { argb: 'E2E8F0' } },
    };
    row.getCell(2).border = {
      top: { style: 'thin', color: { argb: 'E2E8F0' } },
      left: { style: 'thin', color: { argb: 'E2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
      right: { style: 'thin', color: { argb: 'E2E8F0' } },
    };
    row.getCell(2).alignment = { vertical: 'middle', wrapText: true };

    if (metric === 'Scan Date') {
      row.getCell(2).numFmt = 'yyyy-mm-dd hh:mm';
    }

    if (typeof value === 'object' && 'formula' in value) {
      row.getCell(2).numFmt = '0.0';
    }
  });

  summarySheet.autoFilter = {
    from: 'A1',
    to: 'B12',
  };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const storeSlug = fileSafeValue(audit.storeUrl || audit.domain || 'audit');
  const stamp = new Date(audit.updatedAt || Date.now()).toISOString().slice(0, 10);

  anchor.href = objectUrl;
  anchor.download = `cro-audit-${storeSlug}-${stamp}.xlsx`;
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
