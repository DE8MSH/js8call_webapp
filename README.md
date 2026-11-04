# JS8Web LAB 1.1 – GitHub-Pages-Webapp

**Experimenteller JS8-Transceiver auf Transportframe-Ebene mit WebAssembly.**

Dieses Projekt ist **kein vollständiger JS8Call-Port** und darf nicht als solcher bezeichnet werden. Es ist eine unabhängig gestaltete Browser-UI mit einem portierten JS8-Frame-Codec aus dem GPLv3-Projekt `js8call/js8call`. Die Webapp benötigt weder einen Dienst noch einen Backendserver. Der beiliegende WebAssembly-Codec kann mit Emscripten neu gebaut werden.

## Stand 1.1 — Originale JS8Call-Oberflächenstruktur aus den Qt-Quelldateien

Die drei Original-Designerdateien `JS8_UI/mainwindow.ui`, `MessagePanel.ui` und `WideGraph.ui` (sowie `Configuration.ui`) aus dem bereitgestellten JS8Call-improved-Archiv dienen als konkrete Vorlage. Die Webapp übernimmt die **Makro- und Steuerleisten**, die **drei Spalten mit verschiebbaren Trennleisten** einschließlich der vertikalen RX-/TX-Trennleiste, die **Stationsdetails**, die **Band-Activity-Spaltenüberschriften**, die originalgetreue **gelbe RX-Textfläche** und **Wasserfall-Bedienelemente**. Die Umsetzung befindet sich in `original-ui.js` und `original-ui.css`; bestehende JS8-Datenströme und DOM-IDs werden weiterverwendet.

- **Macros**: Directed, SNR, HB, Saved, INFO, CQ, Deselect, REPLY, Halt und STATUS in der Reihenfolge der Qt-Datei. Gültige Kurzbefehle und Beacons werden wie bisher **nur vorbereitet**, niemals unaufgefordert gesendet.
- **Saved**: Dialog für eigene, browserlokal gespeicherte Textbausteine mit `{CALL}`, `{TO}` und `{GRID}`. Einfügen in den Nachrichteneditor, keine automatische Übertragung.
- **Controls**: MODE, RX, TX/Manuelle Freigabe, LOG QSO und CAT mit echter Anbindung. AUTO, HB AUTO, HB ACK, SPOT und TUNE sind sichtbar, aber bewusst deaktiviert, weil die Originalfunktionen nicht implementiert sind.
- **WideGraph-Regler**: Palette, Gain, Zero und Average verändern die tatsächliche Spektrums-/Wasserfall-Anzeige; der Offset kann in 25-Hz-Schritten verändert werden. Der Time-Drift-Knopf öffnet die UTC-Einstellung.
- **Fenster / Menü**: verschiebbare Trenner mit Tastatursteuerung, gespeicherte Spaltengrößen, Vollbild-Aktion und Fokus-Menübefehle. Unter 950 px werden die Hauptspalten untereinander angezeigt.

Eine genaue Zuordnung von Qt-`objectName` zu Browser-Komponente und Funktionsumfang steht in [`docs/qt-ui-parity.md`](docs/qt-ui-parity.md). Die Offline-Cache-Version `v11` speichert diese neuen UI-Dateien mit. `tests/qt-ui.mjs` ist als Regressionstest im GitHub-Pages-Build eingebunden.

**Weiterhin kein 100%-Port:** Der Desktop-Qt-Aufbau wurde anhand der Originalquellen angenähert, die darunterliegende originale WSJT-X-Engine, automatische Nachrichtenwege, Hamlib-Netzwerkfunktionen und echte Betriebsautomatik sind noch nicht übernommen. Ein Buildtest ersetzt keine vollständige Sichtprüfung im Browser.

## Stand 1.0 – Live-AUTO4 mit vier UTC-Zeitschlitzen

Im Wasserfall-Bereich kann **Live: alle 4 Modi · 2 Worker** aktiviert werden. Die App empfängt dann in **NORMAL (15 s), FAST (10 s), TURBO (6 s) und SLOW (30 s)** gleichzeitig, ohne dass die TX-Submode-Auswahl verändert wird. Der Live-Audiopuffer wird einmal aufgenommen und die Zeitplanung erstellt für jeden Modus unabhängig vollständige UTC-Fenster mit den erforderlichen Vor- und Nachlauf-Samples.

Der neue Scheduler `live-rx.js` verwaltet eine **begrenzte Warteschlange mit maximal vier wartenden Dekodieraufträgen** und zwei parallelen WebWorkern. Bei Rückstau werden veraltete Aufträge verworfen, statt den Browser mit unbegrenzten Aufträgen und Audiokopien zu überlasten. Aufträge derselben Betriebsart laufen nie parallel, damit fragmentierte JSC-Nachrichten in korrekter zeitlicher Reihenfolge ankommen. Die Anzeige liefert **laufende Worker, wartende Aufträge, bearbeitete Fenster, erfolgreiche Decodes und verworfene Fenster**. Beim RX-Stopp werden Worker und unvollständige Warteschlangen beendet; verspätete Ergebnisse alter Sessions werden ignoriert.

**CPU-Hinweis:** Die Live-Suche in vier Modi über 300–3000 Hz ist sehr rechenintensiv. Auf langsamen Geräten kann es sinnvoll sein, **Auto-RX 300–3000 Hz** auszuschalten und einen bekannten Audio-Offset im Wasserfall auszuwählen (schmalbandige Suche). Bei ausgelassenen Aufträgen zeigt die Webapp den Verlust offen an, statt angeblich vollständigen Empfang vorzutäuschen. Der 1-Modus-Empfang bleibt weiterhin verfügbar und ist die Standardkonfiguration. Das gilt für den Browser-Decoder und ist keine Portierung des originalen WSJT-X-Mehrmodus-Systems.

**Offline:** Der neue Live-Scheduler wird durch den Service Worker mitgespeichert; Cache-Version `js8web-static-v10`. `tests/live-rx.mjs` prüft unabhängig voneinander laufende Zeitpläne, das Überspringen unvollständiger Slots, Drop-Strategie, Entkopplung der Worker, Fehlerbehandlung und Session-Reset. Diese Komponententests ersetzen keine Realzeit-/HF-Messungen.

## Stand 0.9 – Zuverlässige UTC-TX-Steuerung und optionaler Offline-Betrieb

**Serielle PTT vor Audio:** Der neue Controller `tx-slots.js` richtet TX an UTC-Slots aus und aktiviert bei gewählter RTS/DTR-Steuerung zunächst PTT. Erst nach erfolgreicher Bestätigung durch WebSerial wird das Audio in WebAudio eingeplant. Wird der Slot durch Browser- oder USB-Latenz verpasst, bricht der Controller die Audioausgabe ab. Wird die PTT-Freigabe nicht bestätigt, gilt der Frame **nicht** als erfolgreich beendet. Die Sende-Warteschlange wartet auf Audio-Ende **und** PTT-Aus bis zum nächsten Frame.

**TX-Abbruch:** STOP unterbricht auch geplante, noch nicht gestartete Frames. Browser-Tab im Hintergrund, `pagehide`, und entzogenes TX-Einverständnis lösen ebenfalls einen Abbruch aus (die Deaktivierung von RTS/DTR hängt weiterhin vom funktionierenden USB-Adapter ab). PTT-Kommandos werden serialisiert, sodass `PTT aus` nicht vor einer noch laufenden `PTT an`-Operation überholt werden kann. Wenn RTS/DTR ausgewählt ist, aber kein serieller Port verbunden ist, wird **kein** TX-Audio gestartet. `PTT aus` erlaubt weiterhin Audio-only-Tests. Die Vorlaufzeit ist zwischen 100 und 1500 ms einstellbar; Standard 350 ms. Beachte: Browser-Timing ist nicht hart echtzeitfähig und ein physisch klemmender Adapter kann nicht durch JavaScript zwangsweise abschalten. Funkgerät immer überwachen.

**Offline / GitHub Pages:** Die App registriert `sw.js` unter dem Repository-spezifischen HTTPS-Scope. Die HTML/CSS/JavaScript-Dateien und `js8-core.wasm` werden beim ersten erfolgreichen Laden per CacheStorage gespeichert. Browserseitig unter **Status / Diagnose → Offline-Betrieb** kann mit `JSC-Wörterbuch offline speichern` das komplette, große JSC-Dictionary (8 Dateien) zusätzlich heruntergeladen und nachgewiesen werden. **Offline-Status prüfen** prüft die Cacheeinträge. Kein Backend und keine externen APIs erforderlich. Browserdaten-/Site-Clear löscht auch diesen Cache; ein erster Online-Aufruf ist notwendig.

**Tests:** `tests/tx-slots.mjs` testet UTC-Berechnung, PTT-Schaltreihenfolge, Trennen, abgebrochene Slots, langsam reagierende serielle Schnittstellen und fehlgeschlagene PTT-Freigabe. `tests/offline.mjs` prüft den Service-Worker-Scope, WASM-Precache, Offline-Fallback und Cache-on-use des JSC-Wörterbuchs. Synthetische Tests ersetzen nicht die USB-PTT-/HF-Livevalidierung.

**Status der Gesamtportierung:** Die Webapp ist weiterhin kein vollständiges Desktop-JS8Call. Insbesondere originaler WSJT-X-Softdecoder, Nachrichten-Routing/Store-and-forward, echte remote Inbox und Hamlib-Unterstützung sind noch nicht vollständig portiert.

## Stand 0.8 – verbesserter RX-Decoder (JS8Call-Teilaspekte)

Der browserseitige Worker \`rx-worker.js\` dekodiert weiterhin **ausschließlich nach erfolgreichem CRC12/LDPC(174,87)**. Für schwierige Empfangssituationen sind drei neue, begrenzte Decodierwege hinzugekommen:

* **Zweite LLR-Auswertung:** Nach einem erfolglosen Max-Log-Decodierlauf versucht der Worker eine rauschnormalisierte Log-Sum-Exp-Auswertung der 8-FSK-Tonenergien.
* **Soft-Bit-Kombination wiederholter Frames:** Der neue \`rx-enhance.js\` übernimmt konzeptionell die Signatur-/Kombinationsidee aus dem hochgeladenen Original \`JS8_Mode/soft_combiner.h\`. 174 Soft-Bits werden nur für zeitlich getrennte UTC-Slots mit ähnlichem Modus, Frequenz, Timing und Bit-Signatur kombiniert. Die Daten werden zeitlich begrenzt und beim RX-Stopp geleert. Überlappende Empfangsfenster desselben Slots zählen ausdrücklich nicht mehrfach.
* **Begrenzte SIC-Suche:** Nach einem bereits **CRC/LDPC-validierten** Frame wird dessen 79-Ton-Wellenform per Least-Squares an die Audioaufnahme angepasst und versuchsweise subtrahiert. Ein zweiter Suchlauf erfolgt nur in einem lokal begrenzten Frequenzbereich um erkannte Signale. Das ist eine experimentelle Interferenzunterdrückung, kein Ersatz für den originalen Decoder.

Das Kontrollkästchen **Enhanced RX · Soft-FEC / SIC** aktiviert/deaktiviert diese zusätzlichen Versuche. Da sie mehr Rechenleistung benötigen, auf schwachen Rechnern bei Rückständen deaktivieren.

**WAV-Import:** Mit **WAV: alle 4 Modi** sucht die Anwendung nacheinander NORMAL, FAST, TURBO und SLOW. **WAV-Abbruch** stoppt die Verarbeitung nach dem laufenden Worker-Fenster. Live-RX decodiert weiterhin einen gewählten Modus; automatischer Submode-Wechsel in Echtzeit ist noch nicht implementiert. Decoder-Strategie und eventuelle Soft-Kombination werden in den Empfangsmetadaten/CSV erfasst.

**Reproduzierbare Tests:** \`tests/rx-enhance.mjs\` prüft Signaturabgrenzung, Abweisung duplizierter Slots und das Subtrahieren eines synthetischen JS8-Tonsignals. \`tests/rx-scan.mjs\` prüft weiterhin das tatsächliche WASM-LDPC- und CRC-Decoding. Erfolgreiche synthetische Tests sind noch keine HF-Schwachsignalvalidierung. **Dies ist weiterhin kein vollständiger Port der WSJT-X/JS8Call-Decoder-Engine.**


## CAT-Ausbau · Yaesu FT-450/FT-450D

Über **Konfiguration → CAT · Yaesu FT-450…** lässt sich ein separater WebSerial-CAT-Port öffnen. Wähle die am FT-450 eingestellte CAT-Baudrate (Werkseinstellung üblicherweise 4800) und 1 oder 2 Stopbits passend zum Gerät. Die Webapp fragt die VFO-A-Frequenz alle 3 Sekunden mit `FA;` ab, dekodiert `FAxxxxxxxx;` und stellt den Wert in der Dial-Anzeige dar. Mit **Band am Funkgerät einstellen** kann die Frequenz des ausgewählten JS8-Bandes über `FAxxxxxxxx;` gesetzt werden, aber nur nach expliziter Bestätigung. Die Funktion verwendet **kein automatisches CAT-PTT**, sendet keine beliebigen CAT-Kommandos und ist nicht für andere Geräteprofile freigeschaltet. FT-450 CAT RTS/RTTY kann hardwareabhängig gesonderte Sicherheitshinweise erfordern; im CAT-Port werden RTS und DTR deshalb vorsorglich deaktiviert. Hardwaretests mit angeschlossenem Gerät stehen aus.

Die verwendeten Kommandos stammen aus dem offiziellen [FT-450 CAT Operation Reference Book](https://yaesu.com/Files/4CB893D7-1018-01AF-FA97E9E9AD48B50C/FT-450_CAT_Operation_Reference_Book.pdf). Die Protokolltests liegen in `tests/ft450-cat.mjs`. Diese Funktion ersetzt **nicht** Hamlib und bietet keine vollständige Unterstützung für Xiegu G90 oder andere Funkgeräte.

## Stand 0.7 – JS8Call MSG-Frames, CRC16 und echte TX-Ausgangswahl

**Gerichtete Nachricht:** Im TX-Nachrichteneditor den Modus **Gerichtete MSG · JS8Call + CRC16** wählen, eine Station auswählen und einen Text eingeben. Die Webapp baut einen originalen JS8Call-Directed-Header (`MSG`, Command 9) sowie JSC-kodierte Folgerahmen, hängt die CRC16-KERMIT-Prüfsumme im JS8Call-Base41-Format an und setzt FIRST auf den Directed-Header und LAST auf den letzten Datenframe. Freitext an `@ALLCALL` bleibt im Modus **Freitext · JSC** möglich; automatische Store-and-forward-Routen sind nicht implementiert.

**Empfang:** Die Zusammenführung erkennt nun Nachrichtenketten, bei denen das FIRST-Bit auf dem Directed-Header statt auf einem Datenframe liegt. `MessageSessionTracker` ordnet einen decodierten MSG-Header der nächsten vollständig decodierten Textkette auf der gleichen Audiofrequenz und im gleichen Modus zu (Zeitlimit 10 Minuten). Das Empfangsfenster kennzeichnet ungültige CRC16-Nachrichten als **[CRC FEHLER]**; solche Nachrichten gelten ausdrücklich nicht als bestätigt. Fehlende Frames, Funkinterferenzen und schwache Signale können weiterhin zum Abbruch oder zu Zuordnungsfehlern führen. **Dies ist keine vollständige JS8Call-Routing-/Inbox-Implementierung.**

**TX-Soundkarte:** Zusätzlich zum RX-Eingang gibt es ein Dropdown für den TX-Audioausgang. Chromium-Browser mit `AudioContext.setSinkId` können auf die ausgewählte Soundkarte ausgeben. Wenn die Methode fehlt, zeigt die Anwendung bei der Auswahl eines separaten TX-Ausgangs einen Fehler, anstatt unbemerkt auf die falsche Soundkarte zu senden. WebSerial RTS/DTR bleibt optional; Hamlib/CAT fehlt.

**Tests:** `tests/message-flow.mjs` prüft den CRC16-KERMIT-Referenzvektor `123456789 -> 0x2189 -> 54G`, Directed-MSG-Header/Parser, JSC-TX/RX-Roundtrips für vier Submodes, verkettete MSG-Datenframes und erkannte CRC-Fehler. Der automatisierte Build prüft diesen Test zusätzlich zu den bisherigen Modemtests. Ergebnisse des Build-Tests sind kein Ersatz für einen echten HF-Test.


## Neuer Stand 0.6 – JSC-Freitext-TX, Desktop-Fenster und Logbuch

Der neue Browser-Encoder `jsc-tx.js` portiert die JSC-Codeworterzeugung (s=7,c=9) und die 70/72-Bit-Nachrichtenframes aus dem hochgeladenen JS8Call-Quellcode. Er lädt das vorhandene 262144-Einträge-Wörterbuch, komprimiert Zeichenfolgen und erzeugt FIRST-/LAST-Frames. `app.js` steuert diese Frame-Liste über den bestehenden WASM-79-Ton-Modulator und den UTC-Zeitschlitz. Jede Sendeschlange muss bewusst vorbereitet und mit TX-Freigabe gestartet werden. STOP unterbricht die Warteschlange und deaktiviert RTS/DTR soweit vorhanden.

Die Schaltfläche **JSC-Frames vorbereiten** erzeugt Frames aus beliebigem unterstütztem JSC-Text. **Alle Frames senden** gibt die vorbereiteten Frames über den Browser-Audioausgang slotweise aus. Ein korrektes Funk-HF-Signal setzt eine geeignete Soundkartenschnittstelle und PTT voraus; WebSerial-PTT ist weiterhin nur RTS/DTR. Der Textencoder umfasst **nicht** den vollständigen JS8Call-Directed-Nachrichtenparser, automatische Relays, empfangsbasierte Wiederholungen oder CAT.

Die Oberfläche erhält einen freigestalteten Chat-Composer und aus dem Menü **Fenster** aufrufbare, verschiebbare und skalierbare **Inbox**, **Outbox** und **Logbuch**. Empfangsereignisse und Ausgabeprotokolle werden nur lokal im Browser in `localStorage` gespeichert, nicht an einen Server gesendet. Logbucheinträge können als ADIF exportiert werden. Das sind **lokale Browser-Fenster**, nicht das originale JS8Call-Store-and-Forward-Postfach.

Mit `node tests/jsc-tx.mjs` wird die neue TX-Kodierung gegen die vorhandene JSC-Dekodierung und das Wörterbuch rückgeprüft. Weiterhin **kein 100-prozentiger Port** des Originals (fehlende CAT/Hamlib-Kompatibilität, vollständiger Softdecoder, Relays/Inbox-Protokoll, Nachrichtensemantik und Hardware-Live-Tests).


## Funktionsumfang / geprüfte Tests

| Feature | Status |
|---|---|
| GitHub Pages: HTML/CSS/JS/WASM ohne eigenen Backendserver | Ja, automatischer Actions-Deploy |
| Echte JS8-Modulation: 79 Symbole / 8-FSK / Costas | Ja, im Codec-Loopback geprüft |
| CRC12 / LDPC(174,87) / Frame-Typ 0–7 | Ja, geprüft |
| NORMAL 15s, FAST 10s, TURBO 6s, SLOW 30s | Ja, Audioloopback geprüft |
| RAW 12-Zeichen-Frames | Ja, mit Originalalphabet |
| Audiowiedergabe und UTC-Slot-Zeiten | Implementiert, HF-Hardwaretest offen |
| Empfang über Mikrofon | Implementiert, benötigt Praxistest |
| Automatischer Costas-Breitbandscan 300–3000 Hz | Implementiert und mit synthetischen JS8-WAV-Signalen getestet |
| Wasserfall und WAV-Import/Export | Implementiert |
| CSV-Logging | Implementiert |
| PTT über serielle RTS/DTR-Leitung | Browserseitig implementiert, Hardwaretest offen |
| JS8Call-Protokoll: CQ, HB, gerichtete Kurzbefehle (Einzelrahmen) | **Teilport**; Sender und Parser ergänzt |
| JSC-Freitext-TX und FIRST/LAST-Frameketten | **Ja**, mit JSC-Dictionary; integrierter HF-Livetest offen |\n| Alte Huffman-Textframes und Heartbeat-SNR | Implementiert, Tests mit echten RX-Frames |
| Vollständige JSC-Wortbuch-Dekompression (262144 Wörter) | **Ja: RX-Teilport**, alle Wörter in acht statischen JSON-Dateien; On-air-Frame-Tests |
| Browser-Inbox/Outbox, lokale Datenspeicherung und ADIF-Logbuch | **Ja**, lokal in Browserdaten |
| Original-JS8Call-Inbox, Nachrichtentransfer, Routing/Store-and-forward | **Nein** |
| Vollständiger Softdecoder mit zeit-/frequenzbreitem Suchraster wie im Original | **Nein** |
| Hamlib/CAT-Transceiversteuerung, USB-PTT für alle Geräte | **Nein** |
| Browser-Unterstützung ohne WebSerial | RX/TX-Audio möglich; keine serielle PTT |

**Wichtiger Hinweis:** Ein korrekt erzeugter JS8-Transportframe ist noch **keine reguläre JS8Call-Freitextnachricht**. Das Original verwendet zusätzlich `varicode.cpp` für Kompression, Rufzeichen, Frame-Arten, Directed-Commands, Checksummen und Verkettung. Auf Sendung mit dieser Lab-Version würde ein normaler JS8Call-Client den Dateninhalt üblicherweise nicht als lesbare QSO-Nachricht darstellen. Bitte nur in einer geeigneten Testumgebung oder ausdrücklich als Labortest benutzen.

Der Empfänger sucht standardmäßig **300–3000 Hz** nach Costas-Synchronisationen, verfeinert Zeit und Tonfrequenz und versucht bis zu 14 CRC12/LDPC-gültige JS8-Frames pro Suchfenster. Alternativ kann ein enger Bereich um die ausgewählte Audiofrequenz benutzt werden. Die Webapp erkennt CQ/HB und eine begrenzte Menge gerichteter Kurzbefehle. Dies ist **kein vollwertiger schwachsignaltauglicher JS8Call-Decoder**; der reale Empfang wurde durch einen JS8Web-RX-Log vom 4.11.2026 mit HB-/ACK-/SNR-Frames mehrerer Funkstationen bestätigt; schwache-Signal-Leistung und Robustheit sind aber noch nicht mit dem Original verglichen.


## Bedienoberfläche und RX-Port in v0.4

Die neue Menüleiste enthält **Datei, Konfiguration, Modus, Log, Ansicht, Steuerung, Hilfe**. Die Anordnung folgt der originalen JS8Call-Arbeitsweise: **Band Activity links, empfangene Nachrichten und TX-Eingabe in der Mitte, Call Activity rechts, Wasserfall unten**. Rufzeichen und Alter stammen aus tatsächlich decodierten Frames. Ein Klick wählt das Zielrufzeichen; Doppelklick stimmt die Audiofrequenz ab. Die Auswahlmenüs öffnen Einstellungen und rufen echte RX-/CQ-/WAV-/Log-/Halt-Funktionen auf. Stations-Einstellungen werden lokal gespeichert; TX-Freigaben ausdrücklich nicht.

Der Protokoll-Decoder unterstützt jetzt **HEARTBEAT SNR / CMD 29 mit dB-Anzeige**, ACK und weitere Kurzbefehle sowie das ältere Huffman-Textformat. Die **JSC-Wortbuch-Dekompression ist seit v0.5 eingebaut** und arbeitet ohne einen Backendserver. Textfragmente mit FIRST-/LAST-Kennungen werden nach Frequenz und aufeinanderfolgenden Zeitfenstern zusammengesetzt. Eine vollständige QSO-/Inbox-/Store-and-forward-Verwaltung und ein originalgetreuer Softdecoder fehlen weiterhin. `tests/protocol-rx.mjs` enthält Rohframe-Regressionen aus dem eingereichten JS8Web-Log mit Stationen wie MM0ZFG, G5TAR, 2E0RLZ, PA3ATX und M6MHG.

## JSC-Decodierung und reale Beispielsignale (v0.5)

Das Originalwörterbuch aus [JS8Call `jsc_map.cpp`](https://github.com/js8call/js8call/blob/main/jsc_map.cpp) enthält **262.144 Einträge**. Es liegt im Unterordner `jsc-dict/` als acht nach Index geordnete JSON-Dateien mit je 32.768 Einträgen. Der Decoder `jsc.js` übernimmt den ursprünglichen (s=7,c=9)-Dense-Code mit optionalem Leerzeichen hinter Wörtern, entfernt das JS8-Padding und lädt nur die benötigten Wörterbuchdateien.

**Verifiziert an Rohframes aus dem echten Empfänger-CSV vom 4. November 2026:**

| Rawframe | JSC-Freitext |
|---|---|
| `wpKlK1tYGr++` | `NICE DAY HERE, ` |
| `+qxsyDGlB2++` | `WILL POP IN AND ` |
| `tc4+fKl65A++` | `OUT WHEN I GET A ` |

Frames mit erkanntem JSC-Inhalt erscheinen nach dem initialen Wörterbuch-Laden automatisch als Klartext im Band- und Nachrichtenfenster. Der RX-Pfad bleibt unverändert quellseitig lokal: Mikrofon/USB-Audio → Browser/WebWorker → WebAssembly LDPC/CRC → JSC-Wortbuch. Für 44,1/48-kHz-Soundkarten nutzt der Decoder jetzt einen Polyphase-Tiefpass vor der Reduktion auf 12 kHz, um Aliasing zu mindern.

`node tests/jsc.mjs` testet die Wörterbuch-Integrität und diese drei realen Rohframes. Das bedeutet **keinen Nachweis identischer schwachsignalseitiger Empfindlichkeit mit Desktop-JS8Call**. JSC-TX-Freitextkompression, volles Nachrichtenrouting, Inbox, CAT und weitere native Funktionen sind noch nicht fertig.

## GitHub Pages – automatische Bereitstellung

Das Repository https://github.com/DE8MSH/js8call_webapp enthält die Quelldateien.
Der Workflow `.github/workflows/deploy.yml` baut `js8-core.wasm` aus `js8-core.c`,
führt Transport-, Breitband-, Protokoll- und JSC-Empfangstests aus und veröffentlicht das Ergebnis via GitHub Pages.
Der erzeugte WASM-Codec ist Bestandteil des Pages-Deployments und wird zusätzlich als herunterladbares Build-Artefakt gespeichert.
Es wird kein externer Backendserver benötigt.

**Einmalige Einstellung:** In **Settings → Pages → Build and deployment → Source**
**GitHub Actions** auswählen. Falls der erste Workflow vor der Aktivierung scheitert,
in **Actions → Build and deploy JS8Web LAB → Run workflow** erneut ausführen.
Die spätere URL ist: **https://de8msh.github.io/js8call_webapp/**

GitHub Pages bietet HTTPS; der erste Deploy ist erst nach erfolgreichem Actions-Lauf live.

## Lokaler Test auf Linux Mint 22

```bash
cd js8web-pages
./PRUEFEN.sh
python3 -m http.server 8765
```

Dann `http://localhost:8765/` in Chrome/Chromium/Edge öffnen. Unter `localhost` ist Mikrofonzugriff ebenfalls erlaubt. Für das Bauen mit Emscripten muss `emcc` installiert sein. Die mit GitHub Actions gebaute WASM-Datei funktioniert danach auch ohne lokale Emscripten-Installation.

## WASM mit Emscripten aus Quellcode bauen

```bash
# Emscripten SDK (emsdk) nach Dokumentation installieren und aktivieren:
# https://emscripten.org/docs/getting_started/downloads.html
cd js8web-pages
./BAUEN.sh
./PRUEFEN.sh
```

Wenn `emcc` vorhanden ist, nutzt `BAUEN.sh` Emscripten. Andernfalls wird ein freestanding `wasm32`-Build mit `clang` und `wasm-ld` erzeugt (gleiche WebAssembly-Exports). Beim GitHub-Pages-Deployment wird das WASM-Modul von GitHub Actions gebaut. Das ursprüngliche Lab-Paket enthielt einen vorgefertigten `clang`-Build. Ein Emscripten-Build wurde hier nicht ausgeführt. Der Codec benötigt keine OS-Funktionen und keine Backenddienste.

### Architektur

```text
index.html + app.css + ui-layout.js
    app.js ── WebAudio (Mikrofon, FFT-Wasserfall, TX-Audio)
       │   ├─ WebSerial (optional PTT RTS/DTR)
       │   └─ WASM-Encoder (js8-core.wasm)
       └─ rx-worker.js ── Goertzel, Costas-Suche, LLR ── WASM-LDPC/CRC
                  ↳ js8-core.wasm
js8-core.c ── unabhängiger, portierter JS8-Frame-Codec
```

Ursprüngliche Referenzen: [`JS8.cpp`](https://github.com/js8call/js8call/blob/main/JS8.cpp), [`JS8.hpp`](https://github.com/js8call/js8call/blob/main/JS8.hpp), [`commons.h`](https://github.com/js8call/js8call/blob/main/commons.h), [`varicode.cpp`](https://github.com/js8call/js8call/blob/main/varicode.cpp) (Protokoll nicht portiert), [Emscripten](https://github.com/emscripten-core/emscripten).

### Audio / PTT

* Browser-Mikrofonaufnahme ohne Echo-/Noise-/Automatic-Gain-Verarbeitung anfordern.
* 12 kHz DSP, Phasenkontinuität bei 8-FSK-Tonsymbolen, sanfter Ein- und Ausblendrand.
* Soundkartenausgang wird als TX-Audio verwendet; das Funkgerät muss korrekt auf USB eingestellt und in passender Weise angeschlossen sein.
* WebSerial kann RTS oder DTR setzen. Nicht jedes TRX und nicht jede USB-Schnittstelle unterstützt diese PTT-Methode. Kein umfassendes Hamlib, keine garantierte CAT-Kompatibilität und keine automatische Frequenzeinstellung.
* Der Empfänger puffert Mikrofonsamples zeitbezogen über UTC-Slotgrenzen hinweg, damit Puffergrenzen nicht den Anfang einer Aussendung abschneiden. Der Wasserfall erlaubt durch Klicken die Wahl einer manuellen Frequenz; Auto-RX sucht unabhängig davon breitbandig.\n* 12 bit CRC im Transportframe schützt die Daten; `js8-core.c` verwendet den GPLv3-Quellcode als Referenz, ersetzt aber nicht die gesamte Signalverarbeitung des Originals.
* UTC-Slot und Laptop-Zeit sollten z. B. mit `systemd-timesyncd` synchronisiert sein. Timing und TX-Audio sind im Browser nicht hart echtzeitfähig.

## Sicherheit und Lizenz

Nur mit gültiger Amateurfunkzulassung und innerhalb der zulässigen Frequenzen und Betriebsarten senden. Vor TX prüfen: Frequenztabelle, Band, USB-Modus, PTT-Polarität, Sendepegel, mögliche HF-Rückkopplung. Da Webseiten keinen garantierten Echtzeitzugriff auf Hardware haben, niemals PTT ohne Überwachung laufen lassen.

**GPL-3.0:** Original JS8Call von den jeweiligen JS8Call- und WSJT-X-Mitwirkenden; Codec adaptiert unter GPLv3. Quellcode und vollständige Lizenz liegen bei. Das Repository enthält keine kopierten Emscripten-Bibliotheken. Der neue Browsercode ist ebenfalls unter GPL-3.0 veröffentlicht. Der Projektname JS8Web LAB kennzeichnet die Nicht-Zugehörigkeit zum offiziellen JS8Call-Projekt.

## Entwicklungsbedarf für einen vollständigen Webport

Für eine echte JS8Call-kompatible Webanwendung müssen mindestens `varicode.cpp`, die JS8Call-Nachrichtenverwaltung, der vollständige weaksignal-Decoder und weitere Funktionen portiert werden. Qt 6 WebAssembly allein beseitigt nicht die Probleme mit Hamlib, nativer serieller Kommunikation, Audio-Scheduling, Threads, WebAssembly-Speicher und dem Browser-Sandbox-Modell. Solange diese fehlen, ist dieses Paket als **technischer Prototyp** und nicht als vollständiger JS8Call-Client zu verwenden.

## Stand 0.3 – RX-Korrektur vom 4. November 2026

Der vorherige Worker suchte nur ±8 Hz und wenige Zehntelsekunden am Slot-Beginn und erkannte deshalb viele empfangene Stationen nicht. Der neue Worker sucht das komplette 300–3000-Hz-Audioband mittels FFT/Costas-Korrelation, verfeinert Kandidaten über Goertzel und wendet anschließend den bestehenden LDPC-/CRC-Decoder an. Auch Mikrofon-Pufferung und WAV-Suche wurden an überlappende Slots angepasst.

Reproduzierbare Tests: `node tests/test.mjs` und `node tests/rx-scan.mjs` (bei vorhandenem `js8-core.wasm`). Die neuen Tests prüfen Frequenzen von 650 bis 2550 Hz, bis zu 1,1 s Zeitversatz, 12/48 kHz PCM, simuliertes Rauschen, zwei gleichzeitige Signale sowie die Unterdrückung eines Rauschfensters ohne Aussendung. **Diese Tests sind keine reale Funkvalidierung und keine Garantie für die Dekodierung sehr schwacher Stationen.**

Bei Problemen in der Webseite: Auto-RX aktiviert lassen, Modus auf NORMAL und USB-Dial-Frequenz am Transceiver korrekt einstellen, HF-Audio-Signal über das gewählte Mikrofon/Soundkarten-Interface einspeisen, unnötige Echo-/Rauschfilter des Systems deaktivieren und die UTC-Uhr überprüfen. Als erste Gegenprobe 'Test-WAV erzeugen' und dieselbe Datei unter 'WAV-Datei decodieren' einlesen.

**LDPC-Korrektur in v0.3:** Die Check-to-Variable-Nachrichten im WASM-Min-Sum-Decoder hatten ein falsches Basisvorzeichen für gerade Parität bei einer LLR-Konvention (positiv = Bit 1). Dieses Vorzeichen wurde korrigiert. Ein zusätzlicher reproduzierbarer schwacher Rausch-Test prüft den Fehler; er ersetzt keine Live-Funkvalidierung.
