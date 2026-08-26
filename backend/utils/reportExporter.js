const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

class ReportExporter {
  static async toExcel(title, columns, data) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(title.substring(0, 31));
    
    // Title row
    sheet.mergeCells(1, 1, 1, columns.length);
    const titleCell = sheet.getCell('A1');
    titleCell.value = title;
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: 'center' };
    
    // Headers
    const headerRow = sheet.addRow(columns.map(c => c.header));
    headerRow.font = { bold: true };
    headerRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    });
    
    // Data
    data.forEach(row => {
      sheet.addRow(columns.map(c => row[c.key] || ''));
    });
    
    // Auto width
    sheet.columns.forEach((col, i) => {
      col.width = Math.max(columns[i].header.length + 5, 15);
    });
    
    return workbook;
  }

  static toPDF(title, columns, data, res) {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${title}.pdf"`);
    doc.pipe(res);
    
    doc.fontSize(14).text(title, { align: 'center' });
    doc.moveDown();
    
    // Table
    const tableTop = doc.y;
    const colWidth = (doc.page.width - 60) / columns.length;
    
    // Headers
    doc.fontSize(8).font('Helvetica-Bold');
    columns.forEach((col, i) => {
      doc.text(col.header, 30 + i * colWidth, tableTop, { width: colWidth, align: 'left' });
    });
    doc.moveDown(0.5);
    
    // Data
    doc.font('Helvetica').fontSize(7);
    data.forEach(row => {
      const y = doc.y;
      columns.forEach((col, i) => {
        const val = row[col.key] !== null && row[col.key] !== undefined ? String(row[col.key]) : '';
        doc.text(val.substring(0, 20), 30 + i * colWidth, y, { width: colWidth, align: 'left' });
      });
      if (doc.y > doc.page.height - 50) {
        doc.addPage();
      }
    });
    
    doc.end();
  }
}

module.exports = ReportExporter;
