'use strict';

/**
 * seed-exercises-extra.js
 * Delega al sincronizador unificado de ejercicios (sergei-argutin + hasaneyldrm + free-exercise-db).
 */
const { syncExerciseCatalog } = require('../seed-hasaneyldrm');

syncExerciseCatalog({ force: true })
  .then((stats) => {
    console.log('✅ seed-exercises-extra completado:', stats);
    process.exit(0);
  })
  .catch((e) => {
    console.error('❌ Error en seed-exercises-extra:', e);
    process.exit(1);
  });
