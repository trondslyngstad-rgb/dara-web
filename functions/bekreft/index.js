// Bekreftelse av påmelding til The Week. Lenken i e-posten virker i LENKE_DAGER dager (Don 10.11.2026).
// Trykker man på lenken igjen etter at man har bekreftet, får man samme takk.
import { LENKE_DAGER, sikreTabeller, naa, minutterSiden, side, esc, T, MAGASIN } from '../../server/liste.js';

export async function onRequestGet({ request, env }) {
  const token = new URL(request.url).searchParams.get('t') || '';
  let sp = 'no';
  let ok = false;
  if (/^[0-9a-f]{48}$/.test(token) && env.DB) {
    try {
      await sikreTabeller(env.DB);
      const rad = await env.DB.prepare(`SELECT epost, status, sprak, sist_sendt FROM abonnenter WHERE token = ?`).bind(token).first();
      if (rad) {
        sp = rad.sprak === 'en' ? 'en' : 'no';
        if (rad.status === 'bekreftet') ok = true;
        else if (rad.sist_sendt && minutterSiden(rad.sist_sendt) < LENKE_DAGER * 1440) {
          await env.DB.prepare(`UPDATE abonnenter SET status = 'bekreftet', bekreftet = ? WHERE epost = ?`).bind(naa(), rad.epost).run();
          ok = true;
        }
      }
    } catch (err) { console.log('bekreftelse feilet', String(err).slice(0, 300)); }
  }
  const t = T[sp];
  if (ok) {
    return side(sp, t.takk, `<h1>${esc(t.takk)}</h1><p><a class="knapp" href="${MAGASIN[sp]}">${esc(t.les)}</a></p><p><a href="/${sp}/">${esc(t.forsiden)}</a></p>`);
  }
  return side(sp, t.meld_pa, `<h1>${esc(t.utlopt)}</h1><p><a class="knapp" href="/${sp}/#pamelding">${esc(t.meld_pa)}</a></p>`, 410);
}
