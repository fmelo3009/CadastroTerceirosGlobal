// Middlewares de autenticação/autorização para a área restrita (interna)

function exigirLogin(req, res, next) {
  if (req.session && req.session.usuario) {
    return next();
  }
  req.session.avisoLogin = 'Faça login para acessar a área interna.';
  return res.redirect('/interno/login');
}

function exigirAdmin(req, res, next) {
  if (req.session && req.session.usuario && req.session.usuario.papel === 'admin') {
    return next();
  }
  return res.status(403).render('erro', {
    titulo: 'Acesso negado',
    mensagem: 'Você não tem permissão de administrador para acessar esta página.',
  });
}

function injetarUsuario(req, res, next) {
  res.locals.usuarioLogado = (req.session && req.session.usuario) || null;
  next();
}

module.exports = { exigirLogin, exigirAdmin, injetarUsuario };
