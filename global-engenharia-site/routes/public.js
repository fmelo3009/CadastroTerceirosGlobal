const express = require('express');
const router = express.Router();
const config = require('../config');
const db = require('../lib/db');


// ============================================================
// PÁGINA INICIAL
// ============================================================

router.get('/', async (req, res, next) => {
  try {

    const servicos = await db.all(`
      SELECT *
      FROM servicos
      ORDER BY id
      LIMIT 8
    `);

    res.render('public/home', {
      titulo: 'Início',
      servicos,
      empreendimentos: config.EMPREENDIMENTOS,
      linkGPE: config.LINK_GPE
    });

  } catch (erro) {

    console.error(
      'Erro ao carregar página inicial:',
      erro
    );

    next(erro);
  }
});


// ============================================================
// SOBRE
// ============================================================

router.get('/sobre', (req, res) => {

  res.redirect(
    'https://globalparticipacoesenergia.com.br/'
  );

});


// ============================================================
// SERVIÇOS
// ============================================================

router.get('/servicos', async (req, res, next) => {
  try {

    const servicos = await db.all(`
      SELECT *
      FROM servicos
      ORDER BY nome
    `);

    res.render('public/servicos', {
      titulo: 'Serviços e Atuação',
      servicos
    });

  } catch (erro) {

    console.error(
      'Erro ao carregar serviços:',
      erro
    );

    next(erro);
  }
});


// ============================================================
// CONTATO
// ============================================================

router.get('/contato', (req, res) => {

  return res.redirect(
    'https://globalparticipacoesenergia.com.br/contato/'
  );

});


module.exports = router;
