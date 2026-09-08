const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { body, validationResult } = require('express-validator');

const db = require('../lib/db');
const config = require('../config');
const supabase = require('../lib/supabase');


// ============================================================
// UPLOAD EM MEMÓRIA
// O arquivo não fica salvo no Render
// ============================================================

const storage = multer.memoryStorage();

const EXTENSOES_PERMITIDAS = new Set([
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.doc',
  '.docx'
]);

const MIMES_PERMITIDOS = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);

const upload = multer({
  storage,

  limits: {
    fileSize:
      config.MAX_UPLOAD_SIZE_MB *
      1024 *
      1024
  },

  fileFilter: (req, file, cb) => {
    const extensao =
      path
        .extname(file.originalname)
        .toLowerCase();

    const extensaoValida =
      EXTENSOES_PERMITIDAS.has(
        extensao
      );

    const mimeValido =
      MIMES_PERMITIDOS.has(
        file.mimetype
      );

    if (
      !extensaoValida ||
      !mimeValido
    ) {
      return cb(
        new Error(
          'Tipo de arquivo não permitido. Envie PDF, JPG, PNG, DOC ou DOCX.'
        )
      );
    }

    cb(null, true);
  }
});


// ============================================================
// FUNÇÃO PARA SALVAR DOCUMENTO NO SUPABASE STORAGE
// ============================================================

async function salvarDocumento(
  file,
  terceirizadoId,
  tipoDocumento,
  prefixo
) {
  if (!file) {
    return null;
  }

  const extensao =
    path
      .extname(file.originalname)
      .toLowerCase();

  const caminhoStorage =
    `terceirizados/${terceirizadoId}/${prefixo}-${Date.now()}${extensao}`;


  // ----------------------------------------------------------
  // UPLOAD NO SUPABASE STORAGE
  // ----------------------------------------------------------

  const {
    error: erroUpload
  } =
    await supabase.storage
      .from('documentos')
      .upload(
        caminhoStorage,
        file.buffer,
        {
          contentType:
            file.mimetype,

          upsert:
            false
        }
      );


  if (erroUpload) {
    throw new Error(
      `Erro ao enviar arquivo para o Supabase Storage: ${erroUpload.message}`
    );
  }


  try {

    // --------------------------------------------------------
    // REGISTRAR ARQUIVO NO POSTGRESQL
    // --------------------------------------------------------

    await db.query(
      `
        INSERT INTO documentos
        (
          terceirizado_id,
          tipo_documento,
          nome_arquivo_original,
          caminho_arquivo,
          status
        )

        VALUES
        (
          $1,
          $2,
          $3,
          $4,
          $5
        )
      `,
      [
        terceirizadoId,
        tipoDocumento,
        file.originalname,
        caminhoStorage,
        'Enviado'
      ]
    );

  } catch (erroBanco) {

    // Se o registro no banco falhar,
    // removemos o arquivo que acabou de ser enviado.
    await supabase.storage
      .from('documentos')
      .remove([
        caminhoStorage
      ]);

    throw erroBanco;
  }


  return caminhoStorage;
}


// ============================================================
// PÁGINA PRINCIPAL DO CADASTRO
// ============================================================

router.get(
  '/',
  (req, res) => {
    res.redirect(
      '/#cadastro'
    );
  }
);


// ============================================================
// PESSOA FÍSICA
// ============================================================

router.get(
  '/pessoa-fisica',
  (req, res) => {
    res.render(
      'cadastro/pessoa-fisica',
      {
        titulo:
          'Cadastro de Pessoa Física - UTE Tupã',

        valores: {},

        erros: []
      }
    );
  }
);


// ============================================================
// SALVAR PESSOA FÍSICA
// ============================================================

router.post(
  '/pessoa-fisica',

  upload.single(
    'curriculo'
  ),

  [
    body('nome')
      .trim()
      .notEmpty()
      .withMessage(
        'Informe o nome completo.'
      ),

    body('cpf')
      .trim()
      .notEmpty()
      .withMessage(
        'Informe o CPF.'
      ),

    body('municipio')
      .trim()
      .notEmpty()
      .withMessage(
        'Informe o município.'
      ),

    body('telefone')
      .trim()
      .notEmpty()
      .withMessage(
        'Informe o telefone principal.'
      ),

    body('email')
      .trim()
      .isEmail()
      .withMessage(
        'Informe um e-mail válido.'
      ),

    body('profissao')
      .trim()
      .notEmpty()
      .withMessage(
        'Informe a profissão.'
      )
  ],

  async (req, res) => {

    const resultado =
      validationResult(req);


    if (
      !resultado.isEmpty()
    ) {
      return res
        .status(400)
        .render(
          'cadastro/pessoa-fisica',
          {
            titulo:
              'Cadastro de Pessoa Física - UTE Tupã',

            valores:
              req.body,

            erros:
              resultado.array()
          }
        );
    }


    let novoId =
      null;


    try {

      const b =
        req.body;


      // ======================================================
      // CPF
      // ======================================================

      const cpfLimpo =
        String(
          b.cpf || ''
        ).replace(
          /\D/g,
          ''
        );


      if (
        cpfLimpo.length !== 11
      ) {
        return res
          .status(400)
          .render(
            'cadastro/pessoa-fisica',
            {
              titulo:
                'Cadastro de Pessoa Física - UTE Tupã',

              valores:
                b,

              erros: [
                {
                  msg:
                    'Informe um CPF válido com 11 dígitos.'
                }
              ]
            }
          );
      }


      // ======================================================
      // CPF DUPLICADO
      // ======================================================

      const jaExiste =
        await db.get(
          `
            SELECT id
            FROM terceirizados
            WHERE cpf_cnpj = $1
          `,
          [
            cpfLimpo
          ]
        );


      if (jaExiste) {
        return res
          .status(400)
          .render(
            'cadastro/pessoa-fisica',
            {
              titulo:
                'Cadastro de Pessoa Física - UTE Tupã',

              valores:
                b,

              erros: [
                {
                  msg:
                    'Já existe um cadastro com este CPF.'
                }
              ]
            }
          );
      }


      // ======================================================
      // MUNICÍPIO
      // ======================================================

      let municipioFinal =
        b.municipio;


      if (
        b.municipio ===
        'Outro'
      ) {

        if (
          !b.municipio_outro ||
          !b.municipio_outro.trim()
        ) {
          return res
            .status(400)
            .render(
              'cadastro/pessoa-fisica',
              {
                titulo:
                  'Cadastro de Pessoa Física - UTE Tupã',

                valores:
                  b,

                erros: [
                  {
                    msg:
                      'Informe o município.'
                  }
                ]
              }
            );
        }

        municipioFinal =
          b.municipio_outro.trim();
      }


      // ======================================================
      // PROFISSÃO
      // ======================================================

      let profissaoFinal =
        b.profissao;


      if (
        b.profissao ===
        'Outros'
      ) {

        if (
          !b.outra_profissao ||
          !b.outra_profissao.trim()
        ) {
          return res
            .status(400)
            .render(
              'cadastro/pessoa-fisica',
              {
                titulo:
                  'Cadastro de Pessoa Física - UTE Tupã',

                valores:
                  b,

                erros: [
                  {
                    msg:
                      'Informe a profissão.'
                  }
                ]
              }
            );
        }

        profissaoFinal =
          b.outra_profissao.trim();
      }


      // ======================================================
      // INSERT NO POSTGRESQL / SUPABASE
      // ======================================================

      const novoCadastro =
        await db.get(
          `
            INSERT INTO terceirizados
            (
              tipo,
              razao_social,
              cpf_cnpj,

              telefone,
              telefone_secundario,
              email,

              cep,
              endereco,
              complemento,
              cidade,
              estado,

              sexo,
              profissao,

              observacoes,
              situacao_cadastral
            )

            VALUES
            (
              'PF',
              $1,
              $2,

              $3,
              $4,
              $5,

              $6,
              $7,
              $8,
              $9,
              $10,

              $11,
              $12,

              $13,
              'Pendente de análise'
            )

            RETURNING id
          `,
          [
            b.nome.trim(),

            cpfLimpo,

            b.telefone ||
              null,

            b.telefone_secundario ||
              null,

            b.email
              ? b.email.trim()
              : null,

            b.cep ||
              null,

            b.endereco ||
              null,

            b.complemento ||
              null,

            municipioFinal,

            'RJ',

            b.sexo ||
              null,

            profissaoFinal,

            b.observacoes ||
              null
          ]
        );


      novoId =
        novoCadastro.id;


      // ======================================================
      // CURRÍCULO → SUPABASE STORAGE
      // ======================================================

      if (req.file) {

        await salvarDocumento(
          req.file,
          novoId,
          'Currículo',
          'curriculo'
        );

      }


      // ======================================================
      // SUCESSO
      // ======================================================

      return res.render(
        'cadastro/sucesso',
        {
          titulo:
            'Cadastro realizado',

          protocolo:
            novoId,

          nome:
            b.nome,

          empreendimentoAtual: {
            nome:
              'UTE Tupã Fase I'
          }
        }
      );


    } catch (erro) {

      console.error(
        'Erro ao salvar Pessoa Física:',
        erro
      );


      // Se o cadastro foi criado,
      // mas o arquivo falhou,
      // removemos o cadastro para permitir nova tentativa.
      if (novoId) {
        try {
          await db.query(
            `
              DELETE FROM terceirizados
              WHERE id = $1
            `,
            [
              novoId
            ]
          );
        } catch (
          erroLimpeza
        ) {
          console.error(
            'Erro ao desfazer cadastro:',
            erroLimpeza
          );
        }
      }


      if (
        erro.code ===
        '23505'
      ) {
        return res
          .status(400)
          .render(
            'cadastro/pessoa-fisica',
            {
              titulo:
                'Cadastro de Pessoa Física - UTE Tupã',

              valores:
                req.body,

              erros: [
                {
                  msg:
                    'Já existe um cadastro com este CPF.'
                }
              ]
            }
          );
      }


      return res
        .status(500)
        .render(
          'cadastro/pessoa-fisica',
          {
            titulo:
              'Cadastro de Pessoa Física - UTE Tupã',

            valores:
              req.body,

            erros: [
              {
                msg:
                  'Não foi possível realizar o cadastro. Tente novamente.'
              }
            ]
          }
        );

    }

  }
);


// ============================================================
// PESSOA JURÍDICA
// ============================================================

router.get(
  '/pessoa-juridica',
  (req, res) => {
    res.render(
      'cadastro/pessoa-juridica',
      {
        titulo:
          'Cadastro de Pessoa Jurídica - UTE Tupã',

        erros: [],

        valores: {}
      }
    );
  }
);


// ============================================================
// SALVAR PESSOA JURÍDICA
// ============================================================

router.post(
  '/pessoa-juridica',

  upload.single(
    'portfolio'
  ),

  async (req, res) => {

    let empresaId =
      null;


    try {

      const {
        municipio,
        municipio_outro,

        razao_social,
        nome_fantasia,
        cnpj,

        capital_social,
        regime_tributario,

        inscricao_estadual,
        inscricao_municipal,

        cep,
        endereco,
        complemento,

        contato_nome,
        telefone,
        telefone_secundario,
        email,

        tipo_atividade,
        setor_atividade,
        outro_setor,

        observacoes
      } = req.body;


      // ======================================================
      // VALIDAÇÕES
      // ======================================================

      const erros = [];


      if (!municipio) {
        erros.push({
          msg:
            'Informe o município.'
        });
      }


      if (
        municipio ===
          'Outro' &&
        (
          !municipio_outro ||
          !municipio_outro.trim()
        )
      ) {
        erros.push({
          msg:
            'Informe o município da empresa.'
        });
      }


      if (
        !razao_social ||
        !razao_social.trim()
      ) {
        erros.push({
          msg:
            'Informe a Razão Social.'
        });
      }


      if (!cnpj) {
        erros.push({
          msg:
            'Informe o CNPJ.'
        });
      }


      if (
        !contato_nome ||
        !contato_nome.trim()
      ) {
        erros.push({
          msg:
            'Informe o nome do responsável ou contato.'
        });
      }


      if (!telefone) {
        erros.push({
          msg:
            'Informe o telefone principal.'
        });
      }


      if (
        !email ||
        !email.trim()
      ) {
        erros.push({
          msg:
            'Informe o e-mail.'
        });
      }


      if (
        email &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
          .test(email.trim())
      ) {
        erros.push({
          msg:
            'Informe um e-mail válido.'
        });
      }


      if (!tipo_atividade) {
        erros.push({
          msg:
            'Informe o tipo de atividade.'
        });
      }


      if (!setor_atividade) {
        erros.push({
          msg:
            'Informe o setor de atividade.'
        });
      }


      if (
        setor_atividade ===
          'Outros' &&
        (
          !outro_setor ||
          !outro_setor.trim()
        )
      ) {
        erros.push({
          msg:
            'Informe o setor de atividade.'
        });
      }


      // ======================================================
      // CNPJ
      // ======================================================

      const cnpjLimpo =
        String(
          cnpj || ''
        ).replace(
          /\D/g,
          ''
        );


      if (
        cnpjLimpo &&
        cnpjLimpo.length !== 14
      ) {
        erros.push({
          msg:
            'Informe um CNPJ válido com 14 dígitos.'
        });
      }


      if (
        erros.length > 0
      ) {
        return res
          .status(400)
          .render(
            'cadastro/pessoa-juridica',
            {
              titulo:
                'Cadastro de Pessoa Jurídica - UTE Tupã',

              erros,

              valores:
                req.body
            }
          );
      }


      // ======================================================
      // DUPLICIDADE
      // ======================================================

      const empresaExistente =
        await db.get(
          `
            SELECT id
            FROM terceirizados
            WHERE cpf_cnpj = $1
          `,
          [
            cnpjLimpo
          ]
        );


      if (
        empresaExistente
      ) {
        return res
          .status(400)
          .render(
            'cadastro/pessoa-juridica',
            {
              titulo:
                'Cadastro de Pessoa Jurídica - UTE Tupã',

              erros: [
                {
                  msg:
                    'Este CNPJ já está cadastrado.'
                }
              ],

              valores:
                req.body
            }
          );
      }


      // ======================================================
      // MUNICÍPIO
      // ======================================================

      const municipioFinal =
        municipio ===
          'Outro'
          ? municipio_outro.trim()
          : municipio;


      // ======================================================
      // SETOR
      // ======================================================

      const setorFinal =
        setor_atividade ===
          'Outros'
          ? outro_setor.trim()
          : setor_atividade;


      // ======================================================
      // INSERT POSTGRESQL / SUPABASE
      // ======================================================

      const novaEmpresa =
        await db.get(
          `
            INSERT INTO terceirizados
            (
              tipo,

              razao_social,
              nome_fantasia,
              cpf_cnpj,

              telefone,
              telefone_secundario,
              email,

              cep,
              endereco,
              complemento,

              cidade,
              estado,

              capital_social,
              regime_tributario,

              inscricao_estadual,
              inscricao_municipal,

              contato_nome,
              contato_telefone,

              tipo_atividade,
              setor_atividade,

              observacoes,

              situacao_cadastral
            )

            VALUES
            (
              'PJ',

              $1,
              $2,
              $3,

              $4,
              $5,
              $6,

              $7,
              $8,
              $9,

              $10,
              $11,

              $12,
              $13,

              $14,
              $15,

              $16,
              $17,

              $18,
              $19,

              $20,

              'Pendente de análise'
            )

            RETURNING id
          `,
          [
            razao_social.trim(),

            nome_fantasia
              ? nome_fantasia.trim()
              : null,

            cnpjLimpo,

            telefone ||
              null,

            telefone_secundario ||
              null,

            email
              ? email.trim()
              : null,

            cep ||
              null,

            endereco ||
              null,

            complemento ||
              null,

            municipioFinal,

            'RJ',

            capital_social ||
              null,

            regime_tributario ||
              null,

            inscricao_estadual ||
              null,

            inscricao_municipal ||
              null,

            contato_nome.trim(),

            telefone ||
              null,

            tipo_atividade,

            setorFinal,

            observacoes ||
              null
          ]
        );


      empresaId =
        novaEmpresa.id;


      // ======================================================
      // PORTFÓLIO → SUPABASE STORAGE
      // ======================================================

      if (req.file) {

        await salvarDocumento(
          req.file,
          empresaId,
          'Portfólio',
          'portfolio'
        );

      }


      // ======================================================
      // SUCESSO
      // ======================================================

      return res.render(
        'cadastro/sucesso',
        {
          titulo:
            'Cadastro realizado',

          protocolo:
            empresaId,

          nome:
            razao_social,

          empreendimentoAtual: {
            nome:
              'UTE Tupã Fase I'
          }
        }
      );


    } catch (erro) {

      console.error(
        'Erro ao salvar Pessoa Jurídica:',
        erro
      );


      if (empresaId) {
        try {
          await db.query(
            `
              DELETE FROM terceirizados
              WHERE id = $1
            `,
            [
              empresaId
            ]
          );
        } catch (
          erroLimpeza
        ) {
          console.error(
            'Erro ao desfazer cadastro da empresa:',
            erroLimpeza
          );
        }
      }


      if (
        erro.code ===
        '23505'
      ) {
        return res
          .status(400)
          .render(
            'cadastro/pessoa-juridica',
            {
              titulo:
                'Cadastro de Pessoa Jurídica - UTE Tupã',

              erros: [
                {
                  msg:
                    'Este CNPJ já está cadastrado.'
                }
              ],

              valores:
                req.body || {}
            }
          );
      }


      return res
        .status(500)
        .render(
          'cadastro/pessoa-juridica',
          {
            titulo:
              'Cadastro de Pessoa Jurídica - UTE Tupã',

            erros: [
              {
                msg:
                  'Não foi possível realizar o cadastro. Tente novamente.'
              }
            ],

            valores:
              req.body || {}
          }
        );

    }

  }
);


module.exports = router;
