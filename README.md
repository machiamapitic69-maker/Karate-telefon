# Ritm – taskuri & calendar pentru iPhone

Aplicație de planificare (ca Google Calendar, dar orientată pe **terminarea taskurilor**).
E o aplicație web instalabilă (PWA): merge pe iPhone ca o aplicație normală, pe tot ecranul, și funcționează offline.
Datele stau doar pe telefonul tău.

## Ce face
- **Azi** – progresul zilei, „Următorul pas” (ce ai de făcut *acum*), programul pe ore cu linia orei curente, restanțe pe care le muți pe azi dintr-o atingere.
- **Adăugare rapidă în limbaj natural** – scrii `mâine la 18 sală #sport 45min !` și aplicația înțelege singură data, ora, durata, categoria și prioritatea.
- **Calendar** lunar cu puncte colorate pe categorii, și un avertisment când ți-ai planificat mai multe ore decât ai într-o zi.
- **Liste** – Planificate, Cândva (idei fără termen), Rutine (obiceiuri zilnice/săptămânale cu serii 🔥), Finalizate, plus căutare.
- **Pași mici** (sub-taskuri) pentru taskurile mari.
- **Focus (Pomodoro)** legat de un task, cu timp de focus contorizat.
- **Progres** – serie de zile, rata de finalizare, grafice pe zile și pe categorii.
- **Mementouri** – notificări (iOS 16.4+, cu aplicația instalată) și export în **Calendarul iPhone** (.ics, cu alarmă inclusă).
- Copie de siguranță / restaurare, categorii editabile, mod întunecat automat.

## Cum o pui pe iPhone
1. Publică folderul pe GitHub Pages: în repo **Settings → Pages → Build and deployment → Deploy from a branch**,
   alege branch-ul (de ex. `main` după merge) și folderul `/ (root)`, apoi **Save**.
   După 1–2 minute primești un link de forma `https://<utilizator>.github.io/Karate-telefon/`.
2. Deschide linkul în **Safari** pe iPhone.
3. Apasă **Partajează** → **Adaugă pe ecranul principal**.
4. Deschide **Ritm** de pe ecranul principal. Gata!

## Rulare locală
```
python3 -m http.server 8000
```
apoi deschide http://localhost:8000.

## Fișiere
- `index.html`, `styles.css`, `app.js` – aplicația
- `sw.js` – service worker (offline)
- `manifest.webmanifest`, `icons/` – instalare ca aplicație
