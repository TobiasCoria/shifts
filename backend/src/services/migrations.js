const pool = require('../config/db');

async function columns(table) {
  const [rows] = await pool.execute(
    'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
    [table]
  );
  return new Set(rows.map((row) => row.COLUMN_NAME));
}

async function addColumn(table, name, definition) {
  const existing = await columns(table);
  if (!existing.has(name)) await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${name}\` ${definition}`);
}

async function migrar() {
  const connection = await pool.getConnection();
  let fase = 'adquirir bloqueo';
  try {
    const [locks] = await connection.query("SELECT GET_LOCK('tcgym_schema_migration', 30) AS locked");
    if (Number(locks[0].locked) !== 1) throw new Error('No se pudo bloquear la migración de esquema');
    fase = 'crear tablas base';
    await connection.query(`
      CREATE TABLE IF NOT EXISTS organizaciones (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(150) NOT NULL,
        slug VARCHAR(180) NOT NULL UNIQUE,
        tipo_negocio VARCHAR(40) NOT NULL DEFAULT 'gimnasio',
        zona_horaria VARCHAR(80) NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
        minutos_cancelacion INT NOT NULL DEFAULT 120,
        creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS membresias (
        organizacion_id BIGINT UNSIGNED NOT NULL,
        usuario_id BIGINT UNSIGNED NOT NULL,
        rol VARCHAR(20) NOT NULL DEFAULT 'socio',
        estado VARCHAR(20) NOT NULL DEFAULT 'activo',
        PRIMARY KEY (organizacion_id, usuario_id),
        INDEX idx_membresias_usuario (usuario_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS servicios (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        organizacion_id BIGINT UNSIGNED NOT NULL,
        nombre VARCHAR(120) NOT NULL,
        duracion_minutos INT NOT NULL DEFAULT 60,
        capacidad INT NOT NULL DEFAULT 10,
        activo BOOLEAN NOT NULL DEFAULT TRUE,
        INDEX idx_servicios_org (organizacion_id, activo)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS agenda_horarios (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        organizacion_id BIGINT UNSIGNED NOT NULL,
        servicio_id BIGINT UNSIGNED NOT NULL,
        dia_semana TINYINT UNSIGNED NOT NULL,
        hora_inicio TIME NOT NULL,
        hora_fin TIME NOT NULL,
        intervalo_minutos INT NOT NULL DEFAULT 60,
        capacidad INT NULL,
        activo BOOLEAN NOT NULL DEFAULT TRUE,
        INDEX idx_horarios_lookup (organizacion_id, servicio_id, dia_semana, activo)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS recursos (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        organizacion_id BIGINT UNSIGNED NOT NULL,
        nombre VARCHAR(120) NOT NULL,
        tipo VARCHAR(40) NOT NULL DEFAULT 'profesional',
        activo BOOLEAN NOT NULL DEFAULT TRUE,
        INDEX idx_recursos_org (organizacion_id, activo)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS invitaciones (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        organizacion_id BIGINT UNSIGNED NOT NULL,
        email VARCHAR(254) NOT NULL,
        rol VARCHAR(20) NOT NULL DEFAULT 'socio',
        token_hash CHAR(64) NOT NULL UNIQUE,
        expira_en DATETIME NOT NULL,
        aceptada_en DATETIME NULL,
        INDEX idx_invitaciones_org (organizacion_id, email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    fase = 'agregar columnas de organización';
    await addColumn('usuarios', 'organizacion_actual_id', 'BIGINT UNSIGNED NULL');
    await addColumn('turnos', 'organizacion_id', 'BIGINT UNSIGNED NULL');
    await addColumn('turnos', 'servicio_id', 'BIGINT UNSIGNED NULL');
    fase = 'ajustar documento opcional';
    const [documentColumns] = await connection.query("SELECT COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'documento'");
    if (documentColumns[0]?.IS_NULLABLE === 'NO' && /^(varchar|char|varbinary|binary)\(/i.test(documentColumns[0].COLUMN_TYPE)) {
      await connection.query(`ALTER TABLE usuarios MODIFY documento ${documentColumns[0].COLUMN_TYPE} NULL`);
    }
    fase = 'crear espacio TCGym';
    await connection.query("INSERT IGNORE INTO organizaciones (nombre, slug, tipo_negocio, zona_horaria) VALUES ('TCGym', 'tcgym', 'gimnasio', 'America/Argentina/Buenos_Aires')");
    fase = 'crear servicio inicial';
    await connection.query("INSERT INTO servicios (organizacion_id, nombre, duracion_minutos, capacidad, activo) SELECT o.id, 'Entrenamiento libre', 60, 10, TRUE FROM organizaciones o WHERE o.slug = 'tcgym' AND NOT EXISTS (SELECT 1 FROM servicios s WHERE s.organizacion_id = o.id)");
    fase = 'crear horarios iniciales';
    await connection.query("INSERT INTO agenda_horarios (organizacion_id, servicio_id, dia_semana, hora_inicio, hora_fin, intervalo_minutos, capacidad) SELECT o.id, s.id, dias.dia, '07:00:00', '22:00:00', 60, 10 FROM organizaciones o JOIN servicios s ON s.organizacion_id = o.id CROSS JOIN (SELECT 0 AS dia UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6) dias WHERE o.slug = 'tcgym' AND s.nombre = 'Entrenamiento libre' AND NOT EXISTS (SELECT 1 FROM agenda_horarios h WHERE h.servicio_id = s.id AND h.dia_semana = dias.dia)");
    fase = 'asociar usuarios existentes';
    await connection.query("UPDATE usuarios SET organizacion_actual_id = (SELECT id FROM organizaciones WHERE slug = 'tcgym' LIMIT 1) WHERE organizacion_actual_id IS NULL");
    fase = 'crear membresías existentes';
    await connection.query("INSERT IGNORE INTO membresias (organizacion_id, usuario_id, rol) SELECT o.id, u.id, CASE WHEN u.rol = 'admin' THEN 'admin' ELSE 'socio' END FROM usuarios u JOIN organizaciones o ON o.slug = 'tcgym'");
    fase = 'asociar turnos existentes';
    await connection.query("UPDATE turnos SET organizacion_id = (SELECT id FROM organizaciones WHERE slug = 'tcgym' LIMIT 1) WHERE organizacion_id IS NULL");
    fase = 'asociar turnos al servicio inicial';
    await connection.query("UPDATE turnos t JOIN servicios s ON s.organizacion_id = t.organizacion_id SET t.servicio_id = s.id WHERE t.servicio_id IS NULL");
  } catch (err) {
    console.error(`[migrations.${fase}]`, err.code || err.message, err.sqlMessage || '');
    throw err;
  } finally {
    await connection.query("SELECT RELEASE_LOCK('tcgym_schema_migration')").catch(() => {});
    connection.release();
  }
}

module.exports = { migrar };
