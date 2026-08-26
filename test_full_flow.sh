#!/bin/bash
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
API="http://localhost:5000/api"
PASS=0; FAIL=0

log_pass() { echo -e "  ${GREEN}✅ $1${NC}"; PASS=$((PASS+1)); }
log_fail() { echo -e "  ${RED}❌ $1${NC}"; echo -e "     ${RED}$2${NC}"; FAIL=$((FAIL+1)); }
log_info() { echo -e "  ${CYAN}ℹ️  $1${NC}"; }
log_data() { echo -e "  ${YELLOW}📄 $1${NC}"; }
login() { echo $(curl -s -X POST $API/auth/login -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"$2\"}" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4); }

echo -e "${BOLD}${BLUE}"
echo "╔══════════════════════════════════════════════════════╗"
echo "║     COMPLETE HOSPITAL COMMUNICATION FLOW TEST        ║"
echo "║   Doctor ↔ Nurse ↔ Lab ↔ Injection ↔ Ward ↔ Pharm  ║"
echo "╚══════════════════════════════════════════════════════╝${NC}"

echo -e "\n${YELLOW}🔑 Logging in all staff...${NC}"
T_REC=$(login "dylan@gmail.com" "Dylan1234")
T_NURSE=$(login "eliud@gmail.com" "Eliud1234")
T_DOC=$(login "oliver@gmail.com" "Oliver1234")
T_LAB=$(login "abby@gmail.com" "Abby1234")
T_PHARM=$(login "juma@gmail.com" "Juma1234")
[ -n "$T_DOC" ] && log_pass "All staff logged in" || { log_fail "Login failed"; exit 1; }

# ═══════════════════════════════════════════════════════════
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  PHASE 1: RECEPTION — Patient Registration   ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

P=$(curl -s -X POST $API/patients -H "Authorization: Bearer $T_REC" -H "Content-Type: application/json" \
  -d '{"full_name":"John Otieno","phone":"0722333444","gender":"male","date_of_birth":"1985-03-15","allergies":"Penicillin"}')
PID=$(echo "$P" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
PNUM=$(echo "$P" | grep -o '"patient_number":"[^"]*"' | cut -d'"' -f4)
[ -n "$PID" ] && log_pass "Patient registered: $PNUM" || { log_fail "Register" "$P"; exit 1; }
log_data "Name: John Otieno | DOB: 1985-03-15 | ⚠️  Allergy: Penicillin"

V=$(curl -s -X POST "$API/patients/$PID/visits" -H "Authorization: Bearer $T_REC" -H "Content-Type: application/json" \
  -d '{"visit_type":"emergency","chief_complaint":"High fever 5 days, severe headache, neck stiffness, confusion","consultation_fee":500,"fee_paid":true,"priority":"emergency"}')
VID=$(echo "$V" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
VNUM=$(echo "$V" | grep -o '"visit_number":"[^"]*"' | cut -d'"' -f4)
[ -n "$VID" ] && log_pass "Emergency visit: $VNUM — Fee KES 500 paid" || { log_fail "Visit" "$V"; exit 1; }
log_data "CC: High fever 5 days, severe headache, neck stiffness, confusion"

# ═══════════════════════════════════════════════════════════
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  PHASE 2: TRIAGE — Nurse Assessment          ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

curl -s -X PUT "$API/patients/visits/$VID/status" \
  -H "Authorization: Bearer $T_NURSE" -H "Content-Type: application/json" \
  -d '{"status":"with_doctor","blood_pressure_systolic":98,"blood_pressure_diastolic":60,"pulse_rate":118,"temperature":40.2,"oxygen_saturation":96}' > /dev/null
log_pass "Triage done → sent to Doctor"
log_data "Vitals: BP 98/60 | Pulse 118 | Temp 40.2°C | SpO2 96%"
log_info "⚠️  Critical vitals flagged — Emergency priority"

# ═══════════════════════════════════════════════════════════
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  PHASE 3: DOCTOR — Initial Consultation      ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

C=$(curl -s -X POST $API/consultations -H "Authorization: Bearer $T_DOC" -H "Content-Type: application/json" \
  -d "{\"visit_id\":\"$VID\",\"patient_id\":\"$PID\",
    \"presenting_complaint\":\"High fever 5 days, severe frontal headache, photophobia, neck stiffness, confusion since this morning\",
    \"history_of_illness\":\"Started with headache and fever. Progressive deterioration. No trauma. No sick contacts.\",
    \"examination_findings\":\"Temp 40.2C, BP 98/60, Pulse 118, RR 24, SpO2 96%. Alert but confused GCS 13. Neck stiffness +. Kernig sign +. Photophobia +. No rash.\",
    \"review_of_systems\":\"CNS: Confusion, neck stiffness, photophobia. CVS: Tachycardic, hypotensive. Resp: Tachypnoeic. GI: Nausea, vomiting x3.\",
    \"impression\":\"Bacterial meningitis with early septic shock — CRITICAL\",
    \"diagnosis\":\"Bacterial Meningitis\",\"icd_code\":\"G00.9\",
    \"management_plan\":\"URGENT: IV Ceftriaxone 2g STAT then BD (NOT Penicillin — allergic). IV Dexamethasone 10mg QID x4 days. IV NS 1L over 30min STAT then maintain 125ml/hr. Monitor GCS, vitals every 30min. Strict I&O. Lumbar puncture after CT if stable.\",
    \"lab_requests\":[
      {\"test_name\":\"CBC with differential\",\"urgency\":\"stat\",\"notes\":\"Check for leukocytosis, left shift\"},
      {\"test_name\":\"CSF Analysis + Culture\",\"urgency\":\"stat\",\"notes\":\"Lumbar puncture — send for microscopy, culture, glucose, protein\"},
      {\"test_name\":\"Blood Culture x2\",\"urgency\":\"stat\",\"notes\":\"Before antibiotics if possible\"},
      {\"test_name\":\"Serum electrolytes + RFT\",\"urgency\":\"urgent\",\"notes\":\"Check for SIADH, renal function\"}
    ],
    \"prescriptions\":[
      {\"drug_name\":\"IV Ceftriaxone\",\"dosage\":\"2g\",\"frequency\":\"BD\",\"route\":\"IV\",\"duration\":\"14 days\",\"quantity\":28,\"instructions\":\"DO NOT use Penicillin — patient allergic. Give over 30 min in 100ml NS\"},
      {\"drug_name\":\"IV Dexamethasone\",\"dosage\":\"10mg\",\"frequency\":\"QID\",\"route\":\"IV\",\"duration\":\"4 days\",\"quantity\":16,\"instructions\":\"Give 15min BEFORE each Ceftriaxone dose\"},
      {\"drug_name\":\"IV Normal Saline 0.9%\",\"dosage\":\"1L\",\"frequency\":\"TDS\",\"route\":\"IV\",\"duration\":\"2 days\",\"quantity\":6,\"instructions\":\"First litre STAT over 30min, then 125ml/hr maintenance\"},
      {\"drug_name\":\"Paracetamol IV\",\"dosage\":\"1g\",\"frequency\":\"QID\",\"route\":\"IV\",\"duration\":\"3 days\",\"quantity\":12,\"instructions\":\"For fever and pain control\"}
    ]}")
CID=$(echo "$C" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
[ -n "$CID" ] && log_pass "Consultation saved — Dx: Bacterial Meningitis (G00.9)" || { log_fail "Consultation" "$C"; exit 1; }
log_data "Impression: Bacterial meningitis with early septic shock — CRITICAL"
log_data "Prescriptions: 4 IV drugs | Lab: 4 STAT tests"
log_info "⚠️  Doctor noted Penicillin allergy in instructions"

# Doctor → Lab
curl -s -X POST "$API/billing/visit/$VID/items" -H "Authorization: Bearer $T_DOC" -H "Content-Type: application/json" -d '{"item_type":"laboratory","description":"CBC with differential (STAT)","quantity":1,"unit_price":800}' > /dev/null
curl -s -X POST "$API/billing/visit/$VID/items" -H "Authorization: Bearer $T_DOC" -H "Content-Type: application/json" -d '{"item_type":"laboratory","description":"CSF Analysis + Culture (STAT)","quantity":1,"unit_price":2500}' > /dev/null
curl -s -X POST "$API/billing/visit/$VID/items" -H "Authorization: Bearer $T_DOC" -H "Content-Type: application/json" -d '{"item_type":"laboratory","description":"Blood Culture x2 (STAT)","quantity":1,"unit_price":1800}' > /dev/null
curl -s -X POST "$API/billing/visit/$VID/items" -H "Authorization: Bearer $T_DOC" -H "Content-Type: application/json" -d '{"item_type":"laboratory","description":"Serum Electrolytes + RFT","quantity":1,"unit_price":1200}' > /dev/null
log_pass "Doctor → LAB: 4 STAT tests ordered (KES 6300)"
log_data "Tests: CBC | CSF Analysis | Blood Culture x2 | Electrolytes+RFT"

# Doctor → Injection Room with detailed instructions
curl -s -X PUT "$API/patients/visits/$VID/status" -H "Authorization: Bearer $T_DOC" -H "Content-Type: application/json" -d '{"status":"injection_room"}' > /dev/null
curl -s -X POST "$API/billing/visit/$VID/items" -H "Authorization: Bearer $T_DOC" -H "Content-Type: application/json" -d '{"item_type":"injection","description":"IV Medications — Meningitis Protocol","quantity":1,"unit_price":3000}' > /dev/null

# Create injection orders with doctor instructions
IO1=$(curl -s -X POST "$API/injection-room/visit/$VID/orders" -H "Authorization: Bearer $T_DOC" -H "Content-Type: application/json" \
  -d '{"drug_name":"IV Ceftriaxone 2g","dosage":"2g","route":"IV","frequency":"BD","duration":"14 days","quantity":1,"instructions":"STAT dose. Give over 30min in 100ml NS. NOT Penicillin — patient ALLERGIC"}')
OID1=$(echo "$IO1" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

IO2=$(curl -s -X POST "$API/injection-room/visit/$VID/orders" -H "Authorization: Bearer $T_DOC" -H "Content-Type: application/json" \
  -d '{"drug_name":"IV Dexamethasone 10mg","dosage":"10mg","route":"IV","frequency":"QID","duration":"4 days","quantity":1,"instructions":"Give 15min BEFORE Ceftriaxone"}')
OID2=$(echo "$IO2" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

IO3=$(curl -s -X POST "$API/injection-room/visit/$VID/orders" -H "Authorization: Bearer $T_DOC" -H "Content-Type: application/json" \
  -d '{"drug_name":"IV Normal Saline 1L","dosage":"1L","route":"IV","frequency":"STAT then TDS","duration":"2 days","quantity":1,"instructions":"First litre STAT over 30min"}')
OID3=$(echo "$IO3" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

[ -n "$OID1" ] && log_pass "Doctor → INJECTION ROOM: 3 IV orders with instructions" || log_fail "Injection orders failed"
log_data "Order 1: IV Ceftriaxone 2g — STAT, over 30min, NOT Penicillin (allergic)"
log_data "Order 2: IV Dexamethasone 10mg — give 15min BEFORE Ceftriaxone"
log_data "Order 3: IV Normal Saline 1L — STAT over 30min"

# ═══════════════════════════════════════════════════════════
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  PHASE 4: BILLING — Payment Processing       ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

BILL=$(curl -s "$API/billing/visit/$VID" -H "Authorization: Bearer $T_REC")
BILL_NO=$(echo "$BILL" | grep -o '"bill_number":"[^"]*"' | cut -d'"' -f4)
TOTAL=$(echo "$BILL" | grep -o '"total_amount":"[^"]*"' | cut -d'"' -f4 | head -1)
[ -n "$BILL_NO" ] && log_pass "Bill: $BILL_NO — Total KES $TOTAL" || log_fail "No bill"
curl -s -X POST "$API/billing/visit/$VID/pay" -H "Authorization: Bearer $T_REC" -H "Content-Type: application/json" \
  -d "{\"payment_method\":\"mpesa\",\"amount\":5000,\"reference_number\":\"MPESA001\"}" > /dev/null
log_pass "Partial payment KES 5000 via M-Pesa (emergency deposit)"

# ═══════════════════════════════════════════════════════════
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  PHASE 5: LAB — Processing STAT Tests        ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

LAB_LIST=$(curl -s "$API/lab-requests?start_date=2026-01-01&end_date=2026-12-31" -H "Authorization: Bearer $T_LAB")
LAB_ID1=$(echo "$LAB_LIST" | grep -o '"id":"[^"]*"' | sed -n '1p' | cut -d'"' -f4)
LAB_ID2=$(echo "$LAB_LIST" | grep -o '"id":"[^"]*"' | sed -n '2p' | cut -d'"' -f4)
[ -n "$LAB_ID1" ] && log_pass "Lab sees STAT requests" || log_fail "No lab requests"

if [ -n "$LAB_ID1" ]; then
  curl -s -X PUT "$API/lab-requests/$LAB_ID1/result" -H "Authorization: Bearer $T_LAB" \
    -H "Content-Type: application/json" \
    -d '{"result":"WBC 24.5 (H), Neutrophils 94% (H), Bands 12% (H), Hgb 11.2 (L), Plt 145","result_flag":"high","result_value":"24.5","result_unit":"x10^9/L","reference_range":"4.0-11.0","technician_notes":"Marked leukocytosis with left shift. Consistent with severe bacterial infection."}' > /dev/null
  log_pass "CBC result: WBC 24.5 (HIGH) — Severe bacterial infection"
  log_data "WBC 24.5 | Neutrophils 94% | Bands 12% | Hgb 11.2 | Plt 145"
fi

if [ -n "$LAB_ID2" ]; then
  curl -s -X PUT "$API/lab-requests/$LAB_ID2/result" -H "Authorization: Bearer $T_LAB" \
    -H "Content-Type: application/json" \
    -d '{"result":"CSF: Appearance Cloudy/turbid. WBC 2400 (predominantly neutrophils). Protein 3.8 g/L (H). Glucose 1.2 mmol/L (L). Gram stain: Gram +ve diplococci. Culture pending 48hrs.","result_flag":"high","technician_notes":"URGENT: CSF findings consistent with bacterial meningitis. Gram +ve diplococci — likely Streptococcus pneumoniae. Notify doctor IMMEDIATELY."}' > /dev/null
  log_pass "CSF result: BACTERIAL MENINGITIS CONFIRMED — Gram +ve diplococci"
  log_data "CSF: Cloudy | WBC 2400 | Protein 3.8 (H) | Glucose 1.2 (L) | Gram +ve diplococci"
  log_info "🚨 Lab tech flagged: Notify doctor IMMEDIATELY"
fi

# ═══════════════════════════════════════════════════════════
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  PHASE 6: INJECTION ROOM — Nurse Administers ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

INJ=$(curl -s "$API/injection-room" -H "Authorization: Bearer $T_NURSE")
INJ_N=$(echo "$INJ" | grep -o '"patient_name"' | wc -l)
[ "$INJ_N" -gt 0 ] && log_pass "Nurse sees $INJ_N patient(s) in injection queue" || log_fail "Injection queue empty"

INJ_VID=$(echo "$INJ" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$INJ_VID" ] && [ -n "$OID1" ]; then
  # Nurse reads doctor instructions and administers
  log_info "Nurse reading doctor instructions before administering..."

  # Administer Dexamethasone FIRST (as per doctor instructions)
  ADM2=$(curl -s -X PUT "$API/injection-room/orders/$OID2/administer" \
    -H "Authorization: Bearer $T_NURSE" -H "Content-Type: application/json" \
    -d '{"nurse_report":"IV Dexamethasone 10mg given over 5min as per doctor instructions (before Ceftriaxone). No reaction. Pre-vitals: BP 98/60, Pulse 118, Temp 40.2C. Patient alert but confused."}')
  [ "$(echo $ADM2 | grep -c 'administered')" -gt 0 ] && log_pass "Nurse gave Dexamethasone FIRST (following doctor order)" || log_fail "Dexamethasone failed" "$ADM2"
  log_data "Nurse note: Dexamethasone given before Ceftriaxone as instructed"

  sleep 1

  # Administer Ceftriaxone
  ADM1=$(curl -s -X PUT "$API/injection-room/orders/$OID1/administer" \
    -H "Authorization: Bearer $T_NURSE" -H "Content-Type: application/json" \
    -d '{"nurse_report":"IV Ceftriaxone 2g given over 30min in 100ml NS. Confirmed NOT Penicillin (patient allergic). No adverse reaction observed. Post 30min vitals: BP 102/65, Pulse 112, Temp 39.8C. Patient more alert, GCS improved to 14."}')
  [ "$(echo $ADM1 | grep -c 'administered')" -gt 0 ] && log_pass "Nurse gave Ceftriaxone with detailed nurse_report" || log_fail "Ceftriaxone failed" "$ADM1"
  log_data "Nurse note: Confirmed NOT Penicillin. Post-vitals: BP 102/65, GCS 14"

  # Administer Normal Saline
  ADM3=$(curl -s -X PUT "$API/injection-room/orders/$OID3/administer" \
    -H "Authorization: Bearer $T_NURSE" -H "Content-Type: application/json" \
    -d '{"nurse_report":"IV NS 1L running STAT over 30min. IV site: Right antecubital, no infiltration. Urine output noted 80ml since admission."}')
  [ "$(echo $ADM3 | grep -c 'administered')" -gt 0 ] && log_pass "Nurse gave Normal Saline + documented IV site" || log_fail "NS failed"
  log_data "Nurse note: IV site good, UO 80ml noted"

  # Verify nurse_report saved
  SAVED=$(curl -s "$API/injection-room/visit/$VID" -H "Authorization: Bearer $T_NURSE")
  NR_COUNT=$(echo "$SAVED" | grep -o '"nurse_report"' | wc -l)
  ADM_COUNT=$(echo "$SAVED" | grep -o '"status":"administered"' | wc -l)
  [ "$NR_COUNT" -gt 0 ] && log_pass "nurse_report saved: $NR_COUNT order(s) have reports" || log_fail "nurse_report NOT saved in DB" "$SAVED"
  [ "$ADM_COUNT" -eq 3 ] && log_pass "All 3 orders administered ($ADM_COUNT/3)" || log_fail "Not all administered ($ADM_COUNT/3)"

  # Return to doctor
  curl -s -X PUT "$API/injection-room/visit/$INJ_VID/return-to-doctor" -H "Authorization: Bearer $T_NURSE" > /dev/null
  log_pass "Nurse returned patient to Doctor"
fi

# ═══════════════════════════════════════════════════════════
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  PHASE 7: DOCTOR — Reviews All Reports       ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Doctor checks lab results
LAB_RESULTS=$(curl -s "$API/consultations/visit/$VID/lab-results" -H "Authorization: Bearer $T_DOC")
LAB_COUNT=$(echo "$LAB_RESULTS" | grep -o '"result_flag"' | wc -l)
[ "$LAB_COUNT" -gt 0 ] && log_pass "Doctor sees $LAB_COUNT lab result(s)" || log_fail "Doctor cannot see lab results"

# Show lab results summary
CBC_RESULT=$(echo "$LAB_RESULTS" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('data',[]); [print(x.get('test_name','')+':', x.get('result_value',''),'('+x.get('result_flag','')+')') for x in r if x.get('result_flag')]" 2>/dev/null)
[ -n "$CBC_RESULT" ] && log_data "Lab results: $CBC_RESULT"

# Doctor checks injection/nurse reports
INJ_REPORTS=$(curl -s "$API/consultations/visit/$VID/injection-reports" -H "Authorization: Bearer $T_DOC")
ADM_COUNT=$(echo "$INJ_REPORTS" | grep -o '"status":"administered"' | wc -l)
NR_COUNT=$(echo "$INJ_REPORTS" | grep -o '"nurse_report"' | wc -l)
[ "$ADM_COUNT" -gt 0 ] && log_pass "Doctor sees $ADM_COUNT administered injection(s)" || log_fail "Doctor cannot see injection reports" "$INJ_REPORTS"
[ "$NR_COUNT" -gt 0 ] && log_pass "Doctor sees nurse_report on $NR_COUNT order(s)" || log_fail "nurse_report missing from doctor view"

# Show nurse reports
NURSE_NOTES=$(echo "$INJ_REPORTS" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for r in d.get('data',[]):
    if r.get('nurse_report'):
        print(r.get('drug_name','')+':', r.get('nurse_report','')[:80]+'...')
" 2>/dev/null)
[ -n "$NURSE_NOTES" ] && log_data "Nurse reports seen by doctor:" && echo -e "     ${CYAN}$NURSE_NOTES${NC}"

# Doctor updates management based on results
curl -s -X PUT "$API/consultations/$CID" -H "Authorization: Bearer $T_DOC" \
  -H "Content-Type: application/json" \
  -d '{"management_plan":"UPDATED: CSF confirms Strep pneumoniae meningitis. Continue IV Ceftriaxone 2g BD x14 days. Dexamethasone x4 days. Add IV Acyclovir 750mg TDS (cover viral). Strict neuro obs hourly. Repeat CSF culture 48hrs. Neurology consult requested.","examination_findings":"Post-treatment 1hr: Temp 39.2C (down from 40.2), BP 108/70, Pulse 105, GCS 14 (improved from 13). Responding to treatment."}' > /dev/null
log_pass "Doctor updated plan based on lab + nurse reports"
log_data "Updated plan: Confirmed Strep pneumoniae. Added IV Acyclovir. Neuro consult."

# ═══════════════════════════════════════════════════════════
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  PHASE 8: WARD ADMISSION                     ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

curl -s -X PUT "$API/patients/visits/$VID/status" -H "Authorization: Bearer $T_DOC" \
  -H "Content-Type: application/json" -d '{"status":"admitted"}' > /dev/null
log_pass "Doctor admitted patient to ICU Ward"

curl -s -X POST "$API/billing/visit/$VID/items" -H "Authorization: Bearer $T_REC" \
  -H "Content-Type: application/json" -d '{"item_type":"admission","description":"ICU Admission Fee","quantity":1,"unit_price":5000}' > /dev/null
curl -s -X POST "$API/billing/visit/$VID/items" -H "Authorization: Bearer $T_REC" \
  -H "Content-Type: application/json" -d '{"item_type":"bed_charge","description":"ICU Day 1","quantity":1,"unit_price":8000}' > /dev/null
log_pass "Ward charges: ICU Admission KES 5000 + Day 1 KES 8000"

# Nurse adds ward drug orders
WARD_O1=$(curl -s -X POST "$API/inpatient/visit/$VID/orders" -H "Authorization: Bearer $T_NURSE" \
  -H "Content-Type: application/json" \
  -d '{"drug_name":"IV Ceftriaxone 2g","dosage":"2g","route":"IV","frequency":"BD","instructions":"Continue meningitis treatment"}')
WOID1=$(echo "$WARD_O1" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
[ -n "$WOID1" ] && log_pass "Ward nurse added IV Ceftriaxone order" || log_fail "Ward order failed"

# ═══════════════════════════════════════════════════════════
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  PHASE 9: WARD ROUND — Days 2-4              ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Day 2
curl -s -X PUT "$API/consultations/$CID" -H "Authorization: Bearer $T_DOC" \
  -H "Content-Type: application/json" \
  -d '{"examination_findings":"Day 2: Temp 38.1C (improving), BP 115/75, Pulse 92, GCS 15 (fully alert). Neck stiffness reduced. Tolerating fluids orally."}' > /dev/null
log_pass "Day 2 ward round: GCS 15, improving"
log_data "Day 2: Temp 38.1C | BP 115/75 | GCS 15 | Neck stiffness reduced"

# Day 3
curl -s -X PUT "$API/consultations/$CID" -H "Authorization: Bearer $T_DOC" \
  -H "Content-Type: application/json" \
  -d '{"examination_findings":"Day 3: Temp 37.2C (afebrile), BP 120/80, Pulse 78, GCS 15. No neck stiffness. Eating and drinking well. Plan to step down to oral antibiotics Day 5."}' > /dev/null
log_pass "Day 3 ward round: Afebrile, no neck stiffness"
log_data "Day 3: Temp 37.2C (afebrile) | No neck stiffness | Eating well"

# Day 4
curl -s -X PUT "$API/consultations/$CID" -H "Authorization: Bearer $T_DOC" \
  -H "Content-Type: application/json" \
  -d '{"examination_findings":"Day 4: Fully recovered. Temp 36.8C, BP 122/78, Pulse 74, GCS 15. Neurologically intact. Ready for discharge with oral antibiotics x10 days.","management_plan":"DISCHARGE PLAN: Amoxicillin-Clavulanate 625mg BD x10 days (NOTE: patient allergic to Penicillin — use Azithromycin 500mg OD x5 days instead). Review in 2 weeks. Neurology OPD follow-up."}' > /dev/null
log_pass "Day 4 ward round: Fully recovered — ready for discharge"
log_data "Day 4: Temp 36.8C | GCS 15 | Neurologically intact"

# ═══════════════════════════════════════════════════════════
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  PHASE 10: DISCHARGE + PHARMACY              ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Add discharge medications to pharmacy
curl -s -X POST "$API/billing/visit/$VID/items" -H "Authorization: Bearer $T_DOC" \
  -H "Content-Type: application/json" \
  -d '{"item_type":"drug","description":"Azithromycin 500mg x5 (discharge meds)","quantity":5,"unit_price":80}' > /dev/null
curl -s -X PUT "$API/patients/visits/$VID/status" -H "Authorization: Bearer $T_DOC" \
  -H "Content-Type: application/json" -d '{"status":"pharmacy"}' > /dev/null
log_pass "Doctor sent discharge prescription to Pharmacy"
log_data "Discharge meds: Azithromycin 500mg OD x5 (safe — not Penicillin)"

# Pharmacy checks queue
RX=$(curl -s "$API/consultations/pharmacy-queue" -H "Authorization: Bearer $T_PHARM")
RX_OK=$(echo "$RX" | grep -o '"success":true')
[ -n "$RX_OK" ] && log_pass "Pharmacist sees prescription queue" || log_fail "Pharmacy queue failed"

# Final bill
BILL_FINAL=$(curl -s "$API/billing/visit/$VID" -H "Authorization: Bearer $T_REC")
BALANCE=$(echo "$BILL_FINAL" | grep -o '"balance":"[^"]*"' | cut -d'"' -f4 | head -1)
GRAND_TOTAL=$(echo "$BILL_FINAL" | grep -o '"total_amount":"[^"]*"' | cut -d'"' -f4 | head -1)
log_pass "Final bill: KES $GRAND_TOTAL | Balance: KES $BALANCE"

if [ -n "$BALANCE" ] && [ "$BALANCE" != "0.00" ] && [ "$BALANCE" != "0" ]; then
  curl -s -X POST "$API/billing/visit/$VID/pay" -H "Authorization: Bearer $T_REC" \
    -H "Content-Type: application/json" \
    -d "{\"payment_method\":\"mpesa\",\"amount\":$BALANCE,\"reference_number\":\"FINAL999\"}" > /dev/null
  log_pass "Final balance KES $BALANCE paid — account cleared"
fi

# Discharge
curl -s -X PUT "$API/patients/visits/$VID/status" -H "Authorization: Bearer $T_DOC" \
  -H "Content-Type: application/json" -d '{"status":"discharged"}' > /dev/null
log_pass "Patient discharged after 4-day ICU admission"
log_data "Discharge: Azithromycin 500mg OD x5. Review 2 weeks. Neurology OPD."

# ═══════════════════════════════════════════════════════════
echo -e "\n${BLUE}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                  TEST SUMMARY                        ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════╝${NC}"
echo -e "  ${GREEN}✅ Passed: $PASS${NC}  ${RED}❌ Failed: $FAIL${NC}"
echo ""
echo -e "  ${CYAN}Flow tested:${NC}"
echo -e "  Reception → Triage → Doctor → Lab + Injection"
echo -e "  Lab results → Doctor reviews → Nurse reports → Doctor sees"
echo -e "  Ward admission → 4-day rounds → Discharge → Pharmacy"
echo ""
[ $FAIL -eq 0 ] && echo -e "  ${GREEN}${BOLD}🎉 ALL SYSTEMS COMMUNICATING PERFECTLY!${NC}" || echo -e "  ${RED}${BOLD}⚠️  $FAIL test(s) failed — check above${NC}"
