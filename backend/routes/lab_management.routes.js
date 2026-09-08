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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lab_reports (
      id SERIAL PRIMARY KEY,
      pharmacy_id INTEGER NOT NULL,
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
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
};

router.get('/reports/all', async (req, res) => {
  try {
    await ensureReportsTable();
    const { search, start_date, end_date, flag } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const from = start_date || today;
    const to = end_date || today;

    let query = `SELECT * FROM lab_reports WHERE pharmacy_id=$1 AND report_date BETWEEN $2 AND $3`;
    const params = [req.pharmacy_id, from, to];
    let idx = 4;

    if (search) {
      query += ` AND (patient_name ILIKE $${idx} OR patient_number ILIKE $${idx} OR test_name ILIKE $${idx})`;
      params.push(`%${search}%`); idx++;
    }
    if (flag) { query += ` AND result_flag=$${idx++}`; params.push(flag); }

    query += ` ORDER BY created_at DESC`;
    const result = await pool.query(query, params);
    return successResponse(res, 200, 'Reports fetched', result.rows);
  } catch (error) {
    console.error('Reports fetch error:', error.message);
    return errorResponse(res, 500, 'Failed to fetch reports');
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
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
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
    return errorResponse(res, 500, 'Failed to save report');
  }
});

router.delete('/reports/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM lab_reports WHERE id=$1 AND pharmacy_id=$2`, [req.params.id, req.pharmacy_id]);
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
    query += ` ORDER BY CASE lr.urgency WHEN 'emergency' THEN 1 WHEN 'urgent' THEN 2 ELSE 3 END, lr.created_at DESC LIMIT $${params.length}`;

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

// MOH 706 - Auto-generate monthly/weekly lab summary
router.get('/moh706', async (req, res) => {
  try {
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
    const result = await pool.query(
      `SELECT test_name, test_code, status, result_flag, result_value FROM lab_requests WHERE pharmacy_id = $1 AND DATE(created_at) BETWEEN $2 AND $3`,
      [req.pharmacy_id, start, end]
    );
    const rows = result.rows;
    const total = rows.length;
    const completed = rows.filter(r => r.status === 'Completed').length;
    const pending = rows.filter(r => r.status === 'Pending').length;
    const processing = rows.filter(r => r.status === 'processing').length;
    const categorize = (name) => {
      const n = (name || '').toLowerCase();
      if (/haemogram|hemogram|cbc|blood count|haematology|wbc|rbc|platelet|hgb|hct/.test(n)) return 'haematology';
      if (/malaria|parasite|widal|brucella|stool|ova|cyst|giardia|amoeba|helminth/.test(n)) return 'parasitology';
      if (/urine|urinalysis/.test(n)) return 'urinalysis';
      if (/culture|sensitivity|swab|sputum|csf|bacteria|gram|afb|tb |tuberculosis/.test(n)) return 'bacteriology';
      if (/glucose|sugar|creatinine|urea|uecs|electrolyte|sodium|potassium|cholesterol|lipid|triglyceride|lft|liver|bilirubin|alt|ast|alp|albumin|protein|hba1c|ferritin|crp|esr|procalcitonin|d-dimer|troponin|psa|prolactin|fsh|lh|cortisol|insulin|tsh|thyroid|t3|t4/.test(n)) return 'chemistry';
      if (/hiv|hepatitis|vdrl|syphilis|rpr|rheumatoid|aso|antistreptolysin|dengue|covid|influenza|strep|h.pylori|helicobacter|toxoplasma|pregnancy|bhcg|beta-hcg/.test(n)) return 'serology';
      if (/pap|smear|tissue|biopsy|histology|cytology|fnac/.test(n)) return 'histology';
      return 'other';
    };
    const cats = { haematology:[], parasitology:[], urinalysis:[], bacteriology:[], chemistry:[], serology:[], histology:[], other:[] };
    rows.forEach(r => { const cat = categorize(r.test_name); cats[cat].push(r); });
    const summary = {};
    for (const [cat, items] of Object.entries(cats)) {
      summary[cat] = { total: items.length, completed: items.filter(i => i.status === 'Completed').length, positive: items.filter(i => ['high','critical'].includes(i.result_flag)).length, pending: items.filter(i => i.status === 'Pending').length };
    }
    const testCounts = {};
    rows.forEach(r => {
      if (!testCounts[r.test_name]) testCounts[r.test_name] = { total:0, completed:0, positive:0, category: categorize(r.test_name) };
      testCounts[r.test_name].total++;
      if (r.status === 'Completed') testCounts[r.test_name].completed++;
      if (['high','critical'].includes(r.result_flag)) testCounts[r.test_name].positive++;
    });
    return successResponse(res, 200, 'MOH 706 data fetched', { period: { start, end }, totals: { total, completed, pending, processing }, summary, tests: testCounts });
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
