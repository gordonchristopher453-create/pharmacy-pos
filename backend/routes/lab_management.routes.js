const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { successResponse, errorResponse } = require('../utils/response');
const { protect, requirePharmacy } = require('../middleware/auth.middleware');

// ─── Shared PDF builder ───────────────────────────────────────────────────────
async function buildLabPDF(res, labRow, pharmacy) {
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition',
    `attachment; filename=Lab_Result_${(labRow.patient_name||'Patient').replace(/\s+/g,'_')}_${labRow.id}.pdf`);
  doc.pipe(res);

  const GREEN   = '#1a7a4a';
  const NAVY    = '#1a3a6a';
  const GREY    = '#666666';
  const BLACK   = '#111111';
  const RED     = '#cc0000';
  const BLUE    = '#1a4a8a';
  const LIGHT   = '#f4f7f4';
  const pageW   = doc.page.width  - 100; // usable width (margins 50 each side)

  // ── Header ────────────────────────────────────────────────────────────────
  const ph = pharmacy || {};
  const facilityName = ph.name || 'Medicare Healthcare';
  const facilityAddr = [ph.address, ph.city, ph.country].filter(Boolean).join(', ') || 'Kenya';
  const facilityPhone = ph.phone ? `Tel: ${ph.phone}` : '';
  const facilityEmail = ph.email ? `Email: ${ph.email}` : '';

  // Green top bar
  doc.rect(50, 40, pageW, 5).fill(GREEN);

  // Facility name
  doc.moveDown(0.2);
  doc.fontSize(20).font('Helvetica-Bold').fillColor(NAVY)
    .text(facilityName.toUpperCase(), 50, 55, { width: pageW, align: 'center' });
  doc.fontSize(9).font('Helvetica').fillColor(GREY)
    .text([facilityAddr, facilityPhone, facilityEmail].filter(Boolean).join('  |  '), 50, 80, { width: pageW, align: 'center' });

  // Report title band
  doc.rect(50, 100, pageW, 22).fill(GREEN);
  doc.fontSize(13).font('Helvetica-Bold').fillColor('#ffffff')
    .text('LABORATORY RESULT REPORT', 50, 105, { width: pageW, align: 'center' });

  // ── Patient info grid ─────────────────────────────────────────────────────
  const r = labRow;
  const getAge = dob => !dob ? '—' : Math.floor((Date.now() - new Date(dob)) / (365.25 * 24 * 60 * 60 * 1000)) + ' yrs';

  const infoTop = 132;
  doc.rect(50, infoTop, pageW, 90).fill(LIGHT).stroke('#dddddd');

  const col1x = 55, col2x = 310, rowH = 16;
  const infoRows = [
    [['Patient Name:', r.patient_name || '—'],           ['Patient No:',  r.patient_number || '—']],
    [['Gender:',      (r.gender||'—').toUpperCase()],    ['Age / DOB:',   getAge(r.date_of_birth)]],
    [['Doctor:',      r.doctor_name || '—'],             ['Visit No:',    r.visit_number || '—']],
    [['Diagnosis:',   r.diagnosis || r.icd_code || '—'], ['Blood Group:', r.blood_group || '—']],
    [['Allergies:',   r.allergies  || 'None known'],     ['Phone:',       r.phone || '—']],
  ];

  doc.font('Helvetica').fontSize(9).fillColor(BLACK);
  infoRows.forEach(([left, right], i) => {
    const y = infoTop + 6 + i * rowH;
    doc.font('Helvetica-Bold').fillColor(NAVY).text(left[0], col1x, y, { continued: true })
       .font('Helvetica').fillColor(BLACK).text(' ' + left[1]);
    doc.font('Helvetica-Bold').fillColor(NAVY).text(right[0], col2x, y, { continued: true })
       .font('Helvetica').fillColor(BLACK).text(' ' + right[1]);
  });

  // ── Test header ───────────────────────────────────────────────────────────
  const testTop = infoTop + 98;
  doc.rect(50, testTop, pageW, 20).fill(NAVY);
  const testLabel = `${r.test_name || 'Test'}${r.test_code ? ' (' + r.test_code + ')' : ''}`;
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#ffffff')
     .text(testLabel, 55, testTop + 5, { width: pageW - 10 });

  const urgency = (r.urgency || 'routine').toUpperCase();
  const urgColor = urgency === 'EMERGENCY' || urgency === 'STAT' ? RED : urgency === 'URGENT' ? '#cc6600' : GREEN;
  doc.fontSize(9).font('Helvetica-Bold').fillColor(urgColor)
     .text(urgency, 50, testTop + 7, { width: pageW, align: 'right' });

  doc.fillColor(BLACK);

  // ── Results section ───────────────────────────────────────────────────────
  let y = testTop + 30;

  // single result_value (non-table)
  if (r.result_value && !r.result?.includes(':')) {
    doc.fontSize(16).font('Helvetica-Bold')
       .fillColor(r.result_flag === 'high' || r.result_flag === 'critical' ? RED : r.result_flag === 'low' ? BLUE : GREEN)
       .text(`${r.result_value} ${r.result_unit || ''}`, 50, y, { align: 'center', width: pageW });
    y += 26;
    if (r.reference_range) {
      doc.fontSize(9).font('Helvetica').fillColor(GREY).text(`Reference Range: ${r.reference_range}`, 50, y, { align: 'center', width: pageW });
      y += 16;
    }
  }

  // Parse result text into structured table rows
  if (r.result) {
    const lines = r.result.split('\n').map(l => l.trim()).filter(Boolean);
    let currentSection = null;

    const colW = [pageW * 0.38, pageW * 0.14, pageW * 0.14, pageW * 0.20, pageW * 0.14];
    const cols = [50, 50 + colW[0], 50 + colW[0] + colW[1], 50 + colW[0] + colW[1] + colW[2], 50 + colW[0] + colW[1] + colW[2] + colW[3]];

    const drawTableHeader = (yy) => {
      doc.rect(50, yy, pageW, 16).fill('#e8f0e8');
      ['Parameter', 'Value', 'Unit / Ref', 'Reference Range', 'Flag'].forEach((h, i) => {
        doc.fontSize(8).font('Helvetica-Bold').fillColor(NAVY).text(h, cols[i] + 2, yy + 4, { width: colW[i] - 4 });
      });
      return yy + 16;
    };

    const drawDataRow = (yy, param, value, unit, refRange, flag, shade) => {
      const rowHeight = 15;
      if (shade) doc.rect(50, yy, pageW, rowHeight).fill('#f9fdf9');
      // border
      doc.rect(50, yy, pageW, rowHeight).stroke('#dddddd');

      const flagColor = flag === 'HIGH' || flag === 'CRITICAL' ? RED : flag === 'LOW' ? BLUE : GREEN;
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor(BLACK).text(param, cols[0] + 3, yy + 3, { width: colW[0] - 6, lineBreak: false });
      doc.font(flag && flag !== 'NORMAL' ? 'Helvetica-Bold' : 'Helvetica')
         .fillColor(flag && flag !== 'NORMAL' ? flagColor : BLACK)
         .text(value || '—', cols[1] + 3, yy + 3, { width: colW[1] - 6, lineBreak: false });
      doc.font('Helvetica').fillColor(GREY).text(unit || '', cols[2] + 3, yy + 3, { width: colW[2] - 6, lineBreak: false });
      doc.fillColor(GREY).text(refRange || '', cols[3] + 3, yy + 3, { width: colW[3] - 6, lineBreak: false });
      doc.font('Helvetica-Bold').fillColor(flagColor).text(flag || '', cols[4] + 3, yy + 3, { width: colW[4] - 6, lineBreak: false });
      doc.fillColor(BLACK);
      return yy + rowHeight;
    };

    // Detect if this is a structured table result
    const isTableResult = lines.some(l => /:\s+[\d.—–-]+\s+[\w\/%³µ⁶⁰-]+\s+\(Ref:/i.test(l) || /\[(?:NORMAL|HIGH|LOW|CRITICAL)\]/i.test(l));

    if (isTableResult) {
      let tableStarted = false;
      let shade = false;

      for (const line of lines) {
        // page overflow guard
        if (y > doc.page.height - 100) {
          doc.addPage();
          y = 50;
          if (tableStarted) y = drawTableHeader(y);
        }

        // Section header line (e.g. "WBC Differential (5-Part):")
        if (!line.includes('[') && line.endsWith(':') && !/^\s+/.test(line)) {
          if (!tableStarted) {
            y = drawTableHeader(y);
            tableStarted = true;
          }
          currentSection = line.replace(/:$/, '');
          // Section title row
          doc.rect(50, y, pageW, 15).fill('#d0e8d8');
          doc.fontSize(8.5).font('Helvetica-Bold').fillColor(NAVY).text(currentSection, 53, y + 3);
          doc.rect(50, y, pageW, 15).stroke('#bbccbb');
          y += 15;
          shade = false;
          continue;
        }

        // Data line: "  Param: value unit (Ref: min - max) [FLAG]"
        const m = line.match(/^(.+?):\s+([\d.—–-]+|—)\s+([\w\/%³µ⁶⁰·-]+)\s+\(Ref:\s*([^)]+)\)\s+\[(\w+)\]$/);
        if (m) {
          if (!tableStarted) {
            y = drawTableHeader(y);
            tableStarted = true;
          }
          const [, param, value, unit, refRange, flag] = m;
          y = drawDataRow(y, param.trim(), value, unit, refRange, flag, shade);
          shade = !shade;
          continue;
        }

        // Urinalysis / freetext sections: "  Param: value"
        const m2 = line.match(/^(.+?):\s+(.+)$/);
        if (m2 && tableStarted) {
          y = drawDataRow(y, m2[1].trim(), m2[2].trim(), '', '', '', shade);
          shade = !shade;
          continue;
        }

        // Fallback plain text
        if (tableStarted) {
          // end of table, render as text
          y += 4;
          doc.fontSize(9).font('Helvetica').fillColor(GREY).text(line, 50, y, { width: pageW });
          y += 13;
        } else {
          // Title lines (e.g. "CBC (5-Part Haemogram) Results:")
          if (/Results?:/i.test(line) || line.endsWith(':')) {
            doc.fontSize(10).font('Helvetica-Bold').fillColor(NAVY).text(line.replace(/:$/, ''), 50, y, { width: pageW });
            y += 16;
          } else {
            doc.fontSize(9).font('Helvetica').fillColor(BLACK).text(line, 50, y, { width: pageW });
            y += 13;
          }
        }
      }
    } else {
      // Simple / Urinalysis / Titration / Pos-Neg — render as clean key-value list
      for (const line of lines) {
        if (y > doc.page.height - 100) { doc.addPage(); y = 50; }
        if (line.endsWith(':') || /Results?:/i.test(line)) {
          doc.fontSize(10).font('Helvetica-Bold').fillColor(NAVY).text(line.replace(/:$/, ''), 50, y, { width: pageW });
          y += 16;
        } else {
          const kv = line.match(/^(.+?):\s+(.+)$/);
          if (kv) {
            doc.fontSize(9).font('Helvetica-Bold').fillColor(NAVY)
               .text(kv[1] + ': ', 55, y, { continued: true, width: 180 })
               .font('Helvetica').fillColor(BLACK).text(kv[2]);
          } else {
            doc.fontSize(9).font('Helvetica').fillColor(BLACK).text(line, 55, y, { width: pageW - 5 });
          }
          y += 13;
        }
      }
    }

    y += 6;
  }

  // ── Overall flag ──────────────────────────────────────────────────────────
  if (r.result_flag && r.result_flag !== 'normal') {
    if (y > doc.page.height - 80) { doc.addPage(); y = 50; }
    const flagColor = r.result_flag === 'high' || r.result_flag === 'critical' ? RED : r.result_flag === 'low' ? BLUE : GREEN;
    const flagBg    = r.result_flag === 'high' || r.result_flag === 'critical' ? '#fff0f0' : r.result_flag === 'low' ? '#f0f4ff' : '#f0fff4';
    doc.rect(50, y, pageW, 20).fill(flagBg).stroke(flagColor);
    doc.fontSize(10).font('Helvetica-Bold').fillColor(flagColor)
       .text(`⚠  Overall Flag: ${r.result_flag.toUpperCase()}`, 55, y + 5);
    y += 28;
  }

  // ── Technician notes ──────────────────────────────────────────────────────
  if (r.technician_notes) {
    if (y > doc.page.height - 80) { doc.addPage(); y = 50; }
    doc.rect(50, y, pageW, 14).fill('#fffbe6');
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#996600').text('TECHNICIAN NOTES', 55, y + 3);
    y += 16;
    doc.fontSize(9).font('Helvetica-Oblique').fillColor(BLACK).text(r.technician_notes, 55, y, { width: pageW - 10 });
    y += doc.heightOfString(r.technician_notes, { width: pageW - 10 }) + 10;
  }

  // ── Footer / signature ────────────────────────────────────────────────────
  // Push to bottom if still room, else new page
  const footerH = 80;
  if (y < doc.page.height - footerH - 50) {
    y = doc.page.height - footerH - 20;
  } else {
    doc.addPage();
    y = doc.page.height - footerH - 20;
  }

  doc.rect(50, y, pageW, 1).fill('#cccccc');
  y += 8;

  doc.fontSize(8).font('Helvetica').fillColor(GREY)
     .text(`Resulted: ${r.resulted_at ? new Date(r.resulted_at).toLocaleString('en-KE') : 'Pending'}`, 50, y)
     .text(`Resulted by: ${r.technician_name || r.doctor_name || '—'}`, 50, y + 11)
     .text(`Report ID: LAB-${r.id}  |  Generated: ${new Date().toLocaleString('en-KE')}`, 50, y + 22);

  // Signature blocks
  const sigY = y;
  const sigLabels = ['Lab Technician', 'Pathologist / Doctor'];
  sigLabels.forEach((label, i) => {
    const sx = i === 0 ? 55 : 310;
    doc.fontSize(8).font('Helvetica').fillColor(GREY).text(label + ':', sx, sigY + 38);
    doc.rect(sx, sigY + 50, 180, 1).fill('#999999');
    doc.text('(Signature & Date)', sx, sigY + 53, { fontSize: 7 });
  });

  // Bottom green bar
  doc.rect(50, doc.page.height - 25, pageW, 5).fill(GREEN);

  doc.end();
}

// Public PDF download (with token in query) ─────────────────────────────────
router.get('/public/:id/pdf', async (req, res) => {
  try {
    const token = req.query.token;
    if (!token) return res.status(401).json({ error: 'No token' });
    const jwt = require('jsonwebtoken');
    let decoded;
    try { decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret'); }
    catch (e) { return res.status(401).json({ error: 'Invalid token' }); }

    const result = await pool.query(`
      SELECT lr.*,
        p.full_name as patient_name, p.patient_number, p.gender, p.date_of_birth,
        p.phone, p.allergies, p.blood_group,
        u.full_name as doctor_name,
        t.full_name as technician_name,
        v.visit_number,
        c.diagnosis, c.icd_code,
        ph.name as pharmacy_name, ph.phone as ph_phone, ph.address, ph.city,
        ph.country, ph.email as ph_email, ph.logo_url
      FROM lab_requests lr
      JOIN patients p ON lr.patient_id = p.id
      LEFT JOIN users u ON lr.doctor_id = u.id
      LEFT JOIN users t ON lr.resulted_by = t.id
      LEFT JOIN visits v ON lr.visit_id = v.id
      LEFT JOIN consultations c ON lr.consultation_id = c.id
      LEFT JOIN pharmacies ph ON lr.pharmacy_id = ph.id
      WHERE lr.id = $1 AND lr.pharmacy_id = $2
    `, [req.params.id, decoded.pharmacy_id]);

    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    const r = result.rows[0];
    const pharmacy = { name: r.pharmacy_name, phone: r.ph_phone, address: r.address, city: r.city, country: r.country, email: r.ph_email, logo_url: r.logo_url };
    await buildLabPDF(res, r, pharmacy);
  } catch (e) { console.error('PDF error:', e); res.status(500).json({ error: e.message }); }
});

router.use(protect, requirePharmacy);

// ── MOH LAB REPORTS (must be before /:id) ────────────────────────────────────

const ensureReportsTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lab_reports (
        id SERIAL PRIMARY KEY,
        pharmacy_id TEXT,
        patient_name VARCHAR(255) NOT NULL,
        patient_number VARCHAR(100),
        age VARCHAR(20),
        gender VARCHAR(20),
        test_name VARCHAR(255) NOT NULL,
        test_category VARCHAR(100),
        result TEXT NOT NULL,
        result_value VARCHAR(100),
        result_unit VARCHAR(50),
        reference_range VARCHAR(100),
        result_flag VARCHAR(20) DEFAULT 'normal',
        report_date DATE NOT NULL DEFAULT CURRENT_DATE,
        reported_by VARCHAR(255),
        notes TEXT,
        created_by TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } catch (err) {
    console.error('ensureReportsTable error:', err.message);
  }
};

router.get('/reports/all', async (req, res) => {
  try {
    await ensureReportsTable();
    const { search, start_date, end_date, flag } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const from = start_date || '2020-01-01';
    const to = end_date || today;

    const baseQuery = `
      SELECT 
        lr.id::text as id,
        COALESCE(lr.pharmacy_id::text, $1::text) as pharmacy_id,
        p.full_name as patient_name,
        p.patient_number,
        COALESCE(
          NULLIF(TRIM(EXTRACT(YEAR FROM AGE(p.date_of_birth))::text), ''),
          '—'
        ) as age,
        COALESCE(p.gender, '—') as gender,
        lr.test_name,
        COALESCE(lr.test_category, 'General') as test_category,
        COALESCE(lr.result, lr.result_value, 'Completed') as result,
        lr.result_value,
        lr.result_unit,
        lr.reference_range,
        COALESCE(lr.result_flag, 'normal') as result_flag,
        DATE(COALESCE(lr.resulted_at, lr.created_at)) as report_date,
        COALESCE(u.full_name, 'Lab Technician') as reported_by,
        COALESCE(lr.technician_notes, lr.notes) as notes,
        lr.resulted_by::text as created_by,
        COALESCE(lr.resulted_at, lr.created_at) as created_at,
        lr.updated_at
      FROM lab_requests lr
      JOIN patients p ON lr.patient_id::text = p.id::text
      LEFT JOIN users u ON lr.resulted_by::text = u.id::text
      WHERE (lr.pharmacy_id::text = $1::text OR lr.pharmacy_id IS NULL)
        AND LOWER(COALESCE(lr.status, '')) = 'completed'
        AND DATE(COALESCE(lr.resulted_at, lr.created_at)) BETWEEN $2 AND $3

      UNION ALL

      SELECT 
        lrep.id::text as id,
        lrep.pharmacy_id::text as pharmacy_id,
        lrep.patient_name,
        lrep.patient_number,
        lrep.age,
        lrep.gender,
        lrep.test_name,
        lrep.test_category,
        lrep.result,
        lrep.result_value,
        lrep.result_unit,
        lrep.reference_range,
        lrep.result_flag,
        lrep.report_date,
        lrep.reported_by,
        lrep.notes,
        lrep.created_by::text as created_by,
        lrep.created_at,
        lrep.updated_at
      FROM lab_reports lrep
      WHERE (lrep.pharmacy_id::text = $1::text OR lrep.pharmacy_id IS NULL)
        AND lrep.report_date BETWEEN $2 AND $3
    `;

    const params = [req.pharmacy_id, from, to];
    let idx = 4;
    let whereClauses = [];

    if (search) {
      whereClauses.push(`(patient_name ILIKE $${idx} OR patient_number ILIKE $${idx} OR test_name ILIKE $${idx} OR reported_by ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    if (flag) {
      whereClauses.push(`LOWER(result_flag) = LOWER($${idx++})`);
      params.push(flag);
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const finalQuery = `SELECT * FROM (${baseQuery}) q ${whereStr} ORDER BY created_at DESC`;

    const result = await pool.query(finalQuery, params);
    return successResponse(res, 200, 'Reports fetched', result.rows);
  } catch (error) {
    console.error('Reports fetch error:', error.message);
    return errorResponse(res, 500, 'Failed to fetch reports: ' + error.message);
  }
});

router.post('/reports', async (req, res) => {
  try {
    await ensureReportsTable();
    const {
      patient_name, patient_number, age, gender,
      test_name, test_category, result, result_value,
      result_unit, reference_range, result_flag,
      report_date, reported_by, notes
    } = req.body;

    if (!patient_name || !test_name || !result) {
      return errorResponse(res, 400, 'Patient name, test name and result are required');
    }

    const ins = await pool.query(`
      INSERT INTO lab_reports
        (pharmacy_id, patient_name, patient_number, age, gender,
         test_name, test_category, result, result_value, result_unit,
         reference_range, result_flag, report_date, reported_by, notes, created_by)
      VALUES ($1::text,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::text)
      RETURNING *
    `, [
      req.pharmacy_id, patient_name, patient_number||null, age||null, gender||null,
      test_name, test_category||null, result, result_value||null, result_unit||null,
      reference_range||null, result_flag||'normal',
      report_date || new Date().toISOString().split('T')[0],
      reported_by||null, notes||null, req.user.id
    ]);

    return successResponse(res, 201, 'Report saved', ins.rows[0]);
  } catch (error) {
    console.error('Report save error:', error.message);
    return errorResponse(res, 500, 'Failed to save report: ' + error.message);
  }
});

router.delete('/reports/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM lab_reports WHERE id::text=$1::text AND (pharmacy_id::text=$2::text OR pharmacy_id IS NULL)`, [req.params.id, req.pharmacy_id]);
    return successResponse(res, 200, 'Report deleted');
  } catch (error) {
    return errorResponse(res, 500, 'Failed to delete report');
  }
});

// ── LAB REQUESTS ─────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const { status, urgency, start_date, end_date, search, limit = 500, visit_type } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const from = start_date;
    const to = end_date;

    let query = `
      SELECT
        lr.*,
        p.full_name as patient_name, p.patient_number, p.gender, p.date_of_birth, p.phone, p.allergies,
        u.full_name as doctor_name,
        t.full_name as technician_name,
        v.visit_number, v.visit_type, v.priority, v.status as visit_status,
        c.diagnosis, c.icd_code,
        w.name as ward_name, b.bed_number,
        (EXISTS(SELECT 1 FROM inpatient_admissions ia WHERE ia.visit_id::text = v.id::text AND ia.status = 'admitted')
         OR EXISTS(SELECT 1 FROM beds b WHERE b.current_visit_id::text = v.id::text AND b.status = 'occupied')
         OR v.status = 'inpatient' OR LOWER(COALESCE(v.visit_type, '')) = 'inpatient'
         OR LOWER(COALESCE(lr.notes, '')) LIKE '%inpatient%' OR LOWER(COALESCE(lr.notes, '')) LIKE '%ward%') as is_inpatient
      FROM lab_requests lr
      JOIN patients p ON lr.patient_id::text = p.id::text
      LEFT JOIN users u ON lr.doctor_id::text = u.id::text
      LEFT JOIN users t ON lr.resulted_by::text = t.id::text
      LEFT JOIN visits v ON lr.visit_id::text = v.id::text
      LEFT JOIN consultations c ON lr.consultation_id::text = c.id::text
      LEFT JOIN inpatient_admissions ia ON ia.visit_id::text = v.id::text AND ia.status = 'admitted'
      LEFT JOIN beds b ON (b.current_visit_id::text = v.id::text AND b.status = 'occupied') OR (ia.bed_id::text = b.id::text)
      LEFT JOIN wards w ON b.ward_id::text = w.id::text
      WHERE (lr.pharmacy_id::text = $1::text OR lr.pharmacy_id IS NULL)
    `;
    const params = [req.pharmacy_id];

    // Status filter
    if (status === 'active') {
      query += ` AND (LOWER(COALESCE(lr.status, 'pending')) IN ('pending', 'processing'))`;
    } else if (status === 'pending') {
      query += ` AND (LOWER(COALESCE(lr.status, 'pending')) = 'pending')`;
    } else if (status === 'processing') {
      query += ` AND LOWER(lr.status) = 'processing'`;
    } else if (status === 'completed') {
      query += ` AND LOWER(lr.status) = 'completed'`;
    } else if (status === 'cancelled') {
      query += ` AND LOWER(lr.status) = 'cancelled'`;
    } else if (status && status !== 'all') {
      params.push(status);
      query += ` AND LOWER(lr.status) = LOWER($${params.length})`;
    }

    // Date filtering
    if (status === 'completed') {
      if (from && to) {
        params.push(from);
        params.push(to);
        query += ` AND DATE(COALESCE(lr.resulted_at, lr.created_at)) BETWEEN $${params.length - 1} AND $${params.length}`;
      } else if (from) {
        params.push(from);
        query += ` AND DATE(COALESCE(lr.resulted_at, lr.created_at)) >= $${params.length}`;
      } else if (to) {
        params.push(to);
        query += ` AND DATE(COALESCE(lr.resulted_at, lr.created_at)) <= $${params.length}`;
      }
    } else if (status === 'active' || status === 'pending' || status === 'processing') {
      if (from && to) {
        params.push(from);
        params.push(to);
        query += ` AND (DATE(lr.created_at) BETWEEN $${params.length - 1} AND $${params.length} OR LOWER(COALESCE(lr.status, 'pending')) = 'pending')`;
      } else if (from) {
        params.push(from);
        query += ` AND (DATE(lr.created_at) >= $${params.length} OR LOWER(COALESCE(lr.status, 'pending')) = 'pending')`;
      } else if (to) {
        params.push(to);
        query += ` AND (DATE(lr.created_at) <= $${params.length} OR LOWER(COALESCE(lr.status, 'pending')) = 'pending')`;
      }
    } else {
      if (from && to) {
        params.push(from);
        params.push(to);
        query += ` AND DATE(lr.created_at) BETWEEN $${params.length - 1} AND $${params.length}`;
      } else if (from) {
        params.push(from);
        query += ` AND DATE(lr.created_at) >= $${params.length}`;
      } else if (to) {
        params.push(to);
        query += ` AND DATE(lr.created_at) <= $${params.length}`;
      } else if (visit_type !== 'inpatient' && !status) {
        params.push(today);
        query += ` AND (DATE(lr.created_at) = $${params.length} OR lr.status = 'pending')`;
      }
    }

    if (urgency) { params.push(urgency); query += ` AND LOWER(lr.urgency) = LOWER($${params.length})`; }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (p.full_name ILIKE $${params.length} OR p.patient_number ILIKE $${params.length} OR lr.test_name ILIKE $${params.length} OR u.full_name ILIKE $${params.length})`;
    }
    if (visit_type === 'inpatient') {
      query += ` AND (v.status = 'inpatient' OR LOWER(COALESCE(v.visit_type, '')) = 'inpatient' OR EXISTS(SELECT 1 FROM inpatient_admissions ia WHERE ia.visit_id::text = lr.visit_id::text AND ia.status = 'admitted') OR EXISTS(SELECT 1 FROM beds b WHERE b.current_visit_id::text = lr.visit_id::text AND b.status = 'occupied') OR LOWER(COALESCE(lr.notes, '')) LIKE '%inpatient%' OR LOWER(COALESCE(lr.notes, '')) LIKE '%ward%')`;
    } else if (visit_type === 'outpatient' || visit_type === 'opd') {
      query += ` AND ((v.status IS NULL OR (v.status != 'inpatient' AND LOWER(COALESCE(v.visit_type, '')) != 'inpatient')) AND NOT EXISTS(SELECT 1 FROM inpatient_admissions ia WHERE ia.visit_id::text = lr.visit_id::text AND ia.status = 'admitted') AND NOT EXISTS(SELECT 1 FROM beds b WHERE b.current_visit_id::text = lr.visit_id::text AND b.status = 'occupied') AND LOWER(COALESCE(lr.notes, '')) NOT LIKE '%inpatient%' AND LOWER(COALESCE(lr.notes, '')) NOT LIKE '%ward%')`;
    }

    params.push(parseInt(limit));
    query += ` ORDER BY lr.created_at DESC, lr.id DESC LIMIT $${params.length}`;

    const result = await pool.query(query, params);

    const statsParams = [req.pharmacy_id];
    let statsWhere = `WHERE (pharmacy_id::text = $1::text OR pharmacy_id IS NULL)`;
    if (start_date) {
      statsParams.push(start_date);
      statsWhere += ` AND DATE(created_at) >= $${statsParams.length}`;
    }
    if (end_date) {
      statsParams.push(end_date);
      statsWhere += ` AND DATE(created_at) <= $${statsParams.length}`;
    }
    if (visit_type === 'inpatient') {
      statsWhere += ` AND (EXISTS(SELECT 1 FROM visits v WHERE v.id::text = lab_requests.visit_id::text AND (v.status = 'inpatient' OR LOWER(COALESCE(v.visit_type, '')) = 'inpatient')) OR EXISTS(SELECT 1 FROM inpatient_admissions ia WHERE ia.visit_id::text = lab_requests.visit_id::text AND ia.status = 'admitted') OR LOWER(COALESCE(lab_requests.notes, '')) LIKE '%inpatient%' OR LOWER(COALESCE(lab_requests.notes, '')) LIKE '%ward%')`;
    } else if (visit_type === 'outpatient' || visit_type === 'opd') {
      statsWhere += ` AND (NOT EXISTS(SELECT 1 FROM visits v WHERE v.id::text = lab_requests.visit_id::text AND (v.status = 'inpatient' OR LOWER(COALESCE(v.visit_type, '')) = 'inpatient')) AND NOT EXISTS(SELECT 1 FROM inpatient_admissions ia WHERE ia.visit_id::text = lab_requests.visit_id::text AND ia.status = 'admitted') AND LOWER(COALESCE(lab_requests.notes, '')) NOT LIKE '%inpatient%' AND LOWER(COALESCE(lab_requests.notes, '')) NOT LIKE '%ward%')`;
    }

    const statsRes = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE LOWER(status)='pending') as pending,
        COUNT(*) FILTER (WHERE LOWER(status)='processing') as processing,
        COUNT(*) FILTER (WHERE LOWER(status)='completed') as completed,
        COUNT(*) FILTER (WHERE LOWER(urgency)='emergency') as emergency,
        COUNT(*) FILTER (WHERE LOWER(urgency)='urgent') as urgent
      FROM lab_requests
      ${statsWhere}
    `, statsParams);

    return successResponse(res, 200, 'Lab requests fetched', {
      requests: result.rows,
      stats: statsRes.rows[0]
    });
  } catch (error) {
    console.error('Lab fetch error:', error.message);
    return errorResponse(res, 500, 'Failed to fetch lab requests');
  }
});

router.get('/visit/:visit_id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT lr.*, u.full_name as doctor_name
      FROM lab_requests lr
      LEFT JOIN users u ON lr.doctor_id::text = u.id::text
      WHERE lr.visit_id::text=$1::text AND (lr.pharmacy_id::text=$2::text OR lr.pharmacy_id IS NULL)
      ORDER BY lr.created_at DESC
    `, [req.params.visit_id, req.pharmacy_id]);
    return successResponse(res, 200, 'Visit lab requests fetched', result.rows);
  } catch (error) {
    return errorResponse(res, 500, 'Failed to fetch visit lab requests');
  }
});

// MOH 706 - Auto-generate monthly/weekly lab summary with LOINC normalization
router.get('/moh706', async (req, res) => {
  try {
    await ensureReportsTable();
    const { month, year, week_start, week_end } = req.query;
    let start, end;
    if (week_start && week_end) {
      start = week_start;
      end = week_end;
    } else {
      const m = parseInt(month) || new Date().getMonth() + 1;
      const y = parseInt(year) || new Date().getFullYear();
      start = `${y}-${String(m).padStart(2,'0')}-01`;
      end = new Date(y, m, 0).toISOString().split('T')[0];
    }

    const query = `
      SELECT 
        lr.id::text,
        lr.test_name,
        lr.test_code,
        lr.status,
        lr.result,
        lr.result_value,
        lr.result_flag,
        lr.resulted_at,
        lr.created_at,
        p.date_of_birth,
        p.gender,
        EXTRACT(YEAR FROM AGE(COALESCE(lr.created_at, NOW()), p.date_of_birth)) as calculated_age
      FROM lab_requests lr
      LEFT JOIN patients p ON lr.patient_id::text = p.id::text
      WHERE (lr.pharmacy_id::text = $1::text OR lr.pharmacy_id IS NULL)
        AND DATE(COALESCE(lr.resulted_at, lr.created_at)) BETWEEN $2 AND $3

      UNION ALL

      SELECT
        lrep.id::text,
        lrep.test_name,
        NULL as test_code,
        'completed' as status,
        lrep.result,
        lrep.result_value,
        lrep.result_flag,
        lrep.report_date::timestamp as resulted_at,
        lrep.created_at,
        NULL as date_of_birth,
        lrep.gender,
        CAST(NULLIF(regexp_replace(lrep.age, '[^0-9]', '', 'g'), '') AS NUMERIC) as calculated_age
      FROM lab_reports lrep
      WHERE (lrep.pharmacy_id::text = $1::text OR lrep.pharmacy_id IS NULL)
        AND lrep.report_date BETWEEN $2 AND $3
    `;

    const result = await pool.query(query, [req.pharmacy_id, start, end]);
    const rows = result.rows;
    const total = rows.length;

    const isCompleted = (r) => {
      const s = (r.status || '').toLowerCase();
      return s === 'completed' || !!r.result_value || !!r.result || !!r.resulted_at;
    };

    const isPositiveFlag = (r) => {
      const flag = (r.result_flag || '').toLowerCase();
      const val = String(r.result_value || r.result || '').toLowerCase();
      return ['high', 'low', 'critical', 'positive', 'reactive', 'abnormal', 'detected', 'pos', 'abn', 'reactive'].includes(flag)
        || val.includes('positive') || val.includes('reactive') || val.includes('detected')
        || val.includes('1:80') || val.includes('1:160') || val.includes('1:320')
        || val.includes('+1') || val.includes('+2') || val.includes('+3') || val.includes('+4')
        || flag.includes('high') || flag.includes('abn');
    };

    const isLowFlag = (r) => {
      const flag = (r.result_flag || '').toLowerCase();
      const val = String(r.result_value || r.result || '').toLowerCase();
      return flag === 'low' || flag.includes('low') || val.includes('low');
    };

    const isHighFlag = (r) => {
      const flag = (r.result_flag || '').toLowerCase();
      const val = String(r.result_value || r.result || '').toLowerCase();
      return flag === 'high' || flag === 'critical' || flag.includes('high') || val.includes('high');
    };

    const completed = rows.filter(r => isCompleted(r)).length;
    const pending = rows.filter(r => (r.status || '').toLowerCase() === 'pending' && !isCompleted(r)).length;
    const processing = rows.filter(r => (r.status || '').toLowerCase() === 'processing' && !isCompleted(r)).length;

    // LOINC / Clinical Department Category Mapping
    const categorize = (testName, testCode) => {
      const n = `${testName || ''} ${testCode || ''}`.toLowerCase();
      if (/haemogram|hemogram|cbc|blood count|haematology|fbc|wbc|rbc|platelet|hgb|hct|esr|diff|blood film|peripheral|58410-2|57021-8|718-7|6690-2|883-9|882-1|30341-2|3173-2|8123-2/.test(n)) return 'haematology';
      if (/malaria|parasite|widal|brucella|stool|ova|cyst|giardia|amoeba|helminth|bs for mps|mps|rdt|taenia|hookworm|ascaris|mansoni|bilharzia|89574-8|58900-2|32729-6|74850-9|50549-5|10701-1|42254-3|22295-0/.test(n)) return 'parasitology';
      if (/urine|urinalysis|protein in urine|glucose in urine|ketones|urobilinogen|leukocyte|24356-8|50556-0|5804-0/.test(n)) return 'urinalysis';
      if (/culture|sensitivity|swab|sputum|csf|bacteria|gram|afb|tb |tuberculosis|gene xpert|genexpert|11475-1|89371-9/.test(n)) return 'bacteriology';
      if (/glucose|sugar|rbs|fbs|creatinine|urea|uecs|electrolyte|sodium|potassium|chloride|bicarbonate|cholesterol|lipid|triglyceride|hdl|ldl|lft|liver|bilirubin|alt|ast|alp|albumin|protein|hba1c|ferritin|crp|procalcitonin|d-dimer|troponin|psa|prolactin|fsh|lh|cortisol|insulin|tsh|thyroid|t3|t4|uric acid|2345-7|2339-0|1558-6|24362-6|2160-0|3094-0|24325-3|24331-1|24348-5|3016-3|4548-4/.test(n)) return 'chemistry';
      if (/hiv|hepatitis|hbsag|hcv|vdrl|syphilis|rpr|tpha|rheumatoid|rf|aso|antistreptolysin|dengue|covid|influenza|strep|h\.pylori|h pylori|helicobacter|toxoplasma|pregnancy|upt|bhcg|beta-hcg|blood group|abo|crossmatch|coombs|29893-5|68961-2|20507-0|5292-8|5196-1|13955-0|2106-3|19080-1|29532-9|49540-8|11572-5/.test(n)) return 'serology';
      if (/pap|smear|tissue|biopsy|histology|cytology|fnac/.test(n)) return 'histology';
      return 'other';
    };

    const cats = { haematology:[], parasitology:[], urinalysis:[], bacteriology:[], chemistry:[], serology:[], histology:[], other:[] };
    rows.forEach(r => { const cat = categorize(r.test_name, r.test_code); cats[cat].push(r); });

    const summary = {};
    for (const [cat, items] of Object.entries(cats)) {
      summary[cat] = {
        total: items.length,
        completed: items.filter(i => isCompleted(i)).length,
        positive: items.filter(i => isPositiveFlag(i)).length,
        pending: items.filter(i => (i.status || '').toLowerCase() === 'pending' && !isCompleted(i)).length,
        processing: items.filter(i => (i.status || '').toLowerCase() === 'processing' && !isCompleted(i)).length
      };
    }

    // Granular MOH 706 Line-Item Classifier
    const lineItemCounters = {
      // 1. Urine Analysis
      u_chem_total: { total: 0, completed: 0, positive: 0, negative: 0 },
      u_glucose: { total: 0, completed: 0, positive: 0, negative: 0 },
      u_ketones: { total: 0, completed: 0, positive: 0, negative: 0 },
      u_proteins: { total: 0, completed: 0, positive: 0, negative: 0 },
      u_micro_total: { total: 0, completed: 0, positive: 0, negative: 0 },
      u_pus_cells: { total: 0, completed: 0, positive: 0, negative: 0 },
      u_haematobium: { total: 0, completed: 0, positive: 0, negative: 0 },
      u_tvaginalis: { total: 0, completed: 0, positive: 0, negative: 0 },
      u_yeast: { total: 0, completed: 0, positive: 0, negative: 0 },
      u_bacteria: { total: 0, completed: 0, positive: 0, negative: 0 },

      // 2. Blood Chemistry
      blood_sugar: { total: 0, completed: 0, low: 0, high: 0, positive: 0, negative: 0 },
      ogtt: { total: 0, completed: 0, low: 0, high: 0, positive: 0, negative: 0 },
      uecs_total: { total: 0, completed: 0, positive: 0, negative: 0 },
      creatinine: { total: 0, completed: 0, positive: 0, negative: 0 },
      urea: { total: 0, completed: 0, positive: 0, negative: 0 },
      sodium: { total: 0, completed: 0, positive: 0, negative: 0 },
      potassium: { total: 0, completed: 0, positive: 0, negative: 0 },
      chlorides: { total: 0, completed: 0, positive: 0, negative: 0 },
      lft_total: { total: 0, completed: 0, positive: 0, negative: 0 },
      direct_bilirubin: { total: 0, completed: 0, positive: 0, negative: 0 },
      total_bilirubin: { total: 0, completed: 0, positive: 0, negative: 0 },
      ast_sgot: { total: 0, completed: 0, positive: 0, negative: 0 },
      alt_sgpt: { total: 0, completed: 0, positive: 0, negative: 0 },
      serum_protein: { total: 0, completed: 0, positive: 0, negative: 0 },
      albumin: { total: 0, completed: 0, positive: 0, negative: 0 },
      alp: { total: 0, completed: 0, positive: 0, negative: 0 },
      lipid_total: { total: 0, completed: 0, positive: 0, negative: 0 },
      cholesterol: { total: 0, completed: 0, positive: 0, negative: 0 },
      triglycerides: { total: 0, completed: 0, positive: 0, negative: 0 },
      ldl: { total: 0, completed: 0, positive: 0, negative: 0 },
      t3: { total: 0, completed: 0, low: 0, high: 0, positive: 0, negative: 0 },
      t4: { total: 0, completed: 0, low: 0, high: 0, positive: 0, negative: 0 },
      tsh: { total: 0, completed: 0, low: 0, high: 0, positive: 0, negative: 0 },
      psa: { total: 0, completed: 0, positive: 0, negative: 0 },
      ca15_3: { total: 0, completed: 0, positive: 0, negative: 0 },
      ca19_9: { total: 0, completed: 0, positive: 0, negative: 0 },
      ca125: { total: 0, completed: 0, positive: 0, negative: 0 },
      cea: { total: 0, completed: 0, positive: 0, negative: 0 },
      afp: { total: 0, completed: 0, positive: 0, negative: 0 },
      csf_proteins: { total: 0, completed: 0, low: 0, high: 0, positive: 0, negative: 0 },
      csf_glucose: { total: 0, completed: 0, low: 0, high: 0, positive: 0, negative: 0 },

      // 3. Parasitology & Malaria
      malaria_bs_u5: { total: 0, completed: 0, positive: 0, negative: 0 },
      malaria_bs_o5: { total: 0, completed: 0, positive: 0, negative: 0 },
      malaria_rdt_u5: { total: 0, completed: 0, positive: 0, negative: 0 },
      malaria_rdt_o5: { total: 0, completed: 0, positive: 0, negative: 0 },
      taenia: { total: 0, completed: 0, positive: 0, negative: 0 },
      h_nana: { total: 0, completed: 0, positive: 0, negative: 0 },
      hookworm: { total: 0, completed: 0, positive: 0, negative: 0 },
      roundworms: { total: 0, completed: 0, positive: 0, negative: 0 },
      s_mansoni: { total: 0, completed: 0, positive: 0, negative: 0 },
      trichuris: { total: 0, completed: 0, positive: 0, negative: 0 },
      amoeba: { total: 0, completed: 0, positive: 0, negative: 0 },
      stool_total: { total: 0, completed: 0, positive: 0, negative: 0 },

      // 4. Haematology
      cbc_fbc: { total: 0, completed: 0, low: 0, high: 0, positive: 0, negative: 0 },
      hb_est: { total: 0, completed: 0, low: 0, high: 0, positive: 0, negative: 0 },
      hba1c: { total: 0, completed: 0, low: 0, high: 0, positive: 0, negative: 0 },
      cd4: { total: 0, completed: 0, positive: 0, negative: 0 },
      sickling: { total: 0, completed: 0, positive: 0, negative: 0 },
      pbf: { total: 0, completed: 0, positive: 0, negative: 0 },
      bma: { total: 0, completed: 0, positive: 0, negative: 0 },
      coag: { total: 0, completed: 0, positive: 0, negative: 0 },
      retic: { total: 0, completed: 0, positive: 0, negative: 0 },
      esr: { total: 0, completed: 0, positive: 0, negative: 0 },
      blood_group: { total: 0, completed: 0, positive: 0, negative: 0 },
      blood_units_grouped: { total: 0, completed: 0, positive: 0, negative: 0 },
      hiv_screening: { total: 0, completed: 0, positive: 0, negative: 0 },
      hep_b_screening: { total: 0, completed: 0, positive: 0, negative: 0 },
      hep_c_screening: { total: 0, completed: 0, positive: 0, negative: 0 },
      syphilis_screening: { total: 0, completed: 0, positive: 0, negative: 0 },

      // 5. Bacteriology & TB
      bac_urine: { total: 0, completed: 0, positive: 0, negative: 0 },
      bac_pus: { total: 0, completed: 0, positive: 0, negative: 0 },
      bac_hvs: { total: 0, completed: 0, positive: 0, negative: 0 },
      bac_throat: { total: 0, completed: 0, positive: 0, negative: 0 },
      bac_rectal: { total: 0, completed: 0, positive: 0, negative: 0 },
      bac_blood: { total: 0, completed: 0, positive: 0, negative: 0 },
      bac_water: { total: 0, completed: 0, positive: 0, negative: 0 },
      bac_food: { total: 0, completed: 0, positive: 0, negative: 0 },
      bac_urethral: { total: 0, completed: 0, positive: 0, negative: 0 },
      bac_stool: { total: 0, completed: 0, positive: 0, negative: 0 },
      tb_smear: { total: 0, completed: 0, positive: 0, negative: 0 },
      tb_presumptive: { total: 0, completed: 0, positive: 0, negative: 0 },
      tb_followup: { total: 0, completed: 0, positive: 0, negative: 0 },
      tb_rifampicin: { total: 0, completed: 0, positive: 0, negative: 0 },
      tb_mdr: { total: 0, completed: 0, positive: 0, negative: 0 },

      // 6. Histology & Cytology
      pap_smear: { total: 0, completed: 0, positive: 0, negative: 0 },
      touch_prep: { total: 0, completed: 0, positive: 0, negative: 0 },
      fna_thyroid: { total: 0, completed: 0, positive: 0, negative: 0 },
      fna_lymph: { total: 0, completed: 0, positive: 0, negative: 0 },
      fna_breast: { total: 0, completed: 0, positive: 0, negative: 0 },
      fna_prostate: { total: 0, completed: 0, positive: 0, negative: 0 },
      hist_uterus: { total: 0, completed: 0, positive: 0, negative: 0 },
      hist_esophagus: { total: 0, completed: 0, positive: 0, negative: 0 },
      hist_colorectal: { total: 0, completed: 0, positive: 0, negative: 0 },
      hist_hepatobiliary: { total: 0, completed: 0, positive: 0, negative: 0 },

      // 7. Serology
      vdrl: { total: 0, completed: 0, positive: 0, negative: 0 },
      tpha: { total: 0, completed: 0, positive: 0, negative: 0 },
      asot: { total: 0, completed: 0, positive: 0, negative: 0 },
      hiv: { total: 0, completed: 0, positive: 0, negative: 0 },
      brucella: { total: 0, completed: 0, positive: 0, negative: 0 },
      rf: { total: 0, completed: 0, positive: 0, negative: 0 },
      h_pylori: { total: 0, completed: 0, positive: 0, negative: 0 },
      hep_a: { total: 0, completed: 0, positive: 0, negative: 0 },
      hep_b: { total: 0, completed: 0, positive: 0, negative: 0 },
      hep_c: { total: 0, completed: 0, positive: 0, negative: 0 },
      hcg_pregnancy: { total: 0, completed: 0, positive: 0, negative: 0 },
      crag: { total: 0, completed: 0, positive: 0, negative: 0 },
      widal: { total: 0, completed: 0, positive: 0, negative: 0 }
    };

    const addCounter = (itemKey, r) => {
      if (!lineItemCounters[itemKey]) {
        lineItemCounters[itemKey] = { total: 0, completed: 0, positive: 0, negative: 0, low: 0, high: 0 };
      }
      const c = lineItemCounters[itemKey];
      c.total++;
      if (isCompleted(r)) {
        c.completed++;
        if (isPositiveFlag(r)) c.positive++; else c.negative++;
        if (isLowFlag(r)) c.low = (c.low || 0) + 1;
        if (isHighFlag(r)) c.high = (c.high || 0) + 1;
      }
    };

    rows.forEach(r => {
      const n = `${r.test_name || ''} ${r.test_code || ''}`.toLowerCase();
      const ageVal = r.calculated_age !== null && r.calculated_age !== undefined ? Number(r.calculated_age) : null;
      const isUnder5 = ageVal !== null && !isNaN(ageVal) ? ageVal < 5 : false;

      // 1. Urine
      if (/urinalysis|urine routine|urine chemistry|urine dipstick|urine analysis|ua |24356-8|50556-0/.test(n)) addCounter('u_chem_total', r);
      if (/urine glucose|glucose.*urine|sugar.*urine|glucosuria/.test(n)) addCounter('u_glucose', r);
      if (/ketone/.test(n)) addCounter('u_ketones', r);
      if (/protein.*urine|albumin.*urine|proteinuria/.test(n)) addCounter('u_proteins', r);
      if (/urine microscopy|urine sed|microscopy.*urine/.test(n)) addCounter('u_micro_total', r);
      if (/pus cell|leukocyte esterase|pyuria/.test(n)) addCounter('u_pus_cells', r);
      if (/haematobium|bilharzia.*urine/.test(n)) addCounter('u_haematobium', r);
      if (/trichomonas|t\. vaginalis/.test(n)) addCounter('u_tvaginalis', r);
      if (/yeast|candida.*urine/.test(n)) addCounter('u_yeast', r);
      if (/bacteria.*urine|bacteriuria/.test(n)) addCounter('u_bacteria', r);

      // 2. Blood Chemistry
      if (/blood sugar|rbs|fbs|glucose|glycemia|random blood sugar|fasting blood sugar|2345-7|2339-0|1558-6/.test(n)) addCounter('blood_sugar', r);
      if (/ogtt|oral glucose tolerance/.test(n)) addCounter('ogtt', r);
      if (/uecs|renal function|rft|kidney function|kft|urea & electrolyte|24362-6/.test(n)) addCounter('uecs_total', r);
      if (/creatinine|serum creatinine|2160-0/.test(n)) addCounter('creatinine', r);
      if (/urea|blood urea|bun|3094-0/.test(n)) addCounter('urea', r);
      if (/sodium|serum sodium|na\+|2951-2/.test(n)) addCounter('sodium', r);
      if (/potassium|serum potassium|k\+|2823-3/.test(n)) addCounter('potassium', r);
      if (/chloride|cl\-|2075-0/.test(n)) addCounter('chlorides', r);
      if (/lft|liver function|hepatic panel|liver panel|24325-3/.test(n)) addCounter('lft_total', r);
      if (/direct bilirubin|conjugated bilirubin|1968-7/.test(n)) addCounter('direct_bilirubin', r);
      if (/total bilirubin|serum bilirubin|1975-2/.test(n)) addCounter('total_bilirubin', r);
      if (/asat|sgot|ast|1920-8/.test(n)) addCounter('ast_sgot', r);
      if (/alat|sgpt|alt|1751-7/.test(n)) addCounter('alt_sgpt', r);
      if (/total protein|serum protein|2885-2/.test(n)) addCounter('serum_protein', r);
      if (/albumin|serum albumin|1751-7/.test(n)) addCounter('albumin', r);
      if (/alkaline phosphatase|alp|6768-6/.test(n)) addCounter('alp', r);
      if (/lipid profile|lipid panel|lipids|24331-1/.test(n)) addCounter('lipid_total', r);
      if (/cholesterol|total cholesterol|2093-3/.test(n)) addCounter('cholesterol', r);
      if (/triglyceride|2571-8/.test(n)) addCounter('triglycerides', r);
      if (/ldl|2089-1/.test(n)) addCounter('ldl', r);
      if (/t3|free t3|triiodothyronine/.test(n)) addCounter('t3', r);
      if (/t4|free t4|thyroxine/.test(n)) addCounter('t4', r);
      if (/tsh|thyroid stimulating|3016-3/.test(n)) addCounter('tsh', r);
      if (/psa|prostate specific|2857-1/.test(n)) addCounter('psa', r);
      if (/ca 15-3|ca153|ca-15-3/.test(n)) addCounter('ca15_3', r);
      if (/ca 19-9|ca199|ca-19-9/.test(n)) addCounter('ca19_9', r);
      if (/ca 125|ca125|ca-125/.test(n)) addCounter('ca125', r);
      if (/cea|carcinoembryonic/.test(n)) addCounter('cea', r);
      if (/afp|alpha fetoprotein/.test(n)) addCounter('afp', r);
      if (/csf.*protein/.test(n)) addCounter('csf_proteins', r);
      if (/csf.*glucose/.test(n)) addCounter('csf_glucose', r);

      // 3. Parasitology & Malaria (Under vs 5 and above)
      if (/rdt|rapid.*malaria|mrdt|malaria antigen|74850-9|50549-5/.test(n)) {
        if (isUnder5) addCounter('malaria_rdt_u5', r);
        else addCounter('malaria_rdt_o5', r);
      } else if (/malaria|bs for mps|mps|blood smear for malaria|malaria microscopy|malaria smear|thick and thin|89574-8|58900-2|32729-6/.test(n)) {
        if (isUnder5) addCounter('malaria_bs_u5', r);
        else addCounter('malaria_bs_o5', r);
      }
      if (/taenia|tapeworm/.test(n)) addCounter('taenia', r);
      if (/hymenolepis|h\. nana|h nana/.test(n)) addCounter('h_nana', r);
      if (/hookworm|ancylostoma|necator/.test(n)) addCounter('hookworm', r);
      if (/roundworm|ascaris/.test(n)) addCounter('roundworms', r);
      if (/mansoni|schistosoma|bilharzia/.test(n)) addCounter('s_mansoni', r);
      if (/trichuris|whipworm/.test(n)) addCounter('trichuris', r);
      if (/amoeba|entamoeba|histolytica/.test(n)) addCounter('amoeba', r);
      if (/stool|ova|cyst|o\/c|faecal|fecal|10701-1/.test(n)) addCounter('stool_total', r);

      // 4. Haematology (Full Haemogram, CBC, etc.)
      if (/haemogram|hemogram|cbc|full blood|complete blood|fbc|haematology|58410-2|57021-8|718-7|6690-2/.test(n)) addCounter('cbc_fbc', r);
      if (/hb estimation|haemoglobin estimation|hemoglobin estimation|tallqvist|sahli/.test(n) && !/cbc|haemogram|hemogram|fbc/.test(n)) addCounter('hb_est', r);
      if (/hba1c|glycated|glycohemoglobin|4548-4|17856-6/.test(n)) addCounter('hba1c', r);
      if (/cd4|cd4 count|t-cell|8123-2/.test(n)) addCounter('cd4', r);
      if (/sickl|hb s|sickle cell/.test(n)) addCounter('sickling', r);
      if (/pbf|peripheral blood film|blood film|blood smear/.test(n)) addCounter('pbf', r);
      if (/bma|bone marrow/.test(n)) addCounter('bma', r);
      if (/coag|inr|pt\/inr|prothrombin|aptt|3173-2/.test(n)) addCounter('coag', r);
      if (/reticulocyte|retic/.test(n)) addCounter('retic', r);
      if (/esr|erythrocyte sedimentation|sed rate|30341-2/.test(n)) addCounter('esr', r);
      if (/blood group|abo|rh |rh factor|rhesus|crossmatch|883-9|882-1/.test(n)) addCounter('blood_group', r);

      // 5. Bacteriology & TB
      if (/urine.*cult/.test(n)) addCounter('bac_urine', r);
      if (/pus.*swab|wound.*swab/.test(n)) addCounter('bac_pus', r);
      if (/hvs|vaginal swab/.test(n)) addCounter('bac_hvs', r);
      if (/throat swab/.test(n)) addCounter('bac_throat', r);
      if (/rectal swab/.test(n)) addCounter('bac_rectal', r);
      if (/blood culture/.test(n)) addCounter('bac_blood', r);
      if (/water/.test(n)) addCounter('bac_water', r);
      if (/food/.test(n)) addCounter('bac_food', r);
      if (/urethral swab/.test(n)) addCounter('bac_urethral', r);
      if (/stool culture/.test(n)) addCounter('bac_stool', r);
      if (/tb|tuberculosis|afb|gene xpert|genexpert|sputum afb|11475-1|89371-9/.test(n)) addCounter('tb_smear', r);

      // 6. Histology
      if (/pap|cervical smear/.test(n)) addCounter('pap_smear', r);
      if (/touch prep/.test(n)) addCounter('touch_prep', r);
      if (/fna.*thyroid/.test(n)) addCounter('fna_thyroid', r);
      if (/fna.*lymph/.test(n)) addCounter('fna_lymph', r);
      if (/fna.*breast/.test(n)) addCounter('fna_breast', r);
      if (/fna.*prostate/.test(n)) addCounter('fna_prostate', r);
      if (/uterus|cervix/.test(n) && /biopsy|histolog/.test(n)) addCounter('hist_uterus', r);
      if (/esophagus/.test(n) && /biopsy|histolog/.test(n)) addCounter('hist_esophagus', r);
      if (/colorectal|colon/.test(n) && /biopsy|histolog/.test(n)) addCounter('hist_colorectal', r);
      if (/hepatobiliary|liver/.test(n) && /biopsy|histolog/.test(n)) addCounter('hist_hepatobiliary', r);

      // 7. Serology
      if (/vdrl|rpr|syphilis|treponema|20507-0|5292-8/.test(n)) { addCounter('vdrl', r); addCounter('syphilis_screening', r); }
      if (/tpha/.test(n)) addCounter('tpha', r);
      if (/asot|aso titre|antistreptolysin/.test(n)) addCounter('asot', r);
      if (/hiv|determine|first response|29893-5|68961-2/.test(n)) { addCounter('hiv', r); addCounter('hiv_screening', r); }
      if (/brucella|febrile antigen|brucellosis|22295-0/.test(n)) addCounter('brucella', r);
      if (/rheumatoid|rf test|11572-5/.test(n)) addCounter('rf', r);
      if (/pylori|h\. pylori|h pylori|helicobacter|29532-9|49540-8/.test(n)) addCounter('h_pylori', r);
      if (/hepatitis a|hav/.test(n)) addCounter('hep_a', r);
      if (/hepatitis b|hbsag|5196-1/.test(n)) { addCounter('hep_b', r); addCounter('hep_b_screening', r); }
      if (/hepatitis c|hcv|13955-0/.test(n)) { addCounter('hep_c', r); addCounter('hep_c_screening', r); }
      if (/pregnancy|upt|hcg|beta-hcg|bhcg|2106-3|19080-1/.test(n)) addCounter('hcg_pregnancy', r);
      if (/crag|cryptococc/.test(n)) addCounter('crag', r);
      if (/widal|typhoid|salmonella|42254-3/.test(n)) addCounter('widal', r);
    });

    const testCounts = {};
    rows.forEach(r => {
      const tName = r.test_name || 'Standard Lab Test';
      if (!testCounts[tName]) testCounts[tName] = { total:0, completed:0, positive:0, category: categorize(tName, r.test_code) };
      testCounts[tName].total++;
      if (isCompleted(r)) testCounts[tName].completed++;
      if (isPositiveFlag(r)) testCounts[tName].positive++;
    });

    return successResponse(res, 200, 'MOH 706 data fetched', {
      period: { start, end },
      totals: { total, completed, pending, processing },
      summary,
      line_items: lineItemCounters,
      tests: testCounts
    });
  } catch (error) {
    console.error('MOH 706 error:', error.message);
    return errorResponse(res, 500, 'Failed to generate MOH 706: ' + error.message);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT lr.*,
        p.full_name as patient_name, p.patient_number, p.gender, p.date_of_birth,
        p.phone, p.allergies, p.blood_group,
        u.full_name as doctor_name,
        t.full_name as technician_name,
        v.visit_number, v.visit_type,
        c.diagnosis, c.icd_code, c.management_plan
      FROM lab_requests lr
      JOIN patients p ON lr.patient_id::text = p.id::text
      LEFT JOIN users u ON lr.doctor_id::text = u.id::text
      LEFT JOIN users t ON lr.resulted_by::text = t.id::text
      LEFT JOIN visits v ON lr.visit_id::text = v.id::text
      LEFT JOIN consultations c ON lr.consultation_id::text = c.id::text
      WHERE lr.id::text = $1::text AND (lr.pharmacy_id::text = $2::text OR lr.pharmacy_id IS NULL)
    `, [req.params.id, req.pharmacy_id]);

    if (!result.rows[0]) return errorResponse(res, 404, 'Lab request not found');
    return successResponse(res, 200, 'Lab request fetched', result.rows[0]);
  } catch (error) {
    return errorResponse(res, 500, 'Failed to fetch lab request');
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (status !== 'pending' && status !== 'cancelled') {
      const lab = await pool.query(`
        SELECT lr.visit_id, lr.test_name, v.status as visit_status, v.visit_type,
               EXISTS(SELECT 1 FROM inpatient_admissions ia WHERE ia.visit_id::text = lr.visit_id::text AND ia.status = 'admitted') as is_admitted
        FROM lab_requests lr
        LEFT JOIN visits v ON lr.visit_id::text = v.id::text
        WHERE lr.id::text = $1::text
      `, [req.params.id]);
      if (lab.rows.length === 0) {
        return errorResponse(res, 404, 'Lab request not found');
      }
      const { visit_id, test_name, visit_status, visit_type, is_admitted } = lab.rows[0];

      const isInpatient = visit_status === 'inpatient' ||
                          (visit_type && visit_type.toLowerCase() === 'inpatient') ||
                          is_admitted;

      // Inpatients do not require upfront payment clearance for lab processing
      if (!isInpatient) {
        const billCheck = await pool.query(`
          SELECT status FROM billing_items
          WHERE visit_id::text = $1::text AND (facility_id::text = $2::text OR facility_id IS NULL) AND item_type = 'laboratory'
            AND LOWER(TRIM(item_name)) = LOWER(TRIM($3))
          ORDER BY created_at DESC LIMIT 1
        `, [visit_id, req.pharmacy_id, (test_name || '').trim()]);

        if (billCheck.rows.length > 0 && billCheck.rows[0].status === 'pending') {
          return errorResponse(res, 402, `Payment required for '${test_name}'. Patient has an unpaid bill for this test.`);
        }
      }
    }
    const result = await pool.query(`
      UPDATE lab_requests SET status=$1, updated_at=NOW()
      WHERE id::text=$2::text AND (pharmacy_id::text=$3::text OR pharmacy_id IS NULL) RETURNING *
    `, [status, req.params.id, req.pharmacy_id]);
    if (!result.rows[0]) return errorResponse(res, 404, 'Lab request not found');
    return successResponse(res, 200, 'Status updated', result.rows[0]);
  } catch (error) {
    return errorResponse(res, 500, 'Failed to update status: ' + error.message);
  }
});

router.put('/:id/result', async (req, res) => {
  try {
    const { result, result_value, result_unit, reference_range, result_flag, technician_notes } = req.body;
    // ── payment check & inpatient detection ──────────────────
    const labReq = await pool.query(`
      SELECT lr.visit_id, lr.test_name, v.status as visit_status, v.visit_type,
             EXISTS(SELECT 1 FROM inpatient_admissions ia WHERE ia.visit_id::text = lr.visit_id::text AND ia.status = 'admitted') as is_admitted
      FROM lab_requests lr
      LEFT JOIN visits v ON lr.visit_id::text = v.id::text
      WHERE lr.id::text = $1::text AND (lr.pharmacy_id::text = $2::text OR lr.pharmacy_id IS NULL)
    `, [req.params.id, req.pharmacy_id]);
    if (!labReq.rows[0]) return errorResponse(res, 404, 'Lab request not found');
    const { visit_id, test_name, visit_status, visit_type, is_admitted } = labReq.rows[0];

    const isInpatient = visit_status === 'inpatient' ||
                        (visit_type && visit_type.toLowerCase() === 'inpatient') ||
                        is_admitted;

    // Check payment only for OPD visits
    if (!isInpatient) {
      const payCheck = await pool.query(`
        SELECT status FROM billing_items
        WHERE visit_id::text = $1::text AND (facility_id::text = $2::text OR facility_id IS NULL) AND item_type = 'laboratory'
          AND LOWER(TRIM(item_name)) = LOWER(TRIM($3))
        ORDER BY created_at DESC LIMIT 1
      `, [visit_id, req.pharmacy_id, (test_name || '').trim()]);

      if (payCheck.rows.length > 0 && payCheck.rows[0].status === 'pending') {
        return errorResponse(res, 402, `Lab test '${test_name}' is not paid yet. Patient must pay for this test at reception first.`);
      }
    }
    // ───────────────────────────────────────────────────────
    const res2 = await pool.query(`
      UPDATE lab_requests SET
        result=$1, result_value=$2, result_unit=$3,
        reference_range=$4, result_flag=$5, technician_notes=$6,
        status='completed', resulted_at=NOW(), resulted_by=$7
      WHERE id::text=$8::text AND (pharmacy_id::text=$9::text OR pharmacy_id IS NULL) RETURNING *
    `, [result||null, result_value||null, result_unit||null, reference_range||null,
        result_flag||null, technician_notes||null, req.user.id, req.params.id, req.pharmacy_id]);
    if (!res2.rows[0]) return errorResponse(res, 404, 'Lab request not found');

    // For OPD, return visit to doctor. For inpatient, preserve inpatient status!
    if (!isInpatient) {
      await pool.query(`
        UPDATE visits SET status='with_doctor', updated_at=NOW()
        WHERE id::text=$1::text AND (pharmacy_id::text=$2::text OR pharmacy_id IS NULL) AND UPPER(status) IN ('LAB', 'WITH_LAB', 'WAITING_LAB', 'WITH_DOCTOR', 'RADIOLOGY', 'WAITING_RADIOLOGY')
      `, [res2.rows[0].visit_id, req.pharmacy_id]);

      const io = req.app.get('io');
      if (io) {
        io.emit(`queue_update_${req.pharmacy_id}`, { visit_id: res2.rows[0].visit_id, status: 'with_doctor' });
        io.emit(`visit_updated_${req.pharmacy_id}`, { visit_id: res2.rows[0].visit_id, status: 'with_doctor' });
      }
    }

    return successResponse(res, 200, 'Results entered', res2.rows[0]);
  } catch (error) {
    console.error('Lab result error:', error.message);
    return errorResponse(res, 500, 'Failed to enter results: ' + error.message);
  }
});

// Authenticated PDF download
router.get('/:id/pdf', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT lr.*,
        p.full_name as patient_name, p.patient_number, p.gender, p.date_of_birth,
        p.phone, p.allergies, p.blood_group,
        u.full_name as doctor_name,
        t.full_name as technician_name,
        v.visit_number,
        c.diagnosis, c.icd_code,
        ph.name as pharmacy_name, ph.phone as ph_phone, ph.address, ph.city,
        ph.country, ph.email as ph_email, ph.logo_url
      FROM lab_requests lr
      JOIN patients p ON lr.patient_id::text = p.id::text
      LEFT JOIN users u ON lr.doctor_id::text = u.id::text
      LEFT JOIN users t ON lr.resulted_by::text = t.id::text
      LEFT JOIN visits v ON lr.visit_id::text = v.id::text
      LEFT JOIN consultations c ON lr.consultation_id::text = c.id::text
      LEFT JOIN pharmacies ph ON lr.pharmacy_id::text = ph.id::text
      WHERE lr.id::text = $1::text AND (lr.pharmacy_id::text = $2::text OR lr.pharmacy_id IS NULL)
    `, [req.params.id, req.pharmacy_id]);

    if (!result.rows[0]) return errorResponse(res, 404, 'Lab result not found');
    const r = result.rows[0];
    const pharmacy = { name: r.pharmacy_name, phone: r.ph_phone, address: r.address, city: r.city, country: r.country, email: r.ph_email, logo_url: r.logo_url };
    await buildLabPDF(res, r, pharmacy);
  } catch (e) {
    console.error('PDF error:', e);
    return errorResponse(res, 500, e.message);
  }
});

module.exports = router;
