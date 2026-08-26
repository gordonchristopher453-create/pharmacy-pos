#!/bin/bash
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
API="http://localhost:5000/api"
PASS=0; FAIL=0

check() { if [ "$1" = "true" ]; then echo -e "  ${GREEN}✅ $2${NC}"; PASS=$((PASS+1)); else echo -e "  ${RED}❌ $2${NC}"; echo -e "  ${RED}   $3${NC}"; FAIL=$((FAIL+1)); fi; }

login() { echo $(curl -s -X POST $API/auth/login -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"$2\"}" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4); }

echo -e "${YELLOW}=== FRONTEND INTEGRATION TEST ===${NC}"
echo "Testing every API the frontend calls..."

# Login
T_DOC=$(login "oliver@gmail.com" "Oliver1234")
T_NURSE=$(login "eliud@gmail.com" "Eliud1234")
T_REC=$(login "dylan@gmail.com" "Dylan1234")
T_LAB=$(login "abby@gmail.com" "Abby1234")
T_PHARM=$(login "juma@gmail.com" "Juma1234")

echo -e "\n${YELLOW}--- DOCTOR PAGE APIs ---${NC}"

# OPD Queue
R=$(curl -s "$API/patients/visits?status=waiting,with_doctor,lab,pharmacy,radiology,injection_room" -H "Authorization: Bearer $T_DOC")
check "$(echo $R | grep -c '"success":true')" "OPD Queue" "$(echo $R | head -c 80)"

# Patient History Search
R=$(curl -s "$API/patients/history/search" -H "Authorization: Bearer $T_DOC")
check "$(echo $R | grep -c '"success":true')" "Patient History" "$(echo $R | head -c 80)"

# MOH Reports
R=$(curl -s "$API/patients/reports/moh204?date_from=2026-06-01&date_to=2026-06-30" -H "Authorization: Bearer $T_DOC")
check "$(echo $R | grep -c '"success":true')" "MOH 204 Report" "$(echo $R | head -c 80)"

echo -e "\n${YELLOW}--- INPATIENT PAGE APIs ---${NC}"

# Inpatient patients
R=$(curl -s "$API/inpatient/patients" -H "Authorization: Bearer $T_DOC")
check "$(echo $R | grep -c '"success":true')" "Inpatient Patients" "$(echo $R | head -c 80)"

# Inpatient wards
R=$(curl -s "$API/inpatient/wards" -H "Authorization: Bearer $T_DOC")
check "$(echo $R | grep -c '"success":true')" "Inpatient Wards" "$(echo $R | head -c 80)"

echo -e "\n${YELLOW}--- LAB PAGE APIs ---${NC}"

R=$(curl -s "$API/lab-requests?start_date=2026-01-01&end_date=2026-12-31" -H "Authorization: Bearer $T_LAB")
check "$(echo $R | grep -c '"success":true')" "Lab Requests" "$(echo $R | head -c 80)"

echo -e "\n${YELLOW}--- PHARMACY PAGE APIs ---${NC}"

R=$(curl -s "$API/consultations/pharmacy-queue" -H "Authorization: Bearer $T_PHARM")
check "$(echo $R | grep -c '"success":true')" "Pharmacy Queue" "$(echo $R | head -c 80)"

echo -e "\n${YELLOW}--- INJECTION ROOM APIs ---${NC}"

R=$(curl -s "$API/injection-room" -H "Authorization: Bearer $T_NURSE")
check "$(echo $R | grep -c '"success":true')" "Injection Room" "$(echo $R | head -c 80)"

R=$(curl -s "$API/injection-room/history" -H "Authorization: Bearer $T_NURSE")
check "$(echo $R | grep -c '"success":true')" "Injection History" "$(echo $R | head -c 80)"

echo -e "\n${YELLOW}--- BILLING PAGE APIs ---${NC}"

R=$(curl -s "$API/billing/queue" -H "Authorization: Bearer $T_REC")
check "$(echo $R | grep -c '"success":true')" "Billing Queue" "$(echo $R | head -c 80)"

R=$(curl -s "$API/billing/fees" -H "Authorization: Bearer $T_REC")
check "$(echo $R | grep -c '"success":true')" "Billing Fees" "$(echo $R | head -c 80)"

echo -e "\n${YELLOW}--- MCH APIs ---${NC}"

R=$(curl -s "$API/mch/stats" -H "Authorization: Bearer $T_NURSE")
check "$(echo $R | grep -c '"success":true')" "MCH Stats" "$(echo $R | head -c 80)"

echo -e "\n${GREEN}✅ $PASS passed${NC} ${RED}❌ $FAIL failed${NC}"
[ $FAIL -eq 0 ] && echo -e "${GREEN}All frontend APIs working! Issue is browser cache. Try Ctrl+Shift+R or incognito.${NC}"
