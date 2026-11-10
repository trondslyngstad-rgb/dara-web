// daramag.com: deling, kort som folder seg ut, språkvalg, påmelding og fast linje nederst på mobil.
(function () {
  var kanDele = typeof navigator.share === 'function';

  // Deling: telefonens egen deling når den finnes, og «kopier lenke».
  [].forEach.call(document.querySelectorAll('.del-rad'), function (rad) {
    var url = rad.getAttribute('data-url'), tittel = rad.getAttribute('data-tittel');
    var sys = rad.querySelector('.del-system');
    if (sys && kanDele) {
      // Telefonen har egen deling: vis bare «Del» og «Kopier lenke», så raden får plass på én linje (Don 10.11.2026).
      sys.hidden = false;
      [].forEach.call(rad.querySelectorAll('a.del-knapp'), function (a) { a.hidden = true; });
      sys.addEventListener('click', function () { navigator.share({ title: tittel, url: url }).catch(function () {}); });
    }
    var kop = rad.querySelector('.del-kopier'), status = rad.querySelector('.del-status');
    if (kop) kop.addEventListener('click', function () {
      var ferdig = function () { if (status) { status.textContent = kop.getAttribute('data-kopiert'); setTimeout(function () { status.textContent = ''; }, 2500); } };
      // Feiler kopieringen, vises lenken så man kan kopiere den selv.
      var feil = function () { if (status) status.textContent = kop.getAttribute('data-ikke') + ' ' + url; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(ferdig, feil); else feil();
    });
  });

  // Tidligere artikler: åpne i HTML-en (lesbare uten JavaScript), lukkes her og folder seg ut der de står.
  var knapper = [].slice.call(document.querySelectorAll('.apne'));
  function sett(k, apen) {
    var inn = document.getElementById(k.getAttribute('aria-controls'));
    if (!inn) return;
    k.setAttribute('aria-expanded', String(apen));
    inn.hidden = !apen;
  }
  knapper.forEach(function (k) { sett(k, false); k.addEventListener('click', function () { sett(k, k.getAttribute('aria-expanded') !== 'true'); }); });
  // «Lukk» nederst i en åpnet artikkel lukker den og setter leseren tilbake ved kortet.
  [].forEach.call(document.querySelectorAll('.lukk'), function (b) {
    b.addEventListener('click', function () {
      var kort = document.getElementById(b.getAttribute('data-for'));
      var k = kort && kort.querySelector('.apne');
      if (!k) return;
      sett(k, false); kort.scrollIntoView({ block: 'start' }); k.focus({ preventScroll: true });
    });
  });
  function fraAdressen() {
    var h = (location.hash || '').slice(1);
    var flyttet = document.querySelector('.flyttet');
    if (h === 'flyttet' && flyttet) { flyttet.hidden = false; return; }
    if (!/^a-[\w-]{1,40}$/.test(h)) return;
    var kort = document.getElementById(h);
    if (!kort) { if (flyttet) flyttet.hidden = false; return; }
    var k = kort.querySelector('.apne');
    if (k) sett(k, true);
    kort.scrollIntoView({ block: 'start' });
  }
  fraAdressen();
  window.addEventListener('hashchange', fraAdressen);

  // Språkvalget huskes til neste gang (informasjonskapselen «sprak», ett år).
  [].forEach.call(document.querySelectorAll('[data-sprak]'), function (a) {
    a.addEventListener('click', function () {
      document.cookie = 'sprak=' + a.getAttribute('data-sprak') + '; path=/; max-age=31536000; samesite=lax';
    });
  });

  // Påmelding: sendes til /api/abonner, som melder på hos DARA på Substack. Svaret vises i boksen.
  [].forEach.call(document.querySelectorAll('.pm-skjema'), function (f) {
    var felt = f.querySelector('input[type="email"]'), knapp = f.querySelector('button');
    var status = document.getElementById(felt.getAttribute('aria-describedby'));
    felt.addEventListener('input', function () { felt.removeAttribute('aria-invalid'); status.textContent = ''; });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var epost = felt.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(epost)) {
        felt.setAttribute('aria-invalid', 'true'); status.textContent = f.getAttribute('data-ugyldig'); felt.focus(); return;
      }
      knapp.disabled = true;
      var lokke = f.querySelector('[name="nettsted"]');
      fetch('/api/abonner', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ epost: epost, side: location.href, nettsted: lokke ? lokke.value : '' }) })
        .then(function (s) { return s.ok ? s.json() : Promise.reject(s); })
        .then(function () { f.hidden = true; status.textContent = f.getAttribute('data-sendt'); try { localStorage.setItem('dara-abonnent', '1'); } catch (x) {} oppdaterLinje(); })
        .catch(function () {
          status.textContent = f.getAttribute('data-feil') + ' ';
          var a = document.createElement('a');
          a.href = f.getAttribute('action') + '?email=' + encodeURIComponent(epost); a.target = '_blank'; a.rel = 'noopener';
          a.textContent = 'Substack ↗'; status.appendChild(a);
        })
        .then(function () { knapp.disabled = false; });
    });
  });

  // Fast linje nederst på mobil: vises når delingsraden øverst er rullet ut av syne.
  // «Abonner» skjules mens påmeldingen er på skjermen og etter at man har meldt seg på (Don 10.11.2026).
  var linje = document.querySelector('.fast-linje');
  // På forsiden deler «Del» bare én av flere artikler, så den vises bare på artikkelsidene (Don 10.11.2026).
  if (linje && !document.querySelector('.artikkel.enkel')) { var fdx = linje.querySelector('.fast-del'); if (fdx) fdx.remove(); linje.classList.add('en'); }
  var forsteDel = document.querySelector('.del-rad');
  var pm = document.getElementById('pamelding');
  var delSynlig = true, pmSynlig = false;
  function abonnent() { try { return localStorage.getItem('dara-abonnent') === '1'; } catch (x) { return false; } }
  function oppdaterLinje() {
    if (!linje) return;
    // Skjul hele linjen når den ikke har noen synlig knapp (Katherine 10.11.2026).
    linje.hidden = delSynlig || (!linje.querySelector('.fast-del') && (pmSynlig || abonnent()));
    var ab = linje.querySelector('.fast-abonner');
    if (ab) ab.classList.toggle('skjult', pmSynlig || abonnent());
  }
  if (linje && forsteDel && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (e) { delSynlig = e[0].isIntersecting || e[0].boundingClientRect.top > 0; oppdaterLinje(); }).observe(forsteDel);
    if (pm) new IntersectionObserver(function (e) { pmSynlig = e[0].isIntersecting; oppdaterLinje(); }).observe(pm);
    var fd = linje.querySelector('.fast-del');
    if (fd) fd.addEventListener('click', function () {
      var url = forsteDel.getAttribute('data-url'), tittel = forsteDel.getAttribute('data-tittel');
      if (kanDele) navigator.share({ title: tittel, url: url }).catch(function () {});
      else forsteDel.scrollIntoView({ block: 'center' });
    });
    var fa = linje.querySelector('.fast-abonner');
    fa.addEventListener('click', function (e) {
      if (!pm) return;
      e.preventDefault(); pm.scrollIntoView({ block: 'center' });
      var inp = pm.querySelector('input[type="email"]'); if (inp) inp.focus({ preventScroll: true });
    });
  }
  // Lenker til påmeldingen på samme side setter markøren i feltet.
  [].forEach.call(document.querySelectorAll('a.topp-abonner'), function (a) {
    a.addEventListener('click', function (e) {
      var boks = document.getElementById('pamelding');
      if (!boks) return;
      e.preventDefault(); boks.scrollIntoView({ block: 'center' });
      var inp = boks.querySelector('input[type="email"]'); if (inp) inp.focus({ preventScroll: true });
    });
  });
})();
