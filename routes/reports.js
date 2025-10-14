//
//
const express = require('express');
const router = express.Router();
const csv = require('csv-express');
const PDFDocument = require('pdfkit');
const User = require('../models/User');
const Fee = require('../models/Fee');
const Result = require('../models/Result');
const Notice = require('../models/Notice');
const Timetable = require('../models/Timetable');
const auth = require('../middleware/auth');

// Helper functions for PDF generation
function pickColumns(data) {
  if (!data || data.length === 0) return [];
  const sample = data[0];
  const columns = Object.keys(sample);
  // Filter out internal MongoDB fields and sensitive data
  return columns.filter(col => !col.startsWith('_') && col !== '__v' && col !== 'password');
}

function displayName(columnName) {
  // Convert camelCase or snake_case to Title Case
  return columnName
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

function stringify(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    // Handle populated references (like parent object)
    if (value.name) return value.name;
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * IT23646292 - Wathsana P S S 
 * This route generates a custom, downloadable PDF 'Result Slip' (report card)
 * for a specific student.
 *
 * It works by:
 * 1. Fetching the student's details and all their academic results from the database.
 * 2. Performing a security check to ensure a parent can only access their own child's report.
 * 3. Using the `pdfkit` library to dynamically build a professional-looking PDF document.
 * 4. Formatting the content with a title, student info, a results table, and a summary.
 * 5. Streaming the final PDF to the user's browser, prompting a file download.
 */
// Generate a PDF result slip for a single student
router.get('/result-slip/:studentId', auth, async (req, res) => {
  const { studentId } = req.params;
  try {
    // Find the student
    const student = await User.findOne({ _id: studentId, role: 'Student' }).populate('parent', 'name email').lean();
    if (!student) {
      return res.status(404).json({ msg: 'Student not found' });
    }
    
    // Security check: Ensure parent can only download their own child's result slip
    if (req.user.role === 'Parent') {
      if (!student.parent || student.parent._id.toString() !== req.user.id) {
        return res.status(403).json({ msg: 'Access denied: You can only download your own child\'s result slip' });
      }
    }
    
    // Get results for this student
    const results = await Result.find({ studentId }).lean();
    
    if (!results || results.length === 0) {
      return res.status(404).json({ msg: 'No results found for this student' });
    }

    // Set PDF response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=result-slip-${student.name || studentId}.pdf`);
    
    // Create PDF document
    const doc = new PDFDocument({ 
      size: 'A4', 
      margins: { top: 56, bottom: 56, left: 48, right: 48 } 
    });
    
    doc.pipe(res);

    // Header/Title
    doc.font('Helvetica-Bold').fontSize(20).text('RESULT SLIP', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor('#666').text('Academic Performance Report', { align: 'center' });
    doc.moveDown(1.5);

    // Student Information
    doc.fillColor('#000').font('Helvetica-Bold').fontSize(14).text('Student Information');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(11);
    doc.text(`Name: ${student.name || 'N/A'}`);
    doc.text(`Student ID: ${student._id}`);
    doc.text(`Grade: ${student.grade || 'N/A'}`);
    doc.text(`Section: ${student.section || 'N/A'}`);
    doc.text(`Email: ${student.email || 'N/A'}`);
    if (student.parent) {
      doc.text(`Parent: ${student.parent.name || 'N/A'} (${student.parent.email || 'N/A'})`);
    }
    doc.moveDown(1);

    // Results Table
    doc.font('Helvetica-Bold').fontSize(14).text('Academic Results');
    doc.moveDown(0.5);
    
    // Table headers
    const startY = doc.y;
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('Subject', 60, startY, { width: 100 });
    doc.text('Exam', 180, startY, { width: 100 });
    doc.text('Score', 300, startY, { width: 60 });
    doc.text('Grade', 380, startY, { width: 60 });
    
    // Header underline
    doc.moveTo(60, startY + 15).lineTo(450, startY + 15).stroke();
    
    // Table rows
    let currentY = startY + 25;
    doc.font('Helvetica').fontSize(10);
    
    results.forEach((result, index) => {
      // Alternating row background (light gray for even rows)
      if (index % 2 === 0) {
        doc.rect(50, currentY - 5, 410, 20).fillColor('#f8f8f8').fill();
        doc.fillColor('#000'); // Reset text color
      }
      
      doc.text(result.subject || 'N/A', 60, currentY, { width: 100 });
      doc.text(result.exam || 'N/A', 180, currentY, { width: 100 });
      doc.text(String(result.score || 'N/A'), 300, currentY, { width: 60 });
      doc.text(result.grade || 'N/A', 380, currentY, { width: 60 });
      
      currentY += 20;
    });
    
    // Bottom border for table
    doc.moveTo(60, currentY).lineTo(450, currentY).stroke();
    
    // Summary statistics
    doc.moveDown(2);
    const totalSubjects = results.length;
    const totalScore = results.reduce((sum, r) => sum + (Number(r.score) || 0), 0);
    const averageScore = totalSubjects > 0 ? (totalScore / totalSubjects).toFixed(2) : 0;
    
    doc.font('Helvetica-Bold').fontSize(12).text('Summary');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(11);
    doc.text(`Total Subjects: ${totalSubjects}`);
    doc.text(`Total Score: ${totalScore}`);
    doc.text(`Average Score: ${averageScore}%`);
    
    // Footer
    doc.moveDown(2);
    doc.fontSize(9).fillColor('#666');
    doc.text(`Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, { align: 'center' });
    doc.text('This is a system-generated document.', { align: 'center' });

    doc.end();
    
  } catch (err) {
    console.error('Error generating result slip:', err);
    if (!res.headersSent) {
      res.status(500).json({ msg: 'Server Error', error: err.message });
    }
  }
});


/**
 * IT23168190 - R A WEERASOORIYA
 * IT23337558 - Oshada W G D 
 * IT23621374 - Brundhaban.J 
 * IT23569454 - De Silva K.S.D 
 * IT23646292 - Wathsana P S S 
 * This is a versatile and powerful data export route that acts as a
 * general-purpose report generator for the application.
 *
 * It works by:
 * 1.  Accepting a report 'type' from the URL (e.g., 'students', 'fees', 'results').
 * 2.  Accepting a desired file 'format' from a query parameter (e.g., '?format=pdf' or '?format=csv').
 * 3.  Fetching the corresponding data from the database based on the 'type'.
 * 4.  Dynamically generating either:
 * a) A professionally formatted, multi-page PDF document with tables, headers, and footers.
 * b) A simple CSV file suitable for spreadsheets like Excel.
 * 5.  Streaming the generated file to the user's browser for download.
 */
router.get('/:type', async (req, res) => {
  const { type } = req.params;
  const { format } = req.query;
  let data;
  let filename;

  try {
    // This switch statement checks the 'type' from the URL to decide which data to fetch.
    switch (type) {

      // Handles the 'students' report type.
      case 'students':
        data = await User.find({ role: 'Student' }).populate('parent', 'name email').lean();
        filename = 'students';
        break;

      // Handles the 'teachers' report type.
      case 'teachers':
        data = await User.find({ role: 'Teacher' }).lean();
        filename = 'teachers';
        break;

      // Handles the 'parents' report type.
      case 'parents':
        data = await User.find({ role: 'Parent' }).lean();
        filename = 'parents';
        break;
      
      // Handles the 'fees' report type.
      case 'fees':
        data = await Fee.find().lean();
        filename = 'fees';
        break;
      
      // Handles the 'results' report type.
      case 'results':
        data = await Result.find().lean();
        filename = 'results';
        break;

      // Handles the 'notices' report type.
      case 'notices':
        data = await Notice.find().lean();
        filename = 'notices';
        break;

      // Handles the 'timetable' report type.
      case 'timetable':
        data = await Timetable.find().lean();
        filename = 'timetable';
        break;

      
      default:
        return res.status(400).json({ msg: 'Invalid report type' });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ msg: 'No data found for this report type' });
    }

    /**
     * This block of code is a sophisticated PDF report generator.
     * Its main job is to take a set of data and dynamically build a professional,
     * multi-page PDF document with a well-formatted table.
     *
     * Key Features:
     * 1.  **Smart Orientation:** It automatically switches to landscape mode if the table has too many columns.
     * 2.  **Dynamic Column Sizing:** It analyzes the data to intelligently calculate the best width for each column.
     * 3.  **Professional Theming:** It applies a clean visual theme with colored headers and alternating row colors (zebra striping).
     * 4.  **Multi-Page Handling:** It automatically adds new pages, redraws the table header, and includes page numbers in the footer for long reports.
     * 5.  **Streaming:** It streams the generated PDF directly to the user's browser for an efficient download.
     */
    if (format === 'pdf') {
      // === Improved PDF ===
      // Decide orientation based on column count
      const columns = pickColumns(data);
      const landscape = columns.length > 6;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}.pdf`);

      const doc = new PDFDocument({
        size: 'A4',
        layout: landscape ? 'landscape' : 'portrait',
        margins: { top: 56, bottom: 56, left: 48, right: 48 }
      });

      // Stream to response
      doc.pipe(res);

      // Theme
      const theme = {
        headerBg: '#f4f6f8',
        zebraBg: '#fafafa',
        border: '#dfe3e8',
        titleColor: '#111827',
      };

      // Title block
      const title = `${filename.charAt(0).toUpperCase() + filename.slice(1)} Report`;
      doc
        .fillColor(theme.titleColor)
        .font('Helvetica-Bold')
        .fontSize(22)
        .text(title, { align: 'center' });
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#6b7280')
        .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
      doc.moveDown(1);

      // Table region geometry
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const tableLeft = doc.page.margins.left;
      const rowPaddingX = 6;
      const rowPaddingY = 6;

      // Compute column widths (proportional to content)
      const maxSamples = Math.min(200, data.length);
      const sample = data.slice(0, maxSamples);
      const headerWeights = columns.map(c => Math.max(6, displayName(c).length)); // header minimum
      const contentWeights = columns.map((c, idx) => {
        const maxLen = sample.reduce((m, r) => Math.max(m, stringify(r[c]).length), 0);
        return Math.max(headerWeights[idx], Math.min(60, maxLen)); // cap extremely long
      });
      const totalWeight = contentWeights.reduce((a, b) => a + b, 0) || 1;
      const minCol = 60; // px-ish
      const maxCol = Math.max(120, pageWidth / 2); // avoid one giant column
      const colWidths = contentWeights.map(w => {
        const raw = (w / totalWeight) * pageWidth;
        return Math.max(minCol, Math.min(maxCol, raw));
      });

      // Ensure widths sum to pageWidth (adjust last)
      const widthSum = colWidths.reduce((a, b) => a + b, 0);
      colWidths[colWidths.length - 1] += (pageWidth - widthSum);

      // Draw table header (function so we can repeat on each page)
      const headerHeight = 24;
      const rowBorder = 0.5;
      const headerFontSize = 10;
      const cellFontSize = 10;

      function drawHeader(y) {
        // background
        doc.save()
          .rect(tableLeft, y, pageWidth, headerHeight)
          .fill(theme.headerBg)
          .restore();
        // bottom border
        doc.save()
          .lineWidth(rowBorder)
          .strokeColor(theme.border)
          .moveTo(tableLeft, y + headerHeight)
          .lineTo(tableLeft + pageWidth, y + headerHeight)
          .stroke()
          .restore();
        // titles
        doc.font('Helvetica-Bold').fontSize(headerFontSize).fillColor('#111827');
        let x = tableLeft;
        columns.forEach((c, i) => {
          doc.text(displayName(c), x + rowPaddingX, y + (headerHeight - headerFontSize) / 2 - 1, {
            width: colWidths[i] - rowPaddingX * 2,
            align: 'left',
            ellipsis: true
          });
          x += colWidths[i];
        });
      }

      // Footer with page number
      function drawFooter() {
        const { page } = doc;
        const footerText = `Page ${page.number}`;
        doc.font('Helvetica').fontSize(9).fillColor('#6b7280');
        doc.text(footerText, doc.page.margins.left, page.height - doc.page.margins.bottom + 16, {
          width: page.width - doc.page.margins.left - doc.page.margins.right,
          align: 'right'
        });
      }

      // Start table
      let cursorY = doc.y + 6;
      drawHeader(cursorY);
      cursorY += headerHeight;

      // Row drawing
      function addPageAndHeader() {
        drawFooter();
        doc.addPage();
        cursorY = doc.page.margins.top;
        drawHeader(cursorY);
        cursorY += headerHeight;
      }

      const maxY = () => doc.page.height - doc.page.margins.bottom - 30; // keep space for footer

      data.forEach((row, rowIdx) => {
        // Measure row height (max height among cells)
        doc.font('Helvetica').fontSize(cellFontSize);
        const cellHeights = columns.map((c, i) => {
          const text = stringify(row[c]);
          const w = colWidths[i] - rowPaddingX * 2;
          const h = doc.heightOfString(text || '', {
            width: w,
            align: 'left'
          });
          return Math.max(16, h + rowPaddingY * 2);
        });
        const hRow = Math.max(...cellHeights);

        // Page break if needed
        if (cursorY + hRow > maxY()) {
          addPageAndHeader();
        }

        // Zebra background
        if (rowIdx % 2 === 0) {
          doc.save()
            .rect(tableLeft, cursorY, pageWidth, hRow)
            .fillColor(theme.zebraBg)
            .fill()
            .restore();
        }

        // Row bottom border
        doc.save()
          .lineWidth(rowBorder)
          .strokeColor(theme.border)
          .moveTo(tableLeft, cursorY + hRow)
          .lineTo(tableLeft + pageWidth, cursorY + hRow)
          .stroke()
          .restore();

        // Cells text
        let x = tableLeft;
        columns.forEach((c, i) => {
          const text = stringify(row[c]);
          doc.fillColor('#111827').font('Helvetica').fontSize(cellFontSize).text(text, x + rowPaddingX, cursorY + rowPaddingY, {
            width: colWidths[i] - rowPaddingX * 2,
            align: 'left'
          });
          // Optional vertical separators (comment out if you prefer no grid)
          doc.save()
            .lineWidth(rowBorder)
            .strokeColor('#eceff1')
            .moveTo(x + colWidths[i], cursorY)
            .lineTo(x + colWidths[i], cursorY + hRow)
            .stroke()
            .restore();

          x += colWidths[i];
        });

        cursorY += hRow;
      });

      // Final footer on the last page
      drawFooter();

      doc.end();
    } else {
      // CSV
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}.csv`);
      res.csv(data, true);
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
