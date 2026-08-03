const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../lib/db');
const { exigirLogin } = require('../lib/auth');

// NOTA: esta rota é um placeholder mínimo. A área interna completa
// (dashboard, listagem de terceirizados, seleção, etc.) fica para a
// próxima etapa do projeto — aqui existe só o necessário para login
// funcionar e o servidor não quebrar, sem alterar nada do banco/backend.

router.get('/login', (req, res) => {
  const aviso = req.session.avisoLogin;
  req.session.avisoLogin = null;
  res.render('interno/login', { titulo: 'Área interna', aviso, erro: null });
});

router.post('/login', (req, res) => {
  const { email, senha } = req.body;
  const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ? AND ativo = 1').get(email);

  if (!usuario || !bcrypt.compareSync(senha || '', usuario.senha_hash)) {
    return res.status(401).render('interno/login', {
      titulo: 'Área interna',
      aviso: null,
      erro: 'E-mail ou senha inválidos.',
    });
  }

  req.session.usuario = { id: usuario.id, nome: usuario.nome, papel: usuario.papel };
  res.redirect('/interno');
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/interno/login'));
});

router.get('/', exigirLogin, (req, res) => {
  res.render('erro', {
    titulo: 'Em construção',
    mensagem: 'O painel interno será implementado na próxima etapa do projeto.',
  });
});

module.exports = router;
