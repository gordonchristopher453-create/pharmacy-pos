#!/bin/bash
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
API="http://localhost:5000/api"
PASS=0; FAIL=0

check() { 
  if [ "$1" = "true" ]; then echo -e "  ${GREEN}✅ $2${NC}"; PASS=$((PASS+1))
  else echo -e "  ${RED}❌ $2 - $3${NC}"; FAIL=$((FAIL+1)); fi
}

login() { echo $(curl -s -X POST $API/auth/login -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"$2\"}" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4); }

echo -e "${YELLOW}=== FRONTEND API COMMUNICATION TEST ===${NC}"

# Login all users
T_REC=$(login "dylan@gmail.com" "Dylan1234")
T_NURSE=$(login "eliud@gmail.com" "Eliud1234")
T_DOC=$(login "oliver@gmail.com" "Oliver1234")
T_LAB=$(login "abby@gmail.com" "Abby1234")
T_PHARM=$(login "juma@gmail.com" "Juma1234")

echo -e "\n${YELLOW}--- DOCTOR PAGE APIs ---${NC}"

# OPD Queue
R=$(curl -s "$API/patients/visits?status=waiting,with_doctor,lab,pharmacy,radiology,injection_room" -H "Authorization: Bearer $T_DOC")
check "$(echo $R | grep -q '"success":true' && echo true || echo false)" "GET /patients/visits (OPD Queue)" ""

# Consultation save
P=$(curl -s -X POST $API/patients -H "Authorization: Bearer $T_REC" -H "Content-Type: application/json" -d '{"full_name":"API Test","phone":"0700000000","gender":"male","date_of_birth":"1990-01-01"}')
PID=$(echo "$P" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
V=$(curl -s -X POST "$API/patients/$PID/visits" -H "Authorization: Bearer $T_REC" -H "Content-Type: application/json" -d '{"visit_type":"opd"}')
VID=$(echo "$V" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

C=$(curl -s -X POST $API/consultations -H "Authorization: Bearer $T_DOC" -H "Content-Type: application/json" \
  -d "{\"visit_id\":\"$VID\",\"patient_id\":\"$PID\",\"diagnosis\":\"Test\",\"review_of_systems\":\"OK\",\"impression\":\"OK\"}")
check "$(echo $C | grep -q '"success":true' && echo true || echo false)" "POST /consultations (Save)" ""

# Lab results
R=$(curl -s "$API/consultations/visit/$VID/lab-results" -H "Authorization: Bearer $T_DOC")
check "$(echo $R | grep -q '"success":true' && echo true || echo false)" "GET /consultations/visit/:id/lab-results" ""

# Injection reports
R=$(curl -s "$API/consultations/visit/$VID/injection-reports" -H "Authorization: Bearer $T_DOC")
check "$(echo $R | grep -q '"success":true' && echo true || echo false)" "GET /consultations/visit/:id/injection-reports" ""

# Patient history
R=$(curl -s "$API/patients/history/search?search=Test" -H "Authorization: Bearer $T_DOC")
check "$(echo $R | grep -q '"success":true' && echo true || echo false)" "GET /patients/history/search" ""

echo -e "\n${YELLOW}--- LAB PAGE APIs ---${NC}"
R=$(curl -s "$API/lab-requests?start_date=2026-01-01&end_date=2026-12-31" -H "Authorization: Bearer $T_LAB")
check "$(echo $R | grep -q '"success":true' && echo true || echo false)" "GET /lab-requests (Lab Queue)" ""

echo -e "\n${YELLOW}--- INJECTION ROOM APIs ---${NC}"
R=$(curl -s "$API/injection-room" -H "Authorization: Bearer $T_NURSE")
check "$(echo $R | grep -q '"success":true' && echo true || echo false)" "GET /injection-room (Queue)" ""

R=$(curl -s "$API/injection-room/history" -H "Authorization: Bearer $T_NURSE")
check "$(echo $R | grep -q '"success":true' && echo true || echo false)" "GET /injection-room/history" ""

# Add injection order
R=$(curl -s -X POST "$API/injection-room/visit/$VID/orders" -H "Authorization: Bearer $T_NURSE" -H "Content-Type: application/json" -d '{"drug_name":"Test Drug","route":"IV"}')
check "$(echo $R | grep -q '"success":true' && echo true || echo false)" "POST /injection-room/visit/:id/orders" ""

echo -e "\n${YELLOW}--- BILLING APIs ---${NC}"
R=$(curl -s "$API/billing/queue" -H "Authorization: Bearer $T_REC")
check "$(echo $R | grep -q '"success":true' && echo true || echo false)" "GET /billing/queue" ""

R=$(curl -s "$API/billing/visit/$VID" -H "Authorization: Bearer $T_REC")
check "$(echo $R | grep -q '"success":true' && echo true || echo false)" "GET /billing/visit/:id" ""

# Payment
R=$(curl -s -X POST "$API/billing/visit/$VID/pay" -H "Authorization: Bearer $T_REC" -H "Content-Type: application/json" -d '{"payment_method":"cash","amount":500}')
check "$(echo $R | grep -q '"success":true' && echo true || echo false)" "POST /billing/visit/:id/pay" ""

echo -e "\n${YELLOW}--- PHARMACY APIs ---${NC}"
R=$(curl -s "$API/consultations/pharmacy-queue" -H "Authorization: Bearer $T_PHARM")
check "$(echo $R | grep -q '"success":true' && echo true || echo false)" "GET /consultations/pharmacy-queue" ""

echo -e "\n${YELLOW}--- MCH APIs ---${NC}"
R=$(curl -s "$API/mch/stats" -H "Authorization: Bearer $T_NURSE")
check "$(echo $R | grep -q '"success":true' && echo true || echo false)" "GET /mch/stats" ""

R=$(curl -s "$API/mch/anc" -H "Authorization: Bearer $T_NURSE")
check "$(echo $R | grep -q '"success":true' && echo true || echo false)" "GET /mch/anc" ""

echo -e "\n${YELLOW}--- INPATIENT APIs ---${NC}"
R=$(curl -s "$API/inpatient/patients" -H "Authorization: Bearer $T_NURSE")
check "$(echo $R | grep -q '"success":true' && echo true || echo false)" "GET /inpatient/patients" ""

R=$(curl -s "$API/inpatient/wards" -H "Authorization: Bearer $T_NURSE")
check "$(echo $R | grep -q '"success":true' && echo true || echo false)" "GET /inpatient/wards" ""

echo -e "\n${GREEN}✅ Passed: $PASS${NC}  ${RED}❌ Failed: $FAIL${NC}"
