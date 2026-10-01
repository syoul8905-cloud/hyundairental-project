/**
 * vehicle-tracker-ui.js - 법인차량 운행일지 트래커 전용 UI & 렌더링 엔진
 * 
 * Mode A(배송지별 상세) / Mode B(일자별 요약) 테이블 헤더, 경유지 해석(getResolvedStopLegs),
 * 엑셀(CSV) 내보내기, 클립보드 복사 등 순수 UI 로직을 중앙 모듈화합니다.
 */
(function(window) {
  'use strict';

  function parseTimeToMinutes(tStr) {
    if (window.TimeUtils && typeof window.TimeUtils.parseTimeToMinutes === 'function') {
      return window.TimeUtils.parseTimeToMinutes(tStr);
    }
    if (!tStr || typeof tStr !== 'string') return null;
    var m = tStr.match(/(\d{1,2}):(\d{2})/);
    if (!m) return null;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  }

  /**
   * 운행일지 레코드로부터 개별 주행 구간(Stop Legs) 정밀 계산
   */
  function getResolvedStopLegs(log) {
    if (!log || !log.stops || !Array.isArray(log.stops) || log.stops.length === 0) {
      return [];
    }

    var rawStops = log.stops;
    var stops = rawStops.filter(function(st) {
      var sId = String(st.id || '');
      var sName = String(st.name || '');
      if (sName.startsWith('SYSTEM_CONFIG') || sId.includes('HANDOVER') || sId.includes('1356') || sId.includes('1357') || sId.includes('1358') || sId.includes('1359')) return false;
      return true;
    });
    var hasOrigin = (stops[0] && stops[0].type === 'origin');
    var startIdx = hasOrigin ? 1 : 0;
    var totalLegCount = stops.length - (hasOrigin ? 1 : 0);

    if (totalLegCount <= 0) return [];

    var allHaveDist = true;
    for (var i = startIdx; i < stops.length; i++) {
      if (stops[i].distance_km === undefined || stops[i].distance_km === null || isNaN(stops[i].distance_km) || stops[i].distance_km <= 0) {
        allHaveDist = false;
        break;
      }
    }

    var dayTotalDist = log.distance_km || (log.end_km - log.start_km) || 0;
    var runningOdo = log.start_km;

    if (!allHaveDist && dayTotalDist > 0) {
      var baseDist = Math.floor(dayTotalDist / totalLegCount);
      var remDist = dayTotalDist % totalLegCount;

      for (var i = startIdx; i < stops.length; i++) {
        var legDist = baseDist + ((i - startIdx) < remDist ? 1 : 0);
        var legStart = runningOdo;
        var legEnd = runningOdo + legDist;
        runningOdo = legEnd;

        stops[i].distance_km = legDist;
        stops[i].start_km = legStart;
        stops[i].end_km = legEnd;
      }
    }

    var legs = [];
    for (var i = startIdx; i < stops.length; i++) {
      var s = stops[i];
      var isReturn = (s.type === 'return');
      var fromName = (i > 0 && stops[i - 1]) ? stops[i - 1].name : '가산 센터';
      var sArrive = s.arrive || '';
      var sDepart = s.depart || '';

      if (isReturn) {
        var prevLegTime = (i > 0 && stops[i - 1]) ? (stops[i - 1].arrive || stops[i - 1].depart || '') : '';
        var prevM = parseTimeToMinutes(prevLegTime);
        var depM = parseTimeToMinutes(sDepart);
        if (!sDepart || (prevM !== null && depM !== null && depM < prevM)) {
          sDepart = prevLegTime;
          depM = prevM;
        }
        if (!sArrive) {
          if (log.closed_at) sArrive = log.closed_at;
          else if (log.memo_special) {
            try { var sp = JSON.parse(log.memo_special); if (sp.arrive) sArrive = sp.arrive; } catch(e) {}
          }
          if (!sArrive && s.time && s.time !== '18:00') sArrive = s.time;
        }
        var arrM = parseTimeToMinutes(sArrive);
        if (arrM !== null && ((prevM !== null && arrM < prevM) || (depM !== null && arrM < depM))) {
          var calcM = (depM !== null ? depM : prevM) || 960;
          calcM += 45;
          var ch = Math.floor(calcM / 60) % 24;
          var cm = calcM % 60;
          sArrive = String(ch).padStart(2, '0') + ':' + String(cm).padStart(2, '0');
        }
      }

      var sStatus = s.status || '';
      if (isReturn && log.is_closed && (!sStatus || sStatus === '진행중')) {
        sStatus = '도착완료';
      }

      var isMidReturn = (s.type === 'mid_return' || (s.name && s.name.indexOf('(중간 복귀)') !== -1));
      var badgeText = s.badgeText || (isReturn ? '복귀' : (isMidReturn ? '중간 복귀' : (s.type === 'origin' ? '출발' : (s.type === 'team1' || s.type === 'other' ? `기타 #${s.order || (i - startIdx + 1)}` : `배송 #${s.order || (i - startIdx + 1)}`))));

      var legParking = Number(s.parking_fee || 0);
      var legFuel = Number(s.fuel_fee || 0);
      if (hasOrigin && i === startIdx) {
        if (stops[0].parking_fee) legParking += Number(stops[0].parking_fee);
        if (stops[0].fuel_fee) legFuel += Number(stops[0].fuel_fee);
      }

      legs.push({
        stopIndex: i,
        type: isMidReturn ? 'mid_return' : (s.type || 'delivery'),
        badgeText: badgeText,
        order: isMidReturn ? null : (s.order || (i - startIdx + 1)),
        fromName: fromName,
        name: s.name || (isReturn ? '가산 센터' : (isMidReturn ? '가산 센터 (중간 복귀)' : '배송지')),
        addr: s.addr || '',
        time: s.time || '',
        depart: sDepart,
        arrive: sArrive,
        status: sStatus,
        contact: s.contact || '',
        start_km: Number(s.start_km !== undefined ? s.start_km : log.start_km),
        end_km: Number(s.end_km !== undefined ? s.end_km : log.end_km),
        distance_km: Number(s.distance_km !== undefined ? s.distance_km : 0),
        parking_fee: legParking,
        fuel_fee: legFuel,
        memo: s.memo || (isMidReturn ? '중간 복귀 및 상차/대기' : '')
      });
    }

    return legs;
  }

  /**
   * 테이블 헤더(thead) 렌더링
   */
  function renderTripLogTableHead(viewMode) {
    var thead = document.getElementById('tripLogTableHead');
    if (!thead) return;

    var mode = viewMode || window.currentViewMode || 'detailed';

    if (mode === 'detailed') {
      thead.innerHTML = `
        <tr class="bg-slate-100/90 text-slate-600 text-[11px] font-bold border-b border-slate-200 uppercase tracking-wider">
          <th class="py-2.5 px-3 w-14 text-center">순번</th>
          <th class="py-2.5 px-3 w-28 text-center">방문 구분</th>
          <th class="py-2.5 px-3 text-left min-w-[280px]">방문지 (고객사) & 상세 도로명 주소</th>
          <th class="py-2.5 px-3 w-24 text-right">출발 계기판</th>
          <th class="py-2.5 px-3 w-24 text-right">도착 계기판</th>
          <th class="py-2.5 px-3 w-20 text-right">구간 거리</th>
          <th class="py-2.5 px-3 w-24 text-right">주차비</th>
          <th class="py-2.5 px-3 w-24 text-right">주유비</th>
          <th class="py-2.5 px-3 w-36 text-left">배송 품목 / 메모</th>
          <th class="py-2.5 px-3 w-20 text-center whitespace-nowrap">비용 관리</th>
        </tr>
      `;
    } else {
      thead.innerHTML = `
        <tr class="bg-slate-100/90 text-slate-600 text-[11px] font-bold border-b border-slate-200 uppercase tracking-wider">
          <th class="py-2.5 px-3 w-24 text-center">날짜 (요일)</th>
          <th class="py-2.5 px-3 w-24 text-center">운전자</th>
          <th class="py-2.5 px-3 w-24 text-right">운행 시작 / Km</th>
          <th class="py-2.5 px-3 w-24 text-right">운행 종료 / Km</th>
          <th class="py-2.5 px-3 w-24 text-right">당일 주행거리</th>
          <th class="py-2.5 px-3 w-24 text-center">네비 추천거리</th>
          <th class="py-2.5 px-3 w-40 text-left">도착지 / 경로</th>
          <th class="py-2.5 px-3 w-24 text-right">주차비 합계</th>
          <th class="py-2.5 px-3 w-24 text-right">주유비 합계</th>
          <th class="py-2.5 px-3">비고 / 특이사항</th>
          <th class="py-2.5 px-3 w-20 text-center">관리</th>
        </tr>
      `;
    }
  }

  function setViewMode(mode) {
    window.currentViewMode = mode;
    var btnDetailed = document.getElementById('btnViewDetailedStops');
    var btnSummary = document.getElementById('btnViewDailySummary');
    var title = document.getElementById('tableHeaderTitle');

    var vehNo = window.currentSelectedVehicleNo || '차량';
    var yr = window.currentYear || new Date().getFullYear();
    var mo = window.currentMonth || (new Date().getMonth() + 1);

    if (mode === 'detailed') {
      if (btnDetailed) btnDetailed.className = 'px-2.5 py-1 rounded-lg transition text-white bg-indigo-600 shadow-xs flex items-center gap-1 text-[11px]';
      if (btnSummary) btnSummary.className = 'px-2.5 py-1 rounded-lg transition text-slate-600 hover:text-slate-900 flex items-center gap-1 text-[11px]';
      if (title) title.innerText = `${vehNo} · ${yr}년 ${mo}월 배송지별 운행 및 비용 명세`;
    } else {
      if (btnDetailed) btnDetailed.className = 'px-2.5 py-1 rounded-lg transition text-slate-600 hover:text-slate-900 flex items-center gap-1 text-[11px]';
      if (btnSummary) btnSummary.className = 'px-2.5 py-1 rounded-lg transition text-white bg-indigo-600 shadow-xs flex items-center gap-1 text-[11px]';
      if (title) title.innerText = `${vehNo} · ${yr}년 ${mo}월 일자별 운행 요약`;
    }

    if (typeof window.renderTripLogTable === 'function') {
      window.renderTripLogTable();
    }
  }

  function toggleExportMenu(e) {
    if (e) e.stopPropagation();
    var menu = document.getElementById('exportMenu');
    if (menu) menu.classList.toggle('hidden');
  }

  function closeExportMenu() {
    var menu = document.getElementById('exportMenu');
    if (menu) menu.classList.add('hidden');
  }

  function copyToClipboard(text) {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        if (typeof window.showToast === 'function') window.showToast('📋 주소가 복사되었습니다: ' + text);
      }).catch(function() {
        prompt('주소를 복사하세요:', text);
      });
    } else {
      prompt('주소를 복사하세요:', text);
    }
  }

  // 전역 노출 및 호환성 바인딩
  window.VehicleTrackerUI = {
    getResolvedStopLegs: getResolvedStopLegs,
    renderTripLogTableHead: renderTripLogTableHead,
    setViewMode: setViewMode,
    toggleExportMenu: toggleExportMenu,
    closeExportMenu: closeExportMenu,
    copyToClipboard: copyToClipboard
  };

  // 기존 전역 함수 100% 보존
  if (!window.getResolvedStopLegs) window.getResolvedStopLegs = getResolvedStopLegs;
  if (!window.renderTripLogTableHead) window.renderTripLogTableHead = renderTripLogTableHead;
  if (!window.setViewMode) window.setViewMode = setViewMode;
  if (!window.toggleExportMenu) window.toggleExportMenu = toggleExportMenu;
  if (!window.closeExportMenu) window.closeExportMenu = closeExportMenu;
  if (!window.copyToClipboard) window.copyToClipboard = copyToClipboard;

})(typeof window !== 'undefined' ? window : this);
