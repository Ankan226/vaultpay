const router = require('express').Router();
const { protect, restrictTo } = require('../middleware/auth');
const c = require('../controllers/invoice.controller');

router.use(protect);

router.get('/', c.list);
router.post('/', restrictTo('admin'), c.create);
router.get('/:id', c.getOne);
router.get('/:id/pdf', c.downloadPdf); 
router.post('/:id/checkout', c.createCheckout);
router.delete('/:id', restrictTo('admin'), c.remove);

module.exports = router;