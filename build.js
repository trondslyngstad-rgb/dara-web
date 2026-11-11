// Bygger daramag.com til dist/ uten eksterne pakker. Kjør: node build.js
// Forside på /no/ og /en/, én side per artikkel på hvert språk, personvernside, og videresending av gamle Substack-lenker.
// Bestemt av Trond 10.11.2026: siste artikkel øverst, tre tidligere under, påmelding til The Week, The Week-kort,
// «I samarbeid med» LeanIn uten lenke til lansering. Skisse av Tim og Don. Perspektiver kom med 11.11.2026.
'use strict';
const fs = require('fs');
const path = require('path');
// Versjon i adressen til stil.css og dara.js, så nettleseren henter ny fil når den er endret (Tim 10.11.2026: gammel stil ble brukt med ny side).
const ver = (f) => require('crypto').createHash('sha1').update(fs.readFileSync(path.join(__dirname, 'public', f))).digest('hex').slice(0, 8);
const V_CSS = ver('stil.css'), V_JS = ver('dara.js');

const ROT = __dirname;
const UT = path.join(ROT, 'dist');
const site = JSON.parse(fs.readFileSync(path.join(ROT, 'content/site.json'), 'utf8'));
const SPRAK = ['no', 'en'];

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const https = (u) => (/^https:\/\/[^\s"<>]+$/.test(String(u || '')) ? String(u) : '');
const MND = {
  no: ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
const datoTekst = (iso, sp) => {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return sp === 'no' ? `${d}. ${MND.no[m - 1]} ${y}` : `${d} ${MND.en[m - 1]} ${y}`;
};

// Artiklene: én JSON-fil per artikkel i content/artikler/, lagt inn fra DARA Redaksjon når den er publisert.
const artikler = fs.readdirSync(path.join(ROT, 'content/artikler'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(ROT, 'content/artikler', f), 'utf8')))
  .filter((a) => a.publisert && new Date(a.publisert) <= new Date() && (a.no || a.en))
  .sort((x, y) => String(y.publisert).localeCompare(String(x.publisert)));

// Perspektiver (Trond 11.11.2026): førstehåndsfortellinger fra deltakerne, én JSON-fil per innlegg i content/perspektiver/.
// Teksten er den samme som på Substack. Byline er DARA Redaksjonen; deltakeren nevnes i teksten, med lenke for kontakt.
const perspektiver = (fs.existsSync(path.join(ROT, 'content/perspektiver')) ? fs.readdirSync(path.join(ROT, 'content/perspektiver')) : [])
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(ROT, 'content/perspektiver', f), 'utf8')))
  .filter((a) => a.publisert && new Date(a.publisert) <= new Date() && (a.no || a.en))
  .sort((x, y) => String(y.publisert).localeCompare(String(x.publisert)));
const perspSti = (sp) => `/${sp}/${sp === 'no' ? 'perspektiver' : 'perspectives'}/`;

const sider = fs.readdirSync(path.join(ROT, 'content/sider')).filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(ROT, 'content/sider', f), 'utf8')));
const side_ = (id) => sider.find((x) => x.id === id);
const omLinje = (t, sp) => { const d = side_('deltakerokonomi'); const ord = t.om_ord; const tekst = esc(t.om);
  return d && ord && tekst.includes(esc(ord)) ? tekst.replace(esc(ord), `<a href="${sideUrl(d, sp)}">${esc(ord)}</a>`) : tekst; };
const sideUrl = (x, sp) => { const v = x && (x[sp] || x[sp === 'no' ? 'en' : 'no']); return v ? `/${x[sp] ? sp : (sp === 'no' ? 'en' : 'no')}/${v.slug}/` : '#'; };
// Har artikkelen bare ett språk, vises den språkversjonen også på det andre språket, med en linje om det (Don 10.11.2026).
const versjon = (a, sp) => {
  const v = a[sp] && a[sp].tittel ? a[sp] : null;
  if (v) return { ...v, sp, bare: false };
  const annen = sp === 'no' ? 'en' : 'no';
  return { ...a[annen], sp: annen, bare: true };
};
const arkivSti = (sp) => `/${sp}/${sp === 'no' ? 'alle-saker' : 'all-stories'}/`;
// Kildebiblioteket (Trond 11.11.2026): alle kildene fra de publiserte sakene, bygget på nytt hver gang siden bygges.
const bibliotekSti = (sp) => `/${sp}/${sp === 'no' ? 'kilder' : 'sources'}/`;
// Kildedatoene kommer på norsk fra DARA Redaksjon. På engelsk oversettes månedene, og «udatert» vises ikke.
const kildeDato = (d, sp) => {
  const x = String(d || '').trim();
  if (!x || /^udatert$/i.test(x)) return '';
  if (sp === 'no') return x;
  const m = x.match(/^(?:(\d{1,2})\.\s*)?([a-zæøå]+)\s+(\d{4})$/i);
  const i = m ? MND.no.indexOf(m[2].toLowerCase()) : -1;
  return i < 0 ? x : `${m[1] ? m[1] + ' ' : ''}${MND.en[i]} ${m[3]}`;
};
const url = (a, sp) => { const v = versjon(a, sp); return `/${v.sp}/${v.slug}/`; };

// Enkel tekst til avsnitt. Alt blir escapet.
const avsnitt = (tekst) => {
  const ut = [];
  let liste = [];
  const tom = () => { if (liste.length) { ut.push(`<ul>${liste.join('')}</ul>`); liste = []; } };
  for (const p of tekst || []) {
    if (/^• /.test(p)) { liste.push(`<li>${esc(p.slice(2))}</li>`); continue; }
    tom();
    ut.push(/^## /.test(p) ? `<h2 class="mellomtittel">${esc(p.slice(3))}</h2>` : `<p>${esc(p)}</p>`);
  }
  tom();
  return ut.join('\n');
};

// Tekst med lenker, bilder og sitater, brukt i Perspektiver. Alt blir escapet før lenkene settes inn.
// [tekst](https://... eller /sti/), ![bildetekst|alt](https://...), «> » sitat, «## » mellomtittel, «• » punkt, «---» skillelinje.
const lenker = (s) => esc(s).replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+|\/[\w\-/]*)\)/g, (h, tekst, u) => (u.startsWith('/')
  ? `<a href="${u}">${tekst}</a>` : `<a href="${u}" target="_blank" rel="noopener">${tekst}<span class="sr"> (${esc(ny_fane_tekst)})</span></a>`));
let ny_fane_tekst = '';
const rikTekst = (tekst, t) => {
  ny_fane_tekst = t ? t.ny_fane : '';
  const ut = [];
  let liste = [];
  const tom = () => { if (liste.length) { ut.push(`<ul>${liste.join('')}</ul>`); liste = []; } };
  let forrige = '';
  for (const p of tekst || []) {
    const før = forrige; forrige = p;
    if (/^• /.test(p)) { liste.push(`<li>${lenker(p.slice(2))}</li>`); continue; }
    tom();
    // Intervjuspørsmålet står rett etter mellomtittelen (eller etter introlinjen) og vises som spørsmål (Don 11.11.2026). Teksten er uendret.
    if (/\?$/.test(p) && (/^## /.test(før) || /^Perspectives:/.test(før))) { ut.push(`<p class="sporsmal">${lenker(p)}</p>`); continue; }
    const bilde = /^!\[([^|\]]*)\|?([^\]]*)\]\((https:\/\/[^\s)]+)\)$/.exec(p);
    if (bilde) { if (bilde[1] || bilde[2]) ut.push(`<figure class="bilde"><img src="${esc(bilde[3])}" alt="${esc(bilde[2])}" loading="lazy" decoding="async">${bilde[1] ? `<figcaption>${esc(bilde[1])}</figcaption>` : ''}</figure>`); continue; }
    if (p === '---') { ut.push('<hr>'); continue; }
    if (/^## /.test(p)) { ut.push(`<h2 class="mellomtittel">${esc(p.slice(3))}</h2>`); continue; }
    if (/^> /.test(p)) { ut.push(`<blockquote class="sitat"><p>${lenker(p.slice(2))}</p></blockquote>`); continue; }
    ut.push(`<p>${lenker(p)}</p>`);
  }
  tom();
  return ut.join('\n');
};

const kilder = (a, t) => (a.kilder && a.kilder.length
  ? `<div class="kilder"><p class="kilder-t">${esc(t.kilder)}</p><ul>${a.kilder.map((k) => `<li>${https(k.url)
    ? `<a href="${esc(k.url)}" target="_blank" rel="noopener">${esc(k.name)}${kildeDato(k.date, t.lang === 'en' ? 'en' : 'no') ? ', ' + esc(kildeDato(k.date, t.lang === 'en' ? 'en' : 'no')) : ''}<span class="sr"> (${esc(t.ny_fane)})</span></a>`
    : `${esc(k.name)}${kildeDato(k.date, t.lang === 'en' ? 'en' : 'no') ? ', ' + esc(kildeDato(k.date, t.lang === 'en' ? 'en' : 'no')) : ''}`}</li>`).join('')}</ul></div>`
  : '');
const kilderMedLenke = (a, t) => kilder(a, t).replace(/<\/ul><\/div>$/, `</ul><p class="kilder-alle"><a href="${bibliotekSti(t.lang === 'en' ? 'en' : 'no')}">${esc(t.bibliotek_se_alle)} <span aria-hidden="true">→</span></a></p></div>`);

const bilde = (a, v, sp, lat) => {
  const src = https(a.bilde && a.bilde.url);
  if (!src) return '';
  const alt = (a.bilde[`alt_${sp}`] || a.bilde.alt_en || a.bilde.alt_no || '');
  const kred = v.kreditt ? (https(a.bilde.kreditt_url)
    ? `<a href="${esc(a.bilde.kreditt_url)}" target="_blank" rel="noopener">${esc(v.kreditt)}</a>` : esc(v.kreditt)) : '';
  return `<figure class="bilde"><img src="${esc(src)}" alt="${esc(alt)}" width="1200" height="675" loading="${lat ? 'lazy' : 'eager'}" decoding="async">${v.bildetekst || kred ? `<figcaption>${esc(v.bildetekst || '')} ${kred}</figcaption>` : ''}</figure>`;
};

// Delingsrad. På mobil åpner «Del» telefonens egen deling (dara.js); lenkene under virker også uten JavaScript.
const delRad = (full, tittel, t) => {
  const u = encodeURIComponent(full);
  const tt = encodeURIComponent(tittel);
  const ikon = {
    in: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.75h4V21H3V9.75Zm6.5 0h3.8v1.6h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21h-4v-4.9c0-1.17-.02-2.68-1.63-2.68-1.64 0-1.89 1.28-1.89 2.6V21h-4V9.75Z"/></svg>',
    fb: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.87.25-1.46 1.5-1.46h1.6V4.46A21 21 0 0 0 14.27 4.3c-2.3 0-3.87 1.4-3.87 3.98v2.22H7.8v3h2.6V21h3.1Z"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.78L17.75 3Zm-1.08 16.2h1.7L7.4 4.74H5.58L16.67 19.2Z"/></svg>',
    th: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.7 11.2c-.1 0-.2-.1-.3-.1-.2-3.2-2-5-4.9-5-1.8 0-3.3.8-4.2 2.2l1.6 1.1c.7-1 1.7-1.2 2.6-1.2 1 0 1.8.3 2.3.9.4.4.6 1 .7 1.7-.8-.1-1.7-.2-2.6-.1-2.6.2-4.3 1.7-4.2 3.8.1 2.1 2 3.4 4.2 3.3 1.6-.1 2.8-.7 3.6-1.8.6-.8 1-1.9 1.1-3.2.7.4 1.2 1 1.5 1.6.5 1.2.5 3.1-1 4.6-1.3 1.3-2.9 1.9-5.3 1.9-2.7 0-4.7-.9-6-2.6C4.6 17 4 14.8 4 12s.6-5 1.8-6.6c1.3-1.7 3.3-2.6 6-2.6s4.8.9 6.1 2.6c.6.8 1.1 1.9 1.4 3.1l1.9-.5c-.4-1.5-1-2.8-1.8-3.9C17.7 1.9 15.2.8 11.8.8 8.4.8 5.9 1.9 4.3 4 2.8 5.9 2.1 8.6 2 12c.1 3.4.8 6.1 2.3 8 1.6 2.1 4.1 3.2 7.5 3.2 3 0 5.1-.8 6.8-2.5 2.2-2.2 2.2-5 1.4-6.8-.5-1.3-1.6-2.3-3.3-2.7Zm-4.9 4.6c-1.1.1-2.2-.4-2.3-1.4 0-.8.6-1.6 2.3-1.7h.6c.6 0 1.2.1 1.8.2-.2 2.3-1.3 2.8-2.4 2.9Z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18v14H3V5Zm2 2v.4l7 4.7 7-4.7V7H5Zm14 2.8-7 4.7-7-4.7V17h14V9.8Z"/></svg>',
    lenke: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.6 13.4a1 1 0 0 1 0-1.4l3.6-3.6a3 3 0 1 1 4.2 4.2l-2 2-1.4-1.4 2-2a1 1 0 1 0-1.4-1.4l-3.6 3.6a1 1 0 0 1-1.4 0ZM13.4 10.6a1 1 0 0 1 0 1.4l-3.6 3.6a3 3 0 1 1-4.2-4.2l2-2 1.4 1.4-2 2a1 1 0 1 0 1.4 1.4l3.6-3.6a1 1 0 0 1 1.4 0Z"/></svg>',
    del: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l4 4-1.4 1.4L13 6.8V15h-2V6.8L9.4 8.4 8 7l4-4Zm-7 9h2v7h10v-7h2v9H5v-9Z"/></svg>',
  };
  const a = (href, k, navn) => `<a class="del-knapp" href="${href}" target="_blank" rel="noopener" aria-label="${esc(navn)} (${esc(t.ny_fane)})" title="${esc(navn)}">${ikon[k]}</a>`;
  return `<div class="del-rad" data-url="${esc(full)}" data-tittel="${esc(tittel)}">
    <button type="button" class="del-knapp del-system" hidden aria-label="${esc(t.del_lenke)}" title="${esc(t.del)}">${ikon.del}</button>
    ${a(`https://www.linkedin.com/sharing/share-offsite/?url=${u}`, 'in', 'LinkedIn')}
    ${a(`https://www.facebook.com/sharer/sharer.php?u=${u}`, 'fb', 'Facebook')}
    ${a(`https://twitter.com/intent/tweet?url=${u}&text=${tt}`, 'x', 'X')}
    ${a(`https://www.threads.net/intent/post?text=${encodeURIComponent(tittel + ' ' + full)}`, 'th', 'Threads')}
    <a class="del-knapp" href="mailto:?subject=${tt}&body=${u}" aria-label="${esc(t.epost_del)}" title="${esc(t.epost_del)}">${ikon.mail}</a>
    <button type="button" class="del-knapp del-kopier" data-kopiert="${esc(t.kopiert)}" data-ikke="${esc(t.kopier_selv)}" aria-label="${esc(t.kopier)}" title="${esc(t.kopier)}">${ikon.lenke}</button>
    <span class="del-status" role="status"></span>
  </div>`;
};

// Hele artikkelen. Brukes øverst på forsiden, på artikkelsiden og inne i de tidligere som folder seg ut.
const artikkelInnhold = (a, sp, t, { merke, lat, hId, h1 }) => {
  const v = versjon(a, sp);
  const full = site.nettsted + url(a, sp);
  return `<div class="art-topp">
      <p class="meta">${merke ? `<span class="merke">${esc(merke)}</span> ` : ''}<time datetime="${esc(a.publisert.slice(0, 10))}">${esc(datoTekst(a.publisert, sp))}</time></p>
      <h${hId || h1 ? '1' : '2'} class="tittel" lang="${v.sp === 'no' ? 'nb' : 'en'}">${hId ? esc(v.tittel) : `<a href="${url(a, sp)}">${esc(v.tittel)}</a>`}</h${hId || h1 ? '1' : '2'}>
      ${v.ingress ? `<p class="ingress" lang="${v.sp === 'no' ? 'nb' : 'en'}">${esc(v.ingress)}</p>` : ''}
      ${v.bare ? `<p class="bare">${esc(t.bare_andre)}</p>` : ''}
      ${delRad(full, v.tittel, t)}
    </div>
    ${bilde(a, v, sp, lat)}
    <div class="tekst" lang="${v.sp === 'no' ? 'nb' : 'en'}">${avsnitt(v.tekst)}</div>
    ${kilderMedLenke(a, t)}
    <p class="ki">${esc(t.ki)}</p>`;
};

const partner = (t) => `<aside class="partner" aria-label="${esc(t.partner)} LeanIn">
    <p class="partner-med">${esc(t.partner)}</p>
    <p class="leanin" aria-label="LeanIn">Lean<span>In</span></p>
    <p class="partner-budskap">${esc(t.partner_budskap)}</p>
  </aside>`;

// Lenken til siste utgave av The Week, til bekreftelsessiden i server/liste.js (Katherine 10.11.2026).
fs.writeFileSync(path.join(__dirname, 'server', 'magasin.js'), `// Lages av build.js fra content/site.json. Endre ikke her.\nexport const MAGASIN = ${JSON.stringify({ no: site.theweek.lenke_no, en: site.theweek.lenke_en })};\n`);

// Påmeldingen går til DARAs egen e-postliste (/api/abonner), og leseren blir på siden (Trond og Don 10.11.2026).
// Svaret står utenfor skjemaet, så skjermlesere får det med seg når skjemaet skjules.
// Uten JavaScript sendes skjemaet rett til /api/abonner, som viser en enkel side med svaret.
const pamelding = (t, id, sp) => `<section class="pamelding" id="${id}" aria-labelledby="${id}-t">
    <h2 id="${id}-t">${esc(t.pamelding_tittel)}</h2>
    <p>${esc(t.pamelding_tekst)}</p>
    <form class="pm-skjema" action="/api/abonner" method="post" novalidate
      data-sendt="${esc(t.sendt)}" data-spam="${esc(t.spam)}" data-ugyldig="${esc(t.ugyldig)}" data-feil="${esc(t.feil)}" data-sender="${esc(t.sender)}">
      <label class="sr" for="${id}-e">${esc(t.epost)}</label>
      <input class="sr" name="nettsted" type="text" tabindex="-1" autocomplete="off" aria-hidden="true">
      <input type="hidden" name="sprak" value="${sp}"><input type="hidden" name="kilde" value="daramag"><input type="hidden" name="tilbake" value="">
      <input id="${id}-e" name="epost" type="email" autocomplete="email" placeholder="${esc(t.epost)}" required aria-describedby="${id}-s">
      <button type="submit" class="knapp">${esc(t.abonner)}</button>
    </form>
    <p class="pm-status" id="${id}-s" role="status" aria-live="polite" tabindex="-1"></p>
    <p class="pm-merknad">${esc(t.pamelding_merknad)} <a href="/${sp}/${sp === 'no' ? 'personvern' : 'privacy'}/">${esc(t.personvern_lenke)}</a></p>
  </section>`;

// The Week vises som en magasinforside i DARAs drakt: stor logo, bildet over hele forsiden, ukens sak og to saker til nederst
// (Trond 10.11.2026, etter hans eksempel). Overskriften deles ved kolon: siste del i gull.
const theWeek = (sp, t) => {
  const w = site.theweek;
  const dato = datoTekst(w.dato, sp);
  const tittel = w['tittel_' + sp];
  const i = tittel.lastIndexOf(': ');
  const overskrift = i > 0 ? `${esc(tittel.slice(0, i))}<span class="tw-gull">${esc(tittel.slice(i + 2))}</span>` : esc(tittel);
  const saker = (w['saker_' + sp] || []).map((s) => `<span>${esc(s)}</span>`).join('');
  return `<section class="tw" aria-labelledby="tw-t">
    <a class="tw-forside" href="${esc(w['lenke_' + sp])}" aria-label="DARA The Week, ${esc(t.utgave)} ${esc(w.nummer)}: ${esc(tittel)}">
      <img src="${esc(w['bilde_' + sp])}" alt="" width="1400" height="1040" loading="lazy" decoding="async">
      <span class="tw-topp" aria-hidden="true"><span class="tw-logo">DARA</span><span class="tw-week">The Week</span></span>
      <span class="tw-utgave" aria-hidden="true">${esc(t.utgave)} ${esc(w.nummer)} · ${esc(dato)}</span>
      <span class="tw-bunn" aria-hidden="true"><span class="tw-merke">${esc(t.ukens_sak)}</span><span class="tw-tittel">${overskrift}</span>${saker ? `<span class="tw-saker">${saker}</span>` : ''}</span>
    </a>
    <div class="tw-ved">
      <h2 id="tw-t" class="sr">DARA The Week</h2>
      <p class="tw-tekst">${esc(t.theweek_tekst)}</p>
      <p><a class="knapp gull" href="${esc(w['lenke_' + sp])}">${esc(t.les_magasinet)}</a></p>
      ${w.forside_kreditt ? `<p class="tw-kreditt">${esc(t.foto)}: <span>${w.forside_kreditt_url ? `<a href="${esc(w.forside_kreditt_url)}">${esc(w.forside_kreditt)}</a>` : esc(w.forside_kreditt)}</span></p>` : ''}
    </div>
  </section>`;
};

const side = ({ sp, t, tittel, beskrivelse, sti, annenSti, ogBilde, innhold, type, harPm }) => {
  const annen = sp === 'no' ? 'en' : 'no';
  const kanon = site.nettsted + sti;
  return `<!DOCTYPE html>
<html lang="${t.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(tittel)}</title>
<meta name="description" content="${esc(beskrivelse)}">
<link rel="canonical" href="${esc(kanon)}">
<link rel="alternate" hreflang="${t.lang}" href="${esc(kanon)}">
<link rel="alternate" hreflang="${site[annen].lang}" href="${esc(site.nettsted + annenSti)}">
<link rel="alternate" hreflang="x-default" href="${esc(site.nettsted)}/">
<meta property="og:type" content="${type || 'website'}">
<meta property="og:site_name" content="DARA">
<meta property="og:title" content="${esc(tittel)}">
<meta property="og:description" content="${esc(beskrivelse)}">
<meta property="og:url" content="${esc(kanon)}">
${ogBilde ? `<meta property="og:image" content="${esc(ogBilde)}">` : ''}
<meta property="og:locale" content="${sp === 'no' ? 'nb_NO' : 'en_GB'}">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,800;1,9..144,400&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&family=Inter:wght@500;600;700&family=Bricolage+Grotesque:wght@700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/stil.css?v=${V_CSS}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
</head>
<body>
<a class="hopp" href="#innhold">${esc(t.hopp)}</a>
<header class="topp">
  <div class="wrap topp-rad">
    <a class="logo" href="/${sp}/" aria-label="DARA, ${esc(t.til_forsiden)}">DARA</a>
    <nav class="topp-nav" aria-label="DARA">
      <a href="${esc(site.theweek['lenke_' + sp])}">The Week</a>
      ${perspektiver.length ? `<a href="${perspSti(sp)}"${sti.startsWith(perspSti(sp)) ? ' aria-current="page"' : ''}>${esc(t.perspektiver)}</a>` : ''}
      <a class="topp-abonner" href="${harPm === false ? `/${sp}/` : ''}#pamelding">${esc(t.abonner)}</a>
      <span class="sprak" role="group" aria-label="${esc(t.meny_sprak)}">
        <a href="${sp === 'no' ? sti : annenSti}" lang="nb" aria-label="Norsk" data-sprak="no"${sp === 'no' ? ' aria-current="true"' : ''}>NO</a>
        <a href="${sp === 'en' ? sti : annenSti}" lang="en" aria-label="English" data-sprak="en"${sp === 'en' ? ' aria-current="true"' : ''}>EN</a>
      </span>
    </nav>
  </div>
</header>
<main id="innhold" class="wrap">
${innhold}
</main>
<footer class="bunn">
  <div class="wrap">
    <p class="bunn-lenker"><a href="${arkivSti(sp)}">${esc(t.alle_saker)}</a> · <a href="${esc(site.theweek['lenke_' + sp])}">The Week</a> · ${perspektiver.length ? `<a href="${perspSti(sp)}">${esc(t.perspektiver)}</a> · ` : ''}<a href="${sideUrl(side_('deltakerokonomi'), sp)}">${esc(t.deltakerokonomi)}</a> · <a href="${sideUrl(side_('om'), sp)}">${esc(t.om_dara)}</a> · <a href="${bibliotekSti(sp)}">${esc(t.bibliotek)}</a> · <a href="/${sp}/${sp === 'no' ? 'personvern' : 'privacy'}/">${esc(t.personvern)}</a></p>
    <p class="bunn-substack">${esc(t.substack_tekst)} <a href="${esc(site.substack)}" target="_blank" rel="noopener">${esc(t.substack_lenke)}<span class="sr"> (${esc(t.ny_fane)})</span></a></p>
    <p>${esc(t.redaktor_tekst)}: ${esc(site.redaktor)}</p>
  </div>
</footer>
<div class="fast-linje" hidden>
  <button type="button" class="fast-del">${esc(t.del)}</button>
  <a class="fast-abonner" href="#pamelding">${esc(t.abonner)}</a>
</div>
<script src="/dara.js?v=${V_JS}" defer></script>
</body>
</html>
`;
};

const skriv = (rel, innhold) => {
  const fil = path.join(UT, rel);
  fs.mkdirSync(path.dirname(fil), { recursive: true });
  fs.writeFileSync(fil, innhold);
};

fs.rmSync(UT, { recursive: true, force: true });
fs.mkdirSync(UT, { recursive: true });
for (const f of fs.readdirSync(path.join(ROT, 'public'))) fs.copyFileSync(path.join(ROT, 'public', f), path.join(UT, f));

for (const sp of SPRAK) {
  const t = site[sp];
  const annen = sp === 'no' ? 'en' : 'no';
  const [siste, ...resten] = artikler;
  const tidligere = resten.slice(0, 3);

  // Forsiden
  const forside = `
  <p class="om">${omLinje(t, sp)}</p>
  <p class="flyttet" role="status" hidden>${esc(t.flyttet)} <a href="${arkivSti(sp)}">${esc(t.alle_saker)}</a></p>
  ${siste ? `<article class="artikkel" id="a-${esc(siste.id)}">${artikkelInnhold(siste, sp, t, { merke: t.siste, h1: true })}</article>` : `<p class="tom">${esc(t.tom)}</p>`}
  ${pamelding(t, 'pamelding', sp)}
  ${siste ? partner(t) : ''}
  ${tidligere.length ? `<section class="tidligere" aria-labelledby="tidl-t">
    <h2 id="tidl-t" class="seksjon">${esc(t.tidligere)}</h2>
    <ol class="liste">${tidligere.map((a) => {
      const v = versjon(a, sp);
      return `<li class="kort" id="a-${esc(a.id)}">
        <h3 class="kort-h"><button type="button" class="apne" aria-expanded="true" aria-controls="a-${esc(a.id)}-i">
          ${https(a.bilde && a.bilde.url) ? `<img src="${esc(a.bilde.url)}" alt="" width="72" height="72" loading="lazy" decoding="async">` : ''}
          <span class="kort-tekst"><span class="meta"><time datetime="${esc(a.publisert.slice(0, 10))}">${esc(datoTekst(a.publisert, sp))}</time></span><span class="kort-tittel">${esc(v.tittel)}</span></span>
          <span class="pil" aria-hidden="true">▾</span>
        </button></h3>
        <div class="kort-innhold" id="a-${esc(a.id)}-i">${artikkelInnhold(a, sp, t, { lat: true })}<p><button type="button" class="lukk" data-for="a-${esc(a.id)}">${esc(t.lukk)} <span aria-hidden="true">▴</span></button></p></div>
      </li>`;
    }).join('')}</ol>
    <p class="alle"><a href="${arkivSti(sp)}">${esc(t.se_alle)} <span aria-hidden="true">→</span></a></p>
  </section>` : ''}
  ${theWeek(sp, t)}`;
  skriv(`${sp}/index.html`, side({
    sp, t, tittel: t.fanetittel, beskrivelse: t.om, sti: `/${sp}/`, annenSti: `/${annen}/`,
    ogBilde: siste && https(siste.bilde && siste.bilde.url), innhold: forside,
  }));

  // Én side per artikkel
  for (const a of artikler) {
    const v = versjon(a, sp);
    if (v.bare) continue; // finnes bare på det andre språket: siden lages der
    const andre = artikler.filter((b) => b !== a).slice(0, 3);
    const innhold = `
    <article class="artikkel enkel">${artikkelInnhold(a, sp, t, { hId: true })}</article>
    ${pamelding(t, 'pamelding', sp)}
    ${partner(t)}
    ${andre.length ? `<section class="les-videre" aria-labelledby="lv-t">
      <h2 id="lv-t" class="seksjon">${esc(t.les_videre)}</h2>
      <ul class="liste lenker">${andre.map((b) => {
        const vb = versjon(b, sp);
        return `<li><a class="kort-lenke" href="${url(b, sp)}">${https(b.bilde && b.bilde.url) ? `<img src="${esc(b.bilde.url)}" alt="" width="72" height="72" loading="lazy" decoding="async">` : ''}<span class="kort-tekst"><span class="meta">${esc(datoTekst(b.publisert, sp))}</span><span class="kort-tittel">${esc(vb.tittel)}</span></span></a></li>`;
      }).join('')}</ul>
      <p class="alle"><a href="${arkivSti(sp)}">${esc(t.se_alle)} <span aria-hidden="true">→</span></a></p>
    </section>` : ''}
    ${theWeek(sp, t)}`;
    skriv(`${sp}/${v.slug}/index.html`, side({
      sp, t, tittel: `${v.tittel} · DARA`, beskrivelse: v.ingress || t.om, sti: url(a, sp), annenSti: url(a, annen),
      ogBilde: https(a.bilde && a.bilde.url), innhold, type: 'article',
    }));
  }

  // Alle saker: oversikt over alle publiserte artikler, nyeste først (Trond 10.11.2026)
  skriv(`${arkivSti(sp).slice(1)}index.html`, side({
    sp, t, tittel: `${t.alle_saker} · DARA`, beskrivelse: t.om, sti: arkivSti(sp), annenSti: arkivSti(annen),
    innhold: `<h1 class="tittel arkiv-tittel">${esc(t.alle_saker)}</h1>
    <p class="om">${omLinje(t, sp)}</p>
    ${artikler.length ? `<ul class="liste lenker">${artikler.map((b) => {
      const vb = versjon(b, sp);
      return `<li><a class="kort-lenke" href="${url(b, sp)}">${https(b.bilde && b.bilde.url) ? `<img src="${esc(b.bilde.url)}" alt="" width="72" height="72" loading="lazy" decoding="async">` : ''}<span class="kort-tekst"><span class="meta">${esc(datoTekst(b.publisert, sp))}</span><span class="kort-tittel">${esc(vb.tittel)}</span>${vb.ingress ? `<span class="kort-ingress">${esc(vb.ingress)}</span>` : ''}</span></a></li>`;
    }).join('')}</ul>` : `<p class="tom">${esc(t.tom)}</p>`}
    ${pamelding(t, 'pamelding', sp)}`,
  }));

  // Kildebiblioteket: kildene gruppert per sak, nyeste sak først (Don 11.11.2026). Søket ligger i dara.js; uten JavaScript vises alt.
  const medKilder = artikler.filter((a) => (a.kilder || []).length);
  const unike = new Set(medKilder.flatMap((a) => a.kilder.map((k) => https(k.url) || `${k.name}|${k.date}`))).size;
  const domene = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
  const alleTekst = t.bibliotek_antall.replace('{k}', unike).replace('{s}', medKilder.length);
  skriv(`${bibliotekSti(sp).slice(1)}index.html`, side({
    sp, t, tittel: `${t.bibliotek} · DARA`, beskrivelse: t.bibliotek_ingress, sti: bibliotekSti(sp), annenSti: bibliotekSti(annen),
    innhold: `<h1 class="tittel arkiv-tittel">${esc(t.bibliotek)}</h1>
    <p class="om">${esc(t.bibliotek_ingress)}</p>
    <div class="bib-temaer" role="group" aria-label="${esc(t.bibliotek_temaer)}" hidden>
      <button type="button" class="bib-tema" data-tema="" aria-pressed="true">${esc(t.bibliotek_alle)}</button>${(site.temaer || []).filter((x) => medKilder.some((a) => (a.temaer || []).includes(x.id))).map((x) => `<button type="button" class="bib-tema" data-tema="${esc(x.id)}" aria-pressed="false">${esc(x[sp])}</button>`).join('')}
    </div>
    <form class="bib-sok" role="search" hidden>
      <label class="sr" for="bib-q">${esc(t.bibliotek_sok)}</label>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 3a7 7 0 0 1 5.6 11.2l5.1 5.1-1.4 1.4-5.1-5.1A7 7 0 1 1 10 3Zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z"/></svg>
      <input id="bib-q" type="search" placeholder="${esc(t.bibliotek_sok)}" autocomplete="off" enterkeyhint="search">
    </form>
    <p class="bib-antall" role="status" aria-live="polite" data-alle="${esc(alleTekst)}" data-treff="${esc(t.bibliotek_treff.replace('{n}', '{n}').replace('{alle}', unike))}">${esc(alleTekst)}</p>
    <div class="bib-liste">${medKilder.map((a) => {
      const v = versjon(a, sp);
      const lang = v.sp === 'no' ? 'nb' : 'en';
      return `<section class="bib-sak" data-temaer="${esc((a.temaer || []).join(' '))}"><h2 class="bib-sak-h"><a href="${url(a, sp)}" lang="${lang}">${esc(v.tittel)}</a> <span class="meta">${esc(datoTekst(a.publisert, sp))}</span></h2>
        <ul>${a.kilder.map((k) => {
          const u = https(k.url);
          const dato = kildeDato(k.date, sp);
          const navn = u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(k.name)}<span class="sr"> (${esc(t.ny_fane)})</span></a>` : esc(k.name);
          return `<li class="bib-rad"><span class="bib-navn">${navn}</span> <span class="meta">${[domene(u), dato].filter(Boolean).map(esc).join(' · ')}</span></li>`;
        }).join('')}</ul></section>`;
    }).join('')}</div>
    <p class="bib-ingen" hidden>${esc(t.bibliotek_ingen)} <button type="button" class="bib-alle">${esc(t.bibliotek_vis_alle)}</button></p>
    ${pamelding(t, 'pamelding', sp)}`,
  }));

  // Perspektiver: oversikt, nyeste først, og én side per innlegg (Trond 11.11.2026).
  if (perspektiver.length) {
    const kort = (b) => { const vb = versjon(b, sp); return `<li><a class="kort-lenke" href="/${vb.sp}/${vb.slug}/">${https(b.bilde && b.bilde.url) ? `<img src="${esc(b.bilde.url)}" alt="" width="72" height="72" loading="lazy" decoding="async">` : ''}<span class="kort-tekst"><span class="meta">${esc(b.deltaker)}</span><span class="kort-tittel" lang="${vb.sp === 'no' ? 'nb' : 'en'}">${esc(vb.tittel)}</span>${vb.ingress ? `<span class="kort-ingress" lang="${vb.sp === 'no' ? 'nb' : 'en'}">${esc(vb.ingress)}</span>` : ''}</span></a></li>`; };
    skriv(`${perspSti(sp).slice(1)}index.html`, side({
      sp, t, tittel: `${t.perspektiver} · DARA`, beskrivelse: t.perspektiver_ingress, sti: perspSti(sp), annenSti: perspSti(annen),
      ogBilde: https(perspektiver[0].bilde && perspektiver[0].bilde.url),
      innhold: `<h1 class="tittel arkiv-tittel">${esc(t.perspektiver)}</h1>
      <p class="om">${esc(t.perspektiver_ingress)}</p>
      <ul class="liste lenker">${perspektiver.map(kort).join('')}</ul>
      ${pamelding(t, 'pamelding', sp)}`,
    }));
    for (const a of perspektiver) {
      const v = versjon(a, sp);
      const lang = v.sp === 'no' ? 'nb' : 'en';
      const egen = `/${sp}/${v.slug}/`;
      const annenV = versjon(a, annen);
      const full = site.nettsted + egen;
      const andre = perspektiver.filter((b) => b !== a);
      const bildeSrc = https(a.bilde && a.bilde.url);
      const innhold = `
      <article class="artikkel enkel perspektiv"><div class="art-topp">
        <p class="meta"><a class="merke" href="${perspSti(sp)}">${esc(t.perspektiver)}</a> <time datetime="${esc(a.publisert.slice(0, 10))}">${esc(datoTekst(a.publisert, sp))}</time></p>
        ${v.bare ? `<p class="bare">${esc(t.bare_andre)}</p>` : ''}
        <h1 class="tittel" lang="${lang}">${esc(v.tittel)}</h1>
        ${v.ingress ? `<p class="ingress" lang="${lang}">${esc(v.ingress)}</p>` : ''}
        <p class="byline">${esc(t.av)} ${esc(t.byline)}</p>
        ${delRad(full, v.tittel, t)}
      </div>
      ${bildeSrc ? `<figure class="bilde portrett"><img src="${esc(bildeSrc)}" alt="${esc(a.bilde['alt_' + sp] || a.deltaker)}"${a.bilde.bredde ? ` width="${Number(a.bilde.bredde)}" height="${Number(a.bilde.hoyde)}"` : ''} decoding="async"><figcaption>${esc(a.deltaker)}</figcaption></figure>` : ''}
      <div class="tekst" lang="${lang}">${rikTekst(v.tekst, t)}</div></article>
      ${pamelding(t, 'pamelding', sp)}
      ${andre.length ? `<section class="les-videre" aria-labelledby="lv-t"><h2 id="lv-t" class="seksjon">${esc(t.flere_perspektiver)}</h2><ul class="liste lenker">${andre.map(kort).join('')}</ul></section>` : ''}
      ${theWeek(sp, t)}`;
      skriv(`${sp}/${v.slug}/index.html`, side({
        sp, t, tittel: `${v.tittel} · DARA`, beskrivelse: v.ingress || t.perspektiver_ingress, sti: egen, annenSti: `/${annen}/${annenV.slug}/`,
        ogBilde: bildeSrc, innhold, type: 'article',
      }));
    }
  }

  // Egne sider
  for (const x of sider) {
    const v = x[sp];
    if (!v) continue;
    const annenV = x[annen];
    skriv(`${sp}/${v.slug}/index.html`, side({
      sp, t, tittel: `${v.tittel} · DARA`, beskrivelse: v.ingress || t.om, sti: `/${sp}/${v.slug}/`, annenSti: annenV ? `/${annen}/${annenV.slug}/` : `/${annen}/`,
      ogBilde: https(x.bilde && x.bilde.url), type: 'article',
      innhold: `<article class="artikkel enkel"><div class="art-topp"><h1 class="tittel">${esc(v.tittel)}</h1>${v.ingress ? `<p class="ingress">${esc(v.ingress)}</p>` : ''}${delRad(site.nettsted + `/${sp}/${v.slug}/`, v.tittel, t)}</div>
        ${x.bilde && https(x.bilde.url) ? `<figure class="bilde"><img src="${esc(x.bilde.url)}" alt="${esc(x.bilde['alt_' + sp] || '')}" width="1200" height="675" decoding="async">${v.bildetekst ? `<figcaption>${esc(v.bildetekst)}</figcaption>` : ''}</figure>` : ''}
        <div class="tekst">${avsnitt(v.tekst).replace(/(DARA Source Library|DARA-kildebiblioteket|kildebiblioteket)/, `<a href="${bibliotekSti(sp)}">$1</a>`)}</div></article>
        ${pamelding(t, 'pamelding', sp)}`,
    }));
  }
  // Finnes siden bare på det andre språket, vises den der med en linje om det
  for (const x of sider) {
    if (x[sp] || !x[annen]) continue;
    const v = x[annen];
    const lang = annen === 'no' ? 'nb' : 'en';
    skriv(`${sp}/${v.slug}/index.html`, side({
      sp, t, tittel: `${v.tittel} · DARA`, beskrivelse: v.ingress || t.om, sti: `/${sp}/${v.slug}/`, annenSti: `/${annen}/${v.slug}/`, type: 'article',
      innhold: `<article class="artikkel enkel"><div class="art-topp"><p class="bare">${esc(t.bare_andre)}</p><h1 class="tittel" lang="${lang}">${esc(v.tittel)}</h1>${v.ingress ? `<p class="ingress" lang="${lang}">${esc(v.ingress)}</p>` : ''}</div>
        <div class="tekst" lang="${lang}">${avsnitt(v.tekst).replace(/(DARA Source Library|DARA-kildebiblioteket|kildebiblioteket)/, `<a href="${bibliotekSti(sp)}">$1</a>`)}</div></article>
        ${pamelding(t, 'pamelding', sp)}`,
    }));
  }

  // Personvern
  const pv = sp === 'no' ? 'personvern' : 'privacy';
  const pvTekst = t.personvern_tekst;
  skriv(`${sp}/${pv}/index.html`, side({
    sp, t, tittel: `${t.personvern} · DARA`, beskrivelse: pvTekst[0], sti: `/${sp}/${pv}/`, annenSti: `/${annen}/${annen === 'no' ? 'personvern' : 'privacy'}/`,
    harPm: false, innhold: `<article class="artikkel enkel"><h1 class="tittel">${esc(t.personvern)}</h1><div class="tekst">${avsnitt(pvTekst)}<p><a href="https://substack.com/privacy" target="_blank" rel="noopener">${esc(t.substack_personvern)}</a></p></div></article>`,
  }));
}

// Uten JavaScript og uten funksjonen: velg språk selv.
skriv('index.html', `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>DARA</title><link rel="stylesheet" href="/stil.css?v=${V_CSS}"></head><body><main class="wrap velg"><p class="logo">DARA</p><p><a class="knapp" href="/en/">English</a> <a class="knapp" href="/no/" lang="nb">Norsk</a></p></main></body></html>`);

// Gamle Substack-lenker sendes videre når Substack har flyttet til substack.daramag.com (Don 10.11.2026).
const artikkelRegler = [];
for (const a of artikler) for (const sp of SPRAK) {
  const v = a[sp];
  const m = v && String(v.substack || '').match(/\/p\/([\w-]+)/);
  if (m && v.tittel) artikkelRegler.push(`/p/${m[1]}  /${sp}/${v.slug}/  301`);
}
for (const a of perspektiver) for (const sp of SPRAK) {
  const v = a[sp];
  const m = v && String(v.substack || '').match(/\/p\/([\w-]+)/);
  if (m && v.tittel) artikkelRegler.push(`/p/${m[1]}  /${sp}/${v.slug}/  301`);
}
for (const x of sider) for (const g of x.gamle || []) {
  const sp = /hva|deltaker/.test(g) && x.no ? 'no' : (x.en ? 'en' : 'no');
  artikkelRegler.push(`${g === 'about' ? '/about' : '/p/' + g}  /${sp}/${x[sp].slug}/  301`);
}
skriv('_redirects', [
  ...artikkelRegler,
  `/p/*  ${site.substack_ny}/p/:splat  301`,
  `/s/*  ${site.substack_ny}/s/:splat  301`,
  `/archive  ${site.substack_ny}/archive  301`,
  `/embed  ${site.substack_ny}/embed  301`,
  `/subscribe  ${site.substack_ny}/subscribe  302`,
  `/notes  ${site.substack_ny}/notes  301`,
  `/feed  ${site.substack_ny}/feed  301`,
  '',
].join('\n'));

// Ny artikkel som ikke finnes: send til forsiden med en melding.
skriv('404.html', `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>DARA</title><script src="/404.js"></script></head><body><a href="/en/#flyttet">DARA</a></body></html>`);

console.log(`Ferdig: ${artikler.length} artikler, ${SPRAK.length} språk.`);
