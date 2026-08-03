require('dotenv').config();
const path = require('path');

module.exports = {
  PORT: process.env.PORT || 3000,
  SESSION_SECRET: process.env.SESSION_SECRET || 'troque-este-segredo-em-producao-global-engenharia',
  DB_PATH: path.join(__dirname, 'data', 'global_engenharia.db'),
  UPLOADS_PATH: path.join(__dirname, 'uploads'),
  MAX_UPLOAD_SIZE_MB: 10,

  // Empresa - dados usados no site institucional (ajustar conforme necessidade real)
  EMPRESA: {
    nome: 'Global Engenharia',
    grupo: 'Grupo Global',
    slogan: 'Engenharia, montagem e manutenção industrial com excelência técnica',
    telefone: '(71) 3273-5300',
    email: 'contato@globalengenharia.com.br',
    endereco: 'Alameda Salvador, Edf. Salvador Shopping Business, Torre América, Caminho das Árvores - Salvador/BA',
  },

  // Empreendimentos do Grupo Global (GPE) apresentados na home. Cada um tem sua
  // própria base de cadastro de terceirizados em /cadastro/:slug.
  // UTE Tupã ainda sem foto/link — usar placeholder até os dados chegarem.
  EMPREENDIMENTOS: [
    {
      slug: 'ute-guarani',
      nome: 'UTE Guarani (SFE)',
      tipo: 'Termoelétrica',
      descricao: 'Empresa geradora de energia termoelétrica no estado da Bahia.',
      imagem: '/img/card-ute-guarani.png',
      linkExterno: 'https://globalparticipacoesenergia.com.br/ute-guarani-gua/',
    },
    {
      slug: 'ute-tupa',
      nome: 'UTE Tupã',
      tipo: 'Termoelétrica',
      descricao: 'Empreendimento do Grupo Global — descrição e foto a confirmar.',
      imagem: '/img/card-ute-tupa-placeholder.png',
      linkExterno: null,
    },
    {
      slug: 'ute-apoena',
      nome: 'UTE Apoena (SFE)',
      tipo: 'Termoelétrica',
      descricao: 'Empresa geradora de energia termoelétrica no estado da Bahia.',
      imagem: '/img/card-ute-apoena.png',
      linkExterno: 'https://globalparticipacoesenergia.com.br/ute-apoena-apo/',
    },
  ],

  // Link institucional do grupo (GPE) — usado no "Saiba mais" do hero e no rodapé
  LINK_GPE: 'https://globalparticipacoesenergia.com.br/',

  // Tipos de documento aceitos no cadastro de terceirizados
  TIPOS_DOCUMENTO: [
    'Contrato Social / CNPJ',
    'Cartão CNPJ',
    'Certidão Negativa de Débitos (CND)',
    'FGTS - Certidão de Regularidade',
    'Alvará de Funcionamento',
    'ART / RRT do responsável técnico',
    'Comprovante de endereço',
    'Documento de identidade (RG/CNH)',
    'Certificado NR (Normas Regulamentadoras)',
    'Apólice de Seguro (Responsabilidade Civil)',
    'Atestado de Capacidade Técnica',
    'Outros',
  ],

  ESTADOS_BR: ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'],

  SITUACOES_CADASTRAIS: ['Pendente de análise', 'Ativo', 'Inativo', 'Bloqueado'],

  STATUS_DOCUMENTO: ['Enviado', 'Pendente', 'Vencido', 'Em análise'],
};
