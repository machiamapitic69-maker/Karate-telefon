# Dr. IonDeli 🩺

Aplicație de pregătire pentru **examenul național de rezidențiat** (Medicină).
Funcționează pe telefon și pe laptop, se poate instala ca aplicație (PWA) și merge și fără internet.

## Ce știe să facă

- **Învață**: grile pe discipline și capitole, CS și CM, cu feedback imediat și explicații.
- **Punctaj oficial**: CS = 4 puncte; CM = 1 punct pe fiecare variantă tratată corect (max. 5), dar 0 puncte dacă sunt marcate mai puțin de 2 sau mai mult de 4 variante.
- **Recapitulare cu repetiție spațiată**: grilele greșite revin imediat, cele corecte după 1, 3, 7, 16 și 35 de zile.
- **Simulare de examen**: 20 / 50 / 100 / 200 de grile, cronometru (72 s pe grilă, adică 4 ore pentru 200), proporție CS/CM ca la examen, rezultat raportat la 950 de puncte și analiză pe discipline.
- **Statistici**: obiectiv zilnic, serie de zile consecutive, progres pe discipline, numărătoare inversă până la examen.
- **Greșelile mele și Favorite**: liste pe care le poți exersa separat.
- **Tutor AI (opțional, Claude)**: explicații detaliate pentru orice grilă, întrebări libere, plus **generare de grile noi din notițe sau din textul din carte**.
- **Import**: grile în JSON sau CSV (`disciplina;capitol;tip;enunt;A;B;C;D;E;corecte;explicatie`).
- **Backup**: export și restaurare a progresului, ca să îl muți pe alt dispozitiv.

## Cum o pornești

E un site static, fără build. Oricare dintre variante merge:

```bash
python3 -m http.server 8000   # apoi deschide http://localhost:8000
```

…sau îl publici pe GitHub Pages / Netlify și îl deschizi de pe telefon → „Adaugă pe ecranul principal”.

## Banca de grile

Grilele incluse în `data/questions.js` sunt **exemple originale** (40 de grile pe Medicină internă, Chirurgie, Pediatrie, Obstetrică-Ginecologie).
Grilele proprii se adaugă din aplicație (Mai mult → Import) sau se generează cu tutorul AI din materia de învățat.
Verifică întotdeauna cu bibliografia oficială de rezidențiat.

## Tutorul AI

În „Mai mult → Tutor AI” se introduce o cheie API Claude (de pe console.anthropic.com). Cheia rămâne salvată doar în browserul de pe acel dispozitiv și e trimisă doar către API-ul Anthropic. Fiecare cerere costă puțin (se plătește după consum).

## Structură

```
index.html          interfața
styles.css          stiluri (temă luminoasă și întunecată)
app.js              logica: sesiuni, punctaj, repetiție spațiată, simulare, AI, import/export
data/questions.js   banca de grile
sw.js, manifest.json, icon.svg   PWA (instalare și offline)
```
