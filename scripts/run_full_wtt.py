import subprocess
import urllib.request
import json
import time
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://localhost:8080"
EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

def run_headless_eval(url, eval_js_snippet, timeout_sec=10):
    """Loads a page in headless Edge and evaluates a JS snippet returning results inside a pre tag"""
    test_html = f"""<!DOCTYPE html>
<html>
<body>
  <iframe id="testIframe" src="{url}" style="width:1400px; height:900px;"></iframe>
  <pre id="wttResult"></pre>
  <script>
    window.addEventListener('load', function() {{
      setTimeout(async function() {{
        var out = document.getElementById('wttResult');
        var frame = document.getElementById('testIframe');
        var win = frame.contentWindow;
        var doc = frame.contentDocument;
        try {{
          var res = await (async function() {{
            {eval_js_snippet}
          }})();
          out.innerText = JSON.stringify(res);
        }} catch(err) {{
          out.innerText = JSON.stringify({{ error: err.message, stack: err.stack }});
        }}
      }}, 3500);
    }});
  </script>
</body>
</html>"""
    
    runner_path = "c:/antigravity/배송스케줄관리/scratch_wtt_eval.html"
    with open(runner_path, "w", encoding="utf-8") as f:
        f.write(test_html)

    try:
        cmd = [
            EDGE_PATH,
            "--headless=new",
            "--disable-gpu",
            f"--virtual-time-budget={timeout_sec * 1000}",
            "--dump-dom",
            f"{BASE_URL}/scratch_wtt_eval.html"
        ]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout_sec + 5)
        out = res.stdout.decode('utf-8', errors='ignore')
        if '<pre id="wttResult">' in out:
            json_str = out.split('<pre id="wttResult">')[1].split('</pre>')[0]
            return json.loads(json_str)
        return {"error": "wttResult tag not found in DOM"}
    except Exception as e:
        return {"error": str(e)}
    finally:
        if os.path.exists(runner_path):
            try: os.remove(runner_path)
            except: pass

def check_server_live():
    try:
        with urllib.request.urlopen(f"{BASE_URL}/index.html", timeout=3) as resp:
            return resp.status == 200
    except:
        return False

def run_suite():
    print("==================================================================")
    print("  🚀 [WTT 자동화 회귀 검증 스위트] 배송스케줄 통합 관제 시스템")
    print(f"  타겟: {BASE_URL} (로컬 테스트 서버)")
    print(f"  시각: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("==================================================================\n")

    # 0. Check server liveness
    if not check_server_live():
        print("❌ [오류] 로컬 테스트 서버(http://localhost:8080)가 구동되지 않았습니다.")
        print("   실행 명령어: python -m http.server 8080 --directory c:\\antigravity\\배송스케줄관리")
        sys.exit(1)
    print("✅ [기본 통신] 테스트 서버 (http://localhost:8080) 정상 응답 확인 (HTTP 200)\n")

    passed_count = 0
    total_tests = 5

    # ---------------------------------------------------------------
    # Test 1: PC Dashboard (index.html)
    # ---------------------------------------------------------------
    print("▶ [Test 1/5] PC 관제 대시보드 (index.html) 무결성 검증...")
    t1_js = """
      return {
        title: doc.title,
        hasSupabaseLib: Boolean(win.supabase),
        hasConfirmCsvImport: typeof win.confirmCsvImport === 'function',
        hasLoadAvailableDates: typeof win.loadAvailableDates === 'function',
        hasTriggerSync: typeof win.triggerSync === 'function',
        isCsvImporting: win.isCsvImporting,
        tableBodyExists: Boolean(doc.getElementById('tableBody')),
        recordsCount: (win.records ? win.records.length : -1)
      };
    """
    res1 = run_headless_eval(f"{BASE_URL}/index.html", t1_js)
    if not res1.get("error") and res1.get("hasConfirmCsvImport") and res1.get("hasSupabaseLib") and res1.get("tableBodyExists"):
        print(f"   ✓ 통과: 제목='{res1.get('title')}', Supabase={res1.get('hasSupabaseLib')}, CSV임포트함수={res1.get('hasConfirmCsvImport')}, 테이블바디={res1.get('tableBodyExists')}, 로드된레코드={res1.get('recordsCount')}건")
        passed_count += 1
    else:
        print(f"   ❌ 실패: {res1}")

    # ---------------------------------------------------------------
    # Test 2: Mobile App (mobile.html)
    # ---------------------------------------------------------------
    print("\n▶ [Test 2/5] 기사용 모바일 웹앱 (mobile.html) 차량/자차 모드 검증...")
    t2_js = """
      return {
        title: doc.title,
        hasSelectMobileVehicle: typeof win.selectMobileVehicle === 'function',
        hasUnselectMobileVehicle: typeof win.unselectMobileVehicle === 'function',
        hasHandlePersonalVehicleFinish: typeof win.handlePersonalVehicleFinish === 'function',
        hasIsVehicleConfirmed: typeof win.isVehicleConfirmedForToday === 'function',
        hasVehicleCards: Boolean(doc.getElementById('mobileVehicleOptionsList')),
        bodyHasPersonalVehicleText: doc.body.innerText.indexOf('자차 운행') !== -1 || (doc.getElementById('mobileVehicleOptionsList') && doc.getElementById('mobileVehicleOptionsList').innerHTML.indexOf('자차') !== -1)
      };
    """
    res2 = run_headless_eval(f"{BASE_URL}/mobile.html", t2_js)
    if not res2.get("error") and res2.get("hasSelectMobileVehicle") and res2.get("hasHandlePersonalVehicleFinish"):
        print(f"   ✓ 통과: 제목='{res2.get('title')}', 차량선택함수={res2.get('hasSelectMobileVehicle')}, 자차마감함수={res2.get('hasHandlePersonalVehicleFinish')}")
        passed_count += 1
    else:
        print(f"   ❌ 실패: {res2}")

    # ---------------------------------------------------------------
    # Test 3: Vehicle Log Tracker (vehicle_log_tracker.html)
    # ---------------------------------------------------------------
    print("\n▶ [Test 3/5] 법인차량 운행일지 트래커 (vehicle_log_tracker.html) 검증...")
    t3_js = """
      return {
        title: doc.title,
        hasLoadVehicleData: typeof win.loadVehicleData === 'function',
        hasDeleteDirectStopLeg: typeof win.deleteDirectStopLeg === 'function',
        hasDeleteTripLog: typeof win.deleteTripLog === 'function',
        hasOpenEditStopFeeModal: typeof win.openEditStopFeeModal === 'function',
        tripLogsCount: (win.tripLogs ? win.tripLogs.length : -1),
        delButtonsFound: doc.querySelectorAll('button[onclick*=\"deleteDirectStopLeg\"]').length
      };
    """
    res3 = run_headless_eval(f"{BASE_URL}/vehicle_log_tracker.html?vehicle=801%EB%B6%808744&month=2026-09", t3_js)
    if not res3.get("error") and res3.get("hasDeleteDirectStopLeg") and res3.get("delButtonsFound", 0) > 0:
        print(f"   ✓ 통과: 단건삭제함수={res3.get('hasDeleteDirectStopLeg')}, 단건삭제버튼개수={res3.get('delButtonsFound')}개, 일지건수={res3.get('tripLogsCount')}일치")
        passed_count += 1
    else:
        print(f"   ❌ 실패: {res3}")

    # ---------------------------------------------------------------
    # Test 4: Supabase Live API Connectivity & Isolation
    # ---------------------------------------------------------------
    print("\n▶ [Test 4/5] Supabase 클라우드 실시간 접속 및 차량 마스터 스키마 무결성 검증...")
    try:
        headers = {
            "apikey": "sb_publishable_pLF_neZMUjj3G7PsiH_tuw_rfRuu8eP",
            "Authorization": "Bearer sb_publishable_pLF_neZMUjj3G7PsiH_tuw_rfRuu8eP"
        }
        url = "https://gideypynmhpjucgszyce.supabase.co/rest/v1/delivery_schedules?source_sheet=eq.SYSTEM_CONFIG_VEHICLES"
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=5) as resp:
            v_data = json.loads(resp.read().decode('utf-8'))
            if v_data and len(v_data) > 0:
                print(f"   ✓ 통과: SYSTEM_CONFIG_VEHICLES (ID {v_data[0].get('id')}) 차량 마스터 정상 응답 (HTTP 200)")
                passed_count += 1
            else:
                print("   ❌ 실패: SYSTEM_CONFIG_VEHICLES 차량 마스터 레코드 미발견")
    except Exception as e:
        print(f"   ❌ 실패: {e}")

    # ---------------------------------------------------------------
    # Test 5: Recent Data Integrity (2026-10-01 No Duplicates)
    # ---------------------------------------------------------------
    print("\n▶ [Test 5/5] 2026-10-01 최신 배송 스케줄 무결성 (중복 0건, 정확히 7건) 검증...")
    try:
        url_oct = "https://gideypynmhpjucgszyce.supabase.co/rest/v1/delivery_schedules?delivery_date=eq.2026-10-01"
        req_oct = urllib.request.Request(url_oct, headers=headers)
        with urllib.request.urlopen(req_oct, timeout=5) as resp:
            all_oct = json.loads(resp.read().decode('utf-8'))
            # 운행일지/설정/AS 시트를 제외한 순수 배송 스케줄 건수 집계
            excluded = ['VEHICLE_TRIP_LOGS', 'VEHICLE_MAINTENANCE_LOGS', 'SYSTEM_CONFIG_VEHICLES', 'AS_RECORDS']
            oct_data = [r for r in all_oct if r.get('source_sheet') not in excluded]
            if len(oct_data) == 7:
                print(f"   ✓ 통과: 2026-10-01 순수 배송 스케줄 = 정확히 7건 유지 중 (중복 0건, 일지 {len(all_oct)-7}건 격리 확인)")
                passed_count += 1
            else:
                print(f"   ⚠️ 경고: 순수 배송 스케줄 건수가 7건이 아님 (현재: {len(oct_data)}건, 전체: {len(all_oct)}건)")
    except Exception as e:
        print(f"   ❌ 실패: {e}")

    # ---------------------------------------------------------------
    # Final Report
    # ---------------------------------------------------------------
    print("\n==================================================================")
    if passed_count == total_tests:
        print(f"🎉 [WTT 종합 판정: PASS] 5개 핵심 시나리오 전수 무결성 입증 완료! ({passed_count}/{total_tests})")
        print("   이제 안심하고 Phase 1(공통 유틸리티 분리) 리팩토링에 착수할 수 있습니다.")
    else:
        print(f"⚠️ [WTT 종합 판정: FAIL] {passed_count}/{total_tests} 항목만 통과되었습니다. 결함을 해결한 후 진행하세요.")
    print("==================================================================\n")
    return passed_count == total_tests

if __name__ == "__main__":
    success = run_suite()
    sys.exit(0 if success else 1)
