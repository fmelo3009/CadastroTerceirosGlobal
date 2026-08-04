router.post('/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const senha = req.body.senha || '';

  const usuario = db
    .prepare('SELECT * FROM usuarios WHERE LOWER(email) = ? AND ativo = 1')
    .get(email);

  if (!usuario || !bcrypt.compareSync(senha, usuario.senha_hash)) {
    return res.status(401).render('interno/login', {
      titulo: 'Área interna',
      aviso: null,
      erro: 'E-mail ou senha inválidos.',
    });
  }

  req.session.usuario = {
    id: usuario.id,
    nome: usuario.nome,
    papel: usuario.papel,
  };

  req.session.save((erro) => {
    if (erro) {
      console.error('Erro ao salvar a sessão:', erro);

      return res.status(500).render('interno/login', {
        titulo: 'Área interna',
        aviso: null,
        erro: 'Não foi possível iniciar a sessão. Tente novamente.',
      });
    }

    return res.redirect('/interno');
  });
});
