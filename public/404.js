// Ukjent adresse: til forsiden på riktig språk. Ligner adressen en artikkel, vises linjen om arkivet.
(function () { var p = location.pathname, sp = /^\/no(\/|$)/.test(p) ? '/no/' : '/en/'; location.replace(sp + (/^\/(no|en)\/[\w-]+\/?$/.test(p) ? '#flyttet' : '')); })();
