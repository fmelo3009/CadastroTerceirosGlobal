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
  'Serviços administrativos'
];

async function seedServicos() {
  for (const nome of SERVICOS_PADRAO) {
    await db.query(
      `
        INSERT INTO servicos (nome)
        VALUES ($1)
        ON CONFLICT (nome) DO NOTHING
      `,
      [nome]
    );
  }

  console.log(
    `Serviços: ${SERVICOS_PADRAO.length} verificados/inseridos.`
  );
}

async function seedAdmin() {
  const emailAdmin =
    process.env.ADMIN_EMAIL ||
    'admin@globalengenharia.com.br';

  const senhaAdmin =
    process.env.ADMIN_PASSWORD;

  const existente = await db.get(
    `
      SELECT id
      FROM usuarios
      WHERE LOWER(email) = LOWER($1)
    `,
    [emailAdmin]
  );

  if (existente) {
    console.log('Usuário administrador já existe.');
    return;
  }

  if (!senhaAdmin) {
    console.warn(
      'ADMIN_PASSWORD não definida. Usuário administrador não foi criado.'
    );
    return;
  }

  const hash = bcrypt.hashSync(
    senhaAdmin,
    10
  );

  await db.query(
    `
      INSERT INTO usuarios (
        nome,
        email,
        senha_hash,
        papel,
        ativo
      )
      VALUES ($1, $2, $3, $4, TRUE)
    `,
    [
      'Administrador',
      emailAdmin,
      hash,
      'admin'
    ]
  );

  console.log(
    `Usuário administrador criado: ${emailAdmin}`
  );
}

async function seedBanco() {
  try {
    await seedServicos();
    await seedAdmin();

    console.log(
      'Seed do banco concluído com sucesso.'
    );
  } catch (erro) {
    console.error(
      'Erro ao executar seed:',
      erro
    );

    throw erro;
  }
}

if (require.main === module) {
  seedBanco()
    .then(() => {
      process.exit(0);
    })
    .catch(() => {
      process.exit(1);
    });
}

module.exports = seedBanco;
