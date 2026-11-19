#!/bin/bash
# Controllo di sintassi del JavaScript del gioco. Senza argomenti prende l'ultima versione gioco_vNN.html.
cd "$(dirname "$0")/.." || exit 1
F=${1:-$(ls gioco_v*.html | sort -V | tail -1)}
T=$(mktemp --suffix=.js)
python3 -c "import sys;s=open(sys.argv[1],encoding='utf-8').read();i=s.index('<script>\n')+9;j=s.rindex('</script>');open(sys.argv[2],'w').write(s[i:j])" "$F" "$T" && node --check "$T" && echo "SYNTAX-OK ($F)"; r=$?; rm -f "$T"; exit $r
