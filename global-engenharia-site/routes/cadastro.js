const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { body, validationResult } = require('express-validator');

const db = require('../lib/db');
const config = require('../config');


// ---------------------------------------------------------------------------
// UPLOAD TEMPORÁRIO
// ---------------------------------------------------------------------------

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

    const permitidos =
      /pdf|jpg|jpeg|png|doc|docx/i;

    const ok =
      permitidos.test(
        path.extname(file.originalname)
      );

    if (!ok) {

      return cb(
        new Error(
          'Tipo de arquivo não permitido. Envie PDF, JPG, PNG, DOC ou DOCX.'
        )
      );

    }

    cb(null, true);

  }

});


// ---------------------------------------------------------------------------
// FUNÇÕES DO CADASTRO ANTIGO
// ---------------------------------------------------------------------------

function buscarEmpreendimento(slug) {

  if (!slug) return null;

  return config.EMPREENDIMENTOS.find(
    (e) => e.slug === slug
  ) || null;

}


function carregarDadosFormulario(slug) {

  const servicos = db
    .prepare(
      'SELECT * FROM servicos ORDER BY nome'
    )
    .all();

  return {

    servicos,

    estados:
      config.ESTADOS_BR,

    tiposDocumento:
      config.TIPOS_DOCUMENTO,

    empreendimentos:
      config.EMPREENDIMENTOS,

    empreendimentoAtual:
      buscarEmpreendimento(slug)

  };

}


// ---------------------------------------------------------------------------
// VALIDAÇÕES DO CADASTRO ANTIGO
// ---------------------------------------------------------------------------

const validacoesCadastro = [

  body('tipo')
    .isIn(['PJ', 'PF'])
    .withMessage(
      'Selecione o tipo de cadastro.'
    ),

  body('razao_social')
    .trim()
    .notEmpty()
    .withMessage(
      'Informe o nome / razão social.'
    ),

  body('cpf_cnpj')
    .trim()
    .notEmpty()
    .withMessage(
      'Informe o CPF ou CNPJ.'
    ),

  body('cidade')
    .trim()
    .notEmpty()
    .withMessage(
      'Informe a cidade.'
    ),

  body('estado')
    .trim()
    .isLength({
      min: 2,
      max: 2
    })
    .withMessage(
      'Selecione o estado.'
    ),

  body().custom(
    (value, { req }) => {

      if (
        !req.body.telefone &&
        !req.body.email
      ) {

        throw new Error(
          'Informe ao menos um telefone ou e-mail para contato.'
        );

      }

      return true;

    }
  )

];


// ---------------------------------------------------------------------------
// PROCESSAMENTO DO CADASTRO ANTIGO
// ---------------------------------------------------------------------------

function processarCadastro(req, res) {

  const slugRota =
    req.params.slug || null;


  const empreendimentoSlug =
    slugRota ||
    (
      req.body.empreendimento ||
      null
    );


  const empreendimentoValido =
    empreendimentoSlug
      ? buscarEmpreendimento(
          empreendimentoSlug
        )
      : true;


  const dadosFormulario =
    carregarDadosFormulario(
      empreendimentoSlug
    );


  const resultado =
    validationResult(req);


  if (
    !resultado.isEmpty() ||
    (
      empreendimentoSlug &&
      !empreendimentoValido
    )
  ) {

    (req.files || []).forEach(
      (f) =>
        fs.unlink(
          f.path,
          () => {}
        )
    );


    const erros =
      resultado.array();


    if (
      empreendimentoSlug &&
      !empreendimentoValido
    ) {

      erros.push({
        msg:
          'Empreendimento inválido.'
      });

    }


    return res
      .status(400)
      .render(
        'cadastro/form',
        {

          titulo:
            'Cadastro de Terceirizados',

          ...dadosFormulario,

          valores:
            req.body,

          erros

        }
      );

  }


  try {

    const b =
      req.body;


    const cpfCnpjLimpo =
      String(
        b.cpf_cnpj
      ).replace(
        /\D/g,
        ''
      );


    const jaExiste =
      db
        .prepare(
          `
          SELECT id
          FROM terceirizados
          WHERE cpf_cnpj = ?
          `
        )
        .get(
          cpfCnpjLimpo
        );


    if (jaExiste) {

      (req.files || [])
        .forEach(
          (f) =>
            fs.unlink(
              f.path,
              () => {}
            )
        );


      return res
        .status(400)
        .render(
          'cadastro/form',
          {

            titulo:
              'Cadastro de Terceirizados',

            ...dadosFormulario,

            valores:
              b,

            erros: [
              {
                msg:
                  'Já existe um cadastro com este CPF/CNPJ. Entre em contato conosco se precisar atualizar seus dados.'
              }
            ]

          }
        );

    }


    let novoId;


    const transacao =
      db.transaction(
        () => {


          const infoTerceirizado =
            db
              .prepare(
                `
                INSERT INTO terceirizados
                (
                  empreendimento,
                  tipo,
                  razao_social,
                  nome_fantasia,
                  cpf_cnpj,
                  inscricao_estadual,
                  inscricao_municipal,
                  telefone,
                  whatsapp,
                  email,
                  endereco,
                  complemento,
                  cep,
                  cidade,
                  estado,
                  contato_nome,
                  contato_telefone,
                  setor_atividade,
                  observacoes,
                  situacao_cadastral
                )

                VALUES
                (
                  @empreendimento,
                  @tipo,
                  @razao_social,
                  @nome_fantasia,
                  @cpf_cnpj,
                  @inscricao_estadual,
                  @inscricao_municipal,
                  @telefone,
                  @whatsapp,
                  @email,
                  @endereco,
                  @complemento,
                  @cep,
                  @cidade,
                  @estado,
                  @contato_nome,
                  @contato_telefone,
                  @setor_atividade,
                  @observacoes,
                  'Pendente de análise'
                )
                `
              )
              .run(
                {

                  empreendimento:
                    empreendimentoSlug ||
                    null,

                  tipo:
                    b.tipo,

                  razao_social:
                    b.razao_social,

                  nome_fantasia:
                    b.nome_fantasia ||
                    null,

                  cpf_cnpj:
                    cpfCnpjLimpo,

                  inscricao_estadual:
                    b.inscricao_estadual ||
                    null,

                  inscricao_municipal:
                    b.inscricao_municipal ||
                    null,

                  telefone:
                    b.telefone ||
                    null,

                  whatsapp:
                    b.whatsapp ||
                    null,

                  email:
                    b.email ||
                    null,

                  endereco:
                    b.endereco ||
                    null,

                  complemento:
                    b.complemento ||
                    null,

                  cep:
                    b.cep ||
                    null,

                  cidade:
                    b.cidade,

                  estado:
                    b.estado
                      .toUpperCase(),

                  contato_nome:
                    b.contato_nome ||
                    null,

                  contato_telefone:
                    b.contato_telefone ||
                    null,

                  setor_atividade:
                    b.setor_atividade ||
                    null,

                  observacoes:
                    b.observacoes ||
                    null

                }
              );


          novoId =
            infoTerceirizado
              .lastInsertRowid;


          const servicosSelecionados =
            []
              .concat(
                b['servicos_ids[]'] ||
                b.servicos_ids ||
                []
              )
              .filter(
                Boolean
              );


          const insertServico =
            db.prepare(
              `
              INSERT INTO terceirizado_servicos
              (
                terceirizado_id,
                servico_id,
                servico_outro
              )

              VALUES
              (
                ?,
                ?,
                NULL
              )
              `
            );


          servicosSelecionados
            .forEach(
              (sid) =>
                insertServico
                  .run(
                    novoId,
                    Number(sid)
                  )
            );


          if (
            b.outros_servicos &&
            b.outros_servicos.trim()
          ) {

            const insertOutro =
              db.prepare(
                `
                INSERT INTO terceirizado_servicos
                (
                  terceirizado_id,
                  servico_id,
                  servico_outro
                )

                VALUES
                (
                  ?,
                  NULL,
                  ?
                )
                `
              );


            b.outros_servicos
              .split(',')
              .map(
                (s) =>
                  s.trim()
              )
              .filter(
                Boolean
              )
              .forEach(
                (nome) =>
                  insertOutro.run(
                    novoId,
                    nome
                  )
              );

          }


          db.prepare(
            `
            INSERT INTO experiencias
            (
              terceirizado_id,
              tempo_experiencia,
              area_atuacao,
              principais_atividades,
              empresas_projetos_anteriores,
              principais_competencias,
              certificacoes
            )

            VALUES
            (
              ?,
              ?,
              ?,
              ?,
              ?,
              ?,
              ?
            )
            `
          )
          .run(

            novoId,

            b.tempo_experiencia ||
            null,

            b.area_atuacao ||
            null,

            b.principais_atividades ||
            null,

            b.empresas_projetos_anteriores ||
            null,

            b.principais_competencias ||
            null,

            b.certificacoes ||
            null

          );


          let metaDocumentos =
            [];

          try {

            metaDocumentos =
              JSON.parse(
                b.documentos_meta ||
                '[]'
              );

          } catch (e) {

            metaDocumentos =
              [];

          }


          const insertDoc =
            db.prepare(
              `
              INSERT INTO documentos
              (
                terceirizado_id,
                tipo_documento,
                nome_arquivo_original,
                caminho_arquivo,
                status,
                data_validade
              )

              VALUES
              (
                ?,
                ?,
                ?,
                ?,
                ?,
                ?
              )
              `
            );


          const pastaFinal =
            path.join(

              config.UPLOADS_PATH,

              'terceirizados',

              String(novoId)

            );


          if (
            !fs.existsSync(
              pastaFinal
            )
          ) {

            fs.mkdirSync(
              pastaFinal,
              {
                recursive:
                  true
              }
            );

          }


          metaDocumentos
            .forEach(
              (meta) => {

                if (
                  !meta.tipo
                ) {
                  return;
                }


                const arquivoEnviado =
                  (req.files || [])
                    .find(
                      (f) =>
                        f.fieldname ===
                        meta.campo
                    );


                if (
                  arquivoEnviado
                ) {

                  const destino =
                    path.join(

                      pastaFinal,

                      path.basename(
                        arquivoEnviado.path
                      )

                    );


                  fs.renameSync(
                    arquivoEnviado.path,
                    destino
                  );


                  insertDoc.run(

                    novoId,

                    meta.tipo,

                    arquivoEnviado
                      .originalname,

                    path.relative(
                      config.UPLOADS_PATH,
                      destino
                    ),

                    'Enviado',

                    meta.validade ||
                    null

                  );

                } else {

                  insertDoc.run(

                    novoId,

                    meta.tipo,

                    null,

                    null,

                    'Pendente',

                    meta.validade ||
                    null

                  );

                }

              }
            );


          (req.files || [])
            .filter(
              (f) =>
                fs.existsSync(
                  f.path
                )
            )
            .forEach(
              (f) =>
                fs.unlink(
                  f.path,
                  () => {}
                )
            );

        }
      );


    transacao();


    return res.render(
      'cadastro/sucesso',
      {

        titulo:
          'Cadastro enviado',

        protocolo:
          novoId,

        nome:
          b.nome_fantasia ||
          b.razao_social,

        empreendimentoAtual:
          dadosFormulario
            .empreendimentoAtual

      }
    );


  } catch (err) {

    console.error(
      'Erro ao salvar cadastro de terceirizado:',
      err
    );


    (req.files || [])
      .forEach(
        (f) =>
          fs.existsSync(
            f.path
          ) &&
          fs.unlink(
            f.path,
            () => {}
          )
      );


    return res
      .status(500)
      .render(
        'cadastro/form',
        {

          titulo:
            'Cadastro de Terceirizados',

          ...dadosFormulario,

          valores:
            req.body,

          erros: [
            {
              msg:
                'Ocorreu um erro ao salvar seu cadastro. Tente novamente em instantes.'
            }
          ]

        }
      );

  }

}


// ===========================================================================
// CADASTRO GERAL ANTIGO
// ===========================================================================

router.get(
  '/',
  (req, res) => {

    const dados =
      carregarDadosFormulario(
        null
      );


    res.render(
      'cadastro/form',
      {

        titulo:
          'Cadastro de Terceirizados',

        ...dados,

        valores:
          {},

        erros:
          []

      }
    );

  }
);


router.post(
  '/',
  upload.any(),
  validacoesCadastro,
  processarCadastro
);


// ===========================================================================
// CADASTRO - PESSOA FÍSICA
// ===========================================================================

router.get(
  '/pessoa-fisica',
  (req, res) => {

    res.render(
      'cadastro/pessoa-fisica',
      {

        titulo:
          'Cadastro de Pessoa Física - UTE Tupã',

        valores:
          {},

        erros:
          []

      }
    );

  }
);


// ---------------------------------------------------------------------------
// SALVAR PESSOA FÍSICA
// ---------------------------------------------------------------------------

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

  (req, res) => {


    const resultado =
      validationResult(
        req
      );


    if (
      !resultado.isEmpty()
    ) {


      if (
        req.file &&
        fs.existsSync(
          req.file.path
        )
      ) {

        fs.unlinkSync(
          req.file.path
        );

      }


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


      const cpfLimpo =
        String(
          b.cpf ||
          ''
        ).replace(
          /\D/g,
          ''
        );


      const jaExiste =
        db
          .prepare(
            `
            SELECT id
            FROM terceirizados
            WHERE cpf_cnpj = ?
            `
          )
          .get(
            cpfLimpo
          );


      if (
        jaExiste
      ) {


        if (
          req.file &&
          fs.existsSync(
            req.file.path
          )
        ) {

          fs.unlinkSync(
            req.file.path
          );

        }


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


      let municipioFinal =
        b.municipio;


      if (
        b.municipio ===
          'Outro' &&
        b.municipio_outro &&
        b.municipio_outro.trim()
      ) {

        municipioFinal =
          b.municipio_outro
            .trim();

      }


      let profissaoFinal =
        b.profissao;


      if (
        b.profissao ===
          'Outros' &&
        b.outra_profissao &&
        b.outra_profissao.trim()
      ) {

        profissaoFinal =
          b.outra_profissao
            .trim();

      }


      const info =
        db
          .prepare(
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
            `
          )
          .run(
            {

              nome:
                b.nome.trim(),

              cpf:
                cpfLimpo,

              telefone:
                b.telefone ||
                null,

              telefone_secundario:
                b.telefone_secundario ||
                null,

              email:
                b.email ||
                null,

              cep:
                b.cep ||
                null,

              endereco:
                b.endereco ||
                null,

              complemento:
                b.complemento ||
                null,

              cidade:
                municipioFinal,

              sexo:
                b.sexo ||
                null,

              profissao:
                profissaoFinal,

              observacoes:
                b.observacoes ||
                null

            }
          );


      const novoId =
        info.lastInsertRowid;


      // ---------------------------------------------------------
      // SALVAR CURRÍCULO
      // ---------------------------------------------------------

      if (
        req.file
      ) {


        const pastaFinal =
          path.join(

            config.UPLOADS_PATH,

            'terceirizados',

            String(novoId)

          );


        if (
          !fs.existsSync(
            pastaFinal
          )
        ) {

          fs.mkdirSync(
            pastaFinal,
            {
              recursive:
                true
            }
          );

        }


        const nomeArquivo =
          path.basename(
            req.file.path
          );


        const destino =
          path.join(

            pastaFinal,

            nomeArquivo

          );


        fs.renameSync(
          req.file.path,
          destino
        );


        db.prepare(
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
            ?,
            ?,
            ?,
            ?,
            ?
          )
          `
        )
        .run(

          novoId,

          'Currículo',

          req.file
            .originalname,

          path.relative(
            config.UPLOADS_PATH,
            destino
          ),

          'Enviado'

        );

      }


      return res.render(
        'cadastro/sucesso',
        {

          titulo:
            'Cadastro enviado',

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


    } catch (err) {


      console.error(
        'Erro ao salvar Pessoa Física:',
        err
      );


      if (
        req.file &&
        fs.existsSync(
          req.file.path
        )
      ) {

        fs.unlinkSync(
          req.file.path
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
                  'Ocorreu um erro ao salvar o cadastro. Tente novamente.'
              }
            ]

          }
        );

    }

  }

);


// ===========================================================================
// CADASTRO - PESSOA JURÍDICA
// ===========================================================================

router.get(
  '/pessoa-juridica',
  (req, res) => {

    res.render(
      'cadastro/pessoa-juridica',
      {

        titulo:
          'Cadastro de Pessoa Jurídica - UTE Tupã',

        valores:
          {},

        erros:
          []

      }
    );

  }
);


// ===========================================================================
// ROTAS ANTIGAS COM SLUG
// IMPORTANTE: PRECISAM FICAR DEPOIS DE PESSOA-FISICA E PESSOA-JURIDICA
// ===========================================================================

router.get(
  '/:slug',
  (req, res, next) => {


    const emp =
      buscarEmpreendimento(
        req.params.slug
      );


    if (
      !emp
    ) {

      return next();

    }


    const dados =
      carregarDadosFormulario(
        req.params.slug
      );


    res.render(
      'cadastro/form',
      {

        titulo:
          `Cadastro de Terceirizados · ${emp.nome}`,

        ...dados,

        valores:
          {},

        erros:
          []

      }
    );

  }
);


router.post(
  '/:slug',
  upload.any(),
  validacoesCadastro,
  processarCadastro
);


module.exports = router;
