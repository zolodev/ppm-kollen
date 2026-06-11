# PPM Kollen

Ett hobbyprojekt som använder maskininlärning för att ranka och prognostisera avkastning för svenska PPM-fonder. Resultaten uppdateras varje vecka och publiceras automatiskt.

**Inte finansiell rådgivning.** Prognoserna är experimentella och baserade på historiska mönster — ingen garanti för framtida avkastning.

## Vad är det?

PPM-systemet låter svenska medborgare välja var en del av sin allmänna pension placeras bland hundratals fonder. PPM Kollen undersöker om moderna ML-modeller kan hitta mönster i historisk fonddata och om dessa mönster håller över tid.

Fyra modelltyper används i ett ensemble:

| Modell | Beskrivning |
|--------|-------------|
| **LSTM** | Rekurrenta neuronnät — bra på långsiktiga beroenden i tidsserier |
| **GRU** | Effektivare variant av LSTM, bra när träningsdatan är begränsad |
| **TCN** | Dilaterade konvolutioner som fångar mönster på flera tidsskalor |
| **XGBoost** | Gradientförstärkta beslutsträd — fångar icke-linjära samband |

Alla modeller tränas med kvantilförlust för att producera osäkerhetsintervall (Q10 / Q50 / Q90) snarare än punktprediktioner.

## Hur det fungerar

1. **Datainsamling** — Veckovis fondavkastning hämtas för ~1 100 PPM-fonder och skalas med robust skalning (median/IQR)
2. **Modellträning** — Varje modelltyp tränas per fond och investeringshorisont (~4 400 kombinationer per modelltyp)
3. **Kvantilprognoser** — Varje modell genererar Q10, Q50 och Q90 som kombineras till ett ensemble-intervall
4. **Backtest** — Modellerna utvärderas på osedd data med nyckeltal: hit rate, coverage, MAE och Sharpe
5. **Ranking & publicering** — Fonder rankas efter ett sammansatt poängsystem och publiceras som JSON varje vecka

### Investeringshorisonter

| Horisont | Period | Passar för |
|----------|--------|------------|
| `1w` | 1 vecka | Kortsiktig rörelse, taktisk omplacering |
| `4w` | 4 veckor | Månadsvis ombalansering |
| `13w` | 13 veckor | Kvartalsvy, säsongsmönster |
| `26w` | 26 veckor | Halvårsperspektiv, trendföljning |

## Teknikstack

- **ML:** Python · TensorFlow/Keras · XGBoost
- **Hårdvara:** NVIDIA Jetson · 62 GB RAM · NVMe
- **Drift:** systemd-tjänster med kraschåterställning och automatisk veckovis publicering
- **Frontend:** Vanilla HTML/CSS/JS — inga ramverk · GitHub Pages

## Länkar

- **Stabil:** [ppmkollen.se](https://ppmkollen.se/)
- **Dev:** [dev.ppmkollen.se](https://dev.ppmkollen.se/)
