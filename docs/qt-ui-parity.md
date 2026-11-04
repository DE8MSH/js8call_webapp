# JS8Web 1.1 — Abgleich mit den originalen Qt-UI-Dateien

**Quelle:** Anwender-Upload `JS8Call-improved-master.zip`. Die originale QSplitter-Struktur und
Bezeichnungen wurden direkt aus diesen Dateien entnommen:

- `JS8_UI/mainwindow.ui`
- `JS8_UI/MessagePanel.ui`
- `JS8_UI/WideGraph.ui`
- `JS8_UI/Configuration.ui`

Die Dateinamen sind die Qt-Designer-Quelldateien der bereitgestellten
JS8Call-Variante, nicht neue Browser-Mockups. Das Projekt führt keinen
Qt-Code im Browser aus, sondern setzt vorhandene HTML-Module passend um.

## Struktur des Originalfensters und Browserentsprechungen

| Original (Qt objectName) | Weboberfläche | Zustand |
| --- | --- | --- |
| `topSplitter`, `textHorizontalSplitter`, `callsVerticalSplitter` | Drei Hauptspalten, zwei per Maus und Tastatur verstellbare Trenner | Implementiert; Größen werden lokal gespeichert |
| `textVerticalSplitter` | Vertikaler Trenner zwischen Empfangstext und Nachrichteneditor | Mit Maus und Pfeiltasten verstellbar; Höhe gespeichert |
| `tableWidgetRXAll` | Band Activity links, Spalten UTC/Mode/Offset/Message | Anzeige, manuelle Tabellensortierung |
| `textEditRX` | Gelbes Empfangsfenster `#rxMessages` | Implementiert, originalgetreue Hintergrundfarbe `#ffeaa7` |
| `extFreeTextMsgEdit` | Textkomponist `#textMessage` | JSC-Freitext vorhanden |
| `callDetailTextBrowser` | Stationsdetails `#qtCallDetails` | Bei Stationsauswahl sichtbar, bekannte RX-Daten |
| `tableWidgetCalls` | `#callActivity` mit Rufzeichen, Zeit und Offset | Implementiert |
| `macroHorizontalWidget` | `#qtMacroToolbar` | Reihenfolge und Beschriftungen aus Qt-Quelle |
| `queryButton`, `snrMacroButton`, `infoMacroButton`, `statusMacroButton` | Directed, SNR, INFO, STATUS | Bereiten Frame vor, senden nie automatisch |
| `cqMacroButton`, `hbMacroButton` | CQ, HB | Bereiten vorhandene CQ/HB-Frames vor |
| `macrosMacroButton` | Saved | Neuer lokaler Dialog für editierbare Textmakros und Vorlagen |
| `deselectButton`, `replyMacroButton`, `stopTxButton` | Deselect, REPLY, Halt | Vorhandene Funktionen verbunden |
| `controlHorizontalWidget` | `#qtControlToolbar` | Originale Kontrollleiste mit ehrlicher Funktionsabgrenzung |
| `monitorButton` | RX | Start/Stop des echten Browser-RX |
| `monitorTxButton` | TX | Zeigt manuellen Freigabestatus, keine automatische Aktivierung |
| `logQSOButton` | LOG QSO | Öffnet lokales ADIF-Logbuch |
| `readFreq` | CAT | Öffnet vorhandene FT-450-CAT-Einstellungen |
| `auto_reply_button`, `hb_button`, `hb_ack_button`, `tuneButton`, `spotButton` | AUTO, HB AUTO, HB ACK, TUNE, SPOT | Sichtbar, bewusst deaktiviert |

## Aus WideGraph.ui übernommen

- **Offset**: ±25 Hz am aktuellen Audio-Offset, mit synchronisierter Frequenzanzeige
- **Palette**: Classic/Default, Heat, Grayscale — wirkt unmittelbar auf den vorhandenen Canvas-Wasserfall
- **Gain** und **Zero**: regeln die Intensität des dargestellten Spektrums; verändern nicht das Empfangsaudio
- **Average**: setzt `AnalyserNode.smoothingTimeConstant`
- **Time Drift…**: führt zu der vorhandenen UTC-Korrektur der Station
- **Ansicht → Wasserfall-Regler**: ein-/ausblenden

## Aus dem Qt-Menü übernommen

Die vorhandenen Menüs Datei, Konfiguration, Modus, Log, Ansicht und Steuerung
werden um Ansicht/Vollbild und Fokus-Aktionen ergänzt. Der Original-Qt-Befehl
**Show Fullscreen (F11)** wird in der Webapp als Menüaktion angeboten, weil
Browsersysteme F11 selbst reservieren können.

## Bewusst nicht als umgesetzt ausgegeben

Es gibt weiterhin keine vollständige Qt-Funktionalität des Originalprogramms:
beispielsweise keine automatischen Heartbeats/Antworten, keine vollständige
Store-and-forward-Nachrichtenweiterleitung, keine universelle Hamlib-CAT-Steuerung,
keine vollständige WideGraph-DSP-Nachbildung und keinen Original-WSJT-X-Decoder.
Die Weboberfläche zeigt diesen Unterschied ausdrücklich an.

Im Browser gibt es keine Datei- und Netzwerkzugriffe über beliebige lokale
Schnittstellen wie beim nativen Qt-Programm. Daten des Saved-Dialogs und
Spaltengrößen liegen ausschließlich in `localStorage`; Wellenform,
Wörterbuch und Programmdateien können über den vorhandenen Service Worker
offline gespeichert werden.

**Qualitätssicherung:** `tests/qt-ui.mjs` prüft IDs, Verknüpfung mit
bestehenden Modulen, dokumentierte Qt-Referenznamen und Offline-Cache-Eintrag.
Diese statische Prüfung und der Build ersetzen keine browserbasierte
Sichtprüfung, insbesondere nicht bei sehr kleinen Displays.
