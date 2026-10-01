/**
 * dashboard-ui.js - PC 관제 대시보드 전용 UI 헬퍼 모듈
 * 
 * KPI 산출, 배송 테이블 필터링, 정렬 및 인쇄 지원 유틸리티를 중앙화합니다.
 */
(function(window) {
  'use strict';

  /**
   * 실시간 배송 KPI 통계 산출
   */
  function calculateKPIs(records, driverVal) {
    if (!records || !Array.isArray(records)) {
      return { total: 0, delivery: 0, recovery: 0, driverText: '전체 (0건)' };
    }

    var realDeliveries = records.filter(function(r) {
      return r.구분 !== 'mid_return' && r.category !== 'mid_return' && (!r.고객사 || r.고객사.indexOf('(중간 복귀)') === -1);
    });

    var delCount = realDeliveries.filter(function(r) { return (r.구분 || '').indexOf('회수') === -1; }).length;
    var recCount = realDeliveries.filter(function(r) { return (r.구분 || '').indexOf('회수') !== -1; }).length;

    var driverText = '전체 기사 (' + realDeliveries.length + '건)';
    if (driverVal && driverVal !== 'all') {
      driverText = driverVal + ' (' + realDeliveries.length + '건)';
    } else if (driverVal === '') {
      driverText = '기사 미지정 (' + realDeliveries.length + '건)';
    }

    return {
      total: realDeliveries.length,
      delivery: delCount,
      recovery: recCount,
      driverText: driverText
    };
  }

  /**
   * 배송 구분별 뱃지 스타일 산출
   */
  function getCategoryBadgeStyle(cat) {
    var c = cat || '';
    if (c.indexOf('회수') !== -1) return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
    if (c.indexOf('설치') !== -1) return { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' };
    if (c.indexOf('교환') !== -1) return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
    if (c.indexOf('A/S') !== -1 || c.indexOf('AS') !== -1) return { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' };
    return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
  }

  window.DashboardUI = {
    calculateKPIs: calculateKPIs,
    getCategoryBadgeStyle: getCategoryBadgeStyle
  };

})(typeof window !== 'undefined' ? window : this);
