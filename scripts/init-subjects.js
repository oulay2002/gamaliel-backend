/**
 * Initialize subjects with proper coefficients/max_scores per class level
 * Run: node scripts/init-subjects.js
 */

const { query } = require('../config/database');

const subjectsByLevel = {
  'CP1': [
    { name: 'Graphisme', max_score: 10 },
    { name: 'Copie', max_score: 10 },
    { name: 'Écriture', max_score: 10 },
    { name: 'AEC', max_score: 10 },
    { name: 'Expression écrite', max_score: 10 },
    { name: 'Mathématiques', max_score: 10 },
    { name: 'EDHC', max_score: 10 },
    { name: 'Lecture', max_score: 10 },
    { name: 'Discrimination visuelle', max_score: 10 },
    { name: 'Discrimination auditive', max_score: 10 },
    { name: 'Enrichissement du vocabulaire', max_score: 10 },
    { name: 'Dessin', max_score: 5 },
    { name: 'Chant/Poésie', max_score: 5 },
    { name: 'Anglais', max_score: 10 },
    { name: 'Éducation chrétienne', max_score: 10 }
  ],
  'CP2': [
    { name: 'Graphisme', max_score: 10 },
    { name: 'Copie', max_score: 10 },
    { name: 'Écriture', max_score: 10 },
    { name: 'AEC', max_score: 10 },
    { name: 'Expression écrite', max_score: 10 },
    { name: 'Mathématiques', max_score: 10 },
    { name: 'EDHC', max_score: 10 },
    { name: 'Lecture', max_score: 10 },
    { name: 'Discrimination visuelle', max_score: 10 },
    { name: 'Discrimination auditive', max_score: 10 },
    { name: 'Enrichissement du vocabulaire', max_score: 10 },
    { name: 'Dessin', max_score: 5 },
    { name: 'Chant/Poésie', max_score: 5 },
    { name: 'Anglais', max_score: 10 },
    { name: 'Éducation chrétienne', max_score: 10 }
  ],
  'CE1': [
    { name: 'Dictée', max_score: 10 },
    { name: 'Étude de texte', max_score: 30 },
    { name: 'Éveil au milieu', max_score: 30 },
    { name: 'Mathématiques', max_score: 30 },
    { name: 'Anglais', max_score: 20 },
    { name: 'Éducation chrétienne', max_score: 20 }
  ],
  'CE2': [
    { name: 'Dictée', max_score: 10 },
    { name: 'Étude de texte', max_score: 30 },
    { name: 'Éveil au milieu', max_score: 30 },
    { name: 'Mathématiques', max_score: 30 },
    { name: 'Anglais', max_score: 20 },
    { name: 'Éducation chrétienne', max_score: 20 }
  ],
  'CM1': [
    { name: 'Dictée', max_score: 20 },
    { name: 'Étude de texte', max_score: 50 },
    { name: 'Éveil au milieu', max_score: 50 },
    { name: 'Mathématiques', max_score: 50 },
    { name: 'Anglais', max_score: 20 },
    { name: 'Éducation chrétienne', max_score: 20 }
  ],
  'CM2': [
    { name: 'Dictée', max_score: 20 },
    { name: 'Étude de texte', max_score: 50 },
    { name: 'Éveil au milieu', max_score: 50 },
    { name: 'Mathématiques', max_score: 50 },
    { name: 'Anglais', max_score: 20 },
    { name: 'Éducation chrétienne', max_score: 20 }
  ]
};

async function initSubjects() {
  console.log('📚 Initializing subjects by class level...\n');

  // Ensure subjects table has max_score column
  try {
    await query('ALTER TABLE subjects ADD COLUMN max_score INT DEFAULT 20');
    console.log('✅ Added max_score column to subjects');
  } catch (e) {
    console.log('  max_score column already exists');
  }

  // Add level column to subjects (subjects can be level-specific)
  try {
    await query("ALTER TABLE subjects ADD COLUMN class_level VARCHAR(10) NULL DEFAULT NULL");
    console.log('✅ Added class_level column to subjects');
  } catch (e) {
    console.log('  class_level column already exists');
  }

  for (const [level, subjects] of Object.entries(subjectsByLevel)) {
    console.log(`\n📋 ${level} (${subjects.length} matières):`);

    for (const subj of subjects) {
      try {
        // Check if subject already exists for this level
        const existing = await query(
          'SELECT id FROM subjects WHERE name = ? AND class_level = ?',
          [subj.name, level]
        );

        if (existing.length === 0) {
          await query(
            'INSERT INTO subjects (name, max_score, class_level, is_active) VALUES (?, ?, ?, TRUE)',
            [subj.name, subj.max_score, level]
          );
          console.log(`  ✅ ${subj.name} /${subj.max_score}`);
        } else {
          // Update max_score
          await query(
            'UPDATE subjects SET max_score = ? WHERE name = ? AND class_level = ?',
            [subj.max_score, subj.name, level]
          );
          console.log(`  🔄 ${subj.name} /${subj.max_score} (updated)`);
        }
      } catch (e) {
        console.log(`  ❌ ${subj.name}: ${e.sqlMessage || e.message}`);
      }
    }
  }

  console.log('\n✅ Subjects initialization complete!');
}

initSubjects().catch(e => console.error('Fatal:', e.message));
