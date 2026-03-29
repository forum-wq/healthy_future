# TEXTY-PREHLAD.md — Audit a opravy

**Porovnanie:** TEXTY-PREHLAD.md vs. ClaudeCode_Prompt_HFS_Web_Feedback_Form_v1_0.md vs. živý deployment
**Dátum:** 27. marca 2026
**Autor auditu:** Claude (na požiadanie Dávida Bořutu)

---

## ZHRNUTIE NÁLEZOV

| Závažnosť | Počet | Popis |
|---|---|---|
| **KRITICKÁ** | 1 | Nesprávny názov právnickej osoby v GDPR súhlase |
| **VYSOKÁ** | 4 | NPS otázka nesedí s účelom; chýba PII varovanie; chýba núdzový alert vo wizarde; chýba text autosave |
| **STREDNÁ** | 4 | Chýba progress indicator text; chýba validačné hlásenia; GDPR email treba overiť; chýba FAQ/legal help vo wizarde |
| **NÍZKA** | 3 | Kozmetické úpravy, doplnenia |

---

## KRITICKÉ NÁLEZY

### K1. NESPRÁVNY NÁZOV ENTITY V GDPR SÚHLASE

**Kde:** Sekcia 2 — Informovaný súhlas, prvý bod

**Aktuálny text v TEXTY-PREHLAD:**
> Kto spracúva vaše údaje: Zdravá Budúcnosť Slovenska / **Fundácia Slušného Fóra (FSF)**

**Problém:**
FSF = **Future Slovakia Forum** = **Fórum Budúcnosti Slovenska, o.z.** (IČO: 56046260). „Fundácia Slušného Fóra" je nesprávny názov — neexistuje v kontexte FSF a navyše „Fundácia" je iná právna forma ako „o.z." (občianske združenie). Toto je právne relevantná chyba v GDPR dokumente.

**Zdroj overenia:** Projekt knowledge — FSF_2percenta_Clenovia_Materialy_v2.docx: „Fórum Budúcnosti Slovenska, o.z., IČO: 56046260"; REFORMA_HFS_Overview_AB_v1_1_SK.docx: „Future Slovakia Forum (o.z. Fórum Budúcnosti Slovenska)"; Pravidla_odbornej_prace_FSF_v3_6.docx: „Future Slovakia Forum (FSF) je nezávislý občiansky think-tank"

**Oprava:**
> Kto spracúva vaše údaje: Zdravá Budúcnosť Slovenska, iniciatíva organizácie **Future Slovakia Forum** (Fórum Budúcnosti Slovenska, o.z., IČO: 56046260), v rámci projektu REFORMA 3.3.

**Confidence:** HIGH — overené v 3 nezávislých projektových dokumentoch.

---

## VYSOKÉ NÁLEZY

### V1. NPS OTÁZKA — ROZPOR S PÔVODNÝM PROMPTOM A METODOLÓGIOU

**Kde:** Sekcia 9 — Wizard krok 7

**Aktuálny text v TEXTY-PREHLAD:**
> Na škále 0 až 10 — ako pravdepodobne by ste odporučili **systém zdravotnej starostlivosti na Slovensku** niekomu blízkemu?

**Pôvodný HFS Feedback Portal Prompt v1.0 (v project knowledge):**
> Na škále 0–10, aká je pravdepodobnosť, že by ste **tento portál** odporučili známemu alebo kolegovi?

**Problém:**
Toto sú dva zásadne odlišné merania. Štandardný NPS meria spokojnosť s produktom/službou (= portálom). Otázka o zdravotníckom systéme meria niečo úplne iné — systémovú dôveru. Obe sú užitočné, ale slúžia na odlišné účely.

**Odporúčanie:**
Dávid musí rozhodnúť, čo chce merať. Tri možnosti:

**Variant A** — NPS pre portál (štandardná NPS metodológia):
> Na škále 0 až 10 — aká je pravdepodobnosť, že by ste tento portál odporučili známemu alebo kolegovi?

**Variant B** — NPS pre zdravotný systém (systémové meranie pre REFORMA 3.3):
> Na škále 0 až 10 — ako pravdepodobne by ste odporučili systém zdravotnej starostlivosti na Slovensku niekomu blízkemu?

**Variant C** — Obe otázky (najlepšie pre analytiku, ale predlžuje formulár):
Najprv systém (variant B), potom portál (variant A).

**Confidence:** HIGH — metodologická záležitosť, nie faktická.

---

### V2. CHÝBA PII VAROVANIE NA TEXTOVOM POLI PRÍBEHU

**Kde:** Sekcia 6 — Wizard krok 4 (Váš príbeh)

**Požiadavka z ClaudeCode promptu:**
> „Pri veľkom textovom poli zobraz upozornenie: 'Nevpisujte prosím rodné číslo, adresu ani iné citlivé osobné údaje.'"

**V TEXTY-PREHLAD:** Hint hovorí len o obsahu príbehu, nie o PII ochrane. Zmienka o PII detekcii je len v technickom popise poľa („Funkcie: Detekcia PII"), nie ako viditeľný text pre používateľa.

**Oprava — pridať pod textarea v kroku 4:**

> ⚠ Prosíme, nevpisujte rodné číslo, presnú adresu bydliska ani iné údaje, ktoré by vás mohli priamo identifikovať.

**Confidence:** HIGH — explicitná požiadavka v ClaudeCode prompte + GDPR best practice.

---

### V3. CHÝBA NÚDZOVÝ ALERT VO WIZARDE

**Kde:** Celý wizard flow

**Požiadavka z ClaudeCode promptu:**
> „Ak používateľ v texte naznačí akútny stav, zobraz neblokujúci, ale výrazný alert: 'Ak ste v ohrození alebo potrebujete akútnu pomoc, volajte 155 alebo 112.'"

**V TEXTY-PREHLAD:** Núdzové upozornenie je len na landing page (sekcia 1). V samotnom wizarde chýba text pre in-context alert, ktorý by sa zobrazil pri detekcii núdzových kľúčových slov.

**Oprava — pridať do TEXTY-PREHLAD novú sekciu „GLOBÁLNE UPOZORNENIA":**

> **Núdzový alert (neblokujúci, zobrazí sa pri detekcii kľúčových slov v texte):**
> ⚠ Ak ste v ohrození alebo potrebujete akútnu lekársku pomoc, volajte **155** (záchranná služba) alebo **112** (tiesňová linka). Tento portál nie je náhradou za zdravotnú starostlivosť.

**Confidence:** HIGH — explicitná požiadavka + bezpečnostný štandard.

---

### V4. CHÝBA TEXT PRE AUTOSAVE INDIKÁTOR

**Kde:** Celý wizard flow

**Požiadavka z ClaudeCode promptu:**
> „autosave draftu do local storage alebo session storage" + „pri dlhšom texte priebežné uloženie"

**V TEXTY-PREHLAD:** Žiadna zmienka o autosave texte pre používateľa.

**Oprava — pridať do TEXTY-PREHLAD:**

> **Autosave indikátor (zobrazuje sa diskrétne v rohu alebo pod progress barom):**
> ✓ Odpovede priebežne uložené

> **Ak sa session obnoví po zatvorení prehliadača:**
> Našli sme vaše rozpísané odpovede. Chcete pokračovať tam, kde ste skončili?
> [Pokračovať] [Začať odznova]

**Confidence:** MEDIUM — ClaudeCode to požaduje, ale presný text nie je špecifikovaný.

---

## STREDNÉ NÁLEZY

### S1. CHÝBA TEXT PROGRESS INDIKÁTORA

**Kde:** Celý wizard flow

**Požiadavka z ClaudeCode promptu:**
> „progress indicator (napr. krok 1 z 7)"

**V TEXTY-PREHLAD:** Chýba.

**Oprava — pridať:**
> **Progress bar label:**
> Krok {X} z 7

---

### S2. CHÝBAJÚ TEXTY VALIDAČNÝCH HLÁSENÍ

**Kde:** Celý wizard flow

**Požiadavka z ClaudeCode promptu:**
> „zrozumiteľné validácie" + „error messages naviazané na polia"

**V TEXTY-PREHLAD:** Žiadne validačné texty.

**Oprava — pridať novú sekciu „VALIDAČNÉ HLÁSENIA":**

| Situácia | Text |
|---|---|
| Povinné pole nevyplnené | Toto pole je povinné. |
| Príbeh príliš krátky (<20 znakov) | Prosíme, napíšte aspoň pár viet o vašej skúsenosti. |
| Rating nevybraný | Prosíme, vyberte hodnotenie na škále 1–5. |
| NPS nevybraný | Prosíme, vyberte hodnotu na škále 0–10. |
| Súhlas nezaškrtnutý | Pre pokračovanie je potrebné odsúhlasiť podmienky spracovania údajov. |

---

### S3. GDPR EMAIL — TREBA OVERIŤ EXISTENCIU

**Kde:** Sekcia 2 — Informovaný súhlas

**Text:** gdpr@healthy-future.sk

**Problém:** Na Websupport hostingu je nakonfigurovaný mail server (MX záznamy existujú), ale nie je potvrdené, či schránka gdpr@ existuje.

**Akcia:** Dávid musí vytvoriť schránku gdpr@healthy-future.sk v admin paneli Websupport → Emaily, alebo nastaviť presmerovanie na existujúcu schránku.

---

### S4. CHÝBA LEGAL/FAQ HELP TEXT VO WIZARDE

**Kde:** Wizard flow (ideálne na review stránke alebo v patičke wizardu)

**Požiadavka z ClaudeCode promptu:**
> „Pridaj diskrétny help text alebo FAQ blok" o tom, že portál neposkytuje právne poradenstvo.

**V TEXTY-PREHLAD:** Zmienka o ÚDZS je len na thank-you stránke (sekcia 11). Vo wizarde chýba.

**Oprava — pridať diskrétny help link do footer wizardu:**
> Tento portál neposkytuje právne ani medicínske poradenstvo. [Viac informácií]

> **Expandovaný text (po kliknutí):**
> Ak zvažujete oficiálny podnet, môžete kontaktovať Úrad pre dohľad nad zdravotnou starostlivosťou (ÚDZS) na www.udzs.sk alebo vyhľadať advokáta špecializujúceho sa na medicínske právo.

---

## NÍZKE NÁLEZY

### N1. DROBNÁ NEKONZISTENCIA — „PRÍSLUŠNÍČKA" VS. RODOVO NEUTRÁLNY JAZYK

**Kde:** Sekcia 3 — Krok 1

**Text:** „Rodinný príslušník / príslušníčka"

**Poznámka:** V iných častiach formulára sa rodový tvar nepoužíva (napr. „Ja sám / sama" — tu áno, ale „Známy / známa" — tu tiež). Toto je konzistentné. Len upozornenie, že ak sa rozhodne pre skrátenie, treba to urobiť všade.

**Žiadna akcia.**

---

### N2. KROK 5 — KOMENTÁRE K RATINGU NEMAJÚ PLACEHOLDER

**Kde:** Sekcia 7 — Wizard krok 5

**Text:** „Chcete niečo dodať k lekárom?" atď.

**Odporúčanie:** Pridať hint/placeholder text do textarea komentárov:
> Napr. čo konkrétne bolo dobré alebo zlé? (nepovinné)

---

### N3. THANK-YOU PAGE — FORMULÁCIA „ĎALŠÍ KROK"

**Kde:** Sekcia 11

**Text:** „Chcete podniknúť ďalší krok?"

**Poznámka:** ClaudeCode prompt explicitne hovorí: „Nepoužívaj formuláciu, ktorá predpokladá prihlasovanie." TEXTY-PREHLAD toto rešpektuje (žiadna zmienka o login). Len overenie — OK.

---

## POROVNANIE TEXTY vs. LIVE DEPLOYMENT

**Landing page (root URL):** Texty sa zhodujú 1:1 s TEXTY-PREHLAD sekcia 1. ✅

**Wizard kroky:** Nemohol som fetchovať (client-side routing / Next.js SPA). Na overenie je potrebné manuálne porovnanie alebo screenshot z každého kroku.

**Odporúčanie:** Dávid by mal prejsť celý wizard na živom URL a porovnať každý krok s TEXTY-PREHLAD.md, pričom aplikuje opravy z tohto auditu.

---

## KOMPLETNÝ OPRAVENÝ TEXTY-PREHLAD — ZMENY OZNAČENÉ

Nižšie sú len sekcie, ktoré vyžadujú zmenu. Neupravené sekcie ostávajú bez zmien.

### NOVÁ SEKCIA: GLOBÁLNE PRVKY (pridať na koniec pred sekciu 12)

```
## GLOBÁLNE PRVKY

### Progress indikátor
Krok {X} z 7

### Autosave
✓ Odpovede priebežne uložené

### Obnovenie session
Našli sme vaše rozpísané odpovede. Chcete pokračovať tam, kde ste skončili?
Tlačidlá: Pokračovať | Začať odznova

### Núdzový alert (neblokujúci, pri detekcii kľúčových slov)
⚠ Ak ste v ohrození alebo potrebujete akútnu lekársku pomoc, 
volajte 155 (záchranná služba) alebo 112 (tiesňová linka). 
Tento portál nie je náhradou za zdravotnú starostlivosť.

### Legal help (diskrétny link v patičke wizardu)
Tento portál neposkytuje právne ani medicínske poradenstvo. [Viac informácií]
→ Ak zvažujete oficiálny podnet, môžete kontaktovať Úrad pre dohľad 
  nad zdravotnou starostlivosťou (ÚDZS) na www.udzs.sk alebo vyhľadať 
  advokáta špecializujúceho sa na medicínske právo.

### Validačné hlásenia
- Povinné pole: Toto pole je povinné.
- Príbeh príliš krátky: Prosíme, napíšte aspoň pár viet o vašej skúsenosti.
- Rating nevybraný: Prosíme, vyberte hodnotenie na škále 1–5.
- NPS nevybraný: Prosíme, vyberte hodnotu na škále 0–10.
- Súhlas: Pre pokračovanie je potrebné odsúhlasiť podmienky spracovania údajov.
```

### SEKCIA 2 — OPRAVENÝ INFORMOVANÝ SÚHLAS

Zmena v prvom bode:

**PRED:**
> Kto spracúva vaše údaje: Zdravá Budúcnosť Slovenska / Fundácia Slušného Fóra (FSF), v rámci projektu REFORMA 3.3.

**PO:**
> Kto spracúva vaše údaje: Zdravá Budúcnosť Slovenska, iniciatíva organizácie **Future Slovakia Forum** (Fórum Budúcnosti Slovenska, o.z., IČO: 56046260), v rámci projektu REFORMA 3.3.

### SEKCIA 6 — KROK 4: PRIDAŤ PII VAROVANIE

Pridať pod textarea „Čo sa stalo?":

> ⚠ Prosíme, nevpisujte rodné číslo, presnú adresu bydliska ani iné údaje, ktoré by vás mohli priamo identifikovať.

### SEKCIA 9 — KROK 7: NPS OTÁZKA — ROZHODNUTIE DÁVIDA

Aktuálny text zachovať alebo zmeniť podľa rozhodnutia (viď nález V1 vyššie). Ak sa rozhodne pre meranie portálu (štandardný NPS):

**PRED:**
> Na škále 0 až 10 — ako pravdepodobne by ste odporučili systém zdravotnej starostlivosti na Slovensku niekomu blízkemu?

**PO:**
> Na škále 0 až 10 — aká je pravdepodobnosť, že by ste tento portál odporučili známemu alebo kolegovi?

---

*Audit pripravený: 27.3.2026 | Na základe: TEXTY-PREHLAD.md, ClaudeCode_Prompt_HFS_Web_Feedback_Form_v1_0.md, HFS_Feedback_Portal_Prompt_v1_0.md, živý deployment*
