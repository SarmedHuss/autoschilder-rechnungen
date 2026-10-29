// End-to-End-Tests für den Rechnungsgenerator.
// Aufruf: node tests/e2e.mjs   (benötigt: npm install --no-save playwright && npx playwright install chromium)
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const URL0 = `http://localhost:${server.address().port}/`;

const fails = [];
const check = (name, cond, info = "") => { console.log(cond ? "OK  " : "FAIL", name, info === "" ? "" : String(info).slice(0, 160)); if (!cond) fails.push(name); };
const OUT = path.join(ROOT, "tests", "out"); fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, acceptDownloads: true, locale: "de-DE" });
const page = await ctx.newPage();
const errors = [], external = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));
page.on("request", (r) => { const u = new URL(r.url()); if (!["localhost", "127.0.0.1"].includes(u.hostname) && !u.protocol.startsWith("blob") && !u.protocol.startsWith("data")) external.push(r.url()); });
const settle = () => page.waitForTimeout(350);

// 1) Erster Start
await page.goto(URL0); await settle();
check("Einrichtungshinweis sichtbar", await page.isVisible("#setupBanner"));
check("Speicher lokal (IndexedDB)", (await page.textContent("#storePill")).includes("lokal"));
check("Beispielrechnung 157,10 €", (await page.textContent("#totals")).includes("157,10 €"));
check("Erste Nummer 0001.JJJJ", /^0001\.\d{4}$/.test(await page.inputValue("#f-nr")), await page.inputValue("#f-nr"));
await page.click("#pdfBtn"); await settle();
check("PDF ohne Firmendaten gesperrt", (await page.textContent("#toast")).includes("Firmendaten unvollständig"));

// 2) Firmendaten (Testdaten) eintragen
const firma = { name: "Testfirma Kennzeichen", inhaber: "Erika Test", strasse: "Teststraße 1", plz: "53111", ort: "Bonn", telefax: "(0228) 000000",
  steuernr: "123/4567/8901", bank: "Testbank", iban: "DE89370400440532013000", bic: "COBADEFFXXX", kontoinhaber: "Erika Test", startNr: "0042.2026" };
for (const [k, v] of Object.entries(firma)) await page.fill("#fi-" + k, v);
await page.click("#firmaSave"); await settle();
check("Einrichtungshinweis weg", !(await page.isVisible("#setupBanner")));
await page.click(".tab[data-view=rechnung]");
await page.fill("#f-nr", "0042.2026");

// 3) Speichern + PDF
await page.click("#saveBtn"); await settle();
check("Rechnung gespeichert", (await page.textContent("#docStatus")) === "Gespeichert");
const [pdfDl] = await Promise.all([page.waitForEvent("download"), page.click("#pdfBtn")]);
const pdfPath = path.join(OUT, "rechnung.pdf"); await pdfDl.saveAs(pdfPath);
const pdf = fs.readFileSync(pdfPath);
check("PDF erzeugt", pdf.slice(0, 5).toString() === "%PDF-" && pdf.length > 10000, pdf.length);
check("PDF-Dateiname", pdfDl.suggestedFilename().startsWith("Rechnung_0042.2026"), pdfDl.suggestedFilename());
const epc = await page.evaluate(() => derive(inv, firma).giro);
check("GiroCode-Inhalt", epc === "BCD\n002\n1\nSCT\nCOBADEFFXXX\nErika Test\nDE89370400440532013000\nEUR157.10\n\n\nRechnung 0042.2026", JSON.stringify(epc));

// 4) Neu laden: Daten bleiben
await page.reload(); await settle();
check("Archiv nach Neuladen", (await page.evaluate(() => archiv.length)) === 1);
check("Firmendaten nach Neuladen", (await page.evaluate(() => firma.name)) === "Testfirma Kennzeichen");
await page.click("#newBtn");
check("Nächste Nummer 0043.2026", (await page.inputValue("#f-nr")) === "0043.2026", await page.inputValue("#f-nr"));
const idbKeys = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open("rechnungsgenerator"); r.onsuccess = () => { const t = r.result.transaction("kv").objectStore("kv").getAllKeys(); t.onsuccess = () => res(t.result); }; }));
check("Daten liegen in IndexedDB", idbKeys.includes("config/firma") && idbKeys.includes("rechnungen/0042.2026"), idbKeys.join(","));

// 5) Sicherung, alles löschen, wiederherstellen
await page.click(".tab[data-view=firma]");
const [bk] = await Promise.all([page.waitForEvent("download"), page.click("#backupBtn")]);
const bkPath = path.join(OUT, "sicherung.json"); await bk.saveAs(bkPath);
const bkData = JSON.parse(fs.readFileSync(bkPath, "utf8"));
check("Sicherung vollständig", bkData.app === "rechnungsgenerator" && bkData.rechnungen.length === 1 && bkData.firma.iban === firma.iban);
await page.click("#wipeBtn"); await page.click("#wipeBtn"); await settle();
check("Alles gelöscht", (await page.evaluate(() => archiv.length)) === 0 && (await page.isVisible("#setupBanner")));
await page.reload(); await settle();
check("Gelöscht bleibt gelöscht", (await page.evaluate(() => archiv.length + (firma.name ? 1 : 0))) === 0);
await page.setInputFiles("#importFile", bkPath); await settle();
check("Import-Abfrage", (await page.textContent("#importConfirm")).includes("1 Rechnungen"));
await page.click("#importDo"); await settle();
check("Import wiederhergestellt", (await page.evaluate(() => archiv.length)) === 1 && (await page.evaluate(() => firma.name)) === "Testfirma Kennzeichen");
const bad = path.join(OUT, "kaputt.json"); fs.writeFileSync(bad, '{"foo":1}');
await page.setInputFiles("#importFile", bad); await settle();
check("Fremde Datei abgelehnt", (await page.textContent("#toast")).includes("keine Sicherung"));

// 6) Rechenlogik
const stress = await page.evaluate(() => { let bad = 0; for (let i = 0; i < 5000; i++) { const pos = [{ name: "a", preis: Math.floor(Math.random() * 20000), menge: 1 + Math.floor(Math.random() * 3), ust: 19 }, { name: "b", preis: Math.floor(Math.random() * 9000), menge: 1, ust: 0 }]; const c = calc(pos); if (c.netto + c.u19 !== c.brutto || Math.abs(c.n19 - c.b19 / 1.19) > 0.5) bad++; } return bad; });
check("Rundung konsistent (5000 Fälle)", stress === 0, stress);
const ex = await page.evaluate(() => { const c = calc(paketPositions()); return [c.netto, c.u19, c.brutto]; });
check("Prüfbeispiel 138,44 / 18,66 / 157,10", ex.join() === "13844,1866,15710", ex.join());

// 7) Offline (Service Worker)
await page.goto(URL0); await page.waitForTimeout(1200);
await page.evaluate(() => navigator.serviceWorker.ready);
await ctx.setOffline(true);
await page.reload(); await settle();
check("Offline nutzbar", (await page.textContent("#totals")).includes("€"));
await ctx.setOffline(false);

check("Keine externen Anfragen", external.length === 0, external.join(" "));
check("Keine Konsolenfehler", errors.filter((e) => !/ERR_INTERNET_DISCONNECTED/.test(e)).length === 0, errors.join(" | "));
await ctx.close();

// 8) Handy
const m = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mp = await m.newPage(); await mp.goto(URL0); await mp.waitForTimeout(400);
const sw = await mp.evaluate(() => document.documentElement.scrollWidth);
check("Handy: kein seitliches Scrollen", sw <= 390, sw);
await mp.screenshot({ path: path.join(OUT, "handy.png"), fullPage: true });
await m.close();

await browser.close(); server.close();
console.log(fails.length ? `\n${fails.length} FEHLER: ${fails.join(", ")}` : "\nALLE TESTS OK");
process.exit(fails.length ? 1 : 0);
