/**
 * mobile-ui.js - 기사용 모바일 웹앱 전용 UI 헬퍼 모듈
 * 
 * 모바일 차량 선택 카드 렌더링, 상태 뱃지, 터치 피드백 등
 * 현장 기사 편의성을 위한 UI 유틸리티를 중앙화합니다.
 */
(function(window) {
  'use strict';

  function formatTimeHHMM(dateObj) {
    var d = dateObj || new Date();
    var h = String(d.getHours()).padStart(2, '0');
    var m = String(d.getMinutes()).padStart(2, '0');
    return h + ':' + m;
  }

  function getStatusBadgeClass(status) {
    if (status === '배송완료' || status === '완료') {
      return 'bg-emerald-100 text-emerald-700 border-emerald-300';
    } else if (status === '이동중' || status === '진행중') {
      return 'bg-indigo-100 text-indigo-700 border-indigo-300';
    } else if (status === '미배송') {
      return 'bg-amber-100 text-amber-700 border-amber-300';
    } else {
      return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  }

  function showModal(modalId) {
    var el = document.getElementById(modalId);
    if (el) el.classList.remove('hidden');
  }

  function hideModal(modalId) {
    var el = document.getElementById(modalId);
    if (el) el.classList.add('hidden');
  }

  window.MobileUI = {
    formatTimeHHMM: formatTimeHHMM,
    getStatusBadgeClass: getStatusBadgeClass,
    showModal: showModal,
    hideModal: hideModal
  };

})(typeof window !== 'undefined' ? window : this);
