/**
 * Google Apps Script: 배송 스케줄 시트 전체를 단일 '통합DB' 시트로 자동 취합
 * 
 * [사용 방법]
 * 1. 구글 스프레드시트 상단 메뉴에서 [확장 프로그램] -> [Apps Script] 클릭
 * 2. 기존 코드를 모두 지우고 이 스크립트를 붙여넣기
 * 3. 상단 [저장(Ctrl+S)] 후 'onOpen' 또는 'consolidateDeliverySchedule' 실행
 * 4. 시트로 돌아가 새로고침(F5)하면 상단 메뉴에 [📦 배송관리] -> [통합DB 새로고침] 버튼이 생성됩니다.
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('📦 배송관리')
    .addItem('🔄 전체 시트 취합 (통합DB 갱신)', 'consolidateDeliverySchedule')
    .addToUi();
}

function consolidateDeliverySchedule() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  const targetSheetName = "통합DB";
  
  let targetSheet = ss.getSheetByName(targetSheetName);
  if (!targetSheet) {
    targetSheet = ss.insertSheet(targetSheetName, 0);
  } else {
    targetSheet.clear();
  }

  // 통합 헤더 정의
  const headers = [
    "ID", "배송일자", "계약번호", "구분", "담당기사", "고객사",
    "배송지주소", "방문시간", "담당자/연락처", "품목 및 수량",
    "단프라보관", "통화여부", "의뢰상태", "배송방법", "추후일정/특이사항",
    "비고(전문)", "출처시트"
  ];

  const consolidatedData = [headers];
  let seq = 1;

  // ERP 스케줄 참조 맵 구축 (스케줄 탭이 있을 경우)
  const erpMap = {};
  sheets.forEach(sheet => {
    const sName = sheet.getName();
    if (sName.indexOf("스케줄_") !== -1) {
      const vals = sheet.getDataRange().getValues();
      for (let r = 1; r < vals.length; r++) {
        const row = vals[r];
        const cNo = String(row[0] || "").trim();
        const cust = String(row[4] || "").trim();
        const status = String(row[10] || "").trim();
        const method = String(row[11] || "").trim();
        const addr = String(row[5] || "").trim();
        if (cust) {
          erpMap[cust] = { contractNo: cNo, status: status, method: method, address: addr };
        }
      }
    }
  });

  // 각 탭 순회 및 취합
  sheets.forEach(sheet => {
    const sheetName = sheet.getName();
    if (sheetName === targetSheetName) return;

    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return;

    // 배송일자 파싱 (탭 이름이 26.09.03 형태일 경우 2026-09-03 변환)
    let deliveryDate = sheetName;
    const dateMatch = sheetName.match(/^(\d{2})\.(\d{2})\.(\d{2})$/);
    if (dateMatch) {
      deliveryDate = "20" + dateMatch[1] + "-" + dateMatch[2] + "-" + dateMatch[3];
    } else if (sheetName.indexOf("스케줄_") !== -1) {
      return; // ERP 원본 탭은 개별 일자 데이터에 병합되었으므로 건너뜀 (필요시 활성화)
    }

    // 헤더 행 위치 찾기 (구분, 업체명, 고객명 등이 있는 행)
    let headerIdx = -1;
    for (let r = 0; r < Math.min(5, data.length); r++) {
      const rowStr = data[r].join(" ");
      if (rowStr.indexOf("구분") !== -1 || rowStr.indexOf("업체명") !== -1 || rowStr.indexOf("고객명") !== -1) {
        headerIdx = r;
        break;
      }
    }

    if (headerIdx === -1) headerIdx = 0;

    // 열 위치 탐색
    const headerRow = data[headerIdx].map(c => String(c).replace(/\s+/g, ''));
    const colMap = {
      contractNo: headerRow.findIndex(c => c.indexOf("계약번호") !== -1),
      danpra: headerRow.findIndex(c => c.indexOf("단프라") !== -1),
      type: headerRow.findIndex(c => c.indexOf("구분") !== -1),
      driver: headerRow.findIndex(c => c.indexOf("이름") !== -1),
      cust: headerRow.findIndex(c => c.indexOf("업체명") !== -1 || c.indexOf("고객명") !== -1),
      address: headerRow.findIndex(c => c.indexOf("주소") !== -1),
      time: headerRow.findIndex(c => c.indexOf("시간") !== -1 || c.indexOf("고정") !== -1),
      notes: headerRow.findIndex(c => c.indexOf("비고") !== -1),
      call: headerRow.findIndex(c => c.indexOf("통화") !== -1),
      status: headerRow.findIndex(c => c.indexOf("의뢰상태") !== -1),
      method: headerRow.findIndex(c => c.indexOf("배송방법") !== -1),
      future: headerRow.findIndex(c => c.indexOf("추후") !== -1)
    };

    for (let r = headerIdx + 1; r < data.length; r++) {
      const row = data[r];
      const cust = colMap.cust !== -1 ? String(row[colMap.cust] || "").trim() : "";
      const addr = colMap.address !== -1 ? String(row[colMap.address] || "").trim() : "";
      
      // 고객명이나 주소가 없으면 유효 배송건이 아니므로 제외
      if (!cust && !addr) continue;

      let contractNo = colMap.contractNo !== -1 ? String(row[colMap.contractNo] || "").trim() : "";
      let danpra = colMap.danpra !== -1 ? String(row[colMap.danpra] || "").trim() : "";
      let type = colMap.type !== -1 ? String(row[colMap.type] || "").trim() : "";
      let driver = colMap.driver !== -1 ? String(row[colMap.driver] || "").trim() : "";
      
      // 방문시간 처리 (두 칸으로 나뉜 경우 처리)
      let timeVal = "";
      if (colMap.time !== -1) {
        timeVal = String(row[colMap.time] || "").trim();
        if (row[colMap.time + 1] && String(row[colMap.time + 1]).startsWith(":")) {
          timeVal += String(row[colMap.time + 1]).trim();
        }
      }

      let notes = colMap.notes !== -1 ? String(row[colMap.notes] || "").trim() : "";
      let call = colMap.call !== -1 ? String(row[colMap.call] || "").trim() : "";
      let status = colMap.status !== -1 ? String(row[colMap.status] || "").trim() : "";
      let method = colMap.method !== -1 ? String(row[colMap.method] || "").trim() : "";
      let future = colMap.future !== -1 ? String(row[colMap.future] || "").trim() : "";

      // ERP 맵과 대조하여 계약번호 및 상태 보강
      for (const [k, v] of Object.entries(erpMap)) {
        if (cust.indexOf(k) !== -1 || k.indexOf(cust) !== -1) {
          if (!contractNo) contractNo = v.contractNo;
          if (!status) status = v.status;
          if (!method) method = v.method;
          break;
        }
      }

      // 비고에서 연락처/품목 분리
      const noteLines = notes.split(/\r?\n/);
      let contact = "";
      const items = [];
      noteLines.forEach(l => {
        const line = l.trim();
        if (!line) return;
        if (/(\d{2,4}-\d{3,4}-\d{4})|(대표|책임|팀장|부장|과장|대리|이사|담당)/.test(line)) {
          if (!contact) contact = line;
          else items.push(line);
        } else {
          items.push(line);
        }
      });

      consolidatedData.push([
        seq++,
        deliveryDate,
        contractNo,
        type,
        driver,
        cust,
        addr,
        timeVal,
        contact,
        items.join(" / "),
        danpra,
        call,
        status || (deliveryDate < "2026-09-03" ? "완료" : "진행중"),
        method || "직배송",
        future,
        notes,
        sheetName
      ]);
    }
  });

  // 통합 시트에 데이터 쓰기
  targetSheet.getRange(1, 1, consolidatedData.length, headers.length).setValues(consolidatedData);

  // 시트 서식 지정
  targetSheet.getRange(1, 1, 1, headers.length)
    .setBackground("#1a73e8")
    .setFontColor("#ffffff")
    .setFontWeight("bold")
    .setHorizontalAlignment("center");
  
  targetSheet.setFrozenRows(1);
  targetSheet.autoResizeColumns(1, headers.length);

  SpreadsheetApp.getActiveSpreadsheet().toast(`총 ${seq - 1}건의 배송 데이터가 '통합DB' 시트로 취합되었습니다!`, "취합 완료", 5);
}