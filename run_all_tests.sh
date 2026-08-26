#!/bin/bash
cd ~/pharmacy-pos

tests=(
  "test_system.sh"
  "test_reception_workflow.sh"
  "test_full_flow.sh"
  "test_full_system.sh"
  "test_mch.sh"
  "test_frontend_apis.sh"
  "test_frontend_integration.sh"
  "test_full.sh"
)

for test in "${tests[@]}"; do
  if [ -f "$test" ]; then
    echo "========================================="
    echo "  RUNNING: $test"
    echo "========================================="
    timeout 60 bash "$test" 2>&1 | tail -20
    exit_code=$?
    echo ""
    echo "  EXIT CODE: $exit_code"
    if [ $exit_code -eq 0 ]; then
      echo "  ✅ PASSED"
    else
      echo "  ❌ FAILED (or timed out)"
    fi
    echo ""
  else
    echo "⚠️  $test not found, skipping..."
  fi
done

echo "========================================="
echo "  ALL TESTS COMPLETE"
echo "========================================="
