// Bekreftelse av påmelding til The Week. Lenken i e-posten virker i LENKE_DAGER dager (Don 10.11.2026).
// Lenken viser en knapp; selve bekreftelsen skjer først når leseren trykker. Da kan ikke e-postprogrammer som sjekker lenker,
// melde på noen ved et uhell (Katherine 10.11.2026). Trykker man igjen etter at man har bekreftet, får man samme takk.
import { LENKE_DAGER, sikreTabeller, naa, minutterSiden, side, esc, T, MAGASIN } from '../../server/liste.js';

async function finn(env, token) {
  if (!/^[0-9a-f]{48}$/.test(token) || !env.DB) return null;
  await sikreTabeller(env.DB);
  return env.DB.prepare(`SELECT epost, status, sprak, sist_sendt, bekreftet, eksportert FROM abonnenter WHERE token = ?`).bind(token).first();
}
const nyLenke = (rad) => rad && rad.sist_sendt && minutterSiden(rad.sist_sendt) < LENKE_DAGER * 1440;
const gyldig = (rad) => rad && (rad.status === 'bekreftet' || nyLenke(rad));
const takk = (sp) => { const t = T[sp]; return side(sp, t.takk, `<h1>${esc(t.takk)}</h1><p><a class="knapp" href="${esc(MAGASIN[sp])}">${esc(t.les)}</a></p><p><a href="/${sp}/">${esc(t.forsiden)}</a></p>`); };
const utlopt = (sp) => { const t = T[sp]; return side(sp, t.meld_pa, `<h1>${esc(t.utlopt)}</h1><p><a class="knapp" href="/${sp}/#pamelding">${esc(t.meld_pa)}</a></p>`, 410); };

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const token = u.searchParams.get('t') || '';
  let rad = null;
  try { rad = await finn(env, token); } catch (err) { console.log('bekreftelse feilet', String(err).slice(0, 300)); }
  const sp = rad ? (rad.sprak === 'en' ? 'en' : 'no') : (u.searchParams.get('s') === 'en' ? 'en' : 'no');
  if (!gyldig(rad)) return utlopt(sp);
  // Allerede bekreftet og ingen ny påmelding siden: bare takk. Ny påmelding etter bekreftelse: vis knappen igjen.
  if (rad.status === 'bekreftet' && !(rad.sist_sendt > rad.bekreftet)) return takk(sp);
  const t = T[sp];
  return side(sp, t.bekreft_tittel, `<h1>${esc(t.bekreft_tittel)}</h1><form method="post" action="/bekreft/"><input type="hidden" name="t" value="${esc(token)}"><button class="knapp" type="submit">${esc(t.knapp)}</button></form>`);
}

export async function onRequestPost({ request, env }) {
  let token = '';
  try { token = String((await request.formData()).get('t') || ''); } catch { token = ''; }
  let rad = null;
  try {
    rad = await finn(env, token);
    if (nyLenke(rad) && (rad.status !== 'bekreftet' || rad.sist_sendt > rad.bekreftet)) {
      // Bekreftet på nytt: med i neste fil til Substack igjen, og telleren for bekreftelser nullstilles.
      await env.DB.prepare(`UPDATE abonnenter SET status = 'bekreftet', bekreftet = ?, eksportert = NULL, antall_sendt = 0 WHERE epost = ?`).bind(naa(), rad.epost).run();
    }
  } catch (err) { console.log('bekreftelse feilet', String(err).slice(0, 300)); return side('no', T.no.feil, `<h1>${esc(T.no.feil)}</h1>`, 500); }
  const sp = rad && rad.sprak === 'en' ? 'en' : 'no';
  return gyldig(rad) ? takk(sp) : utlopt(sp);
}
