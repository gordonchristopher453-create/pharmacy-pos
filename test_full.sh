#!/bin/bash
API="http://localhost:5000/api"
PASS=0; FAIL=0
log_pass() { echo "  ✅ $1"; ((PASS++)); }
log_fail() { echo "  ❌ $1"; ((FAIL++)); }

login() { curl -s -X POST "$API/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"$2\"}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['accessToken'])" 2>/dev/null; }

echo "══════════════════════════════════════════"
echo "   FULL SYSTEM TEST"
echo "══════════════════════════════════════════"

T_REC=$(login "dylan@gmail.com" "Dylan1234")
T_NURSE=$(login "eliud@gmail.com" "Eliud1234")
[ -n "$T_REC" ] && log_pass "Receptionist login" || { log_fail "Receptionist login"; exit 1; }
[ -n "$T_NURSE" ] && log_pass "Nurse login" || { log_fail "Nurse login"; exit 1; }

# ── 1. REGISTER PATIENT ──
echo; echo "━━━ 1. Patient Registration ━━━"
R=$(curl -s -X POST "$API/patients" -H "Authorization: Bearer $T_REC" -H "Content-Type: application/json" \
  -d '{"full_name":"Test Full Flow","phone":"0700000001","gender":"female","date_of_birth":"1990-01-01"}')
PID=$(echo $R | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
[ -n "$PID" ] && log_pass "Patient registered: $PID" || log_fail "Patient registration"

# ── 2. CREATE OPD VISIT ──
echo; echo "━━━ 2. OPD Visit ━━━"
R=$(curl -s -X POST "$API/patients/$PID/visits" -H "Authorization: Bearer $T_REC" -H "Content-Type: application/json" \
  -d '{"visit_type":"opd","priority":"normal","chief_complaint":"Fever and headache","consultation_fee":500,"fee_paid":false,"payment_method":"cash"}')
VID=$(echo $R | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
[ -n "$VID" ] && log_pass "OPD visit created: $VID" || log_fail "Visit creation"

# ── 3. CHECK BILLING CREATED ──
echo; echo "━━━ 3. Billing ━━━"
BILL=$(curl -s "$API/billing/visit/$VID" -H "Authorization: Bearer $T_REC")
BILL_ID=$(echo $BILL | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
[ -n "$BILL_ID" ] && log_pass "Bill created: $BILL_ID" || log_fail "Bill creation"
BALANCE=$(echo $BILL | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['balance'])" 2>/dev/null)
[ "$BALANCE" = "500.00" ] && log_pass "Balance correct: KES 500" || log_fail "Balance incorrect: $BALANCE"

# ── 4. BLOCK RECEIPT ON UNPAID ──
echo; echo "━━━ 4. Receipt Block (unpaid) ━━━"
PAID=$(curl -s "$API/billing/visit/$VID/paid" -H "Authorization: Bearer $T_REC")
IS_PAID=$(echo $PAID | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['paid'])" 2>/dev/null)
[ "$IS_PAID" = "False" ] && log_pass "Bill correctly unpaid before payment" || log_fail "Bill showing paid before payment"

# ── 5. COLLECT PAYMENT ──
echo; echo "━━━ 5. Payment ━━━"
R=$(curl -s -X POST "$API/billing/visit/$VID/pay" -H "Authorization: Bearer $T_REC" -H "Content-Type: application/json" \
  -d '{"amount":500,"payment_method":"cash","received_by":"Dylan"}')
[ "$(echo $R | grep -c 'success.*true')" -gt 0 ] && log_pass "Payment collected KES 500" || log_fail "Payment failed"

PAID=$(curl -s "$API/billing/visit/$VID/paid" -H "Authorization: Bearer $T_REC")
IS_PAID=$(echo $PAID | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['paid'])" 2>/dev/null)
[ "$IS_PAID" = "True" ] && log_pass "Bill now paid" || log_fail "Bill not marked paid after payment"

# ── 6. SEND TO DOCTOR ──
echo; echo "━━━ 6. Triage → Doctor ━━━"
R=$(curl -s -X POST "$API/patients/visits/$VID/vitals" -H "Authorization: Bearer $T_NURSE" -H "Content-Type: application/json" \
  -d '{"blood_pressure_systolic":120,"blood_pressure_diastolic":80,"pulse_rate":72,"temperature":37.5,"oxygen_saturation":98,"weight":65,"recorded_by":"Eliud"}')
[ "$(echo $R | grep -c 'success.*true')" -gt 0 ] && log_pass "Vitals recorded" || log_fail "Vitals failed"

# ── 7. MCH FLOW ──
echo; echo "━━━ 7. MCH Flow ━━━"
R=$(curl -s -X POST "$API/patients" -H "Authorization: Bearer $T_REC" -H "Content-Type: application/json" \
  -d '{"full_name":"MCH Test Patient","phone":"0700000002","gender":"female","date_of_birth":"1995-05-15"}')
MCH_PID=$(echo $R | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)

R=$(curl -s -X POST "$API/patients/$MCH_PID/visits" -H "Authorization: Bearer $T_REC" -H "Content-Type: application/json" \
  -d '{"visit_type":"mch","priority":"normal","chief_complaint":"ANC visit","consultation_fee":500,"fee_paid":false,"payment_method":"cash"}')
MCH_VID=$(echo $R | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)

R=$(curl -s -X PUT "$API/patients/visits/$MCH_VID/status" -H "Authorization: Bearer $T_REC" -H "Content-Type: application/json" \
  -d '{"status":"mch","mch_service":"mch_anc"}')
[ "$(echo $R | grep -c 'success.*true')" -gt 0 ] && log_pass "Patient sent to ANC" || log_fail "MCH routing failed"

# Check MCH queue
Q=$(curl -s "$API/mch/queue" -H "Authorization: Bearer $T_NURSE")
IN_Q=$(echo $Q | grep -c "$MCH_VID")
[ "$IN_Q" -gt 0 ] && log_pass "Patient in MCH queue" || log_fail "Patient not in MCH queue"

# Check MCH stats
STATS=$(curl -s "$API/mch/stats" -H "Authorization: Bearer $T_NURSE")
ANC=$(echo $STATS | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['anc_today'])" 2>/dev/null)
[ "$ANC" -gt 0 ] && log_pass "MCH stats: ANC today = $ANC" || log_fail "MCH stats not updating (anc_today=$ANC)"

# ── 8. LAB BILLING ──
echo; echo "━━━ 8. Lab Billing ━━━"
R=$(curl -s -X DELETE "$API/billing/visit/$VID/items?item_type=laboratory" -H "Authorization: Bearer $T_REC")
R=$(curl -s -X POST "$API/billing/visit/$VID/items" -H "Authorization: Bearer $T_REC" -H "Content-Type: application/json" \
  -d '{"item_type":"laboratory","description":"Full Blood Count","quantity":1,"unit_price":500}')
[ "$(echo $R | grep -c 'success.*true')" -gt 0 ] && log_pass "Lab item billed" || log_fail "Lab billing failed"

# ── 9. DISPENSE HISTORY ──
echo; echo "━━━ 9. Dispense History Endpoint ━━━"
R=$(curl -s "$API/pharmacy/dispense-history?date_from=2026-01-01&date_to=2026-12-31" -H "Authorization: Bearer $T_REC")
[ "$(echo $R | grep -c 'success.*true')" -gt 0 ] && log_pass "Dispense history endpoint works" || log_fail "Dispense history failed"

echo
echo "══════════════════════════════════════════"
echo "✅ Passed: $PASS  ❌ Failed: $FAIL"
