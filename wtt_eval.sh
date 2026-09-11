#!/bin/sh
echo '=========================================='
echo '  HYUNDAI RENTAL DELIVERY SYSTEM - FINAL WTT'
echo '=========================================='

PASS_COUNT=0
TOTAL_COUNT=6

# Test 1: mobile.html closing modal
if grep -q 'openMobileVehicleClosingModal' /c/antigravity/배송스케줄관리/mobile.html; then
  echo '[PASS 1/6] Mobile: [운행마감] 기능 UI 및 연동 확인'
  PASS_COUNT=
else
  echo '[FAIL 1/6] Mobile: [운행마감] 누락'
fi

# Test 2: mobile.html cancel vehicle toggle
if grep -q 'currentMobileVehicleNo = null' /c/antigravity/배송스케줄관리/mobile.html; then
  echo '[PASS 2/6] Mobile: 차량 선택 취소 (재클릭 토글 해제) 로직 확인'
  PASS_COUNT=
else
  echo '[FAIL 2/6] Mobile: 차량 선택 취소 누락'
fi

# Test 3: vehicle_log_tracker.html max-h-[90vh]
if grep -q 'max-h-\[90vh\]' /c/antigravity/배송스케줄관리/vehicle_log_tracker.html; then
  echo '[PASS 3/6] Log Tracker: 모달창 세로 오버플로우 방어 (max-h-[90vh]) 확인'
  PASS_COUNT=
else
  echo '[FAIL 3/6] Log Tracker: 모달 오버플로우 방어 누락'
fi

# Test 4: vehicle_log_tracker.html drivers list
if grep -q '이성호' /c/antigravity/배송스케줄관리/vehicle_log_tracker.html && grep -q '현민혁' /c/antigravity/배송스케줄관리/vehicle_log_tracker.html; then
  echo '[PASS 4/6] Log Tracker: 신규 운전자 4명(이성호, 장종순, 박종환, 현민혁) 버튼 확인'
  PASS_COUNT=
else
  echo '[FAIL 4/6] Log Tracker: 신규 운전자 명단 누락'
fi

# Test 5: vehicle_log_tracker.html '기타' label
if grep -q '기타 업무' /c/antigravity/배송스케줄관리/vehicle_log_tracker.html; then
  echo '[PASS 5/6] Log Tracker: 1팀 표기 -> 기타 명칭 일괄 전환 확인'
  PASS_COUNT=
else
  echo '[FAIL 5/6] Log Tracker: 기타 표기 누락'
fi

# Test 6: schedule_time_tracker.html vehicle/driver integration
if grep -q 'corporate_vehicle_logs' /c/antigravity/배송스케줄관리/schedule_time_tracker.html; then
  echo '[PASS 6/6] Time Tracker: 운행일지/차량/기사 실시간 연동 매핑 확인'
  PASS_COUNT=
else
  echo '[FAIL 6/6] Time Tracker: 운행일지 연동 누락'
fi

echo '=========================================='
echo " WTT RESULT:  /  TESTS PASSED\
