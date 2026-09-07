/**
 * ==============================================================================
 * [배송스케줄 원클릭 자동화 & 전 디바이스 웹 대시보드 연동 시스템]
 * ==============================================================================
 * 
 * [스프레드시트 3대 핵심 메뉴]
 * 1. [🌐 배송스케줄 웹 대시보드 열기]
 * 2. [🚀 CSV 업로드 → 다음 근무일 시트 자동 생성 및 반영]
 * 3. [⏰ 현재 시트 시간순 재정렬]
 * 
 * ※ 사용자 지침: 시트 양식(서식/헤더/열너비)은 절대 임의 변경하지 않으며,
 *    신규 시트 생성 시 이전 시트의 양식을 100% 그대로 복제하여 사용합니다.
 */

// ==============================================================================
// 1. 스프레드시트 메뉴 UI 등록 (3대 핵심 메뉴)
// ==============================================================================
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('📦 배송스케줄 관리')
    .addItem('🌐 배송스케줄 웹 대시보드 열기', 'openDashboardInChrome')
    .addSeparator()
    .addItem('🚀 CSV 업로드 → 다음 근무일 시트 자동 생성 및 반영', 'showCsvUploadDialog')
    .addSeparator()
    .addItem('⏰ 현재 시트 시간순 재정렬', 'sortCurrentSheetByTime')
    .addToUi();
}

function openDashboardDirectly() {
  openDashboardInChrome();
}

// ==============================================================================
// 2. 🌐 배송스케줄 웹 대시보드 열기 (원클릭 런처)
// ==============================================================================
function openDashboardInChrome() {
  var defaultUrl = 'https://script.google.com/macros/s/AKfycbyaCUxOK7Fbetl8xWBHjf_Cbuf8YRANSMlVWVyVfcBB2oX9Q8dsIr8qW8iXdduCZ7eP-w/exec';
  try {
    PropertiesService.getScriptProperties().setProperty('WEBAPP_URL', defaultUrl);
  } catch (e) {}

  var webAppUrl = defaultUrl;

  var html = '<!DOCTYPE html><html><head><base target="_blank">'
    + '<meta charset="UTF-8">'
    + '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">'
    + '<style>'
    + 'body { font-family: -apple-system, BlinkMacSystemFont, Pretendard, sans-serif; margin: 0; padding: 16px; background: #f8fafc; color: #1e293b; font-size: 12px; }'
    + '.card { background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); text-align: center; }'
    + '.icon-box { width: 46px; height: 46px; background: linear-gradient(135deg, #4f46e5, #6366f1); color: white; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; margin: 0 auto 10px auto; box-shadow: 0 4px 10px rgba(79, 70, 229, 0.25); }'
    + 'h2 { font-size: 15px; font-weight: 800; margin: 0 0 4px 0; color: #0f172a; }'
    + 'p { font-size: 11px; color: #64748b; margin: 0 0 14px 0; line-height: 1.4; }'
    + '.btn-main { display: flex; align-items: center; justify-content: center; gap: 8px; background: #4f46e5; color: white !important; text-decoration: none; padding: 11px 16px; border-radius: 10px; font-weight: bold; font-size: 13px; cursor: pointer; box-shadow: 0 3px 8px rgba(79, 70, 229, 0.3); margin-bottom: 12px; }'
    + '.btn-sub { display: flex; align-items: center; justify-content: center; gap: 6px; background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 7px 12px; border-radius: 8px; font-weight: 600; font-size: 11px; cursor: pointer; width: 100%; box-sizing: border-box; }'
    + '</style>'
    + '<script>'
    + 'var currentUrl = "' + webAppUrl + '";'
    + 'window.onload = function() {'
    + '  try { var win = window.open(currentUrl, "_blank"); if (win) { setTimeout(function() { google.script.host.close(); }, 800); } } catch(e) {}'
    + '};'
    + 'function handleOpenLink(e) {'
    + '  var win = window.open(currentUrl, "_blank");'
    + '  setTimeout(function() { google.script.host.close(); }, 1000);'
    + '}'
    + 'function copyWebUrl() {'
    + '  var inp = document.getElementById("urlDisplay");'
    + '  if (inp) { inp.select(); inp.setSelectionRange(0, 99999); }'
    + '  navigator.clipboard.writeText(currentUrl).then(function() { alert("대시보드 URL이 복사되었습니다!"); });'
    + '}'
    + '</script>'
    + '</head>'
    + '<body>'
    + '<div class="card">'
    + '<div class="icon-box"><i class="fa-solid fa-globe"></i></div>'
    + '<h2>배송스케줄 웹 대시보드</h2>'
    + '<p>새 창으로 공식 웹 관제 시스템이 열립니다.</p>'
    + '<a id="openLinkBtn" href="' + webAppUrl + '" target="_blank" class="btn-main" onclick="handleOpenLink(event)">'
    + '  <i class="fa-solid fa-arrow-up-right-from-square"></i> 🌐 새 창으로 웹 대시보드 열기'
    + '</a>'
    + '<div style="margin-bottom: 8px; text-align: left;">'
    + '  <div style="font-size: 10px; font-weight: bold; color: #64748b; margin-bottom: 3px;">🔗 등록된 접속 주소:</div>'
    + '  <input type="text" id="urlDisplay" value="' + webAppUrl + '" readonly '
    + '         style="width: 100%; box-sizing: border-box; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 11px; font-family: monospace; background: #f8fafc; color: #334155;"'
    + '         onclick="this.select();">'
    + '</div>'
    + '<button onclick="copyWebUrl()" class="btn-sub">'
    + '  <i class="fa-solid fa-copy"></i> 📋 대시보드 링크 복사 (기사 공유용)'
    + '</button>'
    + '</div>'
    + '</body></html>';

  var htmlOutput = HtmlService.createHtmlOutput(html).setWidth(400).setHeight(280);
  SpreadsheetApp.getUi().showModelessDialog(htmlOutput, '배송스케줄 웹 대시보드');
}

// ==============================================================================
// 3. 🚀 CSV 업로드 → 다음 근무일 시트 자동 생성 및 반영
// ==============================================================================
function isHolidayOrWeekend(date) {
  var day = date.getDay();
  if (day === 0 || day === 6) return true;
  var holidays = [
    "2026-01-01", "2026-02-16", "2026-02-17", "2026-02-18",
    "2026-03-01", "2026-03-02", "2026-05-05", "2026-05-24", "2026-05-25",
    "2026-06-06", "2026-08-15", "2026-08-17", "2026-09-24", "2026-09-25", "2026-09-26",
    "2026-10-03", "2026-10-09", "2026-12-25"
  ];
  var y = date.getFullYear();
  var m = String(date.getMonth() + 1).padStart(2, '0');
  var d = String(date.getDate()).padStart(2, '0');
  var dateStr = y + "-" + m + "-" + d;
  return holidays.indexOf(dateStr) !== -1;
}

function getNextBusinessDay(baseDate) {
  var next = new Date(baseDate.getTime());
  next.setDate(next.getDate() + 1);
  while (isHolidayOrWeekend(next)) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

function showCsvUploadDialog() {
  var html = '<!DOCTYPE html><html><head><base target="_top">'
    + '<style>'
    + 'body { font-family: -apple-system, BlinkMacSystemFont, Pretendard, sans-serif; padding: 20px; font-size: 13px; color: #1e293b; background: #f8fafc; }'
    + '.box { background: white; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 24px; text-align: center; cursor: pointer; }'
    + '.box:hover { border-color: #4f46e5; }'
    + '.btn { background: #4f46e5; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 14px; width: 100%; }'
    + '#status { margin-top: 12px; font-weight: bold; color: #4f46e5; display: none; }'
    + '</style>'
    + '<script>'
    + 'function uploadFile() {'
    + '  var fileInput = document.getElementById("csvFile");'
    + '  if (!fileInput.files.length) { alert("CSV 파일을 선택해주세요."); return; }'
    + '  var file = fileInput.files[0];'
    + '  var reader = new FileReader();'
    + '  document.getElementById("status").style.display = "block";'
    + '  document.getElementById("status").innerText = "처리 중입니다...";'
    + '  reader.onload = function(e) {'
    + '    google.script.run'
    + '      .withSuccessHandler(function(res) { alert(res); google.script.host.close(); })'
    + '      .withFailureHandler(function(err) { alert("오류 발생: " + err.message); document.getElementById("status").style.display = "none"; })'
    + '      .processDeliveryCsvAndCreateNextSheet(e.target.result);'
    + '  };'
    + '  reader.readAsText(file, "EUC-KR");'
    + '}'
    + '</script>'
    + '</head>'
    + '<body>'
    + '<h3 style="margin-top:0; color:#0f172a;">🚀 CSV 파일 업로드</h3>'
    + '<p style="color:#64748b; font-size:12px;">다운로드 받은 배송 의뢰 CSV 파일을 업로드하면 다음 근무일 시트가 자동 생성됩니다.</p>'
    + '<div class="box" onclick="document.getElementById(\'csvFile\').click()">'
    + '  <input type="file" id="csvFile" accept=".csv" style="display:none;" onchange="document.getElementById(\'fileName\').innerText = this.files[0].name;">'
    + '  <div id="fileName" style="font-weight:bold; color:#475569;">📁 클릭하여 CSV 파일 선택</div>'
    + '</div>'
    + '<button class="btn" onclick="uploadFile()">다음 근무일 시트 자동 생성</button>'
    + '<div id="status"></div>'
    + '</body>'
    + '</html>';

  var htmlOutput = HtmlService.createHtmlOutput(html).setWidth(440).setHeight(300);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '🚀 CSV 업로드 및 다음 근무일 시트 생성');
}

function getTimeSortWeight(timeStr) {
  if (!timeStr) return 9999;
  var s = String(timeStr).trim();
  var match = s.match(/(\d{1,2})\s*[:\.]?\s*(\d{0,2})/);
  if (!match) return 9999;
  var hour = parseInt(match[1], 10);
  var min = match[2] ? parseInt(match[2], 10) : 0;
  if (s.indexOf("오후") !== -1 && hour < 12) hour += 12;
  if (s.indexOf("오전") !== -1 && hour === 12) hour = 0;
  return hour * 60 + min;
}

function getLaterScheduleInfo(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { values: [] };
  var kRange = sheet.getRange(2, 11, lastRow - 1, 1);
  var kValues = kRange.getValues().map(function(r) { return r[0]; }).filter(function(v) { return v !== ""; });
  return { values: kValues };
}

function processDeliveryCsvAndCreateNextSheet(csvContent) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var currentSheet = ss.getActiveSheet();
  var currentSheetName = currentSheet.getName();

  var lines = csvContent.split(/\r\n|\n/);
  if (lines.length < 2) throw new Error("CSV 파일의 데이터가 부족합니다.");

  var dateMatch = currentSheetName.match(/(\d{2})\.(\d{2})\.(\d{2})/);
  var baseDate = new Date();
  if (dateMatch) {
    var yr = 2000 + parseInt(dateMatch[1], 10);
    var mo = parseInt(dateMatch[2], 10) - 1;
    var dy = parseInt(dateMatch[3], 10);
    baseDate = new Date(yr, mo, dy);
  }

  var nextDate = getNextBusinessDay(baseDate);
  var nextSheetName = String(nextDate.getFullYear()).slice(-2) + '.' + String(nextDate.getMonth() + 1).padStart(2, '0') + '.' + String(nextDate.getDate()).padStart(2, '0');

  var targetSheet = ss.getSheetByName(nextSheetName);
  var isCreated = false;
  if (!targetSheet) {
    // 💡 사용자 원칙: 이전 시트의 서식(헤더, 열너비, 폰트, 색상, 테두리)을 100% 그대로 복제!
    targetSheet = currentSheet.copyTo(ss);
    targetSheet.setName(nextSheetName);
    ss.setActiveSheet(targetSheet);
    ss.moveActiveSheet(ss.getSheets().length);
    isCreated = true;
    if (targetSheet.getMaxRows() > 1) {
      targetSheet.getRange(2, 1, targetSheet.getMaxRows() - 1, targetSheet.getMaxColumns()).clearContent();
    }
  } else {
    // 기존 시트가 이미 존재할 때도 내용만 비움 (서식 보존)
    if (targetSheet.getMaxRows() > 1) {
      targetSheet.getRange(2, 1, targetSheet.getMaxRows() - 1, targetSheet.getMaxColumns()).clearContent();
    }
  }

  var laterScheduleInfo = getLaterScheduleInfo(currentSheet);

  function parseCsvLine(text) {
    var result = [];
    var cur = '';
    var inQuotes = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (c === '"') {
        if (inQuotes && text[i+1] === '"') { cur += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (c === ',' && !inQuotes) {
        result.push(cur);
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur);
    return result;
  }

  var rows = [];
  var headerCols = parseCsvLine(lines[0]);
  var contractIdx = -1, typeIdx = -1, custIdx = -1, addrIdx = -1, detailAddrIdx = -1, timeIdx = -1, itemIdx = -1, qtyIdx = -1, noteIdx = -1;

  for (var c = 0; c < headerCols.length; c++) {
    var h = headerCols[c].trim();
    if (h === "구분") typeIdx = c;
    else if (typeIdx === -1 && h.indexOf("구분") !== -1 && h.indexOf("본부") === -1 && h.indexOf("부서") === -1) typeIdx = c;
    else if (h === "계약번호" || (contractIdx === -1 && h.indexOf("계약") !== -1)) contractIdx = c;
    else if (h.indexOf("고객") !== -1 || h.indexOf("상호") !== -1 || h.indexOf("업체") !== -1) custIdx = c;
    else if (h.indexOf("상세") !== -1) detailAddrIdx = c;
    else if (h.indexOf("주소") !== -1 && addrIdx === -1) addrIdx = c;
    else if (h.indexOf("시간") !== -1) timeIdx = c;
    else if (h.indexOf("품목") !== -1 || h.indexOf("모델") !== -1 || h.indexOf("제품명") !== -1) itemIdx = c;
    else if (h.indexOf("수량") !== -1) qtyIdx = c;
    else if (h === "비고" || (noteIdx === -1 && h.indexOf("비고") !== -1)) noteIdx = c;
  }

  for (var i = 1; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    var cols = parseCsvLine(line);
    if (cols.length < 3) continue;

    var contractNo = contractIdx !== -1 ? (cols[contractIdx] || '').trim() : (cols[0] || '').trim();
    var rawType = typeIdx !== -1 ? (cols[typeIdx] || '배송').trim() : '배송';

    // 구글 시트 데이터 유효성 검사 규칙 (설치, 회수, 배송, A/S, 수령, 방문, 반납) 완벽 준수
    var typeVal = '배송';
    if (rawType.indexOf('회수') !== -1) typeVal = '회수';
    else if (rawType.indexOf('설치') !== -1) typeVal = '설치';
    else if (rawType.indexOf('A/S') !== -1 || rawType.indexOf('AS') !== -1 || rawType.indexOf('수리') !== -1) typeVal = 'A/S';
    else if (rawType.indexOf('수령') !== -1) typeVal = '수령';
    else if (rawType.indexOf('방문') !== -1) typeVal = '방문';
    else if (rawType.indexOf('반납') !== -1) typeVal = '반납';
    else if (rawType.indexOf('배송') !== -1) typeVal = '배송';
    else typeVal = '배송';

    var custVal = custIdx !== -1 ? (cols[custIdx] || '').trim() : (cols[4] || '').trim();
    var addrVal = addrIdx !== -1 ? (cols[addrIdx] || '').trim() : (cols[5] || '').trim();
    var detailAddrVal = detailAddrIdx !== -1 ? (cols[detailAddrIdx] || '').trim() : (cols[6] || '').trim();
    var timeVal = timeIdx !== -1 ? (cols[timeIdx] || '').trim() : '';
    var itemVal = itemIdx !== -1 ? (cols[itemIdx] || '').trim() : '';
    var qtyVal = qtyIdx !== -1 ? (cols[qtyIdx] || '').trim() : '1';
    var csvNoteVal = noteIdx !== -1 ? (cols[noteIdx] || '').trim() : '';

    if (!custVal && !addrVal) continue;

    var fullNote = '';
    if (itemVal) {
      fullNote = (itemVal + (qtyVal ? ' ' + qtyVal + '대' : '')).trim();
    }
    if (csvNoteVal) {
      fullNote = fullNote ? (fullNote + '\n' + csvNoteVal) : csvNoteVal;
    }

    rows.push({
      contractNo: contractNo,
      danpra: '',
      type: typeVal,
      driver: '',
      cust: custVal,
      addr: addrVal,
      detailAddr: detailAddrVal,
      time: timeVal,
      note: fullNote,
      call: '',
      sortWeight: getTimeSortWeight(timeVal)
    });
  }

  rows.sort(function(a, b) { return a.sortWeight - b.sortWeight; });

  if (rows.length > 0) {
    var dataMatrix = rows.map(function(item) {
      return [
        item.contractNo,
        item.danpra,
        item.type,
        item.driver,
        item.cust,
        item.addr,
        item.detailAddr,
        item.time,
        item.note,
        item.call
      ];
    });
    targetSheet.getRange(2, 1, dataMatrix.length, 10).setValues(dataMatrix);
  }

  if (laterScheduleInfo.values.length > 0) {
    var kData = laterScheduleInfo.values.map(function(v) { return [v]; });
    targetSheet.getRange(2, 11, kData.length, 1).setValues(kData);
  }

  var dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  var dayName = dayNames[nextDate.getDay()];
  var actName = isCreated ? "신규 복제 생성" : "기존 시트 갱신";

  return "✅ '" + nextSheetName + "(" + dayName + ")' 시트가 " + actName + "되었습니다!\n• 총 " + rows.length + "건 이전 양식 100% 보존 반영 완료\n• K열 추후 일정 " + laterScheduleInfo.values.length + "건 보존 완료";
}

// ==============================================================================
// 4. ⏰ 현재 시트 시간순 재정렬
// ==============================================================================
function sortCurrentSheetByTime() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 3) return;

  var dataRange = sheet.getRange(2, 1, lastRow - 1, 10);
  var vals = dataRange.getValues();

  vals.sort(function(a, b) {
    var tA = getTimeSortWeight(a[7]);
    var tB = getTimeSortWeight(b[7]);
    return tA - tB;
  });

  dataRange.setValues(vals);
  SpreadsheetApp.getActiveSpreadsheet().toast('시간 순서대로 정렬되었습니다.', '완료', 3);
}

// ==============================================================================
// 5. 🌐 웹 브라우저 정식 대시보드 서빙 & 실시간 시트 업데이트 API (doGet)
// ==============================================================================
function doGet(e) {
  // 🚀 대시보드에서 담당 기사 즉시 시트 반영 요청 처리 (JSONP API)
  if (e && e.parameter && e.parameter.action === 'updateDriver') {
    var callback = e.parameter.callback || 'onDriverUpdateResponse';
    var p = e.parameter;
    var res = updateDriverInSheet(p.sheetDate, p.contractNo, p.cust, p.driver);
    return ContentService.createTextOutput(callback + '(' + JSON.stringify(res) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  var html = getDashboardHtml();
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheets = ss.getSheets().map(function(s) { return s.getName(); });
    var dateSheets = sheets.filter(function(name) { return /^\d{2}\.\d{2}\.\d{2}/.test(name); }).sort().reverse();
    if (dateSheets.length > 0) {
      html = html.replace('/*__AVAILABLE_SHEETS__*/[]', JSON.stringify(dateSheets));
    }
  } catch (err) {}

  return HtmlService.createHtmlOutput(html)
    .setTitle('배송스케줄 통합 관제 대시보드')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

/**
 * 🚗 대시보드에서 전송한 담당기사 이름을 구글 스프레드시트(스케줄표) D열에 즉시 반영
 */
function updateDriverInSheet(sheetDate, contractNo, cust, driver) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = null;
    if (sheetDate) {
      sheet = ss.getSheetByName(sheetDate);
    }
    if (!sheet) {
      sheet = ss.getActiveSheet();
    }
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: false, message: '시트에 배송 데이터가 없습니다.' };

    var data = sheet.getRange(2, 1, lastRow - 1, 10).getValues();
    var updatedCount = 0;
    var targetDriver = (driver || '').trim();

    for (var i = 0; i < data.length; i++) {
      var rowContract = String(data[i][0] || '').trim(); // Col A (계약번호)
      var rowCust = String(data[i][4] || '').trim();     // Col E (고객사명)

      var isMatch = false;
      if (contractNo && rowContract && rowContract === String(contractNo).trim()) {
        isMatch = true;
      } else if (cust && rowCust && (rowCust === cust || rowCust.indexOf(cust) !== -1 || cust.indexOf(rowCust) !== -1)) {
        isMatch = true;
      }

      if (isMatch) {
        sheet.getRange(i + 2, 4).setValue(targetDriver); // Col D: 담당기사
        updatedCount++;
      }
    }

    return {
      success: true,
      count: updatedCount,
      driver: targetDriver,
      sheetName: sheet.getName()
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
}