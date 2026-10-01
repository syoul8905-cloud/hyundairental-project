/**
 * audit-service.js - 관제 및 모바일 시스템 운영 감사(Audit) 로깅 서비스
 * 
 * 모든 상태 변경(배송 상태, 기사 배정, 차량 락/언락, 일지 삭제/수정)의
 * 조작자, 타임스탬프, 전/후 데이터 무결성을 추적 및 기록합니다.
 */
(function(window) {
  'use strict';

  var memoryAuditLogs = [];
  var MAX_LOGS = 200;

  function getCurrentActor() {
    if (window.currentUser && window.currentUser.id) {
      return { id: window.currentUser.id, role: window.currentUser.role || 'user' };
    }
    if (typeof window.getCurrentDriverName === 'function') {
      var d = window.getCurrentDriverName();
      if (d) return { id: d, role: 'driver' };
    }
    return { id: 'system', role: 'system' };
  }

  function log(actionType, targetType, targetId, details) {
    var actor = getCurrentActor();
    var entry = {
      timestamp: new Date().toISOString(),
      action: actionType,
      target_type: targetType,
      target_id: targetId || null,
      actor: actor.id,
      actor_role: actor.role,
      details: details || {}
    };

    memoryAuditLogs.push(entry);
    if (memoryAuditLogs.length > MAX_LOGS) {
      memoryAuditLogs.shift();
    }

    // 개발/테스트 환경 콘솔 감사 추적
    if (window.location && window.location.hostname === 'localhost') {
      console.log('[AuditService]', entry.timestamp, '|', actor.id, '|', actionType, '->', targetType, targetId, details);
    }

    return entry;
  }

  function getRecentLogs(limit) {
    var l = limit || 50;
    return memoryAuditLogs.slice(-l);
  }

  window.AuditService = {
    log: log,
    getRecentLogs: getRecentLogs,
    getCurrentActor: getCurrentActor
  };

})(typeof window !== 'undefined' ? window : this);
