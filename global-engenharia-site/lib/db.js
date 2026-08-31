const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const config = require('../config');

// Garante que a pasta data/ existe
const dataDir = path.dirname(config.DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(config.DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');


// ---------------------------------------------------------------------------
// SCHEMA PRINCIPAL
// ---------------------------------------------------------------------------

db.exec(`

  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    papel TEXT NOT NULL DEFAULT 'consultor',
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );


  CREATE TABLE IF NOT EXISTS servicos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE
  );


  CREATE TABLE IF NOT EXISTS terceirizados (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    tipo TEXT NOT NULL,

    -- ---------------------------------------------------------
    -- DADOS GERAIS
    -- ---------------------------------------------------------

    razao_social TEXT NOT NULL,

    nome_fantasia TEXT,

    cpf_cnpj TEXT NOT NULL UNIQUE,

    telefone TEXT,

    telefone_secundario TEXT,

    email TEXT,

    cep TEXT,

    endereco TEXT,

    complemento TEXT,

    cidade TEXT,

    estado TEXT,


    -- ---------------------------------------------------------
    -- PESSOA FÍSICA
    -- ---------------------------------------------------------

    sexo TEXT,

    profissao TEXT,


    -- ---------------------------------------------------------
    -- PESSOA JURÍDICA
    -- ---------------------------------------------------------

    capital_social TEXT,

    regime_tributario TEXT,

    inscricao_estadual TEXT,

    inscricao_municipal TEXT,

    contato_nome TEXT,

    contato_telefone TEXT,

    tipo_atividade TEXT,

    setor_atividade TEXT,


    -- ---------------------------------------------------------
    -- OUTROS
    -- ---------------------------------------------------------

    observacoes TEXT,

    situacao_cadastral TEXT NOT NULL DEFAULT 'Pendente de análise',

    criado_em TEXT NOT NULL DEFAULT (datetime('now')),

    atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))

  );


  CREATE TABLE IF NOT EXISTS terceirizado_servicos (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    terceirizado_id INTEGER NOT NULL
      REFERENCES terceirizados(id)
      ON DELETE CASCADE,

    servico_id INTEGER
      REFERENCES servicos(id)
      ON DELETE SET NULL,

    servico_outro TEXT

  );


  CREATE TABLE IF NOT EXISTS experiencias (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    terceirizado_id INTEGER NOT NULL UNIQUE
      REFERENCES terceirizados(id)
      ON DELETE CASCADE,

    tempo_experiencia TEXT,

    area_atuacao TEXT,

    principais_atividades TEXT,

    empresas_projetos_anteriores TEXT,

    principais_competencias TEXT,

    certificacoes TEXT

  );


  CREATE TABLE IF NOT EXISTS documentos (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    terceirizado_id INTEGER NOT NULL
      REFERENCES terceirizados(id)
      ON DELETE CASCADE,

    tipo_documento TEXT NOT NULL,

    nome_arquivo_original TEXT,

    caminho_arquivo TEXT,

    status TEXT NOT NULL DEFAULT 'Enviado',

    data_validade TEXT,

    criado_em TEXT NOT NULL DEFAULT (datetime('now'))

  );


  CREATE TABLE IF NOT EXISTS selecoes (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    usuario_id INTEGER NOT NULL
      REFERENCES usuarios(id)
      ON DELETE CASCADE,

    terceirizado_id INTEGER NOT NULL
      REFERENCES terceirizados(id)
      ON DELETE CASCADE,

    observacao TEXT,

    criado_em TEXT NOT NULL DEFAULT (datetime('now')),

    UNIQUE(usuario_id, terceirizado_id)

  );

`);


// ---------------------------------------------------------------------------
// MIGRAÇÕES
// Adiciona campos novos caso o banco já exista
// ---------------------------------------------------------------------------

function adicionarColunaSeNaoExistir(tabela, coluna, definicao) {

  const colunas = db
    .prepare(`PRAGMA table_info(${tabela})`)
    .all();

  const existe = colunas.some((c) => c.name === coluna);

  if (!existe) {

    console.log(`Adicionando coluna ${coluna} em ${tabela}`);

    db.exec(`
      ALTER TABLE ${tabela}
      ADD COLUMN ${coluna} ${definicao}
    `);

  }

}


// ---------------------------------------------------------------------------
// CAMPOS NOVOS
// ---------------------------------------------------------------------------

adicionarColunaSeNaoExistir(
  'terceirizados',
  'telefone_secundario',
  'TEXT'
);

adicionarColunaSeNaoExistir(
  'terceirizados',
  'sexo',
  'TEXT'
);

adicionarColunaSeNaoExistir(
  'terceirizados',
  'profissao',
  'TEXT'
);

adicionarColunaSeNaoExistir(
  'terceirizados',
  'capital_social',
  'TEXT'
);

adicionarColunaSeNaoExistir(
  'terceirizados',
  'regime_tributario',
  'TEXT'
);

adicionarColunaSeNaoExistir(
  'terceirizados',
  'tipo_atividade',
  'TEXT'
);


// ---------------------------------------------------------------------------
// ÍNDICES
// ---------------------------------------------------------------------------

db.exec(`

  CREATE INDEX IF NOT EXISTS
  idx_terceirizados_cidade
  ON terceirizados(cidade);


  CREATE INDEX IF NOT EXISTS
  idx_terceirizados_situacao
  ON terceirizados(situacao_cadastral);


  CREATE INDEX IF NOT EXISTS
  idx_terceirizados_tipo
  ON terceirizados(tipo);


  CREATE INDEX IF NOT EXISTS
  idx_terceirizados_profissao
  ON terceirizados(profissao);


  CREATE INDEX IF NOT EXISTS
  idx_terceirizados_setor
  ON terceirizados(setor_atividade);


  CREATE INDEX IF NOT EXISTS
  idx_doc_terceirizado
  ON documentos(terceirizado_id);


  CREATE INDEX IF NOT EXISTS
  idx_ts_terceirizado
  ON terceirizado_servicos(terceirizado_id);

`);


module.exports = db;
