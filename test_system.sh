#!/bin/bash
BASE="http://localhost:5000/api"
PASS="Password123!"  # fallback, overridden per user

declare -A USERS
USERS=(
  ["dylan@gmail.com"]="Dylan1234|reception"
  ["oliver@gmail.com"]="Oliver1234|doctor"
  ["eliud@gmail.com"]="Eliud1234|nurse"
  ["abby@gmail.com"]="Abby1234|lab_tech"
  ["juma@gmail.com"]="Juma1234|pharmacist"
)

# Get a real patient ID from DB
PATIENT_ID="0afc2755-572c-4dbc-bfb2-3c8ad01a4b21"  # Valary Atieno

echo "========================================="
echo "  EHR SYSTEM DIAGNOSTICS"
echo "========================================="

for email in "${!USERS[@]}"; do
  IFS="|" read -r password role <<< "${USERS[$email]}"
  echo ""
  echo "─────────────────────────────────────────"
  echo "🔑 Logging in as $role ($email)"
  
  LOGIN_RESP=$(curl -s -X POST "$BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$password\"}")
  
  SUCCESS=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success',False))" 2>/dev/null)
  TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['accessToken'])" 2>/dev/null)
  
  if [ "$SUCCESS" != "True" ] || [ -z "$TOKEN" ]; then
    echo "❌ Login failed: $LOGIN_RESP"
    continue
  fi
  echo "✅ Login successful, token acquired"

  # ── Role-specific tests ─────────────────
  case $role in
    reception)
      echo "  📋 Test: Create visit"
      VISIT_RESP=$(curl -s -X POST "$BASE/visits" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"patient_id\":\"$PATIENT_ID\",\"visit_type\":\"opd\",\"priority\":\"normal\"}")
      echo "     $VISIT_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print('     ✅' if d.get('success') else '     ❌ ' + d.get('message','Unknown error'))" 2>/dev/null
      
      echo "  📋 Test: Get visits"
      curl -s "$BASE/visits" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'     Total visits: {len(d.get(\"data\",[]))}')" 2>/dev/null
      ;;
    
    doctor)
      echo "  🩺 Test: Get open visits (queue)"
      curl -s "$BASE/visits" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); data=d.get('data',[]); open=[v for v in data if v.get('status')=='open']; print(f'     Open visits: {len(open)}')" 2>/dev/null
      ;;
    
    nurse)
      echo "  🩹 Test: ANC list"
      curl -s "$BASE/anc" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'     ANC records: {len(d.get(\"data\",[]))}')" 2>/dev/null
      echo "  🩹 Test: PNC queue"
      curl -s "$BASE/pnc/queue" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'     PNC queue: {len(d.get(\"data\",[]))}')" 2>/dev/null
      ;;
    
    lab_tech)
      echo "  🔬 Test: Lab requests"
      curl -s "$BASE/lab/requests" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); data=d.get('data',d); print(f'     Lab requests: {len(data) if isinstance(data,list) else \"N/A\"}')" 2>/dev/null
      ;;
    
    pharmacist)
      echo "  💊 Test: Prescriptions queue"
      curl -s "$BASE/prescriptions" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); data=d.get('data',d); print(f'     Prescriptions: {len(data) if isinstance(data,list) else \"N/A\"}')" 2>/dev/null
      ;;
  esac

  # ── Common tests ──────────────────────
  echo "  🌐 Test: Dashboard"
  curl -s "$BASE/dashboard/visits" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print('     ✅ Dashboard OK' if d.get('success') else '     ❌ ' + d.get('message',''))" 2>/dev/null
  
  echo "  🌐 Test: Billing dashboard"
  curl -s "$BASE/billing/dashboard" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print('     ✅ Billing OK' if d.get('success') else '     ❌ ' + d.get('message',''))" 2>/dev/null
done

echo ""
echo "========================================="
echo "  DIAGNOSTICS COMPLETE"
echo "========================================="
