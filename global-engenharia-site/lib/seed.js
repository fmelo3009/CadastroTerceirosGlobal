const bcrypt = require('bcryptjs');
const db = require('./db');

const SERVICOS_PADRAO = [
  'Montagem industrial',
  'Manutenção mecânica',
  'Manutenção elétrica',
  'Instrumentação e automação',
  'Soldagem / Caldeiraria',
  'Pintura industrial',
  'Isolamento térmico',
  'Andaimes e acesso por corda',
  'Construção civil / obras',
  'Elétrica predial',
  'Hidráulica',
  'Refrigeração e climatização (HVAC)',
  'Segurança do trabalho',
  'Limpeza técnica e industrial',
  'Logística e transporte',
  'Locação de equipamentos',
  'Engenharia e projetos',
  'Inspeção e ensaios não destrutivos (END)',
  'Tecnologia da informação',
  'Serviços administrativos',
];

function seedServicos() {
  const insert = db.prepare('INSERT OR IGNORE INTO servicos (nome) VALUES (?)');
  const tx = db.transaction((lista) => {
    for (const nome of lista) insert.run(nome);
  });
  tx(SERVICOS_PADRAO);
  console.log(`Serviços: ${SERVICOS_PADRAO.length} verificados/inseridos.`);
}

function seedAdmin() {
  const existente = db.prepare('SELECT id FROM usuarios WHERE email = ?').get('admin@globalengenharia.com.br');
  if (existente) {
    console.log('Usuário admin já existe, nada a fazer.');
    return;
  }
  const senhaPadrao = 'GlobalEng@2026';
  const hash = bcrypt.hashSync(senhaPadrao, 10);
  db.prepare(`INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES (?, ?, ?, 'admin')`)
    .run('Administrador', 'admin@globalengenharia.com.br', hash);

  console.log('--------------------------------------------------------');
  console.log('Usuário administrador criado:');
  console.log(' e-mail: admin@globalengenharia.com.br');
  console.log(` senha : ${senhaPadrao}`);
  console.log(' >>> Troque essa senha assim que possível <<<');
  console.log('--------------------------------------------------------');
}

seedServicos();
seedAdmin();
