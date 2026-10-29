# Rechnungsgenerator für Kfz-Zulassungsdienste

Webanwendung zum Erstellen von Rechnungen für Kfz-Zulassungen und Kennzeichen – mit Live-Vorschau, PDF-Export, GiroCode, Rechnungsarchiv, Kundenliste und Preisliste.

**Alle Daten bleiben auf dem Rechner, auf dem die App geöffnet wird.** Es gibt keinen Server, kein Konto, keine Cookies und kein Tracking.

## Funktionen

- Rechnung erfassen: Kunde (Stammkunde oder Laufkunde), Fahrzeug (Kennzeichen, Vorgang, FIN, Halter), Positionen per Klick oder „Zulassungspaket“
- Bruttopreise; Umsatzsteuer wird je Steuersatz herausgerechnet
- PDF-Rechnung nach DIN 5008 (Fensterumschlag), wahlweise im Layout „Neues Design“ oder „Foto-Stil“
- GiroCode (EPC-QR) für die Überweisung mit Betrag und Verwendungszweck
- Bar- und Kartenzahlung mit passendem Zahlungshinweis
- Rechnungsarchiv mit Status offen/bezahlt, Suche und CSV-Export für das Steuerbüro
- Fortlaufende Rechnungsnummern im Format `NNNN.JJJJ`
- Funktioniert nach dem ersten Aufruf auch offline und lässt sich als App installieren

## Datenschutz und Speicherort

| Was | Wo |
|---|---|
| Firmendaten, Leistungen, Kunden, Rechnungsarchiv | IndexedDB des Browsers auf diesem Rechner |
| Aktueller Rechnungsentwurf | localStorage des Browsers |
| App-Dateien (für Offline-Nutzung) | Cache des Service Workers |

- Die App lädt **keine** Dateien von fremden Servern: keine Google Fonts, keine CDNs, keine Analyse-Dienste. Die Bibliotheken für PDF und QR-Code liegen im Ordner `vendor/`.
- Im Repository stehen **keine** Firmen- oder Kundendaten. Die Firmendaten trägt man beim ersten Start unter **Firma** ein oder spielt eine Sicherung ein.
- Jeder Browser und jeder Rechner hat einen eigenen, getrennten Datenbestand.

### Datensicherung – wichtig

Wenn die Browserdaten gelöscht werden („Verlauf löschen“, „Websitedaten entfernen“) oder der Rechner ausgetauscht wird, sind die Daten weg. Deshalb:

1. Unter **Firma → Datensicherung** regelmäßig **„Sicherung herunterladen“** wählen. Das Ergebnis ist eine JSON-Datei mit allen Daten.
2. Diese Datei an einem sicheren Ort ablegen, zum Beispiel auf einem USB-Stick oder einem Netzlaufwerk. Sie enthält Kunden- und Bankdaten, also bitte nicht öffentlich ablegen.
3. Mit **„Sicherung einspielen“** lassen sich die Daten wiederherstellen oder auf einen anderen Rechner übertragen.

Das Archiv erinnert daran, wenn die letzte Sicherung älter als 30 Tage ist.

## Erste Schritte

1. Die GitHub-Pages-Adresse im Browser öffnen (Chrome, Edge, Firefox oder Safari).
2. Unter **Firma** Firmenname, Anschrift, Steuernummer und Bankverbindung eintragen und speichern – oder eine vorhandene Sicherung einspielen.
3. Optional unter **Firma** die erste Rechnungsnummer setzen, zum Beispiel `0042.2026`.
4. Leistungen und Preise unter **Leistungen** prüfen.
5. Auf **Rechnung** die erste Rechnung erstellen, **Speichern** und **PDF herunterladen**.

## Umsatzsteuer

- Preise werden **brutto** eingegeben.
- Verauslagte Gebühren der Zulassungsstelle laufen mit **0 %** als durchlaufender Posten (§ 10 Abs. 1 Satz 6 UStG, mit Fußnote auf der Rechnung). Alle anderen Leistungen, auch Porto und Versand, laufen mit **19 %**.
- Rechenweg je Steuersatz: Brutto summieren, netto = Brutto ÷ 1,19 (kaufmännisch gerundet), USt = Brutto − netto.
- Prüfbeispiel: 40,20 € (0 %) + 116,90 € (19 %) = **157,10 €** brutto, davon 138,44 € netto und 18,66 € USt.

Die steuerliche Umsetzung ist sorgfältig gemacht, ersetzt aber keine Steuerberatung.

## Hosting über GitHub Pages

1. Im Repository **Settings → Pages** öffnen.
2. Bei **Source** „Deploy from a branch“ wählen, Branch `main`, Ordner `/ (root)`, dann **Save**.
3. Nach etwa einer Minute ist die App unter `https://<benutzer>.github.io/<repo>/` erreichbar.

Updates: Nach einem Push auf `main` wird die neue Version beim nächsten Öffnen geladen. Für einen sofortigen Wechsel der Offline-Dateien die Konstante `CACHE` in `sw.js` hochzählen.

## Entwicklung und Tests

Die App besteht aus einer einzigen Datei (`index.html`) ohne Build-Schritt.

```bash
npm install --no-save playwright
npx playwright install chromium
node tests/e2e.mjs
```

Die Tests starten einen lokalen Webserver und prüfen unter anderem Rechenlogik und Rundung, die Speicherung in IndexedDB (auch nach einem Neuladen), Sicherung und Wiederherstellung, PDF-Erzeugung und GiroCode sowie die Darstellung auf dem Handy.

## Drittanbieter

- [jsPDF](https://github.com/parallax/jsPDF) 2.5.1 – MIT-Lizenz (`vendor/LICENSE-jspdf.txt`)
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) 1.4.4 – MIT-Lizenz (Hinweis im Dateikopf von `vendor/qrcode.js`)
