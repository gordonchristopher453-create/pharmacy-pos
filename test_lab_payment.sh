#!/bin/bash
BASE="http://localhost:5000/api"
PASS=0; FAIL=0

echo "🔹 Getting tokens..."
ABBY_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"email":"abby@gmail.com","password":"Abby1234"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")
DYLAN_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"email":"dylan@gmail.com","password":"Dylan1234"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")
OLIVER_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"email":"oliver@gmail.com","password":"Oliver1234"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")

echo ""
echo "🔹 ═══ STEP 1: Register patient & visit"
PATIENT_ID=$(curl -s -X POST $BASE/patients -H "Content-Type: application/json" -H "Authorization: Bearer $DYLAN_TOKEN" -d '{"full_name":"Lab Pay Test","phone":"0700000099","gender":"male","date_of_birth":"1990-01-01"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "   Patient: $PATIENT_ID"
VISIT_ID=$(curl -s -X POST $BASE/patients/$PATIENT_ID/visits -H "Content-Type: application/json" -H "Authorization: Bearer $DYLAN_TOKEN" -d '{"visit_type":"routine","priority":"normal"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "   Visit: $VISIT_ID"

echo ""
echo "🔹 ═══ STEP 2: Doctor creates consultation with lab request"
curl -s -X POST $BASE/consultations -H "Content-Type: application/json" -H "Authorization: Bearer $OLIVER_TOKEN" \
  -d "{\"visit_id\":\"$VISIT_ID\",\"patient_id\":\"$PATIENT_ID\",\"diagnosis\":\"Malaria\",\"icd_code\":\"B54\",\"presenting_complaint\":\"Fever\",\"lab_requests\":[{\"test_name\":\"Malaria RDT\",\"test_code\":\"32700-7\",\"urgency\":\"routine\"}]}" > /dev/null
# Fetch lab ID separately
LAB_ID=$(curl -s "$BASE/lab-requests?visit_id=$VISIT_ID&limit=1" -H "Authorization: Bearer $ABBY_TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['requests'][0]['id'] if d.get('data') and d['data'].get('requests') else 'none')" 2>/dev/null)
echo "   Lab request: $LAB_ID"

echo ""
echo "🔹 ═══ STEP 3: Lab tech tries WITHOUT payment (should block)"
R=$(curl -s -X PUT $BASE/lab-requests/$LAB_ID/result -H "Content-Type: application/json" -H "Authorization: Bearer $ABBY_TOKEN" -d '{"result":"Negative","result_flag":"normal"}')
MSG=$(echo $R | python3 -c "import sys,json; print(json.load(sys.stdin)['message'])")
if echo "$MSG" | grep -qi "unpaid\|bill\|pay"; then
  echo "   ✅ PASS: Blocked — $MSG"; PASS=$((PASS+1))
else
  echo "   ❌ FAIL: Not blocked — $MSG"; FAIL=$((FAIL+1))
fi

echo ""
echo "🔹 ═══ STEP 4: Pay the bill"
ITEM_IDS=$(curl -s "$BASE/billing?visit_id=$VISIT_ID" -H "Authorization: Bearer $DYLAN_TOKEN" | python3 -c "import sys,json; [print(i['id']) for i in json.load(sys.stdin).get('data',[])]" 2>/dev/null)
for ITEM_ID in $ITEM_IDS; do
  curl -s -X PUT $BASE/billing/items/$ITEM_ID/pay -H "Content-Type: application/json" -H "Authorization: Bearer $DYLAN_TOKEN" -d '{"payment_method":"cash"}' > /dev/null
  echo "   Paid: $ITEM_ID"
done

echo ""
echo "🔹 ═══ STEP 5: Lab tech submits AFTER payment (should pass)"
R2=$(curl -s -X PUT $BASE/lab-requests/$LAB_ID/result -H "Content-Type: application/json" -H "Authorization: Bearer $ABBY_TOKEN" -d '{"result":"Negative","result_flag":"normal","technician_notes":"No parasites seen"}')
MSG2=$(echo $R2 | python3 -c "import sys,json; print(json.load(sys.stdin)['message'])")
if echo "$MSG2" | grep -qi "entered\|success"; then
  echo "   ✅ PASS: Results submitted — $MSG2"; PASS=$((PASS+1))
else
  echo "   ❌ FAIL: $MSG2"; FAIL=$((FAIL+1))
fi

echo ""
echo "══════════════════════════════════════════"
echo "  RESULTS: ✅ $PASS passed  ❌ $FAIL failed"
echo "══════════════════════════════════════════"
