// Påmelding til DARAs egen e-postliste for The Week (Trond 10.11.2026). Brukes av daramag.com, The Week (magasin.daramag.com) og leanin.no/blog.
// Flyt (Don 10.11.2026): leseren skriver e-post, får en e-post med «Bekreft påmeldingen», og blir værende på siden.
// Svaret er det samme om adressen står på listen fra før eller ikke, så ingen kan sjekke hvem som er påmeldt.
// Vern mot misbruk: bare kall fra våre egne sider, et skjult lokkefelt for roboter, høyst én bekreftelse per adresse per kvarter
// og høyst MAKS_PER_IP_PER_TIME forsøk per time fra samme sted.
// Uten JavaScript sendes skjemaet hit som vanlig skjema, og leseren får en enkel side med svaret og lenke tilbake.
import { TILLATTE, KILDER, GYLDIG, NY_EPOST_ETTER_MIN, MAKS_PER_IP_PER_TIME, MAKS_PER_ADRESSE, sikreTabeller, rydd, naa, minutterSiden, nyToken, forsokKode, kanSendeIDag, bekreftEpost, sendEpost, side, esc, T, JSONHODER } from '../../server/liste.js';

const cors = (origin) => (TILLATTE.includes(origin) ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' } : {});

export async function onRequestOptions({ request }) {
  const origin = request.headers.get('Origin') || '';
  if (!TILLATTE.includes(origin)) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: { ...cors(origin), 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' } });
}

export async function onRequestPost({ request, env, waitUntil }) {
  const egen = new URL(request.url).origin;
  const origin = request.headers.get('Origin') || '';
  const tillatt = origin === egen || TILLATTE.includes(origin);
  const type = request.headers.get('Content-Type') || '';
  const somSkjema = !type.startsWith('application/json');

  let data = {};
  try {
    if (somSkjema) { const f = await request.formData(); data = Object.fromEntries(f.entries()); }
    else data = await request.json();
  } catch { data = {}; }

  const sp = data.sprak === 'en' ? 'en' : 'no';
  const kilde = KILDER.includes(data.kilde) ? data.kilde : 'daramag';
  const tilbake = TILLATTE.some((o) => String(data.tilbake || '').startsWith(o + '/')) ? String(data.tilbake).slice(0, 300) : `https://daramag.com/${sp}/`;

  const svar = (status, resultat) => {
    if (somSkjema) {
      const t = T[sp];
      const tekst = resultat === 'ok'
        ? `<h1>${esc(t.nesten)}</h1><p>${esc(t.sjekk)}</p><p class="liste-liten">${esc(t.spam)}</p>`
        : `<h1>${esc(resultat === 'ugyldig' ? t.ugyldig : t.feil)}</h1>`;
      return side(sp, resultat === 'ok' ? t.nesten : t.feil, `${tekst}<p><a class="knapp" href="${esc(tilbake)}">${esc(t.tilbake)}</a></p>`, status);
    }
    return new Response(JSON.stringify({ resultat }), { status, headers: { ...JSONHODER, ...cors(origin) } });
  };

  if (!tillatt) return svar(403, 'feil');
  if (data.nettsted) return svar(200, 'ok'); // lokkefeltet er fylt ut: en robot
  const epost = String(data.epost || data.email || '').trim().toLowerCase();
  if (!GYLDIG.test(epost) || epost.length > 254) return svar(400, 'ugyldig');
  if (!env.DB) return svar(503, 'feil');

  try {
    await sikreTabeller(env.DB);
    await rydd(env.DB);
    const kode = await forsokKode(env.DB, request.headers.get('CF-Connecting-IP') || 'ukjent');
    const tid = naa();
    const antall = await env.DB.prepare(`SELECT COUNT(*) AS n FROM forsok WHERE kode = ? AND tid > ?`).bind(kode, new Date(Date.now() - 3600000).toISOString()).first();
    if (antall && antall.n >= MAKS_PER_IP_PER_TIME) return svar(429, 'feil');
    await env.DB.prepare(`INSERT INTO forsok (kode, tid) VALUES (?, ?)`).bind(kode, tid).run();

    // Samme svar uansett, så ingen kan finne ut hvem som står på listen. E-posten sendes etter at svaret er gitt,
    // så svartiden heller ikke avslører noe (Katherine 10.11.2026).
    const rad = await env.DB.prepare(`SELECT status, sist_sendt, antall_sendt FROM abonnenter WHERE epost = ?`).bind(epost).first();
    // Er adressen bekreftet fra før, får den likevel en ny bekreftelse. Da kan den som har meldt seg av i Substack,
    // melde seg på igjen her og komme med i neste fil til Substack (Trond 10.11.2026).
    if (rad && rad.sist_sendt && minutterSiden(rad.sist_sendt) < NY_EPOST_ETTER_MIN) return svar(200, 'ok');
    if (rad && rad.antall_sendt >= MAKS_PER_ADRESSE) return svar(200, 'ok');
    if (!(await kanSendeIDag(env.DB))) { console.log('dagens tak for e-post er nådd'); return svar(429, 'feil'); }

    const token = nyToken();
    if (rad) await env.DB.prepare(`UPDATE abonnenter SET token = ?, sprak = ?, kilde = ?, sist_sendt = ?, antall_sendt = antall_sendt + 1 WHERE epost = ?`).bind(token, sp, kilde, tid, epost).run();
    else await env.DB.prepare(`INSERT INTO abonnenter (epost, status, sprak, kilde, token, opprettet, sist_sendt, antall_sendt) VALUES (?, 'venter', ?, ?, ?, ?, ?, 1)`).bind(epost, sp, kilde, token, tid, tid).run();

    const e = bekreftEpost(sp, `${egen}/bekreft/?t=${token}`);
    const send = sendEpost(env, { til: epost, emne: e.emne, tekst: e.tekst, html: e.html }).catch((err) => console.log('e-post feilet', String(err).slice(0, 300)));
    if (waitUntil) waitUntil(send); else await send;
    return svar(200, 'ok');
  } catch (err) {
    console.log('påmelding feilet', String(err).slice(0, 300));
    return svar(500, 'feil');
  }
}
