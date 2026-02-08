#!/bin/bash
# Chiama l'endpoint keepass-lookup (per eseguirlo sulla VPS in bash).
# Uso: ./keepass-lookup.sh -b "https://ticket.logikaservice.it" -e "tua@email.it" -p "tuaPassword" -m "44:8A:5B:4B:68:8D"
# Sulla VPS (localhost): ./keepass-lookup.sh -b "http://localhost:3001" -e "..." -p "..." -m "44:8A:5B:4B:68:8D"

BASE_URL="${BASE_URL:-http://localhost:3001}"
EMAIL=""
PASSWORD=""
MAC=""

while getopts "b:e:p:m:" opt; do
  case $opt in
    b) BASE_URL="$OPTARG" ;;
    e) EMAIL="$OPTARG" ;;
    p) PASSWORD="$OPTARG" ;;
    m) MAC="$OPTARG" ;;
    *) echo "Uso: $0 -b BASE_URL -e EMAIL -p PASSWORD -m MAC"; exit 1 ;;
  esac
done

if [ -z "$MAC" ]; then
  echo "Specifica il MAC con -m (es. -m 44:8A:5B:4B:68:8D)"
  exit 1
fi
if [ -z "$EMAIL" ]; then
  read -p "Email (tecnico/admin): " EMAIL
fi
if [ -z "$PASSWORD" ]; then
  read -s -p "Password: " PASSWORD
  echo
fi

echo "Login su $BASE_URL ..."
LOGIN_RESP=$(curl -s -X POST "$BASE_URL/api/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo "$LOGIN_RESP" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
if [ -z "$TOKEN" ]; then
  echo "Errore: login fallito o risposta senza token."
  echo "$LOGIN_RESP" | head -c 500
  exit 1
fi

echo "Lookup KeePass per MAC: $MAC"
RESULT=$(curl -s -G -H "Authorization: Bearer $TOKEN" --data-urlencode "mac=$MAC" "$BASE_URL/api/network-monitoring/debug/keepass-lookup")
echo "$RESULT" | python3 -m json.tool 2>/dev/null || echo "$RESULT"
