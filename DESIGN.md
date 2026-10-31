# De Ophaalbrug — design sheet

## Premise

Een Amsterdamse gracht waar fietsers de hele dag over een witte ophaalbrug rijden,
tot een tjalk met een te hoge mast aankomt: de brugwachter laat de slagbomen
zakken, één haastige fietser mist het net, de brug gaat open, de boot vaart door,
en daarna stroomt de wachtende rij weer over.

- Archetype (router): station/transit + harbour (machine grammar voor de brug).
- Assumption: 24 x 16 slab, 40 s loop at 40 Hz, 4 systemen (ophaalbrug, slagbomen
  + lichten, tjalk + kielzog, terras-bediening), 6 rollen + 1 verstoring
  (te late fietser), 64 kleuren.

## Camera Side

- Locked: azimuth 45, elevation 33, fov 20.5, fill 0.92/0.94, target (0, 2.0, -0.6) so the gables and the slab share the margin, subjectScale 1.0.
- Exterior. Gracht loopt langs X door het midden (z -0.6 → 5.0), water y -0.5, slab 0.9 dik in lichte steen.
- +Z (voor): smalle kade 3 m met fietspad, brugwachtershuisje, Amsterdammertjes,
  fietsenrek, lantaarn, bank.
- -Z (achter): straat langs X (fietsers), stoep met terras, zes grachtenpanden
  met topgevels en hijsbalken.
- Landmark: ophaalbrug op x 0..3 met portaal, balansbalken en trekstangen; top
  bij open brug y ≈ 9.5.
- Drempel vrij houden: brugdek en de 1.5 m voor beide slagbomen.
- Nooit afdekken: de brug tijdens 13–31 s; de mast die eronderdoor gaat.

## Cast Sheet

| Rol | Silhouet | Locomotie | Actie | Reactie | Exit | Prop |
| --- | --- | --- | --- | --- | --- | --- |
| Brugwachter | pet, blauw jasje, in huisje | staat | drukt knop (10.0, 13.0) | kijkt de boot na, zwaait terug (21) | blijft in huisje | knoppenpaneel |
| Schipper | pet, trui, aan het roer | staat op achterdek | stuurt aan de helmstok | zwaait naar brugwachter (20.6) | vaart de slab uit | helmstok + vlag |
| Te late fietser | colbert, haast | fietst hard, remt | remt vol voor slagboom (12.7) | handen omhoog | rijdt als eerste over (33.1) | koffiebeker |
| Wachtende fietsers (2) | jas, rugzak / bloemen | fietsen, voet aan de grond | wachten op de straatrijbaan (x 2.7 / 4.4, z -2.65) | — | rijden over na 33.5 / 34.1 | fietskrat met bloemen |
| Passanten (3) | — | fietsen over de brug / langs de gracht | — | — | slab-rand | — |
| Ober | schort, wit hemd | loopt deur ↔ tafel | ruilt lege glazen voor volle (3.3–4.8), brengt bitterballen (25) | — | terug naar binnen | dienblad |
| Terrasgasten (2) | zittend | — | nemen slokjes | kijken naar de brug | blijven zitten | bier |

## System Sheet

- Loop 40 s, DT 1/40.
- **Ophaalbrug**: engage (knop 13.0) → werk (blad omhoog 13.2–18.2) → output
  (doorvaart open) → settle (omlaag 26.0–31.0). Parallellogram: balansbalk draait
  met dezelfde hoek als het blad, trekstangen blijven verticaal.
- **Slagbomen + lichten**: lichten knipperen 10.0–33.6, bomen dalen 11.0–12.6,
  stijgen 31.6–33.0.
- **Tjalk**: boeg x(t) via keys; mast passeert brug ~20.7 s; achtersteven voorbij
  de brug vóór het blad zakt.
- **Terras**: glazen ruilen per loop, bierniveau loopt af van 4.5 s tot 40 s en
  sluit naadloos.

## Beats

| t | Beat | QA-shot |
| --- | --- | --- |
| 3.0 | normaal: fietsers over de brug, ober naar terras | `t-03.00` |
| 12.7 | slagbomen dicht, late fietser remt | `t-12.70` |
| 20.7 | brug open, mast onder de balansbalk | `t-20.70` |
| 28.5 | brug zakt, boot vaart weg met kielzog | `t-28.50` |
| 34.5 | rij stroomt over, rust | `t-34.50` |

## Proof (shots/)

`wide|ipad|phone-b1..b5` uit `qa/shoot.mjs`, close-ups `c-*.png` via `qa/probe.mjs`, naad-diff `seam-diff.png` (alleen bewegende fietsers verschillen), `qa/frames/<entity>/sheet.png` voor L, keeper, leaf, tjalk, waiter, G1, G2.

## Detail Budget

- Brug: portaal, 2 balansbalken met contragewicht, 2 trekstangen, blad met
  planken, leuningen, scharnier, landhoofd: ~45 delen.
- Tjalk: romp, zeeg, zwaarden, mast, giek met opgedoekt zeil, roef, helmstok,
  vlag, fiets aan dek, bloembakken, reddingsboei: ~40 delen.
- Panden: 6, elk baksteen, raamkozijnen, banden, gevel­top, hijsbalk, deur + stoep.
