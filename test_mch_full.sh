#!/bin/bash
BASE="http://localhost:5000/api"
PASS=0; FAIL=0

pass() { echo "   ✅ PASS: $1"; PASS=$((PASS+1)); }
fail() { echo "   ❌ FAIL: $1"; FAIL=$((FAIL+1)); }
info() { echo "   ℹ️  INFO: $1"; }

echo "🔹 Getting tokens..."
DYLAN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"email":"dylan@gmail.com","password":"Dylan1234"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")
ELIUD=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"email":"eliud@gmail.com","password":"Eliud1234"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")

check_bill() {
  local VID=$1 LABEL=$2
  ITEMS=$(curl -s "$BASE/billing?visit_id=$VID" -H "Authorization: Bearer $DYLAN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))" 2>/dev/null)
  info "$LABEL billing items: $ITEMS"
}

register_patient() {
  local NAME=$1 PHONE=$2
  curl -s -X POST $BASE/patients -H "Content-Type: application/json" -H "Authorization: Bearer $DYLAN" \
    -d "{\"full_name\":\"$NAME\",\"phone\":\"$PHONE\",\"gender\":\"female\",\"date_of_birth\":\"1995-01-01\"}" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])"
}

create_mch_visit() {
  local PID=$1 SERVICE=$2
  curl -s -X POST $BASE/patients/$PID/visits -H "Content-Type: application/json" -H "Authorization: Bearer $DYLAN" \
    -d '{"visit_type":"mch","priority":"normal"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])"
}

triage_to() {
  local VID=$1 SERVICE=$2
  R=$(curl -s -X PUT $BASE/visits/$VID/status -H "Content-Type: application/json" -H "Authorization: Bearer $ELIUD" \
    -d "{\"status\":\"mch\",\"mch_service\":\"$SERVICE\"}")
  echo $R | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('success') else 1)" 2>/dev/null && pass "Triaged to $SERVICE" || fail "Triage to $SERVICE: $(echo $R | python3 -c 'import sys,json; print(json.load(sys.stdin).get(\"message\",\"\"))')"
}

discharge() {
  local VID=$1
  R=$(curl -s -X PUT $BASE/visits/$VID/status -H "Content-Type: application/json" -H "Authorization: Bearer $ELIUD" -d '{"status":"discharged"}')
  echo $R | python3 -c "import sys,json; exit(0 if json.load(sys.stdin).get('success') else 1)" 2>/dev/null && pass "Discharged" || fail "Discharge failed"
}

# ═══════════════════════════════════════════════════════
echo ""
echo "🤰 ═══ TEST 1: ANC (Antenatal Care)"
PID=$(register_patient "Grace Akinyi ANC" "0700001001")
VID=$(create_mch_visit $PID mch_anc)
echo "   Patient: $PID | Visit: $VID"
triage_to $VID mch_anc
ANC=$(curl -s -X POST $BASE/mch/anc -H "Content-Type: application/json" -H "Authorization: Bearer $ELIUD" \
  -d "{\"patient_id\":\"$PID\",\"visit_id\":\"$VID\",\"lmp\":\"2026-01-01\",\"edd\":\"2026-10-08\",\"gravida\":2,\"para\":1}")
ANC_ID=$(echo $ANC | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
[ -n "$ANC_ID" ] && pass "ANC registered" || fail "ANC register: $(echo $ANC | python3 -c 'import sys,json; print(json.load(sys.stdin).get(\"message\",\"\"))')"
R=$(curl -s -X POST $BASE/mch/anc/$ANC_ID/visits -H "Content-Type: application/json" -H "Authorization: Bearer $ELIUD" \
  -d '{"gestation_weeks":28,"bp_systolic":118,"bp_diastolic":76,"weight":67,"fundal_height":28,"fetal_heart_rate":144,"presentation":"cephalic","complaints":"None","plan":"Routine ANC"}')
echo $R | python3 -c "import sys,json; exit(0 if json.load(sys.stdin).get('success') else 1)" 2>/dev/null && pass "ANC visit recorded" || fail "ANC visit: $(echo $R | python3 -c 'import sys,json; print(json.load(sys.stdin).get(\"message\",\"\"))')"
check_bill $VID "ANC"
discharge $VID

# ═══════════════════════════════════════════════════════
echo ""
echo "🤱 ═══ TEST 2: PNC (Postnatal Care)"
PID=$(register_patient "Mary Wanjiku PNC" "0700001002")
VID=$(create_mch_visit $PID mch_pnc)
echo "   Patient: $PID | Visit: $VID"
triage_to $VID mch_pnc
R=$(curl -s -X POST $BASE/mch/pnc -H "Content-Type: application/json" -H "Authorization: Bearer $ELIUD" \
  -d "{\"patient_id\":\"$PID\",\"visit_id\":\"$VID\",\"delivery_date\":\"2026-06-28\",\"delivery_mode\":\"SVD\",\"birth_weight\":3.2,\"apgar_score\":9,\"breastfeeding\":true,\"maternal_condition\":\"good\",\"infant_condition\":\"good\"}")
echo $R | python3 -c "import sys,json; exit(0 if json.load(sys.stdin).get('success') else 1)" 2>/dev/null && pass "PNC visit recorded" || fail "PNC: $(echo $R | python3 -c 'import sys,json; print(json.load(sys.stdin).get(\"message\",\"\"))')"
check_bill $VID "PNC"
discharge $VID

# ═══════════════════════════════════════════════════════
echo ""
echo "👶 ═══ TEST 3: CWC (Child Welfare Clinic)"
PID=$(register_patient "Baby Otieno CWC" "0700001003")
VID=$(create_mch_visit $PID mch_cwc)
echo "   Patient: $PID | Visit: $VID"
triage_to $VID mch_cwc
R=$(curl -s -X POST $BASE/mch/cwc -H "Content-Type: application/json" -H "Authorization: Bearer $ELIUD" \
  -d "{\"patient_id\":\"$PID\",\"visit_id\":\"$VID\",\"age_months\":6,\"weight\":7.2,\"height\":65,\"muac\":14,\"nutritional_status\":\"normal\",\"development_milestone\":\"normal\",\"counseling_given\":\"Breastfeeding\"}")
echo $R | python3 -c "import sys,json; exit(0 if json.load(sys.stdin).get('success') else 1)" 2>/dev/null && pass "CWC visit recorded" || fail "CWC: $(echo $R | python3 -c 'import sys,json; print(json.load(sys.stdin).get(\"message\",\"\"))')"
check_bill $VID "CWC"
discharge $VID

# ═══════════════════════════════════════════════════════
echo ""
echo "💉 ═══ TEST 4: Immunization"
PID=$(register_patient "Baby Kamau Imm" "0700001004")
VID=$(create_mch_visit $PID mch_immunization)
echo "   Patient: $PID | Visit: $VID"
triage_to $VID mch_immunization
R=$(curl -s -X POST $BASE/mch/immunization -H "Content-Type: application/json" -H "Authorization: Bearer $ELIUD" \
  -d "{\"patient_id\":\"$PID\",\"visit_id\":\"$VID\",\"vaccine\":\"BCG\",\"dose_number\":1,\"site\":\"Left arm\",\"batch_number\":\"BCG2026\",\"next_due_date\":\"2026-10-05\"}")
echo $R | python3 -c "import sys,json; exit(0 if json.load(sys.stdin).get('success') else 1)" 2>/dev/null && pass "Immunization recorded" || fail "Immunization: $(echo $R | python3 -c 'import sys,json; print(json.load(sys.stdin).get(\"message\",\"\"))')"
check_bill $VID "Immunization"
discharge $VID

# ═══════════════════════════════════════════════════════
echo ""
echo "👥 ═══ TEST 5: Family Planning"
PID=$(register_patient "Jane Muthoni FP" "0700001005")
VID=$(create_mch_visit $PID mch_fp)
echo "   Patient: $PID | Visit: $VID"
triage_to $VID mch_fp
R=$(curl -s -X POST $BASE/mch/family-planning -H "Content-Type: application/json" -H "Authorization: Bearer $ELIUD" \
  -d "{\"patient_id\":\"$PID\",\"visit_id\":\"$VID\",\"method\":\"Injectable\",\"brand\":\"Depo-Provera\",\"date_given\":\"2026-07-05\",\"next_appointment\":\"2026-10-05\",\"counseling_done\":true}")
echo $R | python3 -c "import sys,json; exit(0 if json.load(sys.stdin).get('success') else 1)" 2>/dev/null && pass "Family Planning recorded" || fail "FP: $(echo $R | python3 -c 'import sys,json; print(json.load(sys.stdin).get(\"message\",\"\"))')"
check_bill $VID "FP"
discharge $VID

echo ""
echo "══════════════════════════════════════════"
echo "  MCH FULL TEST RESULTS: ✅ $PASS passed  ❌ $FAIL failed"
echo "══════════════════════════════════════════"
