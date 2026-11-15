// Banca de grile Dr. IonDeli.
// Format întrebare:
//   id: identificator unic (text)
//   disc: 'mi' | 'chir' | 'ped' | 'og'  (sau orice cheie definită în DISCIPLINES)
//   chapter: capitolul (text liber)
//   type: 'CS' (complement simplu, 1 răspuns corect) | 'CM' (complement multiplu, 2–4 corecte)
//   q: enunțul
//   options: exact 5 variante (A–E)
//   correct: indicii variantelor corecte (0 = A ... 4 = E)
//   expl: explicația
// Grilele de mai jos sunt exemple originale. Adăugați-le pe ale voastre din „Mai mult → Import”.

window.DISCIPLINES = {
  mi: 'Medicină internă',
  chir: 'Chirurgie',
  ped: 'Pediatrie',
  og: 'Obstetrică-Ginecologie',
};

window.QUESTIONS = [
  // ───────────── MEDICINĂ INTERNĂ ─────────────
  {
    id: 'mi-001', disc: 'mi', chapter: 'Cardiologie – HTA', type: 'CS',
    q: 'Conform ghidurilor ESC/ESH, hipertensiunea arterială se definește la măsurarea în cabinet ca valori:',
    options: ['≥ 130/80 mmHg', '≥ 140/90 mmHg', '≥ 150/95 mmHg', '≥ 160/100 mmHg', '≥ 120/80 mmHg'],
    correct: [1],
    expl: 'HTA = TA sistolică ≥ 140 mmHg și/sau TA diastolică ≥ 90 mmHg la măsurători repetate în cabinet. Gradul 1: 140–159/90–99; gradul 2: 160–179/100–109; gradul 3: ≥ 180/110.',
  },
  {
    id: 'mi-002', disc: 'mi', chapter: 'Tulburări hidroelectrolitice', type: 'CM',
    q: 'Modificări ECG sugestive pentru hiperkaliemie sunt:',
    options: ['Unde T înalte, ascuțite („în cort”)', 'Lărgirea complexului QRS', 'Aplatizarea/dispariția undei P', 'Unde U proeminente', 'Alungirea intervalului QT prin alungirea segmentului ST'],
    correct: [0, 1, 2],
    expl: 'Hiperkaliemia: T ascuțit → alungire PR, aplatizare P → QRS larg → aspect sinusoidal → FV/asistolă. Undele U proeminente apar în hipokaliemie, iar alungirea ST/QT este tipică hipocalcemiei.',
  },
  {
    id: 'mi-003', disc: 'mi', chapter: 'Diabet zaharat – urgențe', type: 'CS',
    q: 'Prima măsură terapeutică în cetoacidoza diabetică la adult este:',
    options: ['Bolus de insulină rapidă înainte de orice hidratare', 'Administrarea de rutină a bicarbonatului de sodiu', 'Rehidratarea cu ser fiziologic 0,9%', 'Perfuzie cu glucoză 5% de la început', 'Restricția aportului de potasiu'],
    correct: [2],
    expl: 'Pilonul inițial este refacerea volemiei cu NaCl 0,9%. Insulina se pornește după verificarea K⁺ (dacă K⁺ < 3,3 mmol/L se corectează întâi potasiul). Glucoza se adaugă când glicemia scade spre ~200–250 mg/dL. Bicarbonatul doar în acidoză severă (pH < 6,9).',
  },
  {
    id: 'mi-004', disc: 'mi', chapter: 'Hematologie – anemii', type: 'CM',
    q: 'Pot produce anemie microcitară:',
    options: ['Deficitul de fier', 'Beta-talasemia minoră', 'Deficitul de vitamină B12', 'Deficitul de acid folic', 'Intoxicația cu plumb'],
    correct: [0, 1, 4],
    expl: 'Microcitoză (VEM scăzut): feripriva, talasemiile, anemia sideroblastică, saturnismul, uneori anemia bolilor cronice. Deficitul de B12 și folat dau anemie megaloblastică (macrocitară).',
  },
  {
    id: 'mi-005', disc: 'mi', chapter: 'Cardiologie – SCA', type: 'CS',
    q: 'Cel mai sensibil și specific biomarker al leziunii miocardice este:',
    options: ['Creatinkinaza totală', 'Mioglobina', 'Troponina cardiacă (I sau T)', 'LDH', 'AST'],
    correct: [2],
    expl: 'Troponinele cardiace (în special cele înalt-sensibile) sunt biomarkerul de elecție pentru diagnosticul infarctului miocardic. Mioglobina e precoce dar nespecifică; CK-MB, LDH și AST au rol istoric.',
  },
  {
    id: 'mi-006', disc: 'mi', chapter: 'Pneumologie – pleură', type: 'CM',
    q: 'Criteriile Light care definesc un revărsat pleural de tip exudat includ:',
    options: ['Raport proteine pleurale/serice > 0,5', 'Raport LDH pleural/seric > 0,6', 'LDH pleural > 2/3 din limita superioară a normalului seric', 'Glucoză pleurală < 60 mg/dL', 'pH pleural < 7,20'],
    correct: [0, 1, 2],
    expl: 'Este suficient un singur criteriu Light pentru exudat. Glucoza scăzută și pH-ul < 7,2 sunt utile (ex. empiem, artrită reumatoidă), dar nu fac parte din criteriile Light.',
  },
  {
    id: 'mi-007', disc: 'mi', chapter: 'Gastroenterologie – ciroză', type: 'CS',
    q: 'Un gradient albumină ser–ascită (SAAG) ≥ 1,1 g/dL sugerează:',
    options: ['Carcinomatoză peritoneală', 'Tuberculoză peritoneală', 'Hipertensiune portală', 'Ascită pancreatică', 'Sindrom nefrotic'],
    correct: [2],
    expl: 'SAAG ≥ 1,1 = ascită prin hipertensiune portală (ciroză, insuficiență cardiacă, Budd-Chiari). SAAG < 1,1: carcinomatoză, TBC, pancreatită, sindrom nefrotic.',
  },
  {
    id: 'mi-008', disc: 'mi', chapter: 'Endocrinologie – tiroidă', type: 'CM',
    q: 'Manifestări clinice ale hipertiroidismului:',
    options: ['Tahicardie / palpitații', 'Scădere ponderală cu apetit păstrat', 'Intoleranță la căldură', 'Bradicardie', 'Constipație'],
    correct: [0, 1, 2],
    expl: 'Hipertiroidismul accelerează metabolismul: tahicardie (adesea FA), scădere ponderală, termofobie, tremor, transpirații, tranzit accelerat. Bradicardia și constipația sunt caracteristice hipotiroidismului.',
  },
  {
    id: 'mi-009', disc: 'mi', chapter: 'Toxicologie', type: 'CS',
    q: 'Antidotul intoxicației cu paracetamol este:',
    options: ['Naloxona', 'Flumazenilul', 'N-acetilcisteina', 'Atropina', 'Fomepizolul'],
    correct: [2],
    expl: 'N-acetilcisteina reface depozitele de glutation și neutralizează metabolitul toxic NAPQI. Naloxona – opioide; flumazenil – benzodiazepine; atropina – organofosforice; fomepizol – metanol/etilenglicol.',
  },
  {
    id: 'mi-010', disc: 'mi', chapter: 'Tromboembolism venos', type: 'CM',
    q: 'Factori de risc pentru tromboembolismul venos:',
    options: ['Imobilizarea prelungită', 'Neoplazia activă', 'Contraceptivele orale estroprogestative', 'Hiperuricemia asimptomatică', 'Hipotensiunea ortostatică'],
    correct: [0, 1, 2],
    expl: 'Triada Virchow: stază (imobilizare), leziune endotelială (chirurgie, traumă), hipercoagulabilitate (neoplazii, estrogeni, sarcină, trombofilii).',
  },
  {
    id: 'mi-011', disc: 'mi', chapter: 'Pneumologie – pneumonii', type: 'CS',
    q: 'Cel mai frecvent agent etiologic al pneumoniei comunitare la adult este:',
    options: ['Staphylococcus aureus', 'Streptococcus pneumoniae', 'Pseudomonas aeruginosa', 'Klebsiella pneumoniae', 'Legionella pneumophila'],
    correct: [1],
    expl: 'Pneumococul rămâne cel mai frecvent agent identificat în pneumonia comunitară. Pseudomonas și Klebsiella sunt mai frecvente în pneumoniile nosocomiale / la pacienți cu comorbidități.',
  },
  {
    id: 'mi-012', disc: 'mi', chapter: 'Nefrologie', type: 'CM',
    q: 'Sindromul nefrotic se caracterizează prin:',
    options: ['Proteinurie > 3,5 g/24 h/1,73 m²', 'Hipoalbuminemie', 'Edeme', 'Hematurie cu cilindri hematici', 'Oligurie cu HTA severă ca element definitoriu'],
    correct: [0, 1, 2],
    expl: 'Sindromul nefrotic: proteinurie nefrotică, hipoalbuminemie, edeme, hiperlipidemie (± lipidurie). Hematuria cu cilindri hematici, oliguria și HTA sunt elemente de sindrom nefritic.',
  },
  {
    id: 'mi-013', disc: 'mi', chapter: 'Diabet zaharat – urgențe', type: 'CS',
    q: 'La un pacient diabetic inconștient prin hipoglicemie, în afara spitalului, fără acces venos, tratamentul de elecție este:',
    options: ['Glucoză per os', 'Glucagon intramuscular/subcutanat', 'Insulină rapidă', 'Hidrocortizon i.v.', 'Ser fiziologic subcutanat'],
    correct: [1],
    expl: 'Pacientul inconștient nu poate primi nimic per os (risc de aspirație). Fără abord venos se administrează glucagon i.m./s.c. (sau intranazal); cu abord venos – glucoză hipertonă i.v.',
  },

  // ───────────── CHIRURGIE ─────────────
  {
    id: 'ch-001', disc: 'chir', chapter: 'Căi biliare', type: 'CS',
    q: 'Semnul Murphy pozitiv este caracteristic pentru:',
    options: ['Apendicita acută', 'Colecistita acută', 'Pancreatita acută', 'Ulcerul perforat', 'Diverticulita sigmoidiană'],
    correct: [1],
    expl: 'Semnul Murphy: oprirea inspirului profund la palparea hipocondrului drept, prin contactul colecistului inflamat cu mâna examinatorului.',
  },
  {
    id: 'ch-002', disc: 'chir', chapter: 'Căi biliare', type: 'CM',
    q: 'Triada Charcot (angiocolita acută) cuprinde:',
    options: ['Febră cu frisoane', 'Icter', 'Durere în hipocondrul drept', 'Hipotensiune arterială', 'Confuzie mentală'],
    correct: [0, 1, 2],
    expl: 'Triada Charcot = durere + febră/frisoane + icter. Adăugarea hipotensiunii și confuziei definește pentada Reynolds (angiocolită severă/supurată).',
  },
  {
    id: 'ch-003', disc: 'chir', chapter: 'Ocluzii intestinale', type: 'CS',
    q: 'Cea mai frecventă cauză de ocluzie a intestinului subțire la adult, în țările dezvoltate, este:',
    options: ['Hernia strangulată', 'Bridele (aderențele) postoperatorii', 'Tumorile intestinale', 'Ileusul biliar', 'Invaginația'],
    correct: [1],
    expl: 'Aderențele postoperatorii sunt prima cauză de ocluzie a intestinului subțire; herniile sunt a doua cauză. La colon predomină cancerul colorectal și volvulusul.',
  },
  {
    id: 'ch-004', disc: 'chir', chapter: 'Apendicita acută', type: 'CM',
    q: 'Semne clinice întâlnite în apendicita acută:',
    options: ['Semnul Blumberg (decompresiune dureroasă)', 'Semnul Rovsing', 'Semnul psoasului', 'Semnul Murphy', 'Semnul Cullen'],
    correct: [0, 1, 2],
    expl: 'Blumberg (iritație peritoneală), Rovsing (durere în FID la compresiunea FIS), psoas (apendice retrocecal). Murphy – colecistită; Cullen (echimoză periombilicală) – pancreatită acută hemoragică, hemoperitoneu.',
  },
  {
    id: 'ch-005', disc: 'chir', chapter: 'Arsuri', type: 'CS',
    q: 'Conform „regulii lui 9” (Wallace), la adult, un membru inferior în întregime reprezintă:',
    options: ['9%', '18%', '27%', '36%', '1%'],
    correct: [1],
    expl: 'Adult: cap-gât 9%, fiecare membru superior 9%, trunchi anterior 18%, trunchi posterior 18%, fiecare membru inferior 18%, perineu 1%. La copil capul are o pondere mai mare (se folosește diagrama Lund-Browder).',
  },
  {
    id: 'ch-006', disc: 'chir', chapter: 'Pancreatita acută', type: 'CM',
    q: 'Criterii Ranson evaluate la internare (pancreatită acută non-biliară):',
    options: ['Vârsta > 55 ani', 'Leucocite > 16.000/mm³', 'Amilaza serică > 1000 UI/L', 'Glicemia > 200 mg/dL', 'Lipaza > 3× limita superioară'],
    correct: [0, 1, 3],
    expl: 'La internare: vârstă > 55, leucocite > 16.000, glicemie > 200 mg/dL, LDH > 350 UI/L, AST > 250 UI/L. Amilaza și lipaza susțin diagnosticul, dar NU sunt criterii de severitate Ranson.',
  },
  {
    id: 'ch-007', disc: 'chir', chapter: 'Hernii', type: 'CS',
    q: 'Conduita în hernia inghinală strangulată este:',
    options: ['Reducere manuală forțată și externare', 'Tratament conservator cu analgezice', 'Intervenție chirurgicală de urgență', 'Intervenție programată peste 2–3 săptămâni', 'Purtarea unui bandaj herniar'],
    correct: [2],
    expl: 'Strangularea implică compromiterea vasculară a conținutului herniar — urgență chirurgicală (risc de necroză și perforație). Taxisul este contraindicat când se suspectează strangularea.',
  },
  {
    id: 'ch-008', disc: 'chir', chapter: 'Cancer colorectal', type: 'CS',
    q: 'Markerul tumoral folosit în monitorizarea postoperatorie a cancerului colorectal este:',
    options: ['AFP', 'CA-125', 'CEA (antigen carcinoembrionar)', 'PSA', 'β-hCG'],
    correct: [2],
    expl: 'CEA se folosește pentru urmărirea recidivei după rezecție (nu pentru screening). AFP – hepatocarcinom/tumori germinale; CA-125 – ovar; PSA – prostată; β-hCG – sarcină, coriocarcinom, tumori germinale.',
  },
  {
    id: 'ch-009', disc: 'chir', chapter: 'Traumatisme toracice', type: 'CM',
    q: 'Semne ale pneumotoraxului sufocant (în tensiune):',
    options: ['Deviația traheei spre partea opusă', 'Hipotensiune arterială', 'Turgescența jugularelor', 'Matitate la percuție pe partea afectată', 'Murmur vezicular abolit pe partea afectată'],
    correct: [0, 1, 2, 4],
    expl: 'Pneumotoraxul în tensiune: detresă respiratorie, hipersonoritate (NU matitate), murmur abolit, deviație traheală controlaterală, jugulare turgescente, hipotensiune. Diagnosticul este clinic; matitatea sugerează hemotorax.',
  },
  {
    id: 'ch-010', disc: 'chir', chapter: 'Traumatisme toracice', type: 'CS',
    q: 'Gestul terapeutic imediat în pneumotoraxul în tensiune este:',
    options: ['Radiografie toracică de confirmare', 'Decompresie imediată pe ac, urmată de drenaj toracic', 'Intubație orotraheală și ventilație cu presiune pozitivă', 'Toracotomie de urgență', 'Oxigenoterapie și reevaluare la 6 ore'],
    correct: [1],
    expl: 'Diagnosticul este clinic, iar tratamentul nu trebuie amânat pentru imagistică: decompresie pe ac (ATLS – spațiul V intercostal, linia axilară anterioară/medie la adult), apoi tub de dren toracic.',
  },

  // ───────────── PEDIATRIE ─────────────
  {
    id: 'pd-001', disc: 'ped', chapter: 'Creștere și dezvoltare', type: 'CS',
    q: 'Sugarul sănătos își dublează greutatea de la naștere în jurul vârstei de:',
    options: ['2 luni', '4–5 luni', '8 luni', '12 luni', '18 luni'],
    correct: [1],
    expl: 'Greutatea se dublează la ~4–5 luni și se triplează la ~12 luni. Talia crește cu ~50% în primul an.',
  },
  {
    id: 'pd-002', disc: 'ped', chapter: 'Neonatologie', type: 'CM',
    q: 'Parametri evaluați în scorul Apgar:',
    options: ['Frecvența cardiacă', 'Efortul respirator', 'Tonusul muscular', 'Temperatura corporală', 'Glicemia'],
    correct: [0, 1, 2],
    expl: 'Apgar (la 1 și 5 minute): culoare, frecvență cardiacă, reactivitate (grimasă), tonus, respirație — câte 0–2 puncte fiecare.',
  },
  {
    id: 'pd-003', disc: 'ped', chapter: 'Patologie respiratorie', type: 'CS',
    q: 'Cel mai frecvent agent etiologic al bronșiolitei acute la sugar este:',
    options: ['Virusul sincițial respirator', 'Virusul gripal B', 'Mycoplasma pneumoniae', 'Haemophilus influenzae tip b', 'Streptococcus pyogenes'],
    correct: [0],
    expl: 'VSR produce majoritatea cazurilor de bronșiolită (sezon rece, sub 2 ani). Alți agenți: rinovirus, metapneumovirus, parainfluenza.',
  },
  {
    id: 'pd-004', disc: 'ped', chapter: 'Deshidratarea acută', type: 'CM',
    q: 'Semne de deshidratare severă la copil (clasificare OMS):',
    options: ['Letargie sau inconștiență', 'Ochi înfundați în orbite', 'Pliul cutanat persistă foarte lent (> 2 secunde)', 'Bea avid, sete intensă', 'Prezența lacrimilor la plâns'],
    correct: [0, 1, 2],
    expl: 'Deshidratare severă: letargie, ochi înfundați, nu poate bea/bea slab, pliu cutanat > 2 s. „Bea avid” este semn de deshidratare moderată; lacrimile prezente indică hidratare relativ păstrată.',
  },
  {
    id: 'pd-005', disc: 'ped', chapter: 'Cardiopatii congenitale', type: 'CS',
    q: 'Tetralogia Fallot NU include:',
    options: ['Defect septal ventricular', 'Stenoză pulmonară (obstrucție în tractul de ejecție al VD)', 'Aortă călare pe sept', 'Hipertrofie ventriculară dreaptă', 'Defect septal atrial'],
    correct: [4],
    expl: 'Tetralogia Fallot: DSV, obstrucția tractului de ejecție al VD, dextropoziția aortei, HVD. Asocierea cu DSA definește „pentalogia Fallot”.',
  },
  {
    id: 'pd-006', disc: 'ped', chapter: 'Boli eruptive', type: 'CS',
    q: 'Semnul patognomonic din perioada prodromală a rujeolei este:',
    options: ['Limba zmeurie', 'Semnul Koplik', 'Semnul Pastia', 'Adenopatia retroauriculară dureroasă', 'Exantemul în „cer înstelat”'],
    correct: [1],
    expl: 'Petele Koplik — mici puncte albe pe fond eritematos pe mucoasa jugală, apar înaintea erupției. Limba zmeurie și semnul Pastia – scarlatină; adenopatia retroauriculară – rubeolă; erupția polimorfă „în cer înstelat” – varicelă.',
  },
  {
    id: 'pd-007', disc: 'ped', chapter: 'Vaccinări', type: 'CM',
    q: 'Conform calendarului național de vaccinare din România, la naștere (în maternitate) se administrează:',
    options: ['Vaccinul hepatitic B', 'Vaccinul BCG', 'Vaccinul ROR', 'Vaccinul hexavalent', 'Vaccinul pneumococic conjugat'],
    correct: [0, 1],
    expl: 'În maternitate: Hep B (primele 24 h) și BCG (2–7 zile). Hexavalentul și pneumococicul încep la 2 luni; ROR la 12 luni.',
  },
  {
    id: 'pd-008', disc: 'ped', chapter: 'Reumatismul articular acut', type: 'CS',
    q: 'Care dintre următoarele NU este criteriu major Jones pentru febra reumatismală?',
    options: ['Cardita', 'Poliartrita', 'Coreea Sydenham', 'Nodulii subcutanați', 'Artralgia'],
    correct: [4],
    expl: 'Criterii majore: cardită, artrită, coree, noduli subcutanați, eritem marginat. Artralgia, febra, VSH/PCR crescute și PR alungit sunt criterii minore.',
  },

  // ───────────── OBSTETRICĂ-GINECOLOGIE ─────────────
  {
    id: 'og-001', disc: 'og', chapter: 'Sarcina fiziologică', type: 'CS',
    q: 'Data probabilă a nașterii (regula lui Naegele) se calculează astfel:',
    options: ['Data ultimei menstruații + 9 luni', 'Prima zi a ultimei menstruații + 7 zile − 3 luni (+ 1 an)', 'Data concepției + 40 de săptămâni', 'Ultima zi a ultimei menstruații + 280 de zile', 'Prima zi a ultimei menstruații − 7 zile + 3 luni'],
    correct: [1],
    expl: 'Naegele: DUM (prima zi) + 7 zile − 3 luni + 1 an ≈ 280 de zile (40 săptămâni) de la DUM, pentru cicluri regulate de 28 de zile.',
  },
  {
    id: 'og-002', disc: 'og', chapter: 'HTA în sarcină', type: 'CM',
    q: 'Elemente care definesc preeclampsia cu semne de severitate:',
    options: ['TA ≥ 160/110 mmHg', 'Trombocite < 100.000/mm³', 'Cefalee persistentă sau tulburări vizuale', 'O singură valoare TA de 140/90 mmHg fără alte simptome', 'Hiperemeza din trimestrul I'],
    correct: [0, 1, 2],
    expl: 'Semne de severitate: TA ≥ 160/110, trombocitopenie, creșterea transaminazelor, insuficiență renală, edem pulmonar, simptome cerebrale/vizuale, durere epigastrică/hipocondru drept.',
  },
  {
    id: 'og-003', disc: 'og', chapter: 'Hemoragia postpartum', type: 'CS',
    q: 'Cea mai frecventă cauză de hemoragie postpartum este:',
    options: ['Atonia uterină', 'Retenția de resturi placentare', 'Leziunile de părți moi', 'Coagulopatiile', 'Inversiunea uterină'],
    correct: [0],
    expl: 'Regula celor „4T”: Tonus (atonie ~70–80%), Trauma, Țesut (resturi), Trombină (coagulopatie). Atonia uterină este de departe cea mai frecventă.',
  },
  {
    id: 'og-004', disc: 'og', chapter: 'HTA în sarcină', type: 'CM',
    q: 'Sindromul HELLP cuprinde:',
    options: ['Hemoliză', 'Creșterea enzimelor hepatice', 'Trombocitopenie', 'Hiperglicemie', 'Leucocitoză marcată'],
    correct: [0, 1, 2],
    expl: 'HELLP = Hemolysis, Elevated Liver enzymes, Low Platelets — complicație severă a preeclampsiei.',
  },
  {
    id: 'og-005', disc: 'og', chapter: 'Sarcina ectopică', type: 'CS',
    q: 'La o pacientă stabilă hemodinamic, cu sarcină ectopică tubară nerumptă, β-hCG scăzut și fără activitate cardiacă embrionară, tratamentul de primă intenție poate fi:',
    options: ['Metotrexat', 'Oxitocină', 'Misoprostol în monoterapie', 'Histerectomie', 'Chiuretaj uterin'],
    correct: [0],
    expl: 'Metotrexatul este indicat în sarcina ectopică nerumptă, la paciente stabile, cu β-hCG sub pragul acceptat și fără activitate cardiacă. Instabilitatea hemodinamică impune chirurgie.',
  },
  {
    id: 'og-006', disc: 'og', chapter: 'Cancer de col uterin', type: 'CM',
    q: 'Factori de risc pentru cancerul de col uterin:',
    options: ['Infecția persistentă cu HPV cu risc oncogen înalt', 'Fumatul', 'Partenerii sexuali multipli', 'Nuliparitatea', 'Menopauza tardivă'],
    correct: [0, 1, 2],
    expl: 'Factori de risc: HPV 16/18 persistent, debut sexual precoce, parteneri multipli, fumat, imunosupresie, multiparitate. Nuliparitatea și menopauza tardivă cresc riscul de cancer endometrial/mamar, nu de col.',
  },
  {
    id: 'og-007', disc: 'og', chapter: 'Hemoragii din trimestrul III', type: 'CS',
    q: 'Manifestarea tipică a placentei praevia este:',
    options: ['Sângerare vaginală dureroasă cu uter hiperton', 'Sângerare vaginală indoloră, cu sânge roșu, în trimestrul III', 'Durere abdominală fără sângerare', 'Febră și lichid amniotic fetid', 'Hipertensiune și proteinurie'],
    correct: [1],
    expl: 'Placenta praevia: sângerare indoloră, roșie, recurentă, uter relaxat. Decolarea prematură de placentă: durere, uter „de lemn”, suferință fetală. Tușeul vaginal este contraindicat până la excluderea praeviei.',
  },
  {
    id: 'og-008', disc: 'og', chapter: 'Diabetul gestațional', type: 'CS',
    q: 'Screeningul diabetului gestațional se face de regulă prin:',
    options: ['HbA1c în trimestrul III', 'TTGO cu 75 g glucoză la 24–28 de săptămâni', 'Glicemie à jeun la 36 de săptămâni', 'Glicozurie la fiecare consultație', 'Fructozamină în trimestrul I'],
    correct: [1],
    expl: 'TTGO 75 g la 24–28 săptămâni (criterii IADPSG: à jeun ≥ 92, la 1 h ≥ 180, la 2 h ≥ 153 mg/dL — o singură valoare este suficientă).',
  },
  {
    id: 'og-009', disc: 'og', chapter: 'Operația cezariană', type: 'CM',
    q: 'Indicații de operație cezariană:',
    options: ['Placenta praevia centrală (totală)', 'Prezentația transversă în travaliu, la termen', 'Disproporția cefalo-pelvină confirmată', 'Primiparitatea, ca unic motiv', 'Ruptura prematură de membrane, ca unic motiv'],
    correct: [0, 1, 2],
    expl: 'Placenta praevia totală, situația transversă și disproporția cefalo-pelvină fac imposibilă nașterea pe cale vaginală. Primiparitatea sau RPM izolată nu sunt indicații de cezariană.',
  },
];
