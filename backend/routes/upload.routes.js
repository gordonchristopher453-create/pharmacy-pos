const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const { protect, requirePharmacy, authorize } = require('../middleware/auth.middleware');
const { pool } = require('../config/db');
const { successResponse, errorResponse } = require('../utils/response');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/logo', protect, requirePharmacy, authorize('facility_admin', 'super_admin'), upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) return errorResponse(res, 400, 'No file uploaded');

    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: 'pharmacy-logos',
          public_id: `pharmacy_${req.pharmacy_id}`,
          overwrite: true,
          transformation: [{ width: 400, height: 400, crop: 'limit' }]
        },
        (err, result) => err ? reject(err) : resolve(result)
      ).end(req.file.buffer);
    });

    await pool.query(
      `UPDATE pharmacies SET logo_url=$1, updated_at=NOW() WHERE id=$2`,
      [result.secure_url, req.pharmacy_id]
    );

    return successResponse(res, 200, 'Logo uploaded', { logo_url: result.secure_url });
  } catch (err) {
    return errorResponse(res, 500, 'Upload failed: ' + err.message);
  }
});

module.exports = router;
