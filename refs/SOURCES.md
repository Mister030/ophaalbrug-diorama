# Sources

## Shape

| Question | Searched | Found | Decision |
| --- | --- | --- | --- |
| how does a Dutch bascule bridge open for a boat | yt: `amsterdam canal boat under bridge cyclists` | `_80SCBeGhSY` (20–140 s), `refs/gracht/sheet-01.png`: barriers + red lights first, leaf rises, barge passes, leaf lowers, cyclists wait at the boom | matched: lights → booms → lift → pass → lower → booms up |
| canal house / tour boat models | sketchfab API `canal house`, `tour boat` (downloadable + CC0) | only `MV Spartan` (a ship, wrong subject) | hand-built |

## Motion

| Question | Found | Decision |
| --- | --- | --- |
| order and pace of the opening | sheet-01: booms are down well before the leaf moves; leaf rises slowly and evenly; the barge keeps moving slowly | booms 1.6 s, lift 5 s (compressed), boat slows but never stops |
| what do waiting cyclists do | sheet-01: stand astride the bike, one foot down | `footDown` pose blended in when speed ≈ 0 |

## Assets

| Asset | Ladder step | Source / query | Licence | Decision |
| --- | --- | --- | --- | --- |
| bridge, boat, houses, bikes | 4 (hand-built) | sketchfab CC0 search above | — | hand-built from refs |
| people | template | `peopleModel-street.js` | MIT (skill) | used |
