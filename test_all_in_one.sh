#!/bin/bash
# ═══════════════════════════════════════════════════
#  COMPLETE EHR SYSTEM INTEGRATION TEST
#  Runs the full patient journey with all modules.
# ═══════════════════════════════════════════════════

set -o pipefail
BASE="http://localhost:5000/api"
PASS=0
FAIL=0

# --------------- helpers ---------------
log() { echo -e "\n🔹 $1"; }
pass() { echo "   ✅ PASS: $1"; ((PASS++)); }
fail() { echo "   ❌ FAIL: $1 — $2"; ((FAIL++)); }

# login and set TOKEN, ROLE, USER_ID
login() {
  local email=$1 password=$2
  local resp=$(curl -s -X POST "$BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$password\"}" 2>/dev/null)
  local ok=$(echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success',False))" 2>/dev/null)
  if [ "$ok" != "True" ]; then
    fail "Login $email" "$resp"
    return 1
  fi
  TOKEN=$(echo "$resp" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)
  ROLE=$(echo "$resp" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['user']['role'])" 2>/dev/null)
  USER_ID=$(echo "$resp" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['user']['id'])" 2>/dev/null)
  pass "Login $ROLE ($email)"
  return 0
}

# ─────────────────────────────────────────────────
log "═══ 1. RECEPTIONIST: Patient Registration & Visit"
login "dylan@gmail.com" "Dylan1234" || exit 1

# create patient
PATIENT_RESP=$(curl -s -X POST "$BASE/patients" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"full_name":"Integration Test Patient","phone":"+254700000000","gender":"female"}')
PATIENT_ID=$(echo "$PATIENT_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id',''))" 2>/dev/null)
if [ -n "$PATIENT_ID" ]; then
  pass "Patient registered (ID: ${PATIENT_ID:0:8}...)"
else
  fail "Patient registration" "$PATIENT_RESP"
fi

# create visit (routine)
VISIT_RESP=$(curl -s -X POST "$BASE/visits" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"patient_id\":\"$PATIENT_ID\",\"visit_type\":\"routine\"}")
VISIT_ID=$(echo "$VISIT_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id',''))" 2>/dev/null)
VISIT_NUM=$(echo "$VISIT_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('visit_number',''))" 2>/dev/null)
if [ -n "$VISIT_ID" ]; then
  pass "Visit created: $VISIT_NUM"
else
  fail "Visit creation" "$VISIT_RESP"
fi

# send to triage (should work)
TRIAGE_RESP=$(curl -s -X PUT "$BASE/visits/$VISIT_ID/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"triaged"}')
TRIAGE_OK=$(echo "$TRIAGE_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success',False))" 2>/dev/null)
[ "$TRIAGE_OK" = "True" ] && pass "Receptionist sent to triage" || fail "Send to triage" "$TRIAGE_RESP"

# try to send directly to OPD (should fail)
OPD_RESP=$(curl -s -X PUT "$BASE/visits/$VISIT_ID/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"with_doctor"}')
OPD_BLOCKED=$(echo "$OPD_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success')==False)" 2>/dev/null)
[ "$OPD_BLOCKED" = "True" ] && pass "Receptionist blocked from OPD" || fail "Receptionist OPD block" "$OPD_RESP"

# ─────────────────────────────────────────────────
log "═══ 2. TRIAGE NURSE: Vitals & Forward to OPD"
login "eliud@gmail.com" "Eliud1234" || exit 1

# record vitals
VITALS_RESP=$(curl -s -X POST "$BASE/patients/visits/$VISIT_ID/vitals" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"blood_pressure_systolic":120,"blood_pressure_diastolic":80,"pulse_rate":72,"temperature":36.5}')
VITALS_OK=$(echo "$VITALS_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success',False))" 2>/dev/null)
[ "$VITALS_OK" = "True" ] && pass "Vitals recorded" || fail "Vitals" "$VITALS_RESP"

# forward to OPD (with doctor)
FWD_RESP=$(curl -s -X PUT "$BASE/visits/$VISIT_ID/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"with_doctor","department":"opd"}')
FWD_OK=$(echo "$FWD_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success',False))" 2>/dev/null)
[ "$FWD_OK" = "True" ] && pass "Forwarded to OPD (with doctor)" || fail "Forward to OPD" "$FWD_RESP"

# ─────────────────────────────────────────────────
log "═══ 3. DOCTOR: Service Orders (Lab, Prescription, Vaccine)"
login "oliver@gmail.com" "Oliver1234" || exit 1

# 3a. Lab order
LAB_RESP=$(curl -s -X POST "$BASE/visits/$VISIT_ID/orders" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"order_type":"lab","test_name":"Complete Blood Count","lab_price":500}')
LAB_ORDER_ID=$(echo "$LAB_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('service_order',{}).get('id',''))" 2>/dev/null)
[ -n "$LAB_ORDER_ID" ] && pass "Lab order created (ID: ${LAB_ORDER_ID:0:8}...)" || fail "Lab order" "$LAB_RESP"

# 3b. Prescription (with real product)
PRESCRIBE_RESP=$(curl -s -X POST "$BASE/visits/$VISIT_ID/orders" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"order_type":"prescription","product_id":"68a6478f-79d5-46ae-9a01-fbc48e281749","drug_name":"Paracetamol 1000mg","dosage":"1g","frequency":"TDS","duration":"5 days","quantity":15,"drug_price":335.40}')
PRESCRIBE_OK=$(echo "$PRESCRIBE_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success',False))" 2>/dev/null)
[ "$PRESCRIBE_OK" = "True" ] && pass "Prescription created (Paracetamol 1000mg x15)" || fail "Prescription" "$PRESCRIBE_RESP"

# 3c. Vaccine order
VAX_RESP=$(curl -s -X POST "$BASE/visits/$VISIT_ID/orders" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"order_type":"vaccine","vaccine_name":"Tetanus Toxoid","vaccine_price":200}')
VAX_OK=$(echo "$VAX_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success',False))" 2>/dev/null)
[ "$VAX_OK" = "True" ] && pass "Vaccine order created" || fail "Vaccine order" "$VAX_RESP"

# ─────────────────────────────────────────────────
log "═══ 4. BILLING: Verify auto-billing & Payment"
# Use receptionist token to check billing
login "dylan@gmail.com" "Dylan1234" || exit 1

BILL_RESP=$(curl -s "$BASE/billing?visit_id=$VISIT_ID" \
  -H "Authorization: Bearer $TOKEN")
BILL_COUNT=$(echo "$BILL_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))" 2>/dev/null)
if [ "$BILL_COUNT" -ge 1 ]; then
  pass "Billing items generated: $BILL_COUNT items"
  # pay all items
  BILL_ITEMS=$(echo "$BILL_RESP" | python3 -c "import sys,json; print('\n'.join([i['id'] for i in json.load(sys.stdin)['data']]))" 2>/dev/null)
  for bid in $BILL_ITEMS; do
    PAY_RESP=$(curl -s -X PUT "$BASE/billing/items/$bid/pay" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"payment_method":"cash"}')
    PAY_OK=$(echo "$PAY_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success',False))" 2>/dev/null)
    [ "$PAY_OK" = "True" ] && pass "Paid billing item $bid" || fail "Pay billing item $bid" "$PAY_RESP"
  done
else
  fail "Billing items" "$BILL_RESP"
fi

# ─────────────────────────────────────────────────
log "═══ 5. LAB TECH: Process lab request"
login "abby@gmail.com" "Abby1234" || exit 1

# get pending lab request for this visit
LAB_PENDING=$(curl -s "$BASE/lab/requests" -H "Authorization: Bearer $TOKEN")
LAB_REQ_ID=$(echo "$LAB_PENDING" | python3 -c "import sys,json; d=json.load(sys.stdin); items=d.get('data',[]); print(items[0]['id'] if items else '')" 2>/dev/null)
if [ -n "$LAB_REQ_ID" ]; then
  # try to update result (may fail due to status constraint, but we'll attempt)
  RESULT_RESP=$(curl -s -X PUT "$BASE/lab/requests/$LAB_REQ_ID/result" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"result":"Normal","result_value":"5.0","result_unit":"x10^9/L"}')
  RESULT_OK=$(echo "$RESULT_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success',False))" 2>/dev/null)
  [ "$RESULT_OK" = "True" ] && pass "Lab result posted" || fail "Lab result" "$RESULT_RESP (may be constraint issue)"
else
  fail "Lab pending request" "No pending request found"
fi

# ─────────────────────────────────────────────────
log "═══ 6. PHARMACIST: Dispense prescription"
login "juma@gmail.com" "Juma1234" || exit 1

# get pending prescriptions for the visit
RX_PENDING=$(curl -s "$BASE/prescriptions" -H "Authorization: Bearer $TOKEN")
RX_ID=$(echo "$RX_PENDING" | python3 -c "import sys,json; d=json.load(sys.stdin); items=d.get('data',[]); matching=[i for i in items if i.get('visit_id')=='$VISIT_ID']; print(matching[0]['id'] if matching else '')" 2>/dev/null)
if [ -n "$RX_ID" ]; then
  DISPENSE_RESP=$(curl -s -X PUT "$BASE/pharmacy/dispense/$RX_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"status":"dispensed"}')
  DISPENSE_OK=$(echo "$DISPENSE_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success',False))" 2>/dev/null)
  [ "$DISPENSE_OK" = "True" ] && pass "Prescription dispensed" || fail "Dispense" "$DISPENSE_RESP (may need payment first)"
else
  fail "Prescription in queue" "No matching prescription found"
fi

# ─────────────────────────────────────────────────
log "═══ 7. REPORTING: Daily Summary & ANC Register"
login "dylan@gmail.com" "Dylan1234" || exit 1

DAILY_RESP=$(curl -s "$BASE/billing/daily-summary" -H "Authorization: Bearer $TOKEN")
DAILY_OK=$(echo "$DAILY_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success',False))" 2>/dev/null)
[ "$DAILY_OK" = "True" ] && pass "Daily billing summary" || fail "Daily summary" "$DAILY_RESP"

ANC_RESP=$(curl -s "$BASE/anc" -H "Authorization: Bearer $TOKEN")
ANC_OK=$(echo "$ANC_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success',False))" 2>/dev/null)
[ "$ANC_OK" = "True" ] && pass "ANC register" || fail "ANC register" "$ANC_RESP"

# ─────────────────────────────────────────────────
log "═══ 8. WORKFLOW: Close visit (discharge)"
login "oliver@gmail.com" "Oliver1234" || exit 1

DISCHARGE_RESP=$(curl -s -X PUT "$BASE/visits/$VISIT_ID/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"discharged"}')
DISCHARGE_OK=$(echo "$DISCHARGE_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success',False))" 2>/dev/null)
[ "$DISCHARGE_OK" = "True" ] && pass "Visit discharged" || fail "Discharge" "$DISCHARGE_RESP"

# ─────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════"
echo "  RESULTS:  ✅ $PASS passed  ❌ $FAIL failed"
echo "══════════════════════════════════════════"
if [ "$FAIL" -eq 0 ]; then
  echo "🎉 ALL TESTS PASSED — System is fully operational!"
else
  echo "⚠️  Some tests failed. Review the output above."
fi
