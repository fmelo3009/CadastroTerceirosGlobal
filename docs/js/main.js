document.addEventListener('DOMContentLoaded', function () {
  const hamburger = document.querySelector('.hamburger');
  const navMobile = document.querySelector('.nav-mobile');

  if (hamburger && navMobile) {
    hamburger.addEventListener('click', function () {
      navMobile.classList.toggle('active');

      const aberto = navMobile.classList.contains('active');
      hamburger.setAttribute('aria-expanded', aberto ? 'true' : 'false');
    });

    navMobile.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        navMobile.classList.remove('active');
        hamburger.setAttribute('aria-expanded', 'false');
      });
    });
  }
});
