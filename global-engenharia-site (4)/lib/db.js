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
// SCHEMA
// ---------------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    papel TEXT NOT NULL DEFAULT 'consultor', -- admin | consultor
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS servicos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS terceirizados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    empreendimento TEXT, -- slug do empreendimento (ex: ute-guarani) ou NULL para cadastro geral
    tipo TEXT NOT NULL DEFAULT 'PJ', -- PJ (empresa) | PF (profissional autônomo)
    razao_social TEXT NOT NULL, -- ou nome completo, se PF
    nome_fantasia TEXT,
    cpf_cnpj TEXT NOT NULL UNIQUE,
    inscricao_estadual TEXT,
    inscricao_municipal TEXT,
    telefone TEXT,
    whatsapp TEXT,
    email TEXT,
    endereco TEXT,
    complemento TEXT,
    cep TEXT,
    cidade TEXT,
    estado TEXT,
    contato_nome TEXT,
    contato_telefone TEXT,
    setor_atividade TEXT,
    observacoes TEXT,
    situacao_cadastral TEXT NOT NULL DEFAULT 'Pendente de análise',
    criado_em TEXT NOT NULL DEFAULT (datetime('now')),
    atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS terceirizado_servicos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    terceirizado_id INTEGER NOT NULL REFERENCES terceirizados(id) ON DELETE CASCADE,
    servico_id INTEGER REFERENCES servicos(id) ON DELETE SET NULL,
    servico_outro TEXT
  );

  CREATE TABLE IF NOT EXISTS experiencias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    terceirizado_id INTEGER NOT NULL UNIQUE REFERENCES terceirizados(id) ON DELETE CASCADE,
    tempo_experiencia TEXT, -- ex: "Menos de 1 ano", "1 a 3 anos", "3 a 5 anos", "Mais de 10 anos"
    area_atuacao TEXT,
    principais_atividades TEXT,
    empresas_projetos_anteriores TEXT,
    principais_competencias TEXT,
    certificacoes TEXT
  );

  CREATE TABLE IF NOT EXISTS documentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    terceirizado_id INTEGER NOT NULL REFERENCES terceirizados(id) ON DELETE CASCADE,
    tipo_documento TEXT NOT NULL,
    nome_arquivo_original TEXT,
    caminho_arquivo TEXT,
    status TEXT NOT NULL DEFAULT 'Enviado', -- Enviado | Pendente | Vencido | Em análise
    data_validade TEXT,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS selecoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    terceirizado_id INTEGER NOT NULL REFERENCES terceirizados(id) ON DELETE CASCADE,
    observacao TEXT,
    criado_em TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(usuario_id, terceirizado_id)
  );

  CREATE INDEX IF NOT EXISTS idx_terceirizados_empreendimento ON terceirizados(empreendimento);
  CREATE INDEX IF NOT EXISTS idx_terceirizados_cidade ON terceirizados(cidade);
  CREATE INDEX IF NOT EXISTS idx_terceirizados_estado ON terceirizados(estado);
  CREATE INDEX IF NOT EXISTS idx_terceirizados_situacao ON terceirizados(situacao_cadastral);
  CREATE INDEX IF NOT EXISTS idx_doc_terceirizado ON documentos(terceirizado_id);
  CREATE INDEX IF NOT EXISTS idx_ts_terceirizado ON terceirizado_servicos(terceirizado_id);
`);

module.exports = db;
