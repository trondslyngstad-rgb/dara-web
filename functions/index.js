// daramag.com/: velger språk (Trond 10.11.2026).
// Rekkefølge: valget man har gjort selv (informasjonskapselen «sprak»), så besøk fra Norge eller nettleserspråk nb/nn/no gir norsk, ellers engelsk.
// Landet kommer fra Cloudflare (request.cf.country). IP-adressen lagres ikke.
export function onRequestGet({ request }) {
  const kake = request.headers.get('Cookie') || '';
  const valgt = (kake.match(/(?:^|;\s*)sprak=(no|en)\b/) || [])[1];
  let sp = valgt;
  if (!sp) {
    const land = (request.cf && request.cf.country) || '';
    const nett = (request.headers.get('Accept-Language') || '').toLowerCase();
    const forste = nett.split(',')[0].trim();
    if (/^(nb|nn|no)\b/.test(forste)) sp = 'no';
    else if (/^en\b/.test(forste) && land !== 'NO') sp = 'en';
    else sp = land === 'NO' || /(^|,)\s*(nb|nn|no)\b/.test(nett) ? 'no' : 'en';
  }
  const url = new URL(request.url);
  return new Response(null, { status: 302, headers: { Location: `${url.origin}/${sp}/${url.search}`, 'Cache-Control': 'private, no-store', Vary: 'Cookie, Accept-Language' } });
}
