# JS8Web LAB 0.3 – GitHub-Pages-Webapp

**Experimenteller JS8-Transceiver auf Transportframe-Ebene mit WebAssembly.**

Dieses Projekt ist **kein vollständiger JS8Call-Port** und darf nicht als solcher bezeichnet werden. Es ist eine unabhängig gestaltete Browser-UI mit einem portierten JS8-Frame-Codec aus dem GPLv3-Projekt `js8call/js8call`. Die Webapp benötigt weder einen Dienst noch einen Backendserver. Der beiliegende WebAssembly-Codec kann mit Emscripten neu gebaut werden.

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
| JS8Call-Protokoll: CQ, HB, gerichtete Kurzbefehle (Einzelrahmen) | **Teilport**; Sender und Parser ergänzt |\n| Vollständiges JS8Call-Textprotokoll, Inbox und Store-and-forward | **Nein** |
| Vollständiger Softdecoder mit zeit-/frequenzbreitem Suchraster wie im Original | **Nein** |
| Hamlib/CAT-Transceiversteuerung, USB-PTT für alle Geräte | **Nein** |
| Browser-Unterstützung ohne WebSerial | RX/TX-Audio möglich; keine serielle PTT |

**Wichtiger Hinweis:** Ein korrekt erzeugter JS8-Transportframe ist noch **keine reguläre JS8Call-Freitextnachricht**. Das Original verwendet zusätzlich `varicode.cpp` für Kompression, Rufzeichen, Frame-Arten, Directed-Commands, Checksummen und Verkettung. Auf Sendung mit dieser Lab-Version würde ein normaler JS8Call-Client den Dateninhalt üblicherweise nicht als lesbare QSO-Nachricht darstellen. Bitte nur in einer geeigneten Testumgebung oder ausdrücklich als Labortest benutzen.

Der Empfänger sucht standardmäßig **300–3000 Hz** nach Costas-Synchronisationen, verfeinert Zeit und Tonfrequenz und versucht bis zu acht CRC12/LDPC-gültige JS8-Frames pro Suchfenster. Alternativ kann ein enger Bereich um die ausgewählte Audiofrequenz benutzt werden. Die Webapp erkennt CQ/HB und eine begrenzte Menge gerichteter Kurzbefehle. Dies ist **kein vollwertiger schwachsignaltauglicher JS8Call-Decoder**; realer HF-Empfang wurde nicht verifiziert.

## GitHub Pages – automatische Bereitstellung

Das Repository https://github.com/DE8MSH/js8call_webapp enthält die Quelldateien.
Der Workflow `.github/workflows/deploy.yml` baut `js8-core.wasm` aus `js8-core.c`,
führt die bisherigen und die neuen Breitband-Empfangstests aus und veröffentlicht das Ergebnis via GitHub Pages.
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
index.html + app.css
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
