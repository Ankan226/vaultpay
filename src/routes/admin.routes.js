const router = require('express').Router();
const { protect, restrictTo } = require('../middleware/auth');
const { dashboard, listClients, createClient, updateClient, deleteClient } = require('../controllers/admin.controller');

router.use(protect, restrictTo('admin')); 

router.get('/dashboard', dashboard);
router.get('/clients', listClients);
router.post('/clients', createClient);
router.patch('/clients/:id', updateClient);
router.delete('/clients/:id', deleteClient);

module.exports = router;