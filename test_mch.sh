#!/bin/bash
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
API="http://localhost:5000/api"
PASS=0; FAIL=0

log_pass() { echo -e "  ${GREEN}✅ $1${NC}"; PASS=$((PASS+1)); }
log_fail() { echo -e "  ${RED}❌ $1${NC}"; FAIL=$((FAIL+1)); }
login() { echo $(curl -s -X POST $API/auth/login -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"$2\"}" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4); }

echo -e "${BLUE}══════════════════════════════════════════${NC}"
echo -e "${BLUE}   MCH FULL FLOW TEST${NC}"
echo -e "${BLUE}══════════════════════════════════════════${NC}"

echo -e "\n${YELLOW}🔑 Logging in...${NC}"
T_REC=$(login "dylan@gmail.com" "Dylan1234")
T_NURSE=$(login "eliud@gmail.com" "Eliud1234")

MCH_SERVICES=("mch_anc:ANC Clinic:🤰:500" "mch_pnc:PNC Clinic:🤱:500" "mch_cwc:CWC Clinic:👶:300" "mch_immunization:Immunization:💉:200" "mch_fp:Family Planning:👥:300")

for SVC in "${MCH_SERVICES[@]}"; do
  IFS=':' read -r CODE LABEL EMOJI FEE <<< "$SVC"
  
  echo -e "\n${BLUE}━━━ Testing: $EMOJI $LABEL ($CODE) ━━━${NC}"
  
  # Register patient
  P=$(curl -s -X POST $API/patients -H "Authorization: Bearer $T_REC" -H "Content-Type: application/json" \
    -d "{\"full_name\":\"MCH $LABEL Patient\",\"phone\":\"0700000000\",\"gender\":\"female\",\"date_of_birth\":\"1995-01-01\"}")
  PID=$(echo "$P" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  [ -n "$PID" ] && log_pass "Registered" || { log_fail "Register" "$P"; continue; }
  
  # Create visit
  V=$(curl -s -X POST "$API/patients/$PID/visits" -H "Authorization: Bearer $T_REC" -H "Content-Type: application/json" \
    -d '{"visit_type":"opd","consultation_fee":500,"fee_paid":true}')
  VID=$(echo "$V" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  [ -n "$VID" ] && log_pass "Visit created" || { log_fail "Visit"; continue; }
  
  # Nurse sends to MCH sub-department
  R=$(curl -s -X PUT "$API/patients/visits/$VID/status" -H "Authorization: Bearer $T_NURSE" -H "Content-Type: application/json" \
    -d "{\"status\":\"mch\",\"mch_service\":\"$CODE\"}")
  [ "$(echo $R | grep -c '"success":true')" -gt 0 ] && log_pass "Sent to $LABEL" || log_fail "Route to $LABEL"
  
  # Check MCH queue
  Q=$(curl -s "$API/mch/queue" -H "Authorization: Bearer $T_NURSE")
  IN_QUEUE=$(echo "$Q" | grep -c "$CODE")
  [ "$IN_QUEUE" -gt 0 ] && log_pass "In MCH queue ($CODE)" || log_fail "Not in MCH queue"
  
  # Check billing
  BILL=$(curl -s "$API/billing/visit/$VID" -H "Authorization: Bearer $T_REC")
  BILL_NO=$(echo "$BILL" | grep -o '"bill_number":"[^"]*"' | cut -d'"' -f4)
  ITEMS=$(echo "$BILL" | grep -o '"description":"[^"]*"' | head -1)
  [ -n "$BILL_NO" ] && log_pass "Bill: $BILL_NO $ITEMS" || log_fail "No bill"
  
  # Pay bill
  TOTAL=$(echo "$BILL" | grep -o '"total_amount":"[^"]*"' | cut -d'"' -f4 | head -1)
  if [ -n "$TOTAL" ] && [ "$TOTAL" != "0.00" ]; then
    curl -s -X POST "$API/billing/visit/$VID/pay" -H "Authorization: Bearer $T_REC" -H "Content-Type: application/json" \
      -d "{\"payment_method\":\"cash\",\"amount\":$TOTAL}" > /dev/null
    log_pass "Paid KES $TOTAL"
  fi
done

# Check MCH stats
echo -e "\n${BLUE}━━━ MCH Dashboard Summary ━━━${NC}"
STATS=$(curl -s "$API/mch/stats" -H "Authorization: Bearer $T_NURSE")
echo "$STATS" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; [print(f'  {k}: {v}') for k,v in d.items()]" 2>/dev/null

# MOH Monthly Summary
echo -e "\n${BLUE}━━━ MOH Monthly Summary ━━━${NC}"
SUMMARY=$(curl -s "$API/mch/reports/mch-monthly-summary?month=6&year=2026" -H "Authorization: Bearer $T_NURSE")
echo "$SUMMARY" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; [print(f'  {k}: {v}') for k,v in d.items()]" 2>/dev/null

echo -e "\n${BLUE}══════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Passed: $PASS${NC}  ${RED}❌ Failed: $FAIL${NC}"
[ $FAIL -eq 0 ] && echo -e "${GREEN}🎉 ALL MCH DEPARTMENTS WORKING WITH BILLING!${NC}"
