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


router.post('/login', (req, res) => {
  const email = String(
    req.body.email || ''
  )
    .trim()
    .toLowerCase();

  const senha = String(
    req.body.senha || ''
  );

  const usuario = db
    .prepare(`
      SELECT *
      FROM usuarios
      WHERE LOWER(email) = ?
      AND ativo = 1
    `)
    .get(email);

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

router.get('/', (req, res) => {
  const totalPF = db
    .prepare(`
      SELECT COUNT(*) AS total
      FROM terceirizados
      WHERE tipo = 'PF'
    `)
    .get()
    .total;

  const totalPJ = db
    .prepare(`
      SELECT COUNT(*) AS total
      FROM terceirizados
      WHERE tipo = 'PJ'
    `)
    .get()
    .total;

  res.render(
    'interno/index',
    {
      titulo:
        'Painel Administrativo',

      totalPF,

      totalPJ
    }
  );
});


// ============================================================
// PESSOAS FÍSICAS
// ============================================================

router.get(
  '/pessoas-fisicas',
  (req, res) => {

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


    const params = {};


    // --------------------------------------------------------
    // BUSCA
    // --------------------------------------------------------

    if (busca) {
      sql += `
        AND (
          t.razao_social LIKE @busca
          OR t.cpf_cnpj LIKE @busca
          OR t.email LIKE @busca
          OR t.telefone LIKE @busca
        )
      `;

      params.busca =
        `%${busca}%`;
    }


    // --------------------------------------------------------
    // CIDADE
    // --------------------------------------------------------

    if (cidade) {
      sql += `
        AND t.cidade LIKE @cidade
      `;

      params.cidade =
        `%${cidade}%`;
    }


    // --------------------------------------------------------
    // PROFISSÃO
    // --------------------------------------------------------

    if (profissao) {
      sql += `
        AND t.profissao LIKE @profissao
      `;

      params.profissao =
        `%${profissao}%`;
    }


    // --------------------------------------------------------
    // SITUAÇÃO
    // --------------------------------------------------------

    if (situacao) {
      sql += `
        AND t.situacao_cadastral = @situacao
      `;

      params.situacao =
        situacao;
    }


    sql += `
      ORDER BY t.criado_em DESC
    `;


    const pessoas =
      db
        .prepare(sql)
        .all(params);


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
  }
);


// ============================================================
// PESSOAS JURÍDICAS
// ============================================================

router.get(
  '/pessoas-juridicas',
  (req, res) => {

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


    const params = {};


    if (busca) {
      sql += `
        AND (
          t.razao_social LIKE @busca
          OR t.nome_fantasia LIKE @busca
          OR t.cpf_cnpj LIKE @busca
          OR t.email LIKE @busca
          OR t.contato_nome LIKE @busca
        )
      `;

      params.busca =
        `%${busca}%`;
    }


    if (cidade) {
      sql += `
        AND t.cidade LIKE @cidade
      `;

      params.cidade =
        `%${cidade}%`;
    }


    if (setor) {
      sql += `
        AND t.setor_atividade LIKE @setor
      `;

      params.setor =
        `%${setor}%`;
    }


    if (situacao) {
      sql += `
        AND t.situacao_cadastral = @situacao
      `;

      params.situacao =
        situacao;
    }


    sql += `
      ORDER BY t.criado_em DESC
    `;


    const empresas =
      db
        .prepare(sql)
        .all(params);


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
  }
);


// ============================================================
// DETALHE DO CADASTRO
// ============================================================

router.get(
  '/terceirizados/:id',
  (req, res) => {

    const terceirizado = db
      .prepare(`
        SELECT *
        FROM terceirizados
        WHERE id = ?
      `)
      .get(
        req.params.id
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


    const documentos = db
      .prepare(`
        SELECT *
        FROM documentos
        WHERE terceirizado_id = ?
        ORDER BY id DESC
      `)
      .all(
        terceirizado.id
      );


    const experiencia = db
      .prepare(`
        SELECT *
        FROM experiencias
        WHERE terceirizado_id = ?
      `)
      .get(
        terceirizado.id
      );


    const servicos = db
      .prepare(`
        SELECT
          COALESCE(
            s.nome,
            ts.servico_outro
          ) AS nome

        FROM terceirizado_servicos ts

        LEFT JOIN servicos s
          ON s.id = ts.servico_id

        WHERE ts.terceirizado_id = ?
      `)
      .all(
        terceirizado.id
      )
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
  }
);


// ============================================================
// ALTERAR SITUAÇÃO
// ============================================================

router.post(
  '/terceirizados/:id/situacao',
  (req, res) => {

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


    db.prepare(`
      UPDATE terceirizados

      SET
        situacao_cadastral = ?,
        atualizado_em = datetime('now')

      WHERE id = ?
    `)
    .run(
      situacao,
      req.params.id
    );


    res.redirect(
      `/interno/terceirizados/${req.params.id}`
    );
  }
);


// ============================================================
// DOWNLOAD DE CURRÍCULO / PORTFÓLIO
// ============================================================

router.get(
  '/documentos/:id/download',
  (req, res) => {

    const documento = db
      .prepare(`
        SELECT *
        FROM documentos
        WHERE id = ?
      `)
      .get(
        req.params.id
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
      caminhoAbsoluto !== pastaUploads &&
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
  }
);


module.exports = router;
