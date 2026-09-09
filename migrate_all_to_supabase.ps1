# ==============================================================================
# Google Sheets 180개 탭 전체 데이터 일괄 추출 및 Supabase DB 백업/이관 스크립트
# ==============================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Net.Http
Add-Type -AssemblyName Microsoft.VisualBasic

$spreadsheetId = "1Q0fJ5gvo6hYv1kJdj1B0Rih_-qNeZ1ecl0NjO6z6_Pw"
$supabaseUrl = "https://gideypynmhpjucgszyce.supabase.co"
$supabaseAnonKey = "sb_publishable_pLF_neZMUjj3G7PsiH_tuw_rfRuu8eP"

$client = New-Object System.Net.Http.HttpClient
$client.Timeout = [TimeSpan]::FromSeconds(30)

Write-Host "1. 구글 스프레드시트 탭 목록 분석 중..." -ForegroundColor Cyan
$editUrl = "https://docs.google.com/spreadsheets/d/$spreadsheetId/edit"
$html = $client.GetStringAsync($editUrl).Result
$matches = [regex]::Matches($html, 'class="goog-inline-block docs-sheet-tab-caption">([^<]+)</div>')

$tabs = @()
foreach ($m in $matches) {
    $name = $m.Groups[1].Value.Trim()
    if ($name -match '^\d{2}\.\d{2}\.\d{2}') {
        $tabs += $name
    }
}
Write-Host "   총 $($tabs.Count)개의 날짜 탭 발견!" -ForegroundColor Green

# 2. 배치별 동시 다운로드 및 파싱
$allRecords = @()
$batchSize = 10
$totalTabs = $tabs.Count

Write-Host "2. 시트 데이터 다운로드 및 정규화 파싱 시작 (총 $totalTabs 개)..." -ForegroundColor Cyan

for ($i = 0; $i -lt $totalTabs; $i += $batchSize) {
    $endIdx = [Math]::Min($i + $batchSize - 1, $totalTabs - 1)
    $currBatch = $tabs[$i..$endIdx]
    
    $tasks = @()
    foreach ($tab in $currBatch) {
        $enc = [Uri]::EscapeDataString($tab)
        $url = "https://docs.google.com/spreadsheets/d/$spreadsheetId/gviz/tq?tqx=out:csv&sheet=$enc"
        $task = $client.GetStringAsync($url)
        $tasks += [PSCustomObject]@{ Tab = $tab; Task = $task }
    }

    [System.Threading.Tasks.Task]::WaitAll($tasks.Task)

    foreach ($item in $tasks) {
        $tab = $item.Tab
        $csv = $item.Task.Result

        # parse date
        $deliveryDate = ""
        if ($tab -match '(\d{2})\.(\d{2})\.(\d{2})') {
            $deliveryDate = "20" + $matches[1] + "-" + $matches[2] + "-" + $matches[3]
        }
        $defaultDriver = ""
        if ($tab -match '\(([^)]+)\)') {
            $defaultDriver = $matches[1]
        }

        $reader = New-Object System.IO.StringReader($csv)
        $parser = New-Object Microsoft.VisualBasic.FileIO.TextFieldParser($reader)
        $parser.TextFieldType = [Microsoft.VisualBasic.FileIO.FieldType]::Delimited
        $parser.SetDelimiters(",")
        $parser.HasFieldsEnclosedInQuotes = $true

        $rows = @()
        while (-not $parser.EndOfData) {
            $rows += ,($parser.ReadFields())
        }
        $parser.Close()
        $reader.Close()

        if ($rows.Count -lt 2) { continue }

        # Find header row
        $headerIdx = -1
        for ($r = 0; $r -lt [Math]::Min(5, $rows.Count); $r++) {
            $rText = ($rows[$r] -join " ")
            $score = 0
            if ($rText -match "구분") { $score++ }
            if ($rText -match "업체명|고객명") { $score++ }
            if ($rText -match "주소") { $score++ }
            if ($rText -match "시간") { $score++ }
            if ($rText -match "비고") { $score++ }
            if ($score -ge 2) {
                $headerIdx = $r
                break
            }
        }

        if ($headerIdx -eq -1) { $headerIdx = 0 }

        $headerRow = $rows[$headerIdx]
        $colCust = -1; $colAddr = -1; $colAddrDet = -1; $colDriver = -1; $colCat = -1
        $colTime = -1; $colNotes = -1; $colCont = -1; $colDanpra = -1; $colCall = -1; $colFuture = -1
        $colStatus = -1; $colMethod = -1

        for ($c = 0; $c -lt $headerRow.Length; $c++) {
            $h = $headerRow[$c] -replace "\s+", ""
            if ($h -match "고객명|업체명") { $colCust = $c }
            elseif ($h -match "상세주소") { $colAddrDet = $c }
            elseif ($h -match "주소") { $colAddr = $c }
            elseif ($h -match "^이름$|기사") { $colDriver = $c }
            elseif ($h -match "구분") { $colCat = $c }
            elseif ($h -match "시간|고정") { $colTime = $c }
            elseif ($h -match "비고") { $colNotes = $c }
            elseif ($h -match "계약번호") { $colCont = $c }
            elseif ($h -match "단프라") { $colDanpra = $c }
            elseif ($h -match "통화") { $colCall = $c }
            elseif ($h -match "추후") { $colFuture = $c }
            elseif ($h -match "상태|의뢰상태") { $colStatus = $c }
            elseif ($h -match "배송방법|방법") { $colMethod = $c }
        }

        for ($r = $headerIdx + 1; $r -lt $rows.Count; $r++) {
            $row = $rows[$r]
            $cust = if ($colCust -ge 0 -and $colCust -lt $row.Length) { $row[$colCust].Trim() } else { "" }
            $addr = if ($colAddr -ge 0 -and $colAddr -lt $row.Length) { $row[$colAddr].Trim() } else { "" }
            
            if ([string]::IsNullOrWhiteSpace($cust) -and [string]::IsNullOrWhiteSpace($addr)) { continue }
            if ($cust -match "^(업체명|고객명|비고|순번|합계)$") { continue }
            if ($cust -match "^[★※■]") { continue }

            $addrDet = if ($colAddrDet -ge 0 -and $colAddrDet -lt $row.Length) { $row[$colAddrDet].Trim() } else { "" }
            $fullAddr = if ($addrDet) { "$addr $addrDet" } else { $addr }

            $driver = if ($colDriver -ge 0 -and $colDriver -lt $row.Length) { $row[$colDriver].Trim() } else { "" }
            if ([string]::IsNullOrWhiteSpace($driver) -and $defaultDriver) { $driver = $defaultDriver }

            $cat = if ($colCat -ge 0 -and $colCat -lt $row.Length) { $row[$colCat].Trim() } else { "배송" }
            if ([string]::IsNullOrWhiteSpace($cat)) { $cat = "배송" }

            $vTime = if ($colTime -ge 0 -and $colTime -lt $row.Length) { $row[$colTime].Trim() } else { "" }
            if ($colTime -ge 0 -and ($colTime + 1) -lt $row.Length) {
                $nextVal = $row[$colTime + 1].Trim()
                if ($nextVal.StartsWith(":")) {
                    $vTime = $vTime + $nextVal
                }
            }

            $notes = if ($colNotes -ge 0 -and $colNotes -lt $row.Length) { $row[$colNotes].Trim() } else { "" }
            $contNo = if ($colCont -ge 0 -and $colCont -lt $row.Length) { $row[$colCont].Trim() } else { "" }
            $danpra = if ($colDanpra -ge 0 -and $colDanpra -lt $row.Length) { $row[$colDanpra].Trim() } else { "" }
            $callSt = if ($colCall -ge 0 -and $colCall -lt $row.Length) { $row[$colCall].Trim() } else { "" }
            $future = if ($colFuture -ge 0 -and $colFuture -lt $row.Length) { $row[$colFuture].Trim() } else { "" }
            $status = if ($colStatus -ge 0 -and $colStatus -lt $row.Length) { $row[$colStatus].Trim() } else { "" }
            $method = if ($colMethod -ge 0 -and $colMethod -lt $row.Length) { $row[$colMethod].Trim() } else { "직배송" }

            if ([string]::IsNullOrWhiteSpace($status)) {
                if ($deliveryDate -lt "2026-09-09") {
                    $status = "배송완료"
                } else {
                    $status = "진행중"
                }
            }
            if ([string]::IsNullOrWhiteSpace($method)) { $method = "직배송" }

            # 비고에서 연락처 및 품목 추출
            $contact = ""
            $itemsList = @()
            if ($notes) {
                $nLines = $notes -split "`r?`n"
                foreach ($nl in $nLines) {
                    $trimL = $nl.Trim()
                    if (-not $trimL) { continue }
                    if ($trimL -match '(01[0-9]-?\d{3,4}-?\d{4})' -and -not $contact) {
                        $contact = $trimL
                    } else {
                        $itemsList += $trimL
                    }
                }
            }
            $items = $itemsList -join " / "

            $record = [ordered]@{
                delivery_date   = $deliveryDate
                contract_no     = $contNo
                category        = $cat
                driver_name     = $driver
                customer_name   = $cust
                address         = $fullAddr
                visit_time      = $vTime
                contact         = $contact
                items           = $items
                danpra_storage  = $danpra
                call_status     = $callSt
                status          = $status
                delivery_method = $method
                memo_special    = $future
                memo_full       = $notes
                source_sheet    = $tab
            }
            $allRecords += [PSCustomObject]$record
        }
    }
    Write-Host "   진행률: $($endIdx + 1) / $totalTabs 완료 (누적 $($allRecords.Count)건 추출됨)" -ForegroundColor Gray
}

Write-Host "`n3. 로컬 영구 백업 파일 저장 중..." -ForegroundColor Cyan
$jsonBackupPath = "c:\antigravity\배송스케줄관리\배송스케줄_전체백업_180시트.json"
$allRecords | ConvertTo-Json -Depth 5 | Set-Content -Path $jsonBackupPath -Encoding UTF8
$csvBackupPath = "c:\antigravity\배송스케줄관리\배송스케줄_전체백업_180시트.csv"
$allRecords | Export-Csv -Path $csvBackupPath -NoTypeInformation -Encoding UTF8
Write-Host "   로컬 백업 완료: $jsonBackupPath ($($allRecords.Count)건)" -ForegroundColor Green

# 4. Supabase DB 일괄 이관
Write-Host "`n4. Supabase DB (delivery_schedules) 이관 시작..." -ForegroundColor Cyan

# 기존 데이터 초기화 (전체 덮어쓰기 백업 갱신)
Write-Host "   기존 테스트 데이터 정리 중..." -ForegroundColor Gray
try {
    $delUrl = "$supabaseUrl/rest/v1/delivery_schedules?id=gt.0"
    $delReq = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Delete, $delUrl)
    $delReq.Headers.Add("apikey", $supabaseAnonKey)
    $delReq.Headers.Add("Authorization", "Bearer $supabaseAnonKey")
    $delRes = $client.SendAsync($delReq).Result
    Write-Host "   기존 데이터 초기화 완료: $($delRes.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "   기존 데이터 초기화 건너뜀: $_" -ForegroundColor Yellow
}

# 청크 단위 업로드 (100건씩)
$chunkSize = 100
$totalUpload = $allRecords.Count
$insertedCount = 0

for ($c = 0; $c -lt $totalUpload; $c += $chunkSize) {
    $cEnd = [Math]::Min($c + $chunkSize - 1, $totalUpload - 1)
    $chunk = $allRecords[$c..$cEnd]
    $jsonBody = $chunk | ConvertTo-Json -Depth 5

    $upUrl = "$supabaseUrl/rest/v1/delivery_schedules"
    $postReq = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Post, $upUrl)
    $postReq.Headers.Add("apikey", $supabaseAnonKey)
    $postReq.Headers.Add("Authorization", "Bearer $supabaseAnonKey")
    $postReq.Headers.Add("Prefer", "return=minimal")
    $postReq.Content = New-Object System.Net.Http.StringContent($jsonBody, [System.Text.Encoding]::UTF8, "application/json")

    $postRes = $client.SendAsync($postReq).Result
    if ($postRes.IsSuccessStatusCode) {
        $insertedCount += $chunk.Count
        Write-Host "   [$insertedCount / $totalUpload] Supabase 업로드 성공..." -ForegroundColor Gray
    } else {
        $errBody = $postRes.Content.ReadAsStringAsync().Result
        Write-Host "   ❌ 업로드 실패 ($($postRes.StatusCode)): $errBody" -ForegroundColor Red
    }
}

Write-Host "`n🎉 Supabase 마이그레이션 완료! 총 $insertedCount 건 적재됨." -ForegroundColor Green

# 5. 검증: Supabase 내 고유 날짜 및 총 건수 확인
$verifyUrl = "$supabaseUrl/rest/v1/delivery_schedules?select=delivery_date"
$vReq = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Get, $verifyUrl)
$vReq.Headers.Add("apikey", $supabaseAnonKey)
$vReq.Headers.Add("Authorization", "Bearer $supabaseAnonKey")
$vRes = $client.SendAsync($vReq).Result
$vJson = $vRes.Content.ReadAsStringAsync().Result | ConvertFrom-Json

$uDates = $vJson | Select-Object -ExpandProperty delivery_date -Unique
Write-Host "   검증된 총 레코드 수: $($vJson.Count) 건" -ForegroundColor Cyan
Write-Host "   등록된 고유 배송일자 수: $($uDates.Count) 일" -ForegroundColor Cyan
Write-Host "   최신 날짜 5개: $(($uDates | Sort-Object -Descending)[0..4] -join ', ')" -ForegroundColor Yellow

$client.Dispose()
