import urllib.request
import urllib.parse
import json
import os
import sys
import datetime

sys.stdout.reconfigure(encoding='utf-8')

SUPABASE_URL = "https://gideypynmhpjucgszyce.supabase.co"
SUPABASE_KEY = "sb_publishable_pLF_neZMUjj3G7PsiH_tuw_rfRuu8eP"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

def fetch_all_records():
    """Fetch all rows from delivery_schedules with pagination support"""
    all_rows = []
    page_size = 1000
    offset = 0

    while True:
        req_headers = HEADERS.copy()
        req_headers["Range"] = f"{offset}-{offset + page_size - 1}"
        req_headers["Prefer"] = "count=exact"
        
        url = f"{SUPABASE_URL}/rest/v1/delivery_schedules?select=*&order=id.asc"
        req = urllib.request.Request(url, headers=req_headers)
        
        try:
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                if not data:
                    break
                all_rows.extend(data)
                if len(data) < page_size:
                    break
                offset += page_size
        except Exception as e:
            print(f"Error fetching page at offset {offset}: {e}")
            break

    return all_rows

def backup(output_dir="c:/antigravity/배송스케줄관리/backups"):
    os.makedirs(output_dir, exist_ok=True)
    now_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    file_path = os.path.join(output_dir, f"db_snapshot_{now_str}.json")

    print(f"[{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Supabase 전체 데이터 백업 시작...")
    rows = fetch_all_records()
    print(f"  ▶ 총 수집 레코드: {len(rows):,}건")

    # Group summary by source_sheet
    summary = {}
    for r in rows:
        src = r.get("source_sheet") or "UNKNOWN"
        summary[src] = summary.get(src, 0) + 1

    print("  ▶ 소스 시트별 레코드 집계:")
    for src, count in sorted(summary.items(), key=lambda x: x[1], reverse=True):
        print(f"     - {src}: {count:,}건")

    with open(file_path, "w", encoding="utf-8") as f:
        json.dump({
            "timestamp": datetime.datetime.now().isoformat(),
            "total_count": len(rows),
            "summary": summary,
            "records": rows
        }, f, ensure_ascii=False, indent=2)

    file_size_kb = round(os.path.getsize(file_path) / 1024, 1)
    print(f"✅ 백업 완료! 저장 경로: {file_path} ({file_size_kb} KB)")
    return file_path

def restore(snapshot_file):
    if not os.path.exists(snapshot_file):
        print(f"❌ 파일을 찾을 수 없습니다: {snapshot_file}")
        return False

    print(f"⚠️ 복원 착수: {snapshot_file}")
    with open(snapshot_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    records = data.get("records", [])
    print(f"  ▶ 복원 대상 레코드 수: {len(records):,}건")
    confirm = input("정말로 Supabase DB를 이 스냅샷으로 덮어쓰시겠습니까? (yes/no): ")
    if confirm.strip().lower() != "yes":
        print("복원 취소됨.")
        return False

    # Batch upsert
    batch_size = 100
    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        body = json.dumps(batch).encode('utf-8')
        req = urllib.request.Request(
            f"{SUPABASE_URL}/rest/v1/delivery_schedules",
            data=body,
            headers={**HEADERS, "Prefer": "resolution=merge-duplicates"},
            method="POST"
        )
        with urllib.request.urlopen(req) as resp:
            pass
        print(f"  ▶ {i + len(batch)} / {len(records)} 복원 진행 중...")

    print("✅ 복원 완료!")
    return True

if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "--restore":
        restore(sys.argv[2])
    else:
        backup()
