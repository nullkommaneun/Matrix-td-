/* ============================================================================
   RESET — Story Content (stories.js)
   Variabler Mini-Story-Katalog für den Log
   Tonalitäten: neutral | coachy | poetisch (per localStorage 'reset.tone')
   ============================================================================ */
(function (g) {
  const icons  = { regulation:"🫁", clarity:"🧠", boundaries:"🛡️", contact:"🕊️", future:"🌱" };
  const meters = { up:"⬆︎", sUp:"↗︎", flat:"—", sDown:"↘︎", down:"⬇︎" };

  const syn = {
    ruhig: ["ruhiger","leiser","klarer"],
    weit:  ["weit","locker","frei"],
    warm:  ["warm","sanft","mild"],
    klar:  ["klar","nüchtern","präzise"],
    klein: ["klein","winzig","einen Millimeter"],
    schritt:["Schritt","Millimeter","Moment"],
  };

  const tod = {
    morgen: ["kühle Morgenluft","frühes Licht am Fenster","erste Ruhe vor dem Tag"],
    mittag: ["helles Mittagslicht","ein kurzer Schattenplatz","ein Atemzug zwischen Terminen"],
    abend:  ["warmer Abenddampf im Bad","tiefes Orange hinter den Dächern","der Tag legt sich"],
    nacht:  ["leise Wohnung in der Nacht","dunkler Himmel wie ein Tuch","nur dein Atem zählt"]
  };

  const streakLines = {
    regulation: ["Du bleibst in der Ruhe-Spur.","Der Körper lernt schnell."],
    clarity:    ["Du hältst den Klarheits-Faden.","Gedanken ordnen sich weiter."],
    boundaries: ["Deine Kante wird sauberer.","Grenzen klingen nach."],
    contact:    ["Der Raum bleibt bei dir.","Leiser wird es im Handy."],
    future:     ["Das Neue bekommt Konturen.","Die Zukunft wirkt greifbarer."]
  };

  const byFamily = {
    regulation: {
      neutral: {
        success: [
          "Brust wird {syn:weit}, der Kopf {syn:ruhig}. {tod:…}",
          "Zwei ruhige Zyklen – der Puls findet wieder Tritt."
        ],
        near: [
          "Der Atem holpert noch; zwei langsame Züge genügen für heute. {nudge:Später noch einmal hinsetzen.}"
        ]
      },
      coachy: {
        success: [
          "Reset fürs Nervensystem: locker, {syn:ruhig}, handlungsfähig.",
          "Perfekt gesteuert – Puls sinkt, Fokus steigt."
        ],
        near: [
          "Fast – du bist dran geblieben. {nudge:Morgen 3× 4-7-8, dann weiter.}"
        ]
      },
      poetisch: {
        success: [
          "Atem hin, Atem her – {syn:warm} und weich. {tod:…}",
          "Die Rippenbogen öffnen sich; der Lärm fällt von dir ab."
        ],
        near: [
          "Der Takt ist noch rau, aber er trägt. {nudge:Eine kleine Wiederholung später.}"
        ]
      }
    },

    clarity: {
      neutral: {
        success: [
          "Du legst die Szene neu auf den Tisch – {syn:klar}.",
          "Ein Splitter Klarheit bleibt hängen."
        ],
        near: ["Stichworte reichen; Struktur folgt morgen. {nudge:Kurz notieren – schließen.}"]
      },
      coachy: {
        success: [
          "Guter Schnitt: Fakten, Anteile, nächste Schritte – sauber markiert.",
          "Klarheit +1: Thema erkannt, nicht du als Problem."
        ],
        near: ["Du warst dran. {nudge:Morgen 10 Minuten weiter, Timer an.}"]
      },
      poetisch: {
        success: [
          "Die Erinnerung verliert Glanz, gewinnt Kontur.",
          "Ein kühler Gedanke ordnet das Bild."
        ],
        near: ["Du hast die Worte berührt. {nudge:Lass sie über Nacht ruhen.}"]
      }
    },

    boundaries: {
      neutral: {
        success: ["Sauber formuliert: was du brauchst, was du lässt.","Ein kleines Nein macht Platz für dich."],
        near:    ["Die Sätze haken noch. {nudge:Zwei Ich-Botschaften genügen.}"]
      },
      coachy: {
        success: ["Grenze gesetzt – respektvoll, klar, stabil.","Kontaktordnung greift: weniger Ziehen, mehr Raum."],
        near:    ["Du probierst es. {nudge:Eine Formulierung schärfen, dann senden – oder nicht.}"]
      },
      poetisch: {
        success: ["Eine feine Linie, mit ruhiger Hand gezogen.","Dein Kreis schließt sich einen Fingerbreit."],
        near:    ["Die Kante ist weich – fürs Erste genug. {nudge:Morgen ziehst du sie nach.}"]
      }
    },

    contact: {
      neutral: {
        success: ["Timer läuft, Benachrichtigungen ruhen – du auch.","Der Chat bleibt zu; du bleibst bei dir."],
        near:    ["Finger am Rand des Chats – du lässt los. {nudge:Bildschirm zu, 10-Min-Delay.}"]
      },
      coachy: {
        success: ["Kein-Kontakt hält: Selbstführung on.","Digital-Hygiene sitzt: weniger Reiz, mehr Ruhe."],
        near:    ["Fast gekippt – und gedreht. {nudge:Support-Call (10 Min) einplanen.}"]
      },
      poetisch: {
        success: ["Das Handy wird still. Der Raum im Kopf wird hell.","Kein Ping – und plötzlich Platz."],
        near:    ["Die Versuchung zieht vorbei wie Wetter. {nudge:Ein Schritt von der Kante.}"]
      }
    },

    future: {
      neutral: {
        success: ["Schlaf zur gleichen Zeit – dein Körper dankt.","Drei weiche Konturen fürs Morgen sind da."],
        near:    ["Routine sitzt noch nicht. {nudge:Heute nur die Uhrzeit halten.}"]
      },
      coachy: {
        success: ["Pfeiler gesetzt: Schlaf, Schritt, Wasser – solide Basis.","Zukunftsbild konkret: 3 Kriterien, 0 Selbstverrat."],
        near:    ["Angekratzt reicht – {nudge:Morgen 20 Min weiter, dann Stopp.}"]
      },
      poetisch: {
        success: ["Der Tag schließt wie ein Buch; du merkst dir die Seite.","Das Neue wirft einen freundlichen Schatten."],
        near:    ["Die Linie wabert noch. {nudge:Morgen ein Strich mehr.}"]
      }
    }
  };

  g.RESET_STORIES = { icons, meters, syn, tod, streakLines, byFamily };
})(window);