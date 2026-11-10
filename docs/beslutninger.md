# Beslutninger for daramag.com

## 10.11.2026 (Trond)
- daramag.com blir DARAs egen forside. Substack flyttes til substack.daramag.com og tar seg av e-post, abonnenter og arkiv. Magasinet blir på magasin.daramag.com.
- Forsiden: siste publiserte artikkel i sin helhet, delingsknapper, «I samarbeid med» LeanIn, påmelding til The Week, tre tidligere som folder seg ut, The Week-kortet, bunn med Om DARA, Arkiv, Personvern og «Redaktør: Trond Slyngstad».
- Hver artikkel får egen side på norsk og engelsk, med deling og «Les videre».
- Språk: norsk for besøk fra Norge, ellers engelsk. Bryter NO | EN som huskes.
- Påmelding: bare The Week på e-post. Alt annet leses på siden.
- Linjen øverst: «DARA er et gratis nettmagasin om deltakerøkonomien: hvem som skaper verdien av data, og hvem som får den.»
- LeanIn: «I samarbeid med», logo og «Tidsbesparende oppfølging med KI», uten lenke før lansering.
- Ingen Perspektiver foreløpig.

## Gjenstår før daramag.com flyttes
- Koble repoet til Cloudflare Pages og sette `SUBSTACK`.
- Teste påmeldingen mot Substack.
- Flytte DNS for daramag.com fra one.com til Cloudflare (domenet blir registrert hos one.com), uten å miste e-post eller magasinet.
- Bytte Substacks domene til substack.daramag.com, og sette `substack` i content/site.json til den nye adressen.
- Både daramag.com og www.daramag.com må kobles til Cloudflare Pages, så gamle lenker på www også sendes videre.
- Sette `SUBSTACK` i Cloudflare (først https://www.daramag.com mens Substack fortsatt ligger der, så https://substack.daramag.com).
- Legge inn en regel for antall forsøk på /api/abonner i Cloudflare (for eksempel 5 per 10 sekunder per IP).
- Vurdere å legge skriftene på egen server i stedet for Google Fonts.
