const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const { protect, requirePharmacy } = require('../middleware/auth.middleware');
const { successResponse, errorResponse } = require('../utils/response');
const { pool } = require('../config/db');

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.use(protect, requirePharmacy);

// ── SCAN WITH OCR.SPACE ────────────────────────────────
const { PDFDocument } = require('pdf-lib');

async function splitPDFPages(buffer) {
  const pdfDoc = await PDFDocument.load(buffer);
  const pageCount = pdfDoc.getPageCount();
  const pages = [];

  for (let i = 0; i < pageCount; i++) {
    const newPdf = await PDFDocument.create();
    const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
    newPdf.addPage(copiedPage);
    const pageBytes = await newPdf.save();
    pages.push(Buffer.from(pageBytes));
    if (i < 3) console.log(`Page ${i+1} size: ${pageBytes.length} bytes`);
  }

  return pages;
}

async function scanWithOCRSpace(fileBuffer, fileName) {
  const FormData = require("form-data");
  const isMimeType = fileName.endsWith('.pdf') ? 'application/pdf' : 'image/png';

  if (fileName.endsWith('.pdf')) {
    let pages = [];
    try {
      pages = await splitPDFPages(fileBuffer);
    } catch(e) {
      console.log('PDF split failed, scanning as single file:', e.message);
      pages = [fileBuffer];
    }

    console.log(`PDF has ${pages.length} pages (sizes: ${pages.map((p,i) => i<3 ? p.length+'b' : '').filter(Boolean).join(', ')}...)`);

    let allText = '';
    let successPages = 0;

    for (let i = 0; i < pages.length; i++) {
      try {
        const form = new FormData();
        form.append('file', pages[i], { filename: `page-${i+1}.pdf`, contentType: 'application/pdf' });
        form.append('language', 'eng');
        form.append('isOverlayRequired', 'false');
        form.append('OCREngine', '2');
        form.append('isTable', 'true');

        const response = await axios.post('https://api.ocr.space/parse/image', form, {
          headers: { 'apikey': process.env.OCR_API_KEY, ...form.getHeaders() },
          maxBodyLength: Infinity
        });

        const pageText = response.data?.ParsedResults?.[0]?.ParsedText || '';
        if (pageText) {
          allText += pageText + '\n';
          successPages++;
        }

        await new Promise(r => setTimeout(r, 2000));
      } catch(e) {
        console.log(`Page ${i+1} scan failed: ${e.message}`);
      }
    }

    console.log(`Scanned ${successPages}/${pages.length} pages successfully`);
    return { ParsedResults: [{ ParsedText: allText }] };
  }

  // Images
  const form = new FormData();
  form.append('file', fileBuffer, { filename: fileName, contentType: isMimeType });
  form.append('language', 'eng');
  form.append('isOverlayRequired', 'false');
  form.append('OCREngine', '2');
  form.append('isTable', 'true');

  const response = await axios.post('https://api.ocr.space/parse/image', form, {
    headers: { 'apikey': process.env.OCR_API_KEY, ...form.getHeaders() },
    maxBodyLength: Infinity
  });

  return response.data;
}

// ── PARSE OCR TEXT TO EXTRACT ITEMS ──────────────────────
function parseUniversal(ocrText, type) {
  const items = [];
  // Normalize: replace tabs, multiple spaces, special chars
  let text = ocrText.replace(/\t/g, ' ').replace(/\r/g, '\n').replace(/\s+/g, ' ');
  const lines = text.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 5) continue;
    
    // Universal pattern: find a price at the end
    // Supports: "Name 100", "Name 100.00", "Name 1,000.00", "Name KES 100"
    const priceRegex = /(?:KES|Ksh|USD|\$)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*$/;
    const priceMatch = trimmed.match(priceRegex);
    if (!priceMatch) continue;
    
    const price = parseFloat(priceMatch[1].replace(/,/g, ''));
    if (isNaN(price) || price <= 0 || price > 10000000) continue;
    
    // Extract name (everything before the price)
    let name = trimmed.substring(0, priceMatch.index).trim();
    // Remove price prefix like "KES", "Ksh", "$"
    name = name.replace(/(?:KES|Ksh|USD|\$)\s*$/i, '').trim();
    
    // Skip non-product lines
    if (name.length < 2) continue;
    if (/^(item|description|price|discount|total|subtotal|grand|page|invoice|date|phone|www|http|email|box|road|industrial|park|trade|surgical|importer|distributor|pharmaceutical|branch|account|bank|pay|transfer|mobile|pesa|swift|sort|iban|bic|routing|ifsc|vat|tax|terms|condition|delivery|address|street|po box|doctor|nurse|patient|hospital|clinic)\b/i.test(name)) continue;
    if (/^(\d+|[A-Z]{1,2}\d+)$/.test(name)) continue; // Just numbers or codes
    
    if (type === 'services') {
      items.push({
        category: detectServiceCategory(name),
        name: name,
        description: '',
        price: price
      });
    } else {
      items.push({
        name: name,
        generic_name: '',
        category: detectProductCategory(name),
        pack_size: '',
        quantity: 1,
        buying_price: Math.round(price * 0.8 * 100) / 100,
        selling_price: price,
        expiry_date: ''
      });
    }
  }
  
  console.log(`Universal parser: ${items.length} items extracted`);
  return items;
}

function detectServiceCategory(name) {
  const n = name.toLowerCase();
  if (n.match(/consult|opd|review|checkup|doctor/i)) return 'consultation';
  if (n.match(/lab|test|cbc|malaria|urine|blood|chemistry|x-ray|ultrasound|scan|imaging|radiology/i)) {
    if (n.match(/x-ray|ultrasound|scan|imaging|radiology/i)) return 'radiology';
    return 'laboratory';
  }
  if (n.match(/inject|iv|im|infusion|drip/i)) return 'injection';
  if (n.match(/admit|bed|ward|ipd/i)) return 'admission';
  if (n.match(/bed|nursing/i)) return 'bed_charge';
  if (n.match(/anc|pnc|cwc|immuniz|family|delivery|mch/i)) return 'mch';
  if (n.match(/surgery|procedure|operation|circumcision/i)) return 'procedure';
  return 'other';
}

function detectProductCategory(name) {
  const n = name.toLowerCase();
  if (n.match(/tablet|caplet|pill/i)) return 'tablet';
  if (n.match(/capsule|caps/i)) return 'capsule';
  if (n.match(/syrup|suspension|elixir|drops|oral/i)) return 'syrup';
  if (n.match(/injection|inj|vial|ampoule|iv/i)) return 'injection';
  if (n.match(/cream|ointment|gel|lotion|soap/i)) return 'cream';
  return 'other';
}

// ── PARSE STOCK DELIVERY INVOICE ─────────────────────────


router.post('/scan-invoice', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) return errorResponse(res, 400, 'No file uploaded');
    
    const { type = 'products' } = req.body;
    
    console.log(`Scanning ${req.files.length} file(s), type: ${type}`);
    
    // Scan with OCR.space
    let allText = '';
    for (const file of req.files) {
      const ocrResult = await scanWithOCRSpace(file.buffer, file.originalname);
      const pageText = ocrResult?.ParsedResults?.[0]?.ParsedText || ocrResult?.parsedText || ocrResult?.text || (typeof ocrResult === 'string' ? ocrResult : '');
      if (pageText) allText += pageText + '\n';
    }
    
    
    
    console.log('OCR Text extracted:', allText.substring(0, 300) + '...');
    
    // Parse the text
    let items;
    if (type === "products" || type === "lab_supplies") {
      items = parseUniversal(allText, "products");
    } else {
      items = parseUniversal(allText, type);
    }
    
    if (items.length === 0) {
      return successResponse(res, 200, 'No items detected. Try a clearer image or enter manually.', {
        items: [],
        rawText: allText.substring(0, 500),
        message: 'No items could be extracted. Ensure the document shows item names and prices clearly.'
      });
    }
    
    return successResponse(res, 200, `Extracted ${items.length} items`, {
      items,
      rawText: allText.substring(0, 300)
    });
    
  } catch (error) {
    console.error('Scan error:', error);
    return errorResponse(res, 500, 'Scan failed: ' + error.message);
  }
});

// ── BULK IMPORT EXTRACTED ITEMS ─────────────────────────
router.post('/bulk-import', async (req, res) => {
  try {
    const { items, type = 'products' } = req.body;
    if (!items || !Array.isArray(items)) return errorResponse(res, 400, 'items array required');
    
    let imported = 0;
    
    if (type === 'services') {
      for (const item of items) {
        if (item.name && item.price) {
          await pool.query(`
            INSERT INTO service_prices (pharmacy_id, category, name, description, price)
            VALUES ($1,$2,$3,$4,$5)
          `, [req.pharmacy_id, item.category||'other', item.name, item.description||null, parseFloat(item.price)]);
          imported++;
        }
      }
    } else {
      for (const item of items) {
        if (item.name) {
          const pRes = await pool.query(`
            INSERT INTO products (pharmacy_id, name, generic_name, buying_price, selling_price, unit)
            VALUES ($1,$2,$3,$4,$5,$6)
            ON CONFLICT (pharmacy_id, name) DO UPDATE
            SET buying_price = EXCLUDED.buying_price,
                selling_price = EXCLUDED.selling_price
            RETURNING id
          `, [
            req.pharmacy_id, item.name, item.generic_name||null,
            parseFloat(item.buying_price)||0, parseFloat(item.selling_price)||0, item.unit||'pcs'
          ]);
          const productId = pRes.rows[0].id;
          await pool.query(`
            INSERT INTO stock (pharmacy_id, product_id, quantity, expiry_date)
            VALUES ($1,$2,$3,$4)
            ON CONFLICT (pharmacy_id, product_id) DO UPDATE
            SET quantity = stock.quantity + EXCLUDED.quantity
          `, [
            req.pharmacy_id, productId,
            parseInt(item.quantity)||0,
            item.expiry_date||null
          ]);
          imported++;
        }
      }
    }
    
    return successResponse(res, 200, `Imported ${imported} items successfully`);
  } catch (error) {
    return errorResponse(res, 500, 'Bulk import failed: ' + error.message);
  }
});

module.exports = router;
