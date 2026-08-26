#!/bin/bash
BASE="http://localhost:5000/api"
PASS=0; FAIL=0

echo "🔹 Getting tokens..."
DYLAN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"email":"dylan@gmail.com","password":"Dylan1234"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")
ELIUD=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"email":"eliud@gmail.com","password":"Eliud1234"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")
FRANK=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"email":"franktofik96@gmail.com","password":"Frank1234"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")

echo ""
echo "🔹 ═══ STEP 1: Receptionist registers female patient & MCH visit"
PID=$(curl -s -X POST $BASE/patients -H "Content-Type: application/json" -H "Authorization: Bearer $DYLAN" \
  -d '{"full_name":"Grace Akinyi","phone":"0712345678","gender":"female","date_of_birth":"1995-06-15"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "   Patient: $PID"

VID=$(curl -s -X POST $BASE/patients/$PID/visits -H "Content-Type: application/json" -H "Authorization: Bearer $DYLAN" \
  -d '{"visit_type":"mch","priority":"normal"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['id'] if d.get('data') else 'none')")
echo "   Visit: $VID"
if [ "$VID" != "none" ] && [ -n "$VID" ]; then echo "   ✅ PASS: MCH visit created"; PASS=$((PASS+1))
else echo "   ❌ FAIL: MCH visit not created"; FAIL=$((FAIL+1)); fi

echo ""
echo "🔹 ═══ STEP 2: Triage nurse takes vitals & assigns ANC"
VITALS=$(curl -s -X POST $BASE/patients/visits/$VID/vitals -H "Content-Type: application/json" -H "Authorization: Bearer $ELIUD" \
  -d '{"weight":65,"blood_pressure_systolic":118,"blood_pressure_diastolic":76,"pulse_rate":80,"temperature":36.8,"oxygen_saturation":98}')
if echo $VITALS | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('success') else 1)" 2>/dev/null; then
  echo "   ✅ PASS: Vitals recorded"; PASS=$((PASS+1))
else echo "   ❌ FAIL: Vitals failed"; FAIL=$((FAIL+1)); fi

TRIAGE=$(curl -s -X PUT $BASE/visits/$VID/status -H "Content-Type: application/json" -H "Authorization: Bearer $ELIUD" \
  -d '{"status":"mch","mch_service":"mch_anc"}')
if echo $TRIAGE | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('success') else 1)" 2>/dev/null; then
  echo "   ✅ PASS: Sent to ANC clinic"; PASS=$((PASS+1))
else echo "   ❌ FAIL: $(echo $TRIAGE | python3 -c 'import sys,json; print(json.load(sys.stdin).get(\"message\",\"unknown\"))')"; FAIL=$((FAIL+1)); fi

echo ""
echo "🔹 ═══ STEP 3: Register ANC record"
ANC=$(curl -s -X POST $BASE/mch/anc -H "Content-Type: application/json" -H "Authorization: Bearer $FRANK" \
  -d "{\"patient_id\":\"$PID\",\"visit_id\":\"$VID\",\"lmp\":\"2026-01-01\",\"edd\":\"2026-10-08\",\"gravida\":1,\"para\":0}")
ANC_ID=$(echo $ANC | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['id'] if d.get('data') else 'none')" 2>/dev/null)
if [ "$ANC_ID" != "none" ] && [ -n "$ANC_ID" ]; then
  echo "   ✅ PASS: ANC registered (ID: ${ANC_ID:0:8}...)"; PASS=$((PASS+1))
else echo "   ❌ FAIL: $(echo $ANC | python3 -c 'import sys,json; print(json.load(sys.stdin).get(\"message\",\"unknown\"))')"; FAIL=$((FAIL+1)); fi

echo ""
echo "🔹 ═══ STEP 4: Add ANC visit entry"
ANCV=$(curl -s -X POST $BASE/mch/anc/$ANC_ID/visits -H "Content-Type: application/json" -H "Authorization: Bearer $FRANK" \
  -d '{"gestation_weeks":24,"bp_systolic":118,"bp_diastolic":76,"weight":65,"fundal_height":24,"fetal_heart_rate":142,"presentation":"cephalic","complaints":"None","examination":"Normal","plan":"Continue routine ANC"}')
if echo $ANCV | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('success') else 1)" 2>/dev/null; then
  echo "   ✅ PASS: ANC visit recorded"; PASS=$((PASS+1))
else echo "   ❌ FAIL: $(echo $ANCV | python3 -c 'import sys,json; print(json.load(sys.stdin).get(\"message\",\"unknown\"))')"; FAIL=$((FAIL+1)); fi

echo ""
echo "🔹 ═══ STEP 5: Check billing for MCH visit"
BILL=$(curl -s "$BASE/billing?visit_id=$VID" -H "Authorization: Bearer $DYLAN")
ITEMS=$(echo $BILL | python3 -c "import sys,json; d=json.load(sys.stdin); items=d.get('data',[]); print(len(items))" 2>/dev/null)
echo "   Billing items: $ITEMS"
echo "   ✅ INFO: MCH billing check complete"

echo ""
echo "🔹 ═══ STEP 6: Discharge patient"
DISC=$(curl -s -X PUT $BASE/visits/$VID/status -H "Content-Type: application/json" -H "Authorization: Bearer $FRANK" \
  -d '{"status":"discharged"}')
if echo $DISC | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('success') else 1)" 2>/dev/null; then
  echo "   ✅ PASS: Visit discharged"; PASS=$((PASS+1))
else echo "   ❌ FAIL: $(echo $DISC | python3 -c 'import sys,json; print(json.load(sys.stdin).get(\"message\",\"unknown\"))')"; FAIL=$((FAIL+1)); fi

echo ""
echo "══════════════════════════════════════════"
echo "  RESULTS: ✅ $PASS passed  ❌ $FAIL failed"
echo "══════════════════════════════════════════"
