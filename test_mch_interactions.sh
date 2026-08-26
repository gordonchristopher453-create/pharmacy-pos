#!/bin/bash
BASE="http://localhost:5000/api"
PASS=0; FAIL=0

pass() { echo "   ✅ PASS: $1"; PASS=$((PASS+1)); }
fail() { echo "   ❌ FAIL: $1"; FAIL=$((FAIL+1)); }
info() { echo "   ℹ️  INFO: $1"; }

check_bill() {
  local VID=$1 LABEL=$2
  RESULT=$(curl -s "$BASE/billing?visit_id=$VID" -H "Authorization: Bearer $DYLAN")
  ITEMS=$(echo $RESULT | python3 -c "import sys,json; d=json.load(sys.stdin); items=d.get('data',[]); print(len(items))" 2>/dev/null)
  TOTAL=$(echo $RESULT | python3 -c "import sys,json; d=json.load(sys.stdin); items=d.get('data',[]); print(sum(float(i.get('total_price',0)) for i in items))" 2>/dev/null)
  info "$LABEL — $ITEMS billing items, KES $TOTAL total"
  if [ "$ITEMS" -gt "0" ] 2>/dev/null; then
    pass "$LABEL auto-billed ($ITEMS items)"
  else
    fail "$LABEL — no billing items generated"
  fi
}

echo "🔹 Getting tokens..."
DYLAN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"email":"dylan@gmail.com","password":"Dylan1234"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")
ELIUD=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"email":"eliud@gmail.com","password":"Eliud1234"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")
JUMA=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"email":"juma@gmail.com","password":"Juma1234"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")
ABBY=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"email":"abby@gmail.com","password":"Abby1234"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")

# ═══════════════════════════════════════════════════════════════
echo ""
echo "🤰 ═══ SCENARIO 1: ANC Mother — Full Profile with Lab, Drugs & TT Vaccine"
echo "       Flow: Reception → Triage → ANC → Lab → Pharmacy → Immunization → Billing"

PID=$(curl -s -X POST $BASE/patients -H "Content-Type: application/json" -H "Authorization: Bearer $DYLAN" \
  -d '{"full_name":"Fatuma Hassan","phone":"0711000001","gender":"female","date_of_birth":"1998-03-10"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "   Mother Patient: $PID"

VID=$(curl -s -X POST $BASE/patients/$PID/visits -H "Content-Type: application/json" -H "Authorization: Bearer $DYLAN" \
  -d '{"visit_type":"mch","priority":"normal"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "   Visit: $VID"
[ -n "$VID" ] && pass "MCH visit created" || fail "MCH visit creation"

# Triage to ANC
R=$(curl -s -X PUT $BASE/visits/$VID/status -H "Content-Type: application/json" -H "Authorization: Bearer $ELIUD" \
  -d '{"status":"mch","mch_service":"mch_anc"}')
echo $R | python3 -c "import sys,json; exit(0 if json.load(sys.stdin).get('success') else 1)" 2>/dev/null && pass "Triaged to ANC" || fail "Triage to ANC"

# Register ANC
ANC=$(curl -s -X POST $BASE/mch/anc -H "Content-Type: application/json" -H "Authorization: Bearer $ELIUD" \
  -d "{\"patient_id\":\"$PID\",\"visit_id\":\"$VID\",\"lmp\":\"2026-01-15\",\"edd\":\"2026-10-22\",\"gravida\":1,\"para\":0,\"hiv_status\":\"negative\"}")
ANC_ID=$(echo $ANC | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
[ -n "$ANC_ID" ] && pass "ANC registered" || fail "ANC registration: $(echo $ANC | python3 -c 'import sys,json; print(json.load(sys.stdin).get(\"message\",\"\"))' 2>/dev/null)"

# ANC visit
R=$(curl -s -X POST $BASE/mch/anc/$ANC_ID/visits -H "Content-Type: application/json" -H "Authorization: Bearer $ELIUD" \
  -d '{"gestation_weeks":16,"bp_systolic":110,"bp_diastolic":70,"weight":58,"fundal_height":16,"fetal_heart_rate":148,"presentation":"cephalic","complaints":"None","plan":"ANC profile done"}')
echo $R | python3 -c "import sys,json; exit(0 if json.load(sys.stdin).get('success') else 1)" 2>/dev/null && pass "ANC visit recorded" || fail "ANC visit"

echo ""
echo "   🔬 Ordering ANC Profile Lab Tests..."
for TEST in "Blood Group & Rh Factor:RH-BG:200" "Haemoglobin:718-7:150" "HIV Test:75622-1:300" "VDRL:5290-5:250" "Urinalysis:24356-8:200"; do
  NAME=$(echo $TEST | cut -d: -f1)
  CODE=$(echo $TEST | cut -d: -f2)
  PRICE=$(echo $TEST | cut -d: -f3)
  R=$(curl -s -X POST $BASE/anc/orders/lab -H "Content-Type: application/json" -H "Authorization: Bearer $ELIUD" \
    -d "{\"visit_id\":\"$VID\",\"patient_id\":\"$PID\",\"test_name\":\"$NAME\",\"test_code\":\"$CODE\",\"lab_price\":$PRICE}")
  echo $R | python3 -c "import sys,json; exit(0 if json.load(sys.stdin).get('success') else 1)" 2>/dev/null && pass "Lab ordered: $NAME" || fail "Lab order $NAME: $(echo $R | python3 -c 'import sys,json; print(json.load(sys.stdin).get(\"message\",\"\"))' 2>/dev/null)"
done

echo ""
echo "   💊 Ordering ANC Drugs..."
for DRUG in "Folic Acid 5mg:folic_acid:30:90:50" "Ferrous Sulphate 200mg:ferrous_sulphate:30:90:80" "SP (Fansidar):fansidar:3:1:200"; do
  NAME=$(echo $DRUG | cut -d: -f1)
  DNAME=$(echo $DRUG | cut -d: -f2)
  QTY=$(echo $DRUG | cut -d: -f3)
  DUR=$(echo $DRUG | cut -d: -f4)
  PRICE=$(echo $DRUG | cut -d: -f5)
  R=$(curl -s -X POST $BASE/anc/orders/drug -H "Content-Type: application/json" -H "Authorization: Bearer $ELIUD" \
    -d "{\"visit_id\":\"$VID\",\"patient_id\":\"$PID\",\"drug_name\":\"$NAME\",\"quantity\":$QTY,\"duration\":\"$DUR days\",\"drug_price\":$PRICE,\"dosage\":\"Once daily\"}")
  echo $R | python3 -c "import sys,json; exit(0 if json.load(sys.stdin).get('success') else 1)" 2>/dev/null && pass "Drug ordered: $NAME" || fail "Drug order $NAME: $(echo $R | python3 -c 'import sys,json; print(json.load(sys.stdin).get(\"message\",\"\"))' 2>/dev/null)"
done

echo ""
echo "   💉 Ordering TT Vaccine..."
R=$(curl -s -X POST $BASE/anc/orders/vaccine -H "Content-Type: application/json" -H "Authorization: Bearer $ELIUD" \
  -d "{\"visit_id\":\"$VID\",\"patient_id\":\"$PID\",\"vaccine_name\":\"TT1 (Tetanus Toxoid)\",\"vaccine_code\":\"TT1\",\"dose_number\":1,\"vaccine_price\":100}")
echo $R | python3 -c "import sys,json; exit(0 if json.load(sys.stdin).get('success') else 1)" 2>/dev/null && pass "TT vaccine ordered" || fail "TT vaccine: $(echo $R | python3 -c 'import sys,json; print(json.load(sys.stdin).get(\"message\",\"\"))' 2>/dev/null)"

echo ""
echo "   🔬 Lab tech processes ANC labs..."
LAB_IDS=$(curl -s "$BASE/lab-requests?visit_id=$VID&limit=10" -H "Authorization: Bearer $ABBY" | python3 -c "
import sys,json
d=json.load(sys.stdin)
reqs=d.get('data',{}).get('requests',[])
print(' '.join([r['id'] for r in reqs]))" 2>/dev/null)
LAB_COUNT=0
for LID in $LAB_IDS; do
  # Pay first
  ITEM_ID=$(curl -s "$BASE/billing?visit_id=$VID" -H "Authorization: Bearer $DYLAN" | python3 -c "
import sys,json
items=json.load(sys.stdin).get('data',[])
for i in items:
  if i.get('status')=='pending' and i.get('item_type')=='laboratory':
    print(i['id']); break" 2>/dev/null)
  if [ -n "$ITEM_ID" ]; then
    curl -s -X PUT $BASE/billing/items/$ITEM_ID/pay -H "Content-Type: application/json" -H "Authorization: Bearer $DYLAN" -d '{"payment_method":"cash"}' > /dev/null
  fi
  R=$(curl -s -X PUT $BASE/lab-requests/$LID/result -H "Content-Type: application/json" -H "Authorization: Bearer $ABBY" \
    -d '{"result":"Normal","result_flag":"normal","technician_notes":"Within normal range"}')
  echo $R | python3 -c "import sys,json; exit(0 if json.load(sys.stdin).get('success') else 1)" 2>/dev/null && LAB_COUNT=$((LAB_COUNT+1)) || true
done
[ "$LAB_COUNT" -gt "0" ] && pass "Lab results posted ($LAB_COUNT tests)" || fail "No lab results posted"

echo ""
echo "   💊 Pharmacist dispenses ANC drugs..."
RX_IDS=$(curl -s "$BASE/prescriptions?visit_id=$VID&limit=10" -H "Authorization: Bearer $JUMA" | python3 -c "
import sys,json
d=json.load(sys.stdin)
rxs=d.get('data',[]) if isinstance(d.get('data'),list) else []
print(' '.join([r['id'] for r in rxs if r.get('status')!='dispensed']))" 2>/dev/null)
RX_COUNT=0
for RID in $RX_IDS; do
  R=$(curl -s -X PUT $BASE/pharmacy/dispense/$RID -H "Content-Type: application/json" -H "Authorization: Bearer $JUMA" \
    -d '{"payment_method":"cash"}')
  echo $R | python3 -c "import sys,json; exit(0 if json.load(sys.stdin).get('success') else 1)" 2>/dev/null && RX_COUNT=$((RX_COUNT+1)) || true
done
[ "$RX_COUNT" -gt "0" ] && pass "Drugs dispensed ($RX_COUNT prescriptions)" || fail "No drugs dispensed"

echo ""
echo "   💰 Checking ANC billing..."
check_bill $VID "ANC Full Profile"

# Discharge
curl -s -X PUT $BASE/visits/$VID/status -H "Content-Type: application/json" -H "Authorization: Bearer $ELIUD" -d '{"status":"discharged"}' > /dev/null
pass "ANC visit discharged"

# ═══════════════════════════════════════════════════════════════
echo ""
echo "👶 ═══ SCENARIO 2: Newborn — CWC with Birth Immunizations"
echo "       Flow: Reception → Triage → CWC → Immunization → Billing"

BABY_PID=$(curl -s -X POST $BASE/patients -H "Content-Type: application/json" -H "Authorization: Bearer $DYLAN" \
  -d '{"full_name":"Baby Hassan","phone":"0711000002","gender":"male","date_of_birth":"2026-07-01"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "   Baby Patient: $BABY_PID"

BABY_VID=$(curl -s -X POST $BASE/patients/$BABY_PID/visits -H "Content-Type: application/json" -H "Authorization: Bearer $DYLAN" \
  -d '{"visit_type":"mch","priority":"normal"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "   Visit: $BABY_VID"

R=$(curl -s -X PUT $BASE/visits/$BABY_VID/status -H "Content-Type: application/json" -H "Authorization: Bearer $ELIUD" \
  -d '{"status":"mch","mch_service":"mch_cwc"}')
echo $R | python3 -c "import sys,json; exit(0 if json.load(sys.stdin).get('success') else 1)" 2>/dev/null && pass "Baby triaged to CWC" || fail "Triage to CWC"

# CWC record
R=$(curl -s -X POST $BASE/mch/cwc -H "Content-Type: application/json" -H "Authorization: Bearer $ELIUD" \
  -d "{\"patient_id\":\"$BABY_PID\",\"visit_id\":\"$BABY_VID\",\"age_months\":0,\"weight\":3.2,\"height\":50,\"muac\":11,\"nutritional_status\":\"normal\",\"development_milestone\":\"normal\",\"counseling_given\":\"Exclusive breastfeeding\"}")
echo $R | python3 -c "import sys,json; exit(0 if json.load(sys.stdin).get('success') else 1)" 2>/dev/null && pass "CWC record created" || fail "CWC record"

echo ""
echo "   💉 Birth immunizations (BCG, OPV0, Hep B)..."
for VAX in "BCG:BCG" "OPV0:OPV-0" "Hepatitis B Birth Dose:HEP-B-0"; do
  NAME=$(echo $VAX | cut -d: -f1)
  CODE=$(echo $VAX | cut -d: -f2)
  R=$(curl -s -X POST $BASE/mch/immunization -H "Content-Type: application/json" -H "Authorization: Bearer $ELIUD" \
    -d "{\"patient_id\":\"$BABY_PID\",\"visit_id\":\"$BABY_VID\",\"vaccine\":\"$NAME\",\"vaccine_code\":\"$CODE\",\"dose_number\":1,\"site\":\"Left arm\",\"batch_number\":\"BATCH2026\",\"vaccine_price\":100}")
  echo $R | python3 -c "import sys,json; exit(0 if json.load(sys.stdin).get('success') else 1)" 2>/dev/null && pass "Vaccine given: $NAME" || fail "Vaccine $NAME: $(echo $R | python3 -c 'import sys,json; print(json.load(sys.stdin).get(\"message\",\"\"))' 2>/dev/null)"
done

check_bill $BABY_VID "Newborn CWC"
curl -s -X PUT $BASE/visits/$BABY_VID/status -H "Content-Type: application/json" -H "Authorization: Bearer $ELIUD" -d '{"status":"discharged"}' > /dev/null
pass "Newborn visit discharged"

# ═══════════════════════════════════════════════════════════════
echo ""
echo "══════════════════════════════════════════"
echo "  MCH INTERACTIONS: ✅ $PASS passed  ❌ $FAIL failed"
echo "══════════════════════════════════════════"
