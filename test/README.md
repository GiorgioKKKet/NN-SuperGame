# Test del gioco

Prove automatiche in Chrome senza finestra (headless). Servono Node 22 o più recente (per `WebSocket` integrato), Python 3 e Google Chrome. Se Chrome ha un altro nome o percorso, impostalo con `CHROME=/percorso/chrome`.

Tutti i comandi vanno lanciati dalla cartella principale del progetto.

## Strumenti

- `test/chk.sh [file.html]` controlla la sintassi del JavaScript del gioco. Senza argomenti prende l'ultima `gioco_vNN.html`.
- `node test/harness.mjs <gioco.html> <scenari.json>` apre il gioco, esegue gli scenari uno dopo l'altro e per ognuno stampa `ok`, `SLOW` (il tempo di gioco non è andato avanti) o `FAIL` (errori JavaScript), con lo stato della partita. Gli screenshot finiscono in `test/out/`, che git ignora.
- `node test/nettest.mjs <server.html> <gioco.html> <scenari.json>` apre host e client in due schede e li collega con una connessione finta. Serve a controllare che quello che succede sull'host arrivi al telefono senza errori.

Su un computer lento (o in risparmio energetico) il gioco gira piano: dai agli scenari almeno 2 secondi (`secs`). Il primo scenario di `nettest` riceve pochi messaggi perché il browser si sta ancora scaldando.

## Formato degli scenari

Ogni file è una lista di oggetti. I campi principali:

- `mode`, `map`, `n`, `pick` (indici dei personaggi), `teams`: avviano una partita come dal menu. Senza `mode` lo scenario continua la partita precedente.
- `secs`: quanti secondi lasciarla andare.
- `pre`: codice eseguito subito dopo l'avvio. `during`: codice eseguito ogni secondo. `post`: codice eseguito alla fine, il risultato viene stampato.
- `extra`: campi in più da aggiungere allo stato stampato (sintassi di un oggetto JavaScript, senza graffe).
- `fire: false`, `move: false`: per non far sparare o muovere i giocatori da soli.
- `shot`: nome dello screenshot da salvare.
- Solo per `nettest`: `hostExtra` (stato letto dall'host) e `cliDuring`.

## Scenari principali

| File | Cosa prova |
|---|---|
| `t13.json`, `t6b.json` | un giro di tutte le modalità |
| `t26.json` | tutte le mappe, con draw call e triangoli |
| `t8.json` | le 25 mosse speciali: errori, danni, nessun danno a chi le usa |
| `t30.json` | danni al secondo di ogni personaggio (base per la carica delle speciali) |
| `t12.json` | schermata iniziale, pagina comandi, menu col controller (pad simulato) |
| `t15.json`, `t17.json`, `t18c.json` | Difendi la birra: negozio, piazzamento, postazione, brindisi, allagamento, nemici nuovi |
| `t14b.json` | slot machine della sopravvivenza |
| `t19.json` | basket: tiri da 2 e da 3, passaggio, rubata, schiacciata, oggetti, fine partita |
| `t28.json`, `t29.json` | tempo fermo di Viki, attacchi degli alleati, basket senza danni nel tempo |
| `n1.json`, `n2b.json`, `n3.json`, `n4b.json` | rete: mappe ed eventi, speciali, negozio e slot, basket |

Gli altri file sono prove più piccole usate durante lo sviluppo di singole parti.
