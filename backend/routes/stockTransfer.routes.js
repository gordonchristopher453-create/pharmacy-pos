const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const {
  requestTransfer, approveTransfer, issueTransfer,
  receiveTransfer, getTransfers, getStoreStock,
} = require('../controllers/stockTransfer.controller');

router.get('/',                       protect, getTransfers);
router.post('/',                      protect, requestTransfer);
router.put('/:id/approve',            protect, approveTransfer);
router.put('/:id/issue',              protect, issueTransfer);
router.put('/:id/receive',            protect, receiveTransfer);
router.get('/store/:store',           protect, getStoreStock);

module.exports = router;
