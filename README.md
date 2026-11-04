# JS8Web LAB 0.1 – GitHub-Pages-Webapp

**Experimenteller JS8-Transceiver auf Transportframe-Ebene mit WebAssembly.**

Dieses Projekt ist **kein vollständiger JS8Call-Port** und darf nicht als solcher bezeichnet werden. Es ist eine unabhängig gestaltete Browser-UI mit einem portierten JS8-Frame-Codec aus dem GPLv3-Projekt `js8call/js8call`. Die Webapp benötigt weder einen Dienst noch einen Backendserver. Der beiliegende WebAssembly-Codec kann mit Emscripten neu gebaut werden.

## Funktionsumfang / geprüfte Tests

| Feature | Status |
|---|---|
| GitHub Pages: HTML/CSS/JS/WASM ohne Server/Actions | Ja |
| Echte JS8-Modulation: 79 Symbole / 8-FSK / Costas | Ja, im Codec-Loopback geprüft |
| CRC12 / LDPC(174,87) / Frame-Typ 0–7 | Ja, geprüft |
| NORMAL 15s, FAST 10s, TURBO 6s, SLOW 30s | Ja, Audioloopback geprüft |
| RAW 12-Zeichen-Frames | Ja, mit Originalalphabet |
| Audiowiedergabe und UTC-Slot-Zeiten | Implementiert, HF-Hardwaretest offen |
| Empfang über Mikrofon | Implementiert, benötigt Praxistest |
| Einfrequenz-Goertzel-Decoder (selbst erzeugte Testframes) | Ja, 4 Modi geprüft |
| Wasserfall und WAV-Import/Export | Implementiert |
| CSV-Logging | Implementiert |
| PTT über serielle RTS/DTR-Leitung | Browserseitig implementiert, Hardwaretest offen |
| Vollständiges JS8Call-Text-/Nachrichtenprotokoll, CQ/HB, Directed Message, Inbox und Store-and-forward | **Nein** |
| Vollständiger Softdecoder mit zeit-/frequenzbreitem Suchraster wie im Original | **Nein** |
| Hamlib/CAT-Transceiversteuerung, USB-PTT für alle Geräte | **Nein** |
| Browser-Unterstützung ohne WebSerial | RX/TX-Audio möglich; keine serielle PTT |

**Wichtiger Hinweis:** Ein korrekt erzeugter JS8-Transportframe ist noch **keine reguläre JS8Call-Freitextnachricht**. Das Original verwendet zusätzlich `varicode.cpp` für Kompression, Rufzeichen, Frame-Arten, Directed-Commands, Checksummen und Verkettung. Auf Sendung mit dieser Lab-Version würde ein normaler JS8Call-Client den Dateninhalt üblicherweise nicht als lesbare QSO-Nachricht darstellen. Bitte nur in einer geeigneten Testumgebung oder ausdrücklich als Labortest benutzen.

Der Empfänger sucht ausschließlich **eine manuell ausgewählte Audiofrequenz** und prüft die empfangenen Bits mit dem originalen CRC12 sowie einem vereinfachten Min-Sum-LDPC-Decoder. Er ist nicht vergleichbar mit dem vollwertigen Mehrsignal-/Schwachsignal-Decoder von JS8Call.

## Direkt auf GitHub Pages hochladen – ohne GitHub Actions

1. ZIP `JS8Web_LAB_GitHubPages_v0.1.zip` herunterladen und entpacken.
2. Auf GitHub ein **öffentliches** Repository anlegen, z. B. `js8call_webapp`.
3. **Den Inhalt des entpackten Ordners** in das Repository-Root hochladen (`index.html`, `app.js`, `rx-worker.js`, `js8-core.wasm`, `app.css` usw.). Nicht nur die ZIP-Datei hochladen.
4. **Settings → Pages → Build and deployment**: `Deploy from a branch` auswählen, danach `main` und `/(root)` auswählen und speichern.
5. Die Website ist dann üblicherweise unter `https://DEINNAME.github.io/js8call_webapp/` erreichbar. Wenn das Repository `DEINNAME.github.io` heißt, liegt die Seite stattdessen im Root `https://DEINNAME.github.io/`.

Es wird kein GitHub-Actions-Workflow mitgeliefert. `js8-core.wasm` ist bereits enthalten. Manche GitHub-Pages-Deployments können trotzdem in GitHubs eigener Deployments-/Actions-Anzeige erscheinen.

**HTTPS:** GitHub Pages stellt HTTPS bereit. Für Mikrofon und WebSerial ist ein sicherer Ursprung notwendig. `file://` ist für das Laden des WASM-Moduls unzuverlässig und wird nicht als Installationsmethode empfohlen.

## Lokaler Test auf Linux Mint 22

```bash
cd js8web-pages
./PRUEFEN.sh
python3 -m http.server 8765
```

Dann `http://localhost:8765/` in Chrome/Chromium/Edge öffnen. Unter `localhost` ist Mikrofonzugriff ebenfalls erlaubt. Für das Bauen mit Emscripten muss `emcc` installiert sein. Das beigelegte WASM funktioniert auch ohne diese Installation.

## WASM mit Emscripten aus Quellcode bauen

```bash
# Emscripten SDK (emsdk) nach Dokumentation installieren und aktivieren:
# https://emscripten.org/docs/getting_started/downloads.html
cd js8web-pages
./BAUEN.sh
./PRUEFEN.sh
```

Wenn `emcc` vorhanden ist, nutzt `BAUEN.sh` Emscripten. Andernfalls wird ein freestanding `wasm32`-Build mit `clang` und `wasm-ld` erzeugt (gleiche WebAssembly-Exports). Der **beigelegte** `js8-core.wasm`-Build wurde mit dem zweiten Verfahren erstellt, da in der Erstellungssitzung kein `emcc` verfügbar war. Ein Emscripten-Build wurde hier nicht ausgeführt. Der Codec benötigt keine OS-Funktionen und keine Backenddienste.

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
* 12 bit CRC im Transportframe schützt die Daten; `js8-core.c` verwendet den GPLv3-Quellcode als Referenz, ersetzt aber nicht die gesamte Signalverarbeitung des Originals.
* UTC-Slot und Laptop-Zeit sollten z. B. mit `systemd-timesyncd` synchronisiert sein. Timing und TX-Audio sind im Browser nicht hart echtzeitfähig.

## Sicherheit und Lizenz

Nur mit gültiger Amateurfunkzulassung und innerhalb der zulässigen Frequenzen und Betriebsarten senden. Vor TX prüfen: Frequenztabelle, Band, USB-Modus, PTT-Polarität, Sendepegel, mögliche HF-Rückkopplung. Da Webseiten keinen garantierten Echtzeitzugriff auf Hardware haben, niemals PTT ohne Überwachung laufen lassen.

**GPL-3.0:** Original JS8Call von den jeweiligen JS8Call- und WSJT-X-Mitwirkenden; Codec adaptiert unter GPLv3. Quellcode und vollständige Lizenz liegen bei. Das Repository enthält keine kopierten Emscripten-Bibliotheken. Der neue Browsercode ist ebenfalls unter GPL-3.0 veröffentlicht. Der Projektname JS8Web LAB kennzeichnet die Nicht-Zugehörigkeit zum offiziellen JS8Call-Projekt.

## Entwicklungsbedarf für einen vollständigen Webport

Für eine echte JS8Call-kompatible Webanwendung müssen mindestens `varicode.cpp`, die JS8Call-Nachrichtenverwaltung, der vollständige weaksignal-Decoder und weitere Funktionen portiert werden. Qt 6 WebAssembly allein beseitigt nicht die Probleme mit Hamlib, nativer serieller Kommunikation, Audio-Scheduling, Threads, WebAssembly-Speicher und dem Browser-Sandbox-Modell. Solange diese fehlen, ist dieses Paket als **technischer Prototyp** und nicht als vollständiger JS8Call-Client zu verwenden.