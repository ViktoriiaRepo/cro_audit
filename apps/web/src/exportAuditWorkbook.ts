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
const uncheckedValue = '☐';
const checkedValue = '☑';
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
  row.height = 38;
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
        formulae: [`OR($A2=TRUE,$A2="${checkedValue}")`],
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
  return `IF(OR(A${row}=TRUE,A${row}="${checkedValue}"),"Done",N${row})`;
}

function itemPriorityValue(item: DemoAuditItem) {
  return priorityLabels.includes(item.priorityLabel) ? item.priorityLabel : 'Medium';
}

function averagePageSpeedScore(audit: DemoAudit): number | null {
  const scores = audit.performanceResults
    .map((result) => result.performanceScore)
    .filter((score): score is number => typeof score === 'number');

  if (scores.length === 0) {
    return null;
  }

  return Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10;
}

function scoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Great';
  if (score >= 50) return 'Good';
  if (score >= 25) return 'Fair';
  return 'Poor';
}

function drawSpeedGaugeDataUrl(score: number, title = 'PageSpeed Score'): string {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 620;
  const context = canvas.getContext('2d');

  if (!context) {
    return '';
  }

  const centerX = 450;
  const centerY = 360;
  const radius = 210;
  const startAngle = Math.PI * 0.78;
  const endAngle = Math.PI * 2.22;
  const sweep = endAngle - startAngle;

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = '#111827';
  context.font = '700 28px Arial';
  context.textAlign = 'center';
  context.fillText(title, centerX, 70);

  context.lineWidth = 30;
  context.lineCap = 'butt';

  const bands = [
    { from: 0, to: 25, color: '#dc2626' },
    { from: 25, to: 50, color: '#f97316' },
    { from: 50, to: 75, color: '#f59e0b' },
    { from: 75, to: 90, color: '#84cc16' },
    { from: 90, to: 100, color: '#16a34a' },
  ];

  context.strokeStyle = '#cbd5e1';
  context.lineWidth = 42;
  context.beginPath();
  context.arc(centerX, centerY, radius + 10, startAngle, endAngle);
  context.stroke();

  for (const band of bands) {
    const bandStart = startAngle + (band.from / 100) * sweep;
    const bandEnd = startAngle + (band.to / 100) * sweep;
    context.strokeStyle = band.color;
    context.lineWidth = 28;
    context.beginPath();
    context.arc(centerX, centerY, radius, bandStart, bandEnd);
    context.stroke();
  }

  const ticks = [0, 25, 50, 75, 100];
  context.strokeStyle = '#111827';
  context.lineWidth = 3;
  for (const tick of ticks) {
    const angle = startAngle + (tick / 100) * sweep;
    const inner = radius - 26;
    const outer = radius + 18;
    context.beginPath();
    context.moveTo(centerX + Math.cos(angle) * inner, centerY + Math.sin(angle) * inner);
    context.lineTo(centerX + Math.cos(angle) * outer, centerY + Math.sin(angle) * outer);
    context.stroke();
  }

  const clampedScore = Math.max(0, Math.min(100, score));
  const needleAngle = startAngle + (clampedScore / 100) * sweep;
  context.strokeStyle = '#fb6f4a';
  context.lineWidth = 18;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(centerX - Math.cos(needleAngle) * 40, centerY - Math.sin(needleAngle) * 40);
  context.lineTo(centerX + Math.cos(needleAngle) * (radius - 25), centerY + Math.sin(needleAngle) * (radius - 25));
  context.stroke();

  context.fillStyle = '#0f766e';
  context.beginPath();
  context.arc(centerX, centerY, 26, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = '#111827';
  context.lineWidth = 2;
  context.stroke();

  context.fillStyle = '#111827';
  context.font = '700 40px Arial';
  context.fillText(String(score), centerX, 505);

  context.font = '700 20px Arial';
  context.fillStyle = '#dc2626';
  context.fillText('Poor', 260, 440);
  context.fillStyle = '#ef4444';
  context.fillText('Fair', 240, 250);
  context.fillStyle = '#f97316';
  context.fillText('Good', centerX, 125);
  context.fillStyle = '#65a30d';
  context.fillText('Great', 665, 250);
  context.fillStyle = '#16a34a';
  context.fillText('Excellent', 685, 440);

  context.fillStyle = '#334155';
  context.font = '14px Arial';
  context.fillText('Google PageSpeed Insights performance score.', centerX, 570);

  return canvas.toDataURL('image/png');
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
    { key: 'done', width: 11 },
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
  auditSheet.getCell('A1').note = 'For clickable Google Sheets checkboxes, select the Done cells and use Insert > Checkbox. Checked TRUE values will mark rows as Done.';

  for (const [category, categoryItems] of groupAuditItems(audit.items)) {
    applyCategoryRow(auditSheet.addRow([]), category);

    for (const item of categoryItems) {
      const rowNumber = auditSheet.rowCount + 1;
      const assessmentLabel = assessmentLabels[item.assessment];
      const priorityLabel = itemPriorityValue(item);
      const row = auditSheet.addRow([
        uncheckedValue,
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

      applyDropdownValidation(row.getCell(1), [uncheckedValue, checkedValue]);
      applyDropdownValidation(row.getCell(4), Object.values(assessmentLabels));
      applyCellStyle(row.getCell(4), assessmentStyles[assessmentLabel] ?? assessmentStyles.Irrelevant!);
      applyCellStyle(row.getCell(10), priorityStyles[priorityLabel] ?? priorityStyles.Medium!);
      applyCellStyle(row.getCell(14), priorityStyles[item.priorityLabel] ?? priorityStyles.Medium!);

      row.getCell(1).font = { color: { argb: '64748B' }, bold: true };
      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
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
  const mobilePerformance = audit.performanceResults.find((result) => result.strategy === 'mobile');
  const desktopPerformance = audit.performanceResults.find((result) => result.strategy === 'desktop');
  const summaryRows: Array<[string, string | number | Date | { formula: string; result: string | number }]> = [
    ['Store URL', audit.storeUrl],
    ['Scan Date', new Date(audit.updatedAt)],
    ['Audit Score', { formula: overallFormula, result: audit.overallScore }],
    ['Overall Performance Score', { formula: overallFormula, result: audit.performanceScore }],
    ['Mobile PageSpeed Score', mobilePerformance?.performanceScore ?? 'Not available'],
    ['Desktop PageSpeed Score', desktopPerformance?.performanceScore ?? 'Not available'],
    ['Total High Priority Findings', { formula: `COUNTIF(${priorityRange},"High")`, result: audit.items.filter((item) => item.priorityLabel === 'High').length }],
    ['Total Medium Priority Findings', { formula: `COUNTIF(${priorityRange},"Medium")`, result: audit.items.filter((item) => item.priorityLabel === 'Medium').length }],
    ['Total Low Priority Findings', { formula: `COUNTIF(${priorityRange},"Low")`, result: audit.items.filter((item) => item.priorityLabel === 'Low').length }],
    ['Total Done', { formula: `COUNTIF(${doneRange},TRUE)+COUNTIF(${doneRange},"${checkedValue}")`, result: 0 }],
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
    to: `B${summaryRows.length + 1}`,
  };

  const performanceSheet = workbook.addWorksheet('Performance', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  performanceSheet.columns = [
    { key: 'url', width: 42 },
    { key: 'strategy', width: 14 },
    { key: 'performanceScore', width: 18 },
    { key: 'accessibilityScore', width: 18 },
    { key: 'bestPracticesScore', width: 20 },
    { key: 'seoScore', width: 14 },
    { key: 'firstContentfulPaint', width: 20 },
    { key: 'largestContentfulPaint', width: 22 },
    { key: 'totalBlockingTime', width: 22 },
    { key: 'cumulativeLayoutShift', width: 24 },
    { key: 'speedIndex', width: 18 },
    { key: 'errorMessage', width: 42 },
  ];

  performanceSheet.addRow([
    'URL',
    'Device',
    'Performance Score',
    'Accessibility Score',
    'Best Practices Score',
    'SEO Score',
    'FCP',
    'LCP',
    'TBT',
    'CLS',
    'Speed Index',
    'Error',
  ]);
  setHeaderRow(performanceSheet.getRow(1));

  if (audit.performanceResults.length > 0) {
    audit.performanceResults.forEach((result) => {
      const row = performanceSheet.addRow([
        result.url,
        result.strategy,
        result.performanceScore ?? '',
        result.accessibilityScore ?? '',
        result.bestPracticesScore ?? '',
        result.seoScore ?? '',
        result.firstContentfulPaint,
        result.largestContentfulPaint,
        result.totalBlockingTime,
        result.cumulativeLayoutShift,
        result.speedIndex,
        result.errorMessage ?? '',
      ]);

      row.eachCell((cell, columnNumber) => {
        cell.alignment = {
          vertical: 'top',
          horizontal: columnNumber >= 2 && columnNumber <= 6 ? 'center' : 'left',
          wrapText: true,
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'E5E7EB' } },
          left: { style: 'thin', color: { argb: 'E5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'E5E7EB' } },
          right: { style: 'thin', color: { argb: 'E5E7EB' } },
        };

        if (columnNumber >= 3 && columnNumber <= 6) {
          cell.numFmt = '0';
        }
      });
    });
  } else {
    performanceSheet.addRow(['No PageSpeed results collected yet.']);
  }

  performanceSheet.autoFilter = {
    from: 'A1',
    to: `L${Math.max(performanceSheet.rowCount, 1)}`,
  };

  const speedScoreSheet = workbook.addWorksheet('Speed Score');
  speedScoreSheet.columns = [
    { key: 'a', width: 14 },
    { key: 'b', width: 14 },
    { key: 'c', width: 14 },
    { key: 'd', width: 14 },
    { key: 'e', width: 14 },
    { key: 'f', width: 14 },
    { key: 'g', width: 14 },
    { key: 'h', width: 14 },
  ];

  const pageSpeedScore = averagePageSpeedScore(audit);
  const gaugeResults = audit.performanceResults.filter((result) => typeof result.performanceScore === 'number');
  speedScoreSheet.getCell('A1').value = 'Mobile and desktop PageSpeed scores are shown separately. Average is listed below.';

  if (gaugeResults.length > 0) {
    gaugeResults.forEach((result, index) => {
      const score = result.performanceScore;

      if (score === null) {
        return;
      }

      const gaugeImage = drawSpeedGaugeDataUrl(score, `${result.strategy === 'mobile' ? 'Mobile' : 'Desktop'} PageSpeed Score`);

      if (gaugeImage) {
        const imageId = workbook.addImage({
          base64: gaugeImage,
          extension: 'png',
        });
        speedScoreSheet.addImage(imageId, {
          tl: { col: 0.8, row: 1.2 + index * 25 },
          ext: { width: 760, height: 520 },
        });
      }

      const rowNumber = 31 + index * 25;
      speedScoreSheet.getCell(`B${rowNumber}`).value = result.strategy === 'mobile' ? 'Mobile score' : 'Desktop score';
      speedScoreSheet.getCell(`C${rowNumber}`).value = score;
      speedScoreSheet.getCell(`D${rowNumber}`).value = scoreLabel(score);
      speedScoreSheet.getCell(`B${rowNumber}`).font = { bold: true };
      speedScoreSheet.getCell(`C${rowNumber}`).font = { bold: true, size: 16 };
      speedScoreSheet.getCell(`D${rowNumber}`).font = { bold: true, size: 16 };
    });

    const averageRow = 31 + gaugeResults.length * 25;
    speedScoreSheet.getCell(`B${averageRow}`).value = 'Average score';
    speedScoreSheet.getCell(`C${averageRow}`).value = pageSpeedScore ?? 'Not available';
    speedScoreSheet.getCell(`D${averageRow}`).value = pageSpeedScore === null ? '' : scoreLabel(pageSpeedScore);
    speedScoreSheet.getCell(`B${averageRow}`).font = { bold: true };
    speedScoreSheet.getCell(`C${averageRow}`).font = { bold: true, size: 16 };
    speedScoreSheet.getCell(`D${averageRow}`).font = { bold: true, size: 16 };
  } else {
    speedScoreSheet.getCell('B4').value = 'No PageSpeed score available yet.';
    speedScoreSheet.getCell('B4').font = { bold: true, size: 16, color: { argb: '991B1B' } };
  }

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
