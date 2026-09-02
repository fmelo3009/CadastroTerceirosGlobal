const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { body, validationResult } = require('express-validator');

const db = require('../lib/db');
const config = require('../config');


// ============================================================
// UPLOAD TEMPORÁRIO
// ============================================================

const tmpDir = path.join(config.UPLOADS_PATH, 'tmp');

if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tmpDir);
  },

  filename: (req, file, cb) => {
    const nomeSeguro = file.originalname.replace(
      /[^a-zA-Z0-9.\-_]/g,
      '_'
    );

    cb(
      null,
      `${Date.now()}-${Math.round(Math.random() * 1e6)}-${nomeSeguro}`
    );
  }
});

const upload = multer({
  storage,

  limits: {
    fileSize:
      config.MAX_UPLOAD_SIZE_MB *
      1024 *
      1024
  },

  fileFilter: (req, file, cb) => {
    const permitidos = /pdf|jpg|jpeg|png|doc|docx/i;

    const extensao = path.extname(
      file.originalname
    );

    if (!permitidos.test(extensao)) {
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
// FUNÇÕES AUXILIARES
// ============================================================

function apagarArquivoTemporario(file) {
  if (
    file &&
    file.path &&
    fs.existsSync(file.path)
  ) {
    try {
      fs.unlinkSync(file.path);
    } catch (erro) {
      console.error(
        'Erro ao excluir arquivo temporário:',
        erro
      );
    }
  }
}


function moverArquivoParaCadastro(
  file,
  terceirizadoId,
  prefixo
) {
  const pastaFinal = path.join(
    config.UPLOADS_PATH,
    'terceirizados',
    String(terceirizadoId)
  );

  if (!fs.existsSync(pastaFinal)) {
    fs.mkdirSync(
      pastaFinal,
      { recursive: true }
    );
  }

  const extensao = path.extname(
    file.originalname
  );

  const nomeArquivo =
    `${prefixo}-${Date.now()}${extensao}`;

  const destino = path.join(
    pastaFinal,
    nomeArquivo
  );

  fs.renameSync(
    file.path,
    destino
  );

  return {
    destino,

    caminhoBanco: path
      .relative(
        config.UPLOADS_PATH,
        destino
      )
      .replace(/\\/g, '/')
  };
}


// ============================================================
// PÁGINA PRINCIPAL DO CADASTRO
// ============================================================

router.get('/', (req, res) => {
  res.redirect('/#cadastro');
});


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

  (req, res) => {
    const resultado =
      validationResult(req);

    if (!resultado.isEmpty()) {
      apagarArquivoTemporario(
        req.file
      );

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
      const b = req.body;

      const cpfLimpo =
        String(
          b.cpf || ''
        ).replace(
          /\D/g,
          ''
        );

      if (cpfLimpo.length !== 11) {
        apagarArquivoTemporario(
          req.file
        );

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


      // --------------------------------------------------------
      // VERIFICAR CPF DUPLICADO
      // --------------------------------------------------------

      const jaExiste = db
        .prepare(`
          SELECT id
          FROM terceirizados
          WHERE cpf_cnpj = ?
        `)
        .get(
          cpfLimpo
        );

      if (jaExiste) {
        apagarArquivoTemporario(
          req.file
        );

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


      // --------------------------------------------------------
      // MUNICÍPIO
      // --------------------------------------------------------

      let municipioFinal =
        b.municipio;

      if (
        b.municipio === 'Outro'
      ) {
        if (
          !b.municipio_outro ||
          !b.municipio_outro.trim()
        ) {
          apagarArquivoTemporario(
            req.file
          );

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


      // --------------------------------------------------------
      // PROFISSÃO
      // --------------------------------------------------------

      let profissaoFinal =
        b.profissao;

      if (
        b.profissao === 'Outros'
      ) {
        if (
          !b.outra_profissao ||
          !b.outra_profissao.trim()
        ) {
          apagarArquivoTemporario(
            req.file
          );

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


      // --------------------------------------------------------
      // TRANSAÇÃO
      // --------------------------------------------------------

      let novoId;

      const transacao =
        db.transaction(() => {

          const info = db
            .prepare(`
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
                @nome,
                @cpf,

                @telefone,
                @telefone_secundario,
                @email,

                @cep,
                @endereco,
                @complemento,
                @cidade,

                @sexo,
                @profissao,

                @observacoes,
                'Pendente de análise'
              )
            `)
            .run({
              nome:
                b.nome.trim(),

              cpf:
                cpfLimpo,

              telefone:
                b.telefone || null,

              telefone_secundario:
                b.telefone_secundario ||
                null,

              email:
                b.email
                  ? b.email.trim()
                  : null,

              cep:
                b.cep || null,

              endereco:
                b.endereco || null,

              complemento:
                b.complemento || null,

              cidade:
                municipioFinal,

              sexo:
                b.sexo || null,

              profissao:
                profissaoFinal,

              observacoes:
                b.observacoes || null
            });

          novoId =
            info.lastInsertRowid;
        });

      transacao();


      // --------------------------------------------------------
      // CURRÍCULO
      // --------------------------------------------------------

      if (req.file) {
        try {
          const arquivo =
            moverArquivoParaCadastro(
              req.file,
              novoId,
              'curriculo'
            );

          db.prepare(`
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
              ?,
              ?,
              ?,
              ?,
              ?
            )
          `)
          .run(
            novoId,
            'Currículo',
            req.file.originalname,
            arquivo.caminhoBanco,
            'Enviado'
          );

        } catch (erroArquivo) {
          console.error(
            'Erro ao salvar currículo:',
            erroArquivo
          );
        }
      }


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

      apagarArquivoTemporario(
        req.file
      );

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

  upload.single('portfolio'),

  (req, res) => {
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


      // --------------------------------------------------------
      // VALIDAÇÕES
      // --------------------------------------------------------

      const erros = [];

      if (!municipio) {
        erros.push({
          msg:
            'Informe o município.'
        });
      }

      if (
        municipio === 'Outro' &&
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


      // --------------------------------------------------------
      // CNPJ
      // --------------------------------------------------------

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


      if (erros.length > 0) {
        apagarArquivoTemporario(
          req.file
        );

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


      // --------------------------------------------------------
      // DUPLICIDADE
      // --------------------------------------------------------

      const empresaExistente =
        db
          .prepare(`
            SELECT id
            FROM terceirizados
            WHERE cpf_cnpj = ?
          `)
          .get(
            cnpjLimpo
          );

      if (empresaExistente) {
        apagarArquivoTemporario(
          req.file
        );

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


      // --------------------------------------------------------
      // MUNICÍPIO
      // --------------------------------------------------------

      const municipioFinal =
        municipio === 'Outro'
          ? municipio_outro.trim()
          : municipio;


      // --------------------------------------------------------
      // SETOR
      // --------------------------------------------------------

      const setorFinal =
        setor_atividade ===
          'Outros'
          ? outro_setor.trim()
          : setor_atividade;


      // --------------------------------------------------------
      // TRANSAÇÃO
      // --------------------------------------------------------

      let empresaId;

      const transacao =
        db.transaction(() => {

          const resultado = db
            .prepare(`
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

                @razao_social,
                @nome_fantasia,
                @cnpj,

                @telefone,
                @telefone_secundario,
                @email,

                @cep,
                @endereco,
                @complemento,

                @cidade,
                @estado,

                @capital_social,
                @regime_tributario,

                @inscricao_estadual,
                @inscricao_municipal,

                @contato_nome,
                @contato_telefone,

                @tipo_atividade,
                @setor_atividade,

                @observacoes,

                'Pendente de análise'
              )
            `)
            .run({
              razao_social:
                razao_social.trim(),

              nome_fantasia:
                nome_fantasia
                  ? nome_fantasia.trim()
                  : null,

              cnpj:
                cnpjLimpo,

              telefone:
                telefone || null,

              telefone_secundario:
                telefone_secundario ||
                null,

              email:
                email
                  ? email.trim()
                  : null,

              cep:
                cep || null,

              endereco:
                endereco || null,

              complemento:
                complemento || null,

              cidade:
                municipioFinal,

              estado:
                'RJ',

              capital_social:
                capital_social || null,

              regime_tributario:
                regime_tributario ||
                null,

              inscricao_estadual:
                inscricao_estadual ||
                null,

              inscricao_municipal:
                inscricao_municipal ||
                null,

              contato_nome:
                contato_nome.trim(),

              contato_telefone:
                telefone || null,

              tipo_atividade,

              setor_atividade:
                setorFinal,

              observacoes:
                observacoes || null
            });

          empresaId =
            resultado.lastInsertRowid;
        });

      transacao();


      // --------------------------------------------------------
      // PORTFÓLIO
      // --------------------------------------------------------

      if (req.file) {
        try {
          const arquivo =
            moverArquivoParaCadastro(
              req.file,
              empresaId,
              'portfolio'
            );

          db.prepare(`
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
              ?,
              ?,
              ?,
              ?,
              ?
            )
          `)
          .run(
            empresaId,
            'Portfólio',
            req.file.originalname,
            arquivo.caminhoBanco,
            'Enviado'
          );

        } catch (erroArquivo) {
          console.error(
            'Erro ao salvar portfólio:',
            erroArquivo
          );
        }
      }


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

      apagarArquivoTemporario(
        req.file
      );

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
