/**
 * schedule-service.js - 배송 스케줄 데이터 서비스 (중앙화 CRUD 및 무결성 제어)
 * 
 * 95곳에 분산되어 있던 delivery_schedules 테이블 직접 쿼리를 일원화하고,
 * 비배송 시트(설정, 운행일지, AS기록)와의 데이터 혼입을 원천 차단합니다.
 */
(function(window) {
  'use strict';

  function getClient() {
    if (window.SupabaseConfig && typeof window.SupabaseConfig.getClient === 'function') {
      return window.SupabaseConfig.getClient();
    }
    return window.supabaseClient;
  }

  // 비배송(시스템 설정/로그) 시트 목록
  var EXCLUDED_SHEETS = [
    'SYSTEM_CONFIG_VEHICLES',
    'SYSTEM_CONFIG_USERS',
    'SYSTEM_CONFIG_DRIVER_ORIGINS',
    'SYSTEM_CONFIG_ASSET_AUDIT_MASTER',
    'SYSTEM_CONFIG_ASSET_AUDIT_SCANS',
    'SYSTEM_CONFIG_QUICK_MEMOS',
    'VEHICLE_TRIP_LOGS',
    'VEHICLE_MAINTENANCE_LOGS',
    'VEHICLE_DAMAGE_PHOTOS',
    'AS_RECORDS'
  ];

  /**
   * 지정 일자의 활성 배송 스케줄 전수 조회
   * @param {string} dateStr - 'YYYY-MM-DD'
   */
  async function fetchSchedulesByDate(dateStr) {
    var client = getClient();
    if (!client) return { success: false, error: 'Supabase 클라이언트 미초기화', data: [] };
    if (!dateStr) return { success: false, error: '조회 일자 누락', data: [] };

    try {
      var query = client.from('delivery_schedules')
        .select('*')
        .eq('delivery_date', dateStr);

      query = query
        .not('source_sheet', 'like', 'SYSTEM_CONFIG_%')
        .not('source_sheet', 'like', 'VEHICLE_%')
        .not('customer_name', 'like', 'SYSTEM_CONFIG_%')
        .not('customer_name', 'like', 'VEHICLE_%')
        .neq('contract_no', 'HANDOVER_CONFIG');

      for (var i = 0; i < EXCLUDED_SHEETS.length; i++) {
        query = query.neq('source_sheet', EXCLUDED_SHEETS[i]);
      }

      var res = await query.order('stop_order', { ascending: true, nullsFirst: false });
      if (res.error) {
        console.error('[ScheduleService] fetchSchedulesByDate 실패:', res.error);
        return { success: false, error: res.error.message, data: [] };
      }
      return { success: true, data: res.data || [] };
    } catch (err) {
      console.error('[ScheduleService] fetchSchedulesByDate 예외:', err);
      return { success: false, error: err.message, data: [] };
    }
  }

  /**
   * 단건 배송 레코드 업데이트
   * @param {number|string} id - DB Primary Key
   * @param {object} updates - 변경할 필드 객체
   */
  async function updateSchedule(id, updates) {
    var client = getClient();
    if (!client || !id) return { success: false, error: '클라이언트 또는 ID 누락' };

    try {
      var res = await client.from('delivery_schedules')
        .update(updates)
        .eq('id', id);

      if (res.error) {
        console.error('[ScheduleService] updateSchedule 실패:', res.error);
        return { success: false, error: res.error.message };
      }

      if (window.AuditService) {
        window.AuditService.log('UPDATE_SCHEDULE', 'delivery_schedules', id, updates);
      }
      return { success: true, data: res.data };
    } catch (err) {
      console.error('[ScheduleService] updateSchedule 예외:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * 담당 기사 일괄 변경
   */
  async function updateDriver(id, driverName) {
    return updateSchedule(id, { driver_name: driverName });
  }

  /**
   * 배송 상태 변경 (예: 배송완료, 이동중, 미배송)
   */
  async function updateStatus(id, status, memoSpecialUpdate) {
    var payload = { status: status };
    if (memoSpecialUpdate !== undefined) {
      payload.memo_special = typeof memoSpecialUpdate === 'object' ? JSON.stringify(memoSpecialUpdate) : memoSpecialUpdate;
    }
    return updateSchedule(id, payload);
  }

  /**
   * 방문 순번 일괄 업데이트
   * @param {Array<{id: number, stop_order: number}>} orderList
   */
  async function updateBatchStopOrders(orderList) {
    var client = getClient();
    if (!client || !orderList || orderList.length === 0) return { success: false, error: '인자 누락' };

    try {
      var promises = orderList.map(function(item) {
        return client.from('delivery_schedules')
          .update({ stop_order: item.stop_order })
          .eq('id', item.id);
      });
      await Promise.all(promises);

      if (window.AuditService) {
        window.AuditService.log('UPDATE_BATCH_STOP_ORDERS', 'delivery_schedules', null, { count: orderList.length });
      }
      return { success: true };
    } catch (err) {
      console.error('[ScheduleService] updateBatchStopOrders 예외:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * 단건 배송 스케줄 삭제
   */
  async function deleteSchedule(id) {
    var client = getClient();
    if (!client || !id) return { success: false, error: '클라이언트 또는 ID 누락' };

    try {
      var res = await client.from('delivery_schedules')
        .delete()
        .eq('id', id);

      if (res.error) {
        console.error('[ScheduleService] deleteSchedule 실패:', res.error);
        return { success: false, error: res.error.message };
      }

      if (window.AuditService) {
        window.AuditService.log('DELETE_SCHEDULE', 'delivery_schedules', id, {});
      }
      return { success: true };
    } catch (err) {
      console.error('[ScheduleService] deleteSchedule 예외:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * 신규 배송 건 삽입 (직접추가 또는 CSV)
   */
  async function insertSchedules(records) {
    var client = getClient();
    if (!client || !records || records.length === 0) return { success: false, error: '삽입할 레코드 없음' };

    try {
      var res = await client.from('delivery_schedules').insert(records);
      if (res.error) {
        console.error('[ScheduleService] insertSchedules 실패:', res.error);
        return { success: false, error: res.error.message };
      }

      if (window.AuditService) {
        window.AuditService.log('INSERT_SCHEDULES', 'delivery_schedules', null, { count: records.length });
      }
      return { success: true, data: res.data };
    } catch (err) {
      console.error('[ScheduleService] insertSchedules 예외:', err);
      return { success: false, error: err.message };
    }
  }

  window.ScheduleService = {
    fetchSchedulesByDate: fetchSchedulesByDate,
    updateSchedule: updateSchedule,
    updateDriver: updateDriver,
    updateStatus: updateStatus,
    updateBatchStopOrders: updateBatchStopOrders,
    deleteSchedule: deleteSchedule,
    insertSchedules: insertSchedules
  };

})(typeof window !== 'undefined' ? window : this);
