const express = require('express');
const router = express.Router();
const config = require('../config');
const db = require('../lib/db');

router.get('/', (req, res) => {
  const servicos = db.prepare('SELECT * FROM servicos ORDER BY id LIMIT 8').all();
  res.render('public/home', {
    titulo: 'Início',
    servicos,
    empreendimentos: config.EMPREENDIMENTOS,
    linkGPE: config.LINK_GPE,
  });
});

router.get('/sobre', (req, res) => {
  res.render('public/sobre', { titulo: 'Sobre a empresa' });
});

router.get('/servicos', (req, res) => {
  const servicos = db.prepare('SELECT * FROM servicos ORDER BY nome').all();
  res.render('public/servicos', { titulo: 'Serviços e Atuação', servicos });
});

router.get('/contato', (req, res) => {
  res.render('public/contato', { titulo: 'Contato', empresa: config.EMPRESA });
});

module.exports = router;
