/* ============================================================================
   RESET — Kartenkatalog (cards.js)
   - Dies ist NUR Content. Beliebig erweiterbar.
   - Engine liest window.RESET_CARDS.cards ein.
   ============================================================================ */
(function (g) {
  const V = '2025-08-24';

  // Hilfsfunktionen für knapperen Content
  const P = (id,theme,title,examples,stat,dc,E,S,H,xp,tags=[]) =>
    ({ id, theme, positive:true,  title, examples, stat, dc, delta:{E,S,H}, xp, tags });
  const N = (id,theme,title,examples,stat,dc,E,S,H,xp,tags=[]) =>
    ({ id, theme, positive:false, title, examples, stat, dc, delta:{E,S,H}, xp, tags: ['negative','avoid',...tags] });

  const cards = [

    /* ===================== 1) STABILISIEREN ===================== */
    P('stb_breathe','stabilisieren','Tiefes bewusstes Atmen',
      ['2× „4–7–8“ im Sitzen','5 Zyklen Box-Breathing (4–4–4–4)'],
      'Regulation', 0, +8, -18,  0, 0, ['aftercare','rest','stabilize','phase:1','fam:stabilisieren']),

    P('stb_walk','stabilisieren','Kurzer Spaziergang',
      ['10 Min draußen, Handy in der Tasche','5 Dinge im Umfeld bewusst benennen'],
      'Regulation', 6, +6, -12, +2, 4, ['aftercare','stabilize','phase:1','fam:stabilisieren']),

    P('stb_bodyscan','stabilisieren','Körper-Scan',
      ['5 Min vom Scheitel bis Fuß spüren','Anspannung/Entspannung je 10 Sek.'],
      'Regulation', 0, +5, -15,  0, 0, ['aftercare','stabilize','phase:1','fam:stabilisieren']),

    P('stb_music','stabilisieren','Beruhigende Musik',
      ['2–3 ruhige Songs mit Kopfhörern','Atem synchron zum Takt verlangsamen'],
      'Selbstbild', 6, +4,  -8, +3, 3, ['aftercare','stabilize','phase:1','fam:stabilisieren']),

    P('stb_warmshower','stabilisieren','Warmes Duschen',
      ['5 Min Nacken/Schultern, tief atmen','Frische Kleidung anziehen'],
      'Regulation', 6, +4, -10, +1, 1, ['aftercare','stabilize','phase:1','fam:stabilisieren']),

    N('stb_textex','stabilisieren','Ex anschreiben',
      ['„Nur kurz fragen, wie’s geht …“','Nachricht absenden statt warten'],
      'Selbstbild', 8, -4, +16, -6, 0, ['contact_mgmt','phase:1','fam:kontakt']),

    N('stb_doomscroll','stabilisieren','Doomscrolling',
      ['20 Min Reels/Stories','Alte Bilder/Chats stalken'],
      'Klarheit', 7, -5, +10, -5, 0, ['phase:1']),

    N('stb_gaming','stabilisieren','Endlos zocken',
      ['„Nur eine Runde“ wird 2 h','Schlaf verschiebt sich'],
      'Regulation', 7, -8,  +6, -4, 0, ['phase:1']),

    N('stb_alcohol','stabilisieren','Alkohol zum Einschlafen',
      ['2–3 Drinks spät abends','Aufwachen nach 3–4 h'],
      'Regulation', 8, -10, +6, -8, 0, ['phase:1']),

    N('stb_drama','stabilisieren','Drama-Telefonat',
      ['45 Min alles „durchkauen“','Mehr Aufregung als Entlastung'],
      'Selbstbild', 7, -6, +12, -4, 0, ['phase:1']),

    /* ===================== 2) EINDÄMMEN ===================== */
    P('edm_digital','eindaemmen','Digital-Hygiene',
      ['Chat stummschalten/archivieren','Benachrichtigungen aus'],
      'Selbstbild', 7, -3, -6, +1, 2, ['contact_mgmt','stabilize','phase:2','fam:kontakt']),

    P('edm_nocontact24','eindaemmen','24 h Kein-Kontakt Commit',
      ['schriftlich festhalten + Timer','Post-it am Handy'],
      'Grenzen', 8, -2, -8, +2, 4, ['contact_mgmt','phase:2','fam:abgrenzen','milestone-setup']),

    P('edm_trigger_mini','eindaemmen','Trigger-Karte mini',
      ['Top-3 Auslöser notieren','Gegenzug je Auslöser'],
      'Klarheit', 7, -6,-10,  0, 6, ['skills','phase:2','fam:reflektieren']),

    P('edm_delay10','eindaemmen','10-Min-Delay',
      ['bei Impuls Timer starten','Alternative Handlung wählen'],
      'Regulation', 6, -1, -6, +1, 3, ['stabilize','phase:2']),

    P('edm_safe_call','eindaemmen','Safe-Friend-Call (10 Min)',
      ['sachlich, keine Ex-Debatte','am Ende nächste Mini-Aufgabe'],
      'Selbstbild', 7, -4, -6, +3, 4, ['network','phase:2','stabilize']),

    N('edm_lastseen','eindaemmen','Zuletzt-online checken',
      ['„war sie/er aktiv?“','mehrfach pro Stunde'],
      'Selbstbild', 7, -2, +10, -5, 0, ['contact_mgmt','phase:2']),

    N('edm_draftsend','eindaemmen','Entwurf tippen & senden',
      ['„schicke ich eh nicht …“','… dann doch abschicken'],
      'Selbstbild', 8, -3, +12, -6, 0, ['contact_mgmt','phase:2']),

    N('edm_driveby','eindaemmen','Drive-by',
      ['Lieblingsorte abfahren','„zufällig“ vorbeischauen'],
      'Grenzen', 8, -6, +14, -8, 0, ['contact_mgmt','phase:2']),

    N('edm_mediascroll','eindaemmen','Foto/Chat-Triggern',
      ['alte Media durchscrollen','Screenshots vergleichen'],
      'Klarheit', 8, -5, +12, -7, 0, ['phase:2']),

    N('edm_rebound','eindaemmen','Rebound-Chat',
      ['irgendwen anschreiben','nur für Bestätigung'],
      'Selbstbild', 7, -4,  +8, -6, 0, ['phase:2']),

    /* ===================== 3) VERSTEHEN ===================== */
    P('ver_muster','verstehen','Journaling: 3 Muster',
      ['wiederkehrende Konflikte benennen','eigener Anteil skizzieren'],
      'Klarheit', 7, -10, +6, +1,12, ['reflect','phase:3','fam:reflektieren','milestone-setup']),

    P('ver_werte','verstehen','Werte-Inventur (Top 5)',
      ['wichtigste Werte notieren','je 1 Grenze pro Wert'],
      'Klarheit', 8, -12, +6, +2,14, ['reflect','boundaries','phase:3','milestone-setup']),

    P('ver_reframe','verstehen','Reframe-Brief (nicht senden)',
      ['„Ich sehe jetzt …“','Dank & Abschied formulieren'],
      'Klarheit', 9,  -8, +4, +4,16, ['reflect','phase:3']),

    P('ver_timeline','verstehen','Beziehungs-Timeline',
      ['Hoch/Tiefpunkte einzeichnen','3 Lernpunkte markieren'],
      'Klarheit', 8,  -8, +5, +2,12, ['reflect','phase:3']),

    P('ver_redflags','verstehen','Red-Flags-Liste',
      ['10 eigene Warnsignale','3 davon fett markieren'],
      'Klarheit', 8,  -9, +6, +2,12, ['reflect','phase:3']),

    N('ver_nostalgia','verstehen','Nostalgie-Schleife',
      ['„unser“ Mixtape Dauerschleife','nur schöne Szenen erinnern'],
      'Selbstbild', 6, -3, +4, -5,0, ['phase:3']),

    N('ver_selfblame','verstehen','Selbstschuld-Spirale',
      ['alles auf sich beziehen','„hätte ich nur …“'],
      'Klarheit', 9, -5,+12, -8,0, ['phase:3']),

    N('ver_signs','verstehen','Zeichen deuten',
      ['„like“ ⇒ meint X','Orakel-Denken'],
      'Klarheit', 7, -2,+10, -6,0, ['phase:3']),

    N('ver_compare','verstehen','Vergleich Social Media',
      ['perfekte Paare anschauen','sich schlechter fühlen'],
      'Selbstbild', 7, -2, +8, -6,0, ['phase:3']),

    N('ver_rumination','verstehen','Grübeln im Bett',
      ['hin- und herwälzen','nicht aufstehen/notieren'],
      'Regulation', 8, -6,+10, -7,0, ['phase:3']),

    /* ===================== 4) NEUAUFBAU ===================== */
    P('neu_sleep','neuaufbau','Routine-Pfeiler (Schlaf)',
      ['fixe Zubett-Zeit','Wecker gleichbleibend'],
      'Regulation', 7,  -6, -4, +3,10,['stabilize','phase:4','milestone-setup']),

    P('neu_move20','neuaufbau','20-Min Bewegung',
      ['flotter Walk / Mobility','Puls leicht erhöhen'],
      'Regulation', 7,  +4, -6, +2, 8,['stabilize','phase:4']),

    P('neu_mealprep','neuaufbau','Meal-Prep leicht',
      ['2 einfache Mahlzeiten','Wasserflasche füllen'],
      'Regulation', 7,  -5, -4, +2,10,['stabilize','phase:4']),

    P('neu_socialmicro','neuaufbau','Sozial-Mikroschritt',
      ['1 Person kurz grüßen','Minitreffen vorschlagen'],
      'Selbstbild', 7,  -3, -3, +3,10,['network','phase:4']),

    P('neu_learn','neuaufbau','Lern-Sprint (25 Min)',
      ['Pomodoro + kurze Pause','kleines Ergebnis sichern'],
      'Klarheit', 7,  -6, -1, +2,10,['growth','phase:4']),

    N('neu_overschedule','neuaufbau','Overscheduling',
      ['Tag vollballern','kein Puffer'],
      'Klarheit', 8, -10,+10, -4,0,['phase:4']),

    N('neu_crashworkout','neuaufbau','Crash-Workout 90 Min',
      ['„Revenge-Body“-Anfall','Regeneration ignorieren'],
      'Regulation', 8, -12, +8, -2,0,['phase:4']),

    N('neu_shopping','neuaufbau','Belohnungs-Shopping',
      ['impulsive Käufe','kurz gut, dann leer'],
      'Selbstbild', 7,  -6, +4, -6,0,['phase:4']),

    N('neu_skipmeal','neuaufbau','Mahlzeiten skippen + Koffein',
      ['Kaffee statt Frühstück','Zittern/Unruhe'],
      'Regulation', 8,  -8,+10, -5,0,['phase:4']),

    N('neu_listwithoutstart','neuaufbau','To-Do-Stapel ohne Start',
      ['Listen schreiben, nicht anfangen','Frust steigt'],
      'Klarheit', 7,  -4, +6, -3,0,['phase:4']),

    /* ===================== 5) INTEGRATION ===================== */
    P('int_future','integration','Zukunftsbild (3 Kriterien)',
      ['wie soll es sich anfühlen?','No-Gos notieren'],
      'Klarheit', 8,  -6, -2, +5,12,['growth','phase:5','milestone-setup']),

    P('int_relapse','integration','Relapse-Plan',
      ['„wenn X, dann Y“','Notfallkarte ins Handy'],
      'Klarheit', 9,  -6, -3, +3,16,['skills','stabilize','phase:5']),

    P('int_boundscript','integration','Grenzen-Script (2 Sätze)',
      ['„Ich brauche … / Ich werde …“','laut üben'],
      'Selbstbild', 8,  -5, -2, +3,14,['boundaries','skills','phase:5']),

    P('int_closure','integration','Abschluss-Ritual',
      ['Brief schreiben & verbrennen','Erinnerungsbox schließen'],
      'Selbstbild', 8,  -4, -4, +4,10,['closure','phase:5']),

    P('int_readiness','integration','Dating-Readiness-Check',
      ['Werte/Tempo abgleichen','rote Linien prüfen'],
      'Klarheit', 8,  -4, -1, +3,10,['growth','phase:5']),

    N('int_bdayping','integration','Geburtstags-Ping',
      ['„Nur gratulieren …“','Schleife triggert'],
      'Selbstbild', 7,  -3,+10, -6,0,['contact_mgmt','phase:5']),

    N('int_breadcrumb','integration','Breadcrumbing',
      ['andere warmhalten','„nur bisschen flirten“'],
      'Selbstbild', 7,  -2, +8, -5,0,['phase:5']),

    N('int_swiping','integration','Serien-Swipen',
      ['Betäubung durch Matches','kein echtes Interesse'],
      'Selbstbild', 7,  -6, +6, -7,0,['phase:5']),

    N('int_oldchats','integration','Alte Chats öffnen',
      ['stundenlang lesen','Screenshots vergleichen'],
      'Klarheit', 7,  -2, +8, -6,0,['phase:5']),

    N('int_drunktext','integration','Betrunken schreiben',
      ['Hemmungen weg','am Morgen bereuen'],
      'Selbstbild', 8,  -8,+12, -9,0,['contact_mgmt','phase:5']),
  ];

  g.RESET_CARDS = { version: V, cards };
})(window);