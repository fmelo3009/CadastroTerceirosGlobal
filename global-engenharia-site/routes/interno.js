const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const db = require('../lib/db');
const config = require('../config');
const { exigirLogin } = require('../lib/auth');


// ============================================================
// LOGIN
// ============================================================

router.get('/login', (req, res) => {
  const aviso = req.session.avisoLogin;

  req.session.avisoLogin = null;

  res.render('interno/login', {
    titulo: 'Área Administrativa',
    aviso,
    erro: null
  });
});


router.post('/login', async (req, res, next) => {
  try {

    const email = String(
      req.body.email || ''
    )
      .trim()
      .toLowerCase();

    const senha = String(
      req.body.senha || ''
    );


    const usuario =
      await db.get(
        `
          SELECT *
          FROM usuarios
          WHERE LOWER(email) = LOWER($1)
          AND ativo = TRUE
        `,
        [
          email
        ]
      );


    if (
      !usuario ||
      !bcrypt.compareSync(
        senha,
        usuario.senha_hash
      )
    ) {

      return res
        .status(401)
        .render(
          'interno/login',
          {
            titulo:
              'Área Administrativa',

            aviso:
              null,

            erro:
              'E-mail ou senha inválidos.'
          }
        );

    }


    req.session.usuario = {
      id:
        usuario.id,

      nome:
        usuario.nome,

      papel:
        usuario.papel
    };


    req.session.save((erro) => {

      if (erro) {

        console.error(
          'Erro ao salvar sessão:',
          erro
        );

        return res
          .status(500)
          .render(
            'interno/login',
            {
              titulo:
                'Área Administrativa',

              aviso:
                null,

              erro:
                'Não foi possível iniciar a sessão.'
            }
          );

      }


      return res.redirect(
        '/interno'
      );

    });


  } catch (erro) {

    console.error(
      'Erro no login:',
      erro
    );

    next(erro);

  }
});


// ============================================================
// LOGOUT
// ============================================================

router.get('/logout', (req, res) => {

  req.session.destroy((erro) => {

    if (erro) {

      console.error(
        'Erro ao encerrar sessão:',
        erro
      );

    }

    res.redirect(
      '/interno/login'
    );

  });

});


// ============================================================
// TODAS AS ROTAS ABAIXO EXIGEM LOGIN
// ============================================================

router.use(exigirLogin);


// ============================================================
// PAINEL PRINCIPAL
// ============================================================

router.get('/', async (req, res, next) => {

  try {

    const pf =
      await db.get(
        `
          SELECT COUNT(*)::int AS total
          FROM terceirizados
          WHERE tipo = 'PF'
        `
      );


    const pj =
      await db.get(
        `
          SELECT COUNT(*)::int AS total
          FROM terceirizados
          WHERE tipo = 'PJ'
        `
      );


    res.render(
      'interno/index',
      {
        titulo:
          'Painel Administrativo',

        totalPF:
          pf ? pf.total : 0,

        totalPJ:
          pj ? pj.total : 0
      }
    );


  } catch (erro) {

    console.error(
      'Erro ao carregar painel administrativo:',
      erro
    );

    next(erro);

  }

});


// ============================================================
// PESSOAS FÍSICAS
// ============================================================

router.get(
  '/pessoas-fisicas',
  async (req, res, next) => {

    try {

      const busca = String(
        req.query.busca || ''
      ).trim();

      const cidade = String(
        req.query.cidade || ''
      ).trim();

      const profissao = String(
        req.query.profissao || ''
      ).trim();

      const situacao = String(
        req.query.situacao || ''
      ).trim();


      let sql = `
        SELECT

          t.*,

          (
            SELECT d.id
            FROM documentos d
            WHERE d.terceirizado_id = t.id
            AND d.tipo_documento = 'Currículo'
            AND d.caminho_arquivo IS NOT NULL
            ORDER BY d.id DESC
            LIMIT 1
          ) AS documento_id

        FROM terceirizados t

        WHERE t.tipo = 'PF'
      `;


      const params = [];


      if (busca) {

        params.push(
          `%${busca}%`
        );

        sql += `
          AND (
            t.razao_social ILIKE $${params.length}
            OR t.cpf_cnpj ILIKE $${params.length}
            OR t.email ILIKE $${params.length}
            OR t.telefone ILIKE $${params.length}
          )
        `;

      }


      if (cidade) {

        params.push(
          `%${cidade}%`
        );

        sql += `
          AND t.cidade
          ILIKE $${params.length}
        `;

      }


      if (profissao) {

        params.push(
          `%${profissao}%`
        );

        sql += `
          AND t.profissao
          ILIKE $${params.length}
        `;

      }


      if (situacao) {

        params.push(
          situacao
        );

        sql += `
          AND t.situacao_cadastral
          = $${params.length}
        `;

      }


      sql += `
        ORDER BY t.criado_em DESC
      `;


      const pessoas =
        await db.all(
          sql,
          params
        );


      res.render(
        'interno/pessoas-fisicas',
        {
          titulo:
            'Pessoas Físicas',

          pessoas,

          situacoes:
            config.SITUACOES_CADASTRAIS,

          filtros: {
            busca,
            cidade,
            profissao,
            situacao
          },

          total:
            pessoas.length
        }
      );


    } catch (erro) {

      console.error(
        'Erro ao carregar Pessoas Físicas:',
        erro
      );

      next(erro);

    }

  }
);


// ============================================================
// PESSOAS JURÍDICAS
// ============================================================

router.get(
  '/pessoas-juridicas',
  async (req, res, next) => {

    try {

      const busca = String(
        req.query.busca || ''
      ).trim();

      const cidade = String(
        req.query.cidade || ''
      ).trim();

      const setor = String(
        req.query.setor || ''
      ).trim();

      const situacao = String(
        req.query.situacao || ''
      ).trim();


      let sql = `
        SELECT

          t.*,

          (
            SELECT d.id
            FROM documentos d
            WHERE d.terceirizado_id = t.id
            AND d.tipo_documento = 'Portfólio'
            AND d.caminho_arquivo IS NOT NULL
            ORDER BY d.id DESC
            LIMIT 1
          ) AS documento_id

        FROM terceirizados t

        WHERE t.tipo = 'PJ'
      `;


      const params = [];


      if (busca) {

        params.push(
          `%${busca}%`
        );

        sql += `
          AND (
            t.razao_social ILIKE $${params.length}
            OR t.nome_fantasia ILIKE $${params.length}
            OR t.cpf_cnpj ILIKE $${params.length}
            OR t.email ILIKE $${params.length}
            OR t.contato_nome ILIKE $${params.length}
          )
        `;

      }


      if (cidade) {

        params.push(
          `%${cidade}%`
        );

        sql += `
          AND t.cidade
          ILIKE $${params.length}
        `;

      }


      if (setor) {

        params.push(
          `%${setor}%`
        );

        sql += `
          AND t.setor_atividade
          ILIKE $${params.length}
        `;

      }


      if (situacao) {

        params.push(
          situacao
        );

        sql += `
          AND t.situacao_cadastral
          = $${params.length}
        `;

      }


      sql += `
        ORDER BY t.criado_em DESC
      `;


      const empresas =
        await db.all(
          sql,
          params
        );


      res.render(
        'interno/pessoas-juridicas',
        {
          titulo:
            'Pessoas Jurídicas',

          empresas,

          situacoes:
            config.SITUACOES_CADASTRAIS,

          filtros: {
            busca,
            cidade,
            setor,
            situacao
          },

          total:
            empresas.length
        }
      );


    } catch (erro) {

      console.error(
        'Erro ao carregar Pessoas Jurídicas:',
        erro
      );

      next(erro);

    }

  }
);


// ============================================================
// DETALHE DO CADASTRO
// ============================================================

router.get(
  '/terceirizados/:id',
  async (req, res, next) => {

    try {

      const terceirizado =
        await db.get(
          `
            SELECT *
            FROM terceirizados
            WHERE id = $1
          `,
          [
            req.params.id
          ]
        );


      if (!terceirizado) {

        return res
          .status(404)
          .render(
            'erro',
            {
              titulo:
                'Não encontrado',

              mensagem:
                'Cadastro não encontrado.'
            }
          );

      }


      const documentos =
        await db.all(
          `
            SELECT *
            FROM documentos
            WHERE terceirizado_id = $1
            ORDER BY id DESC
          `,
          [
            terceirizado.id
          ]
        );


      const experiencia =
        await db.get(
          `
            SELECT *
            FROM experiencias
            WHERE terceirizado_id = $1
          `,
          [
            terceirizado.id
          ]
        );


      const servicosBrutos =
        await db.all(
          `
            SELECT
              COALESCE(
                s.nome,
                ts.servico_outro
              ) AS nome

            FROM terceirizado_servicos ts

            LEFT JOIN servicos s
              ON s.id = ts.servico_id

            WHERE ts.terceirizado_id = $1
          `,
          [
            terceirizado.id
          ]
        );


      const servicos =
        servicosBrutos
          .map(
            registro =>
              registro.nome
          )
          .filter(Boolean);


      terceirizado.empreendimentoNome =
        'UTE Tupã Fase I';


      res.render(
        'interno/detalhe',
        {
          titulo:
            terceirizado.nome_fantasia ||
            terceirizado.razao_social,

          terceirizado,

          experiencia,

          servicos,

          documentos,

          situacoes:
            config.SITUACOES_CADASTRAIS
        }
      );


    } catch (erro) {

      console.error(
        'Erro ao carregar cadastro:',
        erro
      );

      next(erro);

    }

  }
);


// ============================================================
// ALTERAR SITUAÇÃO
// ============================================================

router.post(
  '/terceirizados/:id/situacao',
  async (req, res, next) => {

    try {

      const situacao =
        req.body.situacao;


      if (
        !config.SITUACOES_CADASTRAIS
          .includes(situacao)
      ) {

        return res.redirect(
          `/interno/terceirizados/${req.params.id}`
        );

      }


      await db.query(
        `
          UPDATE terceirizados

          SET
            situacao_cadastral = $1,
            atualizado_em = NOW()

          WHERE id = $2
        `,
        [
          situacao,
          req.params.id
        ]
      );


      res.redirect(
        `/interno/terceirizados/${req.params.id}`
      );


    } catch (erro) {

      console.error(
        'Erro ao alterar situação cadastral:',
        erro
      );

      next(erro);

    }

  }
);


// ============================================================
// DOWNLOAD DE CURRÍCULO / PORTFÓLIO
// AINDA LOCAL NESTA ETAPA
// ============================================================

router.get(
  '/documentos/:id/download',
  async (req, res, next) => {

    try {

      const documento =
        await db.get(
          `
            SELECT *
            FROM documentos
            WHERE id = $1
          `,
          [
            req.params.id
          ]
        );


      if (
        !documento ||
        !documento.caminho_arquivo
      ) {

        return res
          .status(404)
          .render(
            'erro',
            {
              titulo:
                'Arquivo não encontrado',

              mensagem:
                'Este cadastro não possui arquivo anexado.'
            }
          );

      }


      const pastaUploads =
        path.resolve(
          config.UPLOADS_PATH
        );


      const caminhoAbsoluto =
        path.resolve(
          config.UPLOADS_PATH,
          documento.caminho_arquivo
        );


      if (
        caminhoAbsoluto !==
          pastaUploads &&
        !caminhoAbsoluto.startsWith(
          `${pastaUploads}${path.sep}`
        )
      ) {

        return res
          .status(400)
          .render(
            'erro',
            {
              titulo:
                'Caminho inválido',

              mensagem:
                'Não foi possível acessar este arquivo.'
            }
          );

      }


      if (
        !fs.existsSync(
          caminhoAbsoluto
        )
      ) {

        return res
          .status(404)
          .render(
            'erro',
            {
              titulo:
                'Arquivo não encontrado',

              mensagem:
                'O arquivo não foi localizado no servidor.'
            }
          );

      }


      res.download(
        caminhoAbsoluto,

        documento.nome_arquivo_original ||
          path.basename(
            caminhoAbsoluto
          )
      );


    } catch (erro) {

      console.error(
        'Erro ao baixar documento:',
        erro
      );

      next(erro);

    }

  }
);


module.exports = router;
