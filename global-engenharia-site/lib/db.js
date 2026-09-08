const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('connect', () => {
  console.log('Conectado ao PostgreSQL / Supabase');
});

pool.on('error', (erro) => {
  console.error('Erro inesperado no PostgreSQL:', erro);
});

async function query(texto, parametros = []) {
  return pool.query(texto, parametros);
}

async function get(texto, parametros = []) {
  const resultado = await pool.query(texto, parametros);
  return resultado.rows[0] || null;
}

async function all(texto, parametros = []) {
  const resultado = await pool.query(texto, parametros);
  return resultado.rows;
}

module.exports = {
  pool,
  query,
  get,
  all
};
