/**
 * ROUTES CLASSES
 */
const express = require('express');
const { query } = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const classes = await query('SELECT * FROM classes ORDER BY name');
    res.json({ success: true, data: { classes } });
  } catch (error) {
    console.error('Erreur get classes:', error);
    res.status(500).json({ success: false, error: 'Erreur récupération classes' });
  }
});

router.post('/', authorizeRoles('directeur'), async (req, res) => {
  try {
    const { 
      name, 
      level, 
      fee = 0, 
      canteen_fee = 0, 
      transport_fee = 0, 
      annexes_fee = 0, 
      teacher_id = null, 
      max_students = 40, 
      academic_year 
    } = req.body;
    
    // Validation des champs obligatoires
    if (!name || !level || !academic_year) {
      return res.status(400).json({ 
        success: false, 
        error: 'Champs obligatoires manquants (name, level, academic_year)' 
      });
    }
    
    const result = await query(
      `INSERT INTO classes (name, level, fee, canteen_fee, transport_fee, annexes_fee, teacher_id, max_students, academic_year) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, level, fee, canteen_fee, transport_fee, annexes_fee, teacher_id, max_students, academic_year]
    );
    
    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    console.error('Erreur create class:', error);
    res.status(500).json({ success: false, error: 'Erreur création classe' });
  }
});

module.exports = router;