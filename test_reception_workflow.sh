#!/bin/bash
BASE="http://localhost:5000/api"

echo "========================================="
echo "  RECEPTION → TRIAGE WORKFLOW TEST"
echo "========================================="

# 1. Login as receptionist (Dylan)
echo ""
echo "🔑 Logging in as receptionist..."
LOGIN=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"dylan@gmail.com","password":"Dylan1234"}')
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['accessToken'])" 2>/dev/null)
if [ -z "$TOKEN" ]; then echo "❌ Login failed"; exit 1; fi
echo "✅ Token acquired"

# 2. Create a new visit (should default to OPD)
echo ""
echo "📋 Creating new visit for Valary Atieno..."
VISIT_RESP=$(curl -s -X POST "$BASE/visits" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"patient_id":"0afc2755-572c-4dbc-bfb2-3c8ad01a4b21","visit_type":"opd","priority":"normal"}')
echo "$VISIT_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ Visit created: ' + d['data']['visit_number'] if d.get('success') else '❌ ' + d.get('message','Error'))" 2>/dev/null
VISIT_ID=$(echo "$VISIT_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['id'])" 2>/dev/null)

if [ -z "$VISIT_ID" ]; then
  echo "❌ Could not create visit. Check server logs."
  exit 1
fi

# 3. Try to send to OPD (should be blocked)
echo ""
echo "🛑 Trying to send directly to OPD (should fail)..."
OPD_RESP=$(curl -s -X PUT "$BASE/visits/$VISIT_ID/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"opd"}')
echo "$OPD_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print('   Expected 403 → ' + d.get('message','No message'))" 2>/dev/null

# 4. Try to send to MCH (should be blocked)
echo ""
echo "🛑 Trying to send directly to MCH (should fail)..."
MCH_RESP=$(curl -s -X PUT "$BASE/visits/$VISIT_ID/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"mch"}')
echo "$MCH_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print('   Expected 403 → ' + d.get('message','No message'))" 2>/dev/null

# 5. Send to triage (should work)
echo ""
echo "🏥 Sending to triage (should succeed)..."
TRIAGE_RESP=$(curl -s -X PUT "$BASE/visits/$VISIT_ID/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"triaged"}')
echo "$TRIAGE_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print('   ✅ ' + d.get('message','') if d.get('success') else '   ❌ ' + d.get('message',''))" 2>/dev/null

# 6. Login as nurse (Eliud) and forward to OPD
echo ""
echo "🔑 Logging in as triage nurse (Eliud)..."
NURSE_LOGIN=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"eliud@gmail.com","password":"Eliud1234"}')
NURSE_TOKEN=$(echo "$NURSE_LOGIN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['accessToken'])" 2>/dev/null)
echo "✅ Nurse token acquired"

echo ""
echo "👩‍⚕️ Nurse forwarding to OPD (should work)..."
NURSE_OPD=$(curl -s -X PUT "$BASE/visits/$VISIT_ID/status" \
  -H "Authorization: Bearer $NURSE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"with_doctor","department":"opd"}')
echo "$NURSE_OPD" | python3 -c "import sys,json; d=json.load(sys.stdin); print('   ✅ Visit now with doctor' if d.get('success') else '   ❌ ' + d.get('message',''))" 2>/dev/null

echo ""
echo "========================================="
echo "  TEST COMPLETE"
echo "========================================="
