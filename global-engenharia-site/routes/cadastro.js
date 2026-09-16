const express = require('express');
const router = express.Router();
const multer = require('multer');
const { body, validationResult } = require('express-validator');

const db = require('../lib/db');
const supabase = require('../lib/supabase');


// ============================================================
// CONFIGURAÇÃO DE UPLOAD
// ARQUIVO FICA EM MEMÓRIA ATÉ SER ENVIADO AO SUPABASE
// ============================================================

const upload = multer({

  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {

    const nomeArquivo =
      String(file.originalname || '');

    const extensao =
      nomeArquivo
        .split('.')
        .pop()
        .toLowerCase();

    const permitidos = [
      'pdf',
      'jpg',
      'jpeg',
      'png',
      'doc',
      'docx'
    ];

    if (!permitidos.includes(extensao)) {

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
// FUNÇÃO PARA ENVIAR DOCUMENTO AO SUPABASE STORAGE
// ============================================================

async function enviarDocumentoSupabase(
  file,
  terceirizadoId,
  prefixo
) {

  if (!file) {
    return null;
  }


  const extensao =
    String(file.originalname || '')
      .split('.')
      .pop()
      .toLowerCase();


  const nomeArquivo =
    `${prefixo}-${Date.now()}.${extensao}`;


  const caminhoArquivo =
    `terceirizados/${terceirizadoId}/${nomeArquivo}`;


  const {
    data,
    error
  } = await supabase
    .storage
    .from('documentos')
    .upload(
      caminhoArquivo,
      file.buffer,
      {
        contentType:
          file.mimetype ||
          'application/octet-stream',

        upsert: false
      }
    );


  if (error) {

    console.error(
      'Erro no Supabase Storage:',
      error
    );

    throw error;

  }


  return {
    caminhoBanco: data.path,
    nomeArquivo
  };

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

  upload.single('curriculo'),

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

            b.sexo ||
              null,

            profissaoFinal,

            b.observacoes ||
              null

          ]
        );


      const novoId =
        novoCadastro.id;


      // ======================================================
      // CURRÍCULO
      // SUPABASE STORAGE
      // ======================================================

      if (
        req.file
      ) {

        try {

          const arquivo =
            await enviarDocumentoSupabase(
              req.file,
              novoId,
              'curriculo'
            );


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

              novoId,

              'Currículo',

              req.file.originalname,

              arquivo.caminhoBanco,

              'Enviado'

            ]
          );


        } catch (
          erroArquivo
        ) {

          console.error(
            'Erro ao salvar currículo no Supabase Storage:',
            erroArquivo
          );

        }

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


      // Violação UNIQUE PostgreSQL
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


      if (
        !municipio
      ) {

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


      if (
        !cnpj
      ) {

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


      if (
        !telefone
      ) {

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
        !tipo_atividade
      ) {

        erros.push({
          msg:
            'Informe o tipo de atividade.'
        });

      }


      if (
        !setor_atividade
      ) {

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
      // VERIFICAR DUPLICIDADE
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


      const empresaId =
        novaEmpresa.id;


      // ======================================================
      // PORTFÓLIO
      // SUPABASE STORAGE
      // ======================================================

      if (
        req.file
      ) {

        try {

          const arquivo =
            await enviarDocumentoSupabase(
              req.file,
              empresaId,
              'portfolio'
            );


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

              empresaId,

              'Portfólio',

              req.file.originalname,

              arquivo.caminhoBanco,

              'Enviado'

            ]
          );


        } catch (
          erroArquivo
        ) {

          console.error(
            'Erro ao salvar portfólio no Supabase Storage:',
            erroArquivo
          );

        }

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
