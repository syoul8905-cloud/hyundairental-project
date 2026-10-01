/**
 * time-utils.js - 배송스케줄 통합 관제 시스템 공통 시간/일자 유틸리티
 * 
 * 100% 하위 호환성을 위해 window 최상위 전역 스코프에 바인딩됩니다.
 */
(function(window) {
  'use strict';

  var DAY_NAMES_KO = ['일', '월', '화', '수', '목', '금', '토'];

  /**
   * 로컬 타임존 기준 오늘 일자를 YYYY-MM-DD 형식으로 반환
   */
  function getTodayLocalDate() {
    var d = new Date();
    var year = d.getFullYear();
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  /**
   * "HH:mm" 형태의 시간 문자열을 하루 기준 분(minute) 수치로 변환
   * @param {string} tStr - 예: "09:30"
   * @returns {number|null} 분 단위 환산값 (예: 570) 또는 null
   */
  function parseTimeToMinutes(tStr) {
    if (!tStr || typeof tStr !== 'string') return null;
    var m = tStr.match(/(\d{1,2}):(\d{2})/);
    if (!m) return null;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  }

  /**
   * 하루 기준 분(minute) 수치를 "HH:mm" 형태의 2자리 시간 문자열로 변환
   * @param {number} totalMinutes - 예: 570
   * @returns {string} 예: "09:30"
   */
  function formatMinutesToTime(totalMinutes) {
    if (totalMinutes === null || totalMinutes === undefined || isNaN(totalMinutes)) return '';
    var normalized = Math.max(0, Math.floor(totalMinutes)) % (24 * 60);
    var h = Math.floor(normalized / 60);
    var m = normalized % 60;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }

  /**
   * 방문희망시간("9시이전", "13 ~ 14", "15:30")을 정렬용 분 단위로 파싱
   * @param {string} timeStr
   * @returns {number} 분 단위 환산값 (파싱 불가 시 9999)
   */
  function parseVisitMinutes(timeStr) {
    if (!timeStr) return 9999;
    var str = String(timeStr).trim();
    if (str.indexOf('9시이전') !== -1 || str.indexOf('09시이전') !== -1 || str.indexOf('오전') !== -1) return 540;
    var rangeMatch = str.match(/^(\d{1,2})\s*~/);
    if (rangeMatch) {
      return parseInt(rangeMatch[1], 10) * 60;
    }
    var m = str.match(/(\d{1,2})[:시](\d{0,2})/);
    if (m) {
      var h = parseInt(m[1], 10);
      var min = m[2] ? parseInt(m[2], 10) : 0;
      if (str.indexOf('오후') !== -1 && h < 12) h += 12;
      return h * 60 + min;
    }
    return 9999;
  }

  /**
   * 날짜 문자열(YYYY-MM-DD 또는 YYYY.MM.DD)의 일치 여부 판별
   */
  function isSameDate(d1, d2) {
    if (!d1 || !d2) return false;
    return String(d1).replace(/\./g, '-').trim() === String(d2).replace(/\./g, '-').trim();
  }

  /**
   * YYYY-MM-DD 문자열을 "M월 D일 (요일)" 형태로 변환
   */
  function formatDateDisplay(dateStr, includeDayName) {
    if (!dateStr) return '';
    var clean = String(dateStr).replace(/\./g, '-').trim();
    var parts = clean.split('-');
    if (parts.length < 3) return clean;
    var m = Number(parts[1]);
    var d = Number(parts[2]);
    var res = m + '월 ' + d + '일';
    if (includeDayName) {
      var dateObj = new Date(Number(parts[0]), m - 1, d);
      var dayName = isNaN(dateObj.getDay()) ? '' : DAY_NAMES_KO[dateObj.getDay()];
      if (dayName) res += ' (' + dayName + ')';
    }
    return res;
  }

  // 전역 네임스페이스 바인딩 (Zero Regression 무결성 보장)
  window.TimeUtils = {
    DAY_NAMES_KO: DAY_NAMES_KO,
    getTodayLocalDate: getTodayLocalDate,
    parseTimeToMinutes: parseTimeToMinutes,
    formatMinutesToTime: formatMinutesToTime,
    parseVisitMinutes: parseVisitMinutes,
    isSameDate: isSameDate,
    formatDateDisplay: formatDateDisplay
  };

  // 하위 호환성을 위한 최상위 단독 함수 노출
  if (typeof window.getTodayLocalDate !== 'function') window.getTodayLocalDate = getTodayLocalDate;
  if (typeof window.parseTimeToMinutes !== 'function') window.parseTimeToMinutes = parseTimeToMinutes;
  if (typeof window.formatMinutesToTime !== 'function') window.formatMinutesToTime = formatMinutesToTime;
  if (typeof window.parseVisitMinutes !== 'function') window.parseVisitMinutes = parseVisitMinutes;
  if (typeof window.isSameDate !== 'function') window.isSameDate = isSameDate;
  if (typeof window.formatDateDisplay !== 'function') window.formatDateDisplay = formatDateDisplay;

})(typeof window !== 'undefined' ? window : this);
