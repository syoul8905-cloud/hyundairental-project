/**
 * vehicle-service.js - 법인차량 마스터, 실시간 운행락 및 운행일지 데이터 서비스
 * 
 * SYSTEM_CONFIG_VEHICLES 레코드(ID 1615)와 VEHICLE_TRIP_LOGS 간의
 * active_usage 동시성 락, 계기판(current_km) 자동 동기화 및 단건 삭제 일관성을 총괄합니다.
 */
(function(window) {
  'use strict';

  function getClient() {
    if (window.SupabaseConfig && typeof window.SupabaseConfig.getClient === 'function') {
      return window.SupabaseConfig.getClient();
    }
    return window.supabaseClient;
  }

  /**
   * 법인차량 마스터 및 실시간 운행 상태(active_usage) 조회
   */
  async function fetchVehiclesConfig() {
    var client = getClient();
    var fallback = {
      vehicles: window.ConstantsMaster ? window.ConstantsMaster.DEFAULT_CORPORATE_VEHICLES : [
        { vehicle_no: '801부8744', model_name: '스타리아', default_driver: '김승지', initial_km: 70000, current_km: 72247, is_active: true },
        { vehicle_no: '826라8911', model_name: '스타리아', default_driver: '조경찬', initial_km: 180000, current_km: 182000, is_active: true }
      ],
      active_usage: {}
    };

    if (!client) return { success: true, data: fallback, recordId: null };

    try {
      var res = await client.from('delivery_schedules')
        .select('id, memo_full')
        .eq('source_sheet', 'SYSTEM_CONFIG_VEHICLES')
        .limit(1);

      if (res.error) {
        console.warn('[VehicleService] fetchVehiclesConfig 쿼리 실패, 폴백 사용:', res.error);
        return { success: true, data: fallback, recordId: null };
      }

      if (res.data && res.data.length > 0) {
        var row = res.data[0];
        var config = fallback;
        if (row.memo_full) {
          try {
            config = JSON.parse(row.memo_full);
          } catch (e) {
            console.warn('[VehicleService] JSON 파싱 실패, 폴백 사용:', e);
          }
        }
        if (!config.vehicles || !Array.isArray(config.vehicles)) {
          config.vehicles = fallback.vehicles;
        }
        if (!config.active_usage || typeof config.active_usage !== 'object') {
          config.active_usage = {};
        }
        return { success: true, data: config, recordId: row.id };
      } else {
        return { success: true, data: fallback, recordId: null };
      }
    } catch (err) {
      console.error('[VehicleService] fetchVehiclesConfig 예외:', err);
      return { success: true, data: fallback, recordId: null };
    }
  }

  /**
   * 법인차량 마스터 전체 설정 저장
   */
  async function saveVehiclesConfig(configData, existingRecordId) {
    var client = getClient();
    if (!client) return { success: false, error: 'Supabase 클라이언트 미초기화' };

    try {
      var payload = {
        customer_name: 'SYSTEM_CONFIG',
        source_sheet: 'SYSTEM_CONFIG_VEHICLES',
        memo_full: JSON.stringify(configData)
      };

      var res;
      if (existingRecordId) {
        res = await client.from('delivery_schedules')
          .update(payload)
          .eq('id', existingRecordId);
      } else {
        // 기존 레코드 ID 재확인
        var check = await client.from('delivery_schedules')
          .select('id')
          .eq('source_sheet', 'SYSTEM_CONFIG_VEHICLES')
          .limit(1);
        if (check.data && check.data.length > 0) {
          res = await client.from('delivery_schedules')
            .update(payload)
            .eq('id', check.data[0].id);
        } else {
          res = await client.from('delivery_schedules').insert([payload]);
        }
      }

      if (res.error) {
        console.error('[VehicleService] saveVehiclesConfig 실패:', res.error);
        return { success: false, error: res.error.message };
      }

      if (window.AuditService) {
        window.AuditService.log('SAVE_VEHICLES_CONFIG', 'SYSTEM_CONFIG_VEHICLES', existingRecordId, {});
      }
      return { success: true };
    } catch (err) {
      console.error('[VehicleService] saveVehiclesConfig 예외:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * 차량 운행 락(active_usage) 획득
   */
  async function acquireLock(vehicleNo, driverName, dateStr) {
    var cfgRes = await fetchVehiclesConfig();
    var cfg = cfgRes.data;
    if (!cfg.active_usage) cfg.active_usage = {};

    var now = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
    cfg.active_usage[vehicleNo] = {
      driver: driverName,
      date: dateStr,
      startTime: now
    };

    var saveRes = await saveVehiclesConfig(cfg, cfgRes.recordId);
    if (saveRes.success && window.AuditService) {
      window.AuditService.log('ACQUIRE_VEHICLE_LOCK', 'VEHICLE', vehicleNo, { driver: driverName, date: dateStr });
    }
    return saveRes;
  }

  /**
   * 차량 운행 락(active_usage) 해제
   */
  async function releaseLock(vehicleNo) {
    var cfgRes = await fetchVehiclesConfig();
    var cfg = cfgRes.data;
    if (cfg.active_usage && cfg.active_usage[vehicleNo]) {
      delete cfg.active_usage[vehicleNo];
      var saveRes = await saveVehiclesConfig(cfg, cfgRes.recordId);
      if (saveRes.success && window.AuditService) {
        window.AuditService.log('RELEASE_VEHICLE_LOCK', 'VEHICLE', vehicleNo, {});
      }
      return saveRes;
    }
    return { success: true };
  }

  /**
   * 운행일지 목록 조회 (차량별 또는 전체)
   */
  async function fetchTripLogs(vehicleNo, limit) {
    var client = getClient();
    if (!client) return { success: false, error: 'Supabase 미초기화', data: [] };

    try {
      var query = client.from('delivery_schedules')
        .select('*')
        .eq('source_sheet', 'VEHICLE_TRIP_LOGS');

      if (vehicleNo && vehicleNo !== 'all') {
        query = query.eq('customer_name', vehicleNo);
      }

      var res = await query.order('delivery_date', { ascending: false }).limit(limit || 100);
      if (res.error) {
        console.error('[VehicleService] fetchTripLogs 실패:', res.error);
        return { success: false, error: res.error.message, data: [] };
      }
      return { success: true, data: res.data || [] };
    } catch (err) {
      console.error('[VehicleService] fetchTripLogs 예외:', err);
      return { success: false, error: err.message, data: [] };
    }
  }

  /**
   * 운행일지 단건 삭제 및 계기판 역산 동기화
   */
  async function deleteTripLog(logId, vehicleNo) {
    var client = getClient();
    if (!client || !logId) return { success: false, error: '클라이언트 또는 logId 누락' };

    try {
      var res = await client.from('delivery_schedules')
        .delete()
        .eq('id', logId);

      if (res.error) {
        console.error('[VehicleService] deleteTripLog 실패:', res.error);
        return { success: false, error: res.error.message };
      }

      if (window.AuditService) {
        window.AuditService.log('DELETE_TRIP_LOG', 'VEHICLE_TRIP_LOGS', logId, { vehicle_no: vehicleNo });
      }

      // 차량 누적 계기판 자동 역산 동기화
      if (vehicleNo) {
        await syncVehicleOdometer(vehicleNo);
      }

      return { success: true };
    } catch (err) {
      console.error('[VehicleService] deleteTripLog 예외:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * 남은 운행일지 기반 차량 계기판(current_km) 자동 동기화
   */
  async function syncVehicleOdometer(vehicleNo) {
    var client = getClient();
    if (!client || !vehicleNo) return { success: false };

    try {
      var logsRes = await client.from('delivery_schedules')
        .select('delivery_date, memo_full')
        .eq('source_sheet', 'VEHICLE_TRIP_LOGS')
        .eq('customer_name', vehicleNo)
        .order('delivery_date', { ascending: false })
        .limit(1);

      var latestKm = null;
      if (logsRes.data && logsRes.data.length > 0 && logsRes.data[0].memo_full) {
        try {
          var parsed = JSON.parse(logsRes.data[0].memo_full);
          latestKm = Number(parsed.end_km || parsed.start_km || 0);
        } catch (e) {}
      }

      var cfgRes = await fetchVehiclesConfig();
      var cfg = cfgRes.data;
      var targetVeh = (cfg.vehicles || []).find(function(v) {
        return (v.vehicle_no || '').trim() === (vehicleNo || '').trim();
      });

      if (targetVeh) {
        if (latestKm && latestKm > 0) {
          targetVeh.current_km = latestKm;
        } else if (targetVeh.initial_km) {
          targetVeh.current_km = targetVeh.initial_km;
        }
        await saveVehiclesConfig(cfg, cfgRes.recordId);
        return { success: true, updatedKm: targetVeh.current_km };
      }
      return { success: true };
    } catch (err) {
      console.error('[VehicleService] syncVehicleOdometer 예외:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * PC 직접 배차 확정 및 법인차량 운행일지 일괄 자동 생성/동기화
   * @param {string} dateStr 'YYYY-MM-DD'
   * @param {Array<{driver: string, vehicle: string}>} assignments
   */
  async function confirmDispatchAndGenerateLogs(dateStr, assignments, unassignedDrivers) {
    var client = getClient();
    if (!client) return { success: false, error: 'Supabase 클라이언트 미초기화' };
    if (!Array.isArray(assignments)) return { success: false, error: '배차 데이터 누락' };

    var cleanDate = (dateStr || '').replace(/\./g, '-').trim();
    var dotDate = cleanDate.replace(/-/g, '.');

    try {
      var cfgRes = await fetchVehiclesConfig();
      var cfg = cfgRes.data;
      if (!cfg.active_usage) cfg.active_usage = {};

      var assignedDrivers = assignments.map(function(a) { return (a.driver || '').trim(); }).filter(Boolean);
      var unassignedList = Array.isArray(unassignedDrivers) ? unassignedDrivers.map(function(d) { return (d || '').trim(); }).filter(Boolean) : [];
      var targetDriversToClear = Array.from(new Set(assignedDrivers.concat(unassignedList)));

      // 1. 기존 active_usage 중 해당 날짜의 대상 기사들 배차 정리 (미배차 기사 포함)
      Object.keys(cfg.active_usage).forEach(function(vKey) {
        var u = cfg.active_usage[vKey];
        var uDate = (u && u.date) ? u.date.replace(/\./g, '-') : '';
        if (u && (uDate === cleanDate || !uDate) && targetDriversToClear.indexOf((u.driver || '').trim()) !== -1) {
          delete cfg.active_usage[vKey];
        }
      });

      // 2. 신규 active_usage 반영
      assignments.forEach(function(a) {
        var v = (a.vehicle || '').trim();
        var d = (a.driver || '').trim();
        if (v && v !== '미배차' && v !== 'NONE' && d) {
          if (v === '자차' || v === '자차운행' || v === 'PERSONAL') {
            cfg.active_usage['PERSONAL_' + d] = { driver: d, date: cleanDate, vehicle: '자차', startTime: '08:30' };
          } else {
            cfg.active_usage[v] = { driver: d, date: cleanDate, startTime: '08:30' };
          }
        }
      });
      await saveVehiclesConfig(cfg, cfgRes.recordId);

      // 2-1. 미배차(NONE)로 변경된 기사의 0건 단순 업무 일지(가산 센터 ➔ 가산 센터) 정리
      if (unassignedList.length > 0) {
        for (var uIdx = 0; uIdx < unassignedList.length; uIdx++) {
          var unDrv = unassignedList[uIdx];
          var unLogRes = await client.from('delivery_schedules')
            .select('id, memo_full')
            .eq('source_sheet', 'VEHICLE_TRIP_LOGS')
            .eq('driver_name', unDrv)
            .or('delivery_date.eq.' + cleanDate + ',delivery_date.eq.' + dotDate);
          if (unLogRes.data && unLogRes.data.length > 0) {
            for (var l = 0; l < unLogRes.data.length; l++) {
              var logRow = unLogRes.data[l];
              var p = {};
              try { p = JSON.parse(logRow.memo_full || '{}'); } catch(e) {}
              if (!p.stops || p.stops.length <= 2) {
                await client.from('delivery_schedules').delete().eq('id', logRow.id);
              }
            }
          }
        }
      }

      // 3. 당일 전체 배송 스케줄 로드 (YYYY-MM-DD 및 YYYY.MM.DD 포맷 모두 포괄)
      var schedRes = await client.from('delivery_schedules')
        .select('*')
        .or('delivery_date.eq.' + cleanDate + ',delivery_date.eq.' + dotDate + ',source_sheet.eq.' + cleanDate + ',source_sheet.eq.' + dotDate);
      var allRecords = schedRes.data || [];

      var origin = (window.ConstantsMaster && window.ConstantsMaster.CENTER_INFO) ? window.ConstantsMaster.CENTER_INFO : {
        NAME: '가산 센터',
        ADDR: '서울특별시 금천구 벚꽃로 278 (SJ테크노빌)'
      };

      // 4. 각 법인차량별 운행일지 생성/동기화
      for (var i = 0; i < assignments.length; i++) {
        var a = assignments[i];
        var vehNo = (a.vehicle || '').trim();
        var drvName = (a.driver || '').trim();

        if (!vehNo || vehNo === '자차' || vehNo === '자차운행' || vehNo === 'PERSONAL' || vehNo === '미배차' || vehNo === 'NONE' || !drvName) {
          continue;
        }

        // 해당 기사의 유효 직배송 일정 필터링
        var eligible = allRecords.filter(function(r) {
          var src = (r.source_sheet || '').trim();
          var cust = (r.customer_name || '').trim();
          var contract = (r.contract_no || '').trim();
          if (src === 'AS_RECORDS' || src.startsWith('SYSTEM_CONFIG') || src === 'VEHICLE_TRIP_LOGS' || cust.startsWith('SYSTEM_CONFIG') || contract === 'HANDOVER_CONFIG') return false;

          var method = (r.delivery_method || '직배송').trim();
          var rDrv = (r.driver_name || '').trim();
          var cat = (r.category || '배송').trim();

          var isQuick = (method === '퀵배송' || method === '퀵' || rDrv === '퀵');
          var isPickup = (method === '방문수령' || rDrv === '방문수령' || (cat === '수령' && method !== '직배송' && !rDrv));
          var isParcel = (method === '택배' || rDrv === '택배');
          if (isQuick || isPickup || isParcel) return false;

          return rDrv === drvName;
        });

        // 방문 순서 정렬 (stop_order 기준)
        eligible.sort(function(ea, eb) {
          var ordA = (typeof ea.stop_order === 'number') ? ea.stop_order : (parseInt(ea.stop_order, 10) || 9999);
          var ordB = (typeof eb.stop_order === 'number') ? eb.stop_order : (parseInt(eb.stop_order, 10) || 9999);
          if (ordA !== ordB) return ordA - ordB;
          return (ea.visit_time || '').localeCompare(eb.visit_time || '');
        });

        // 기존 당일 운행일지 조회
        var logRes = await client.from('delivery_schedules')
          .select('*')
          .eq('source_sheet', 'VEHICLE_TRIP_LOGS')
          .eq('customer_name', vehNo)
          .eq('delivery_date', cleanDate)
          .limit(1);

        var existingPayload = {};
        var existingRowId = null;
        if (logRes.data && logRes.data.length > 0) {
          existingRowId = logRes.data[0].id;
          try { existingPayload = JSON.parse(logRes.data[0].memo_full || '{}'); } catch(e) {}
        }

        var prevStopsMap = {};
        if (existingPayload.stops && Array.isArray(existingPayload.stops)) {
          existingPayload.stops.forEach(function(st) {
            if (st.id) prevStopsMap[st.id] = st;
          });
        }

        // stops 구성 (Origin -> Deliveries -> Return)
        var stops = [];
        stops.push({
          id: 'stop_origin',
          type: 'origin',
          name: origin.NAME || '가산 센터',
          addr: origin.ADDR || '서울 금천구 벚꽃로 278',
          time: '08:30',
          memo: eligible.length === 0 ? '1팀 외근 및 업무 운행 출발' : '출고 및 배송 출발'
        });

        var delivOrder = 0;
        eligible.forEach(function(r) {
          var stopId = 'stop_deliv_' + r.id;
          var prev = prevStopsMap[stopId] || {};
          var times = {};
          try { if (r.memo_special) times = JSON.parse(r.memo_special); } catch(e) {}

          var isMid = (r.category === 'mid_return' || r.category === '중간복귀' || (r.customer_name && r.customer_name.indexOf('(중간 복귀)') !== -1));
          stops.push({
            id: stopId,
            type: isMid ? 'mid_return' : 'delivery',
            order: isMid ? null : (++delivOrder),
            name: r.customer_name || '고객사',
            addr: r.address || '',
            time: r.visit_time || '',
            depart: times.depart || prev.depart || '',
            arrive: times.arrive || prev.arrive || '',
            status: r.status || prev.status || '출발대기',
            memo: isMid ? '중간 복귀 및 상차/대기' : (r.items || (r.order_memo ? ` (${r.order_memo})` : '')),
            contact: r.contact_name || '',
            parking_fee: prev.parking_fee || 0,
            fuel_fee: prev.fuel_fee || 0
          });
        });

        stops.push({
          id: 'stop_return',
          type: 'return',
          name: origin.NAME || '가산 센터',
          addr: origin.ADDR || '서울 금천구 벚꽃로 278',
          time: '18:00',
          memo: '운행 복귀 및 마감'
        });

        // 시작 계기판 결정 (전일 종료 계기판 계승)
        var startKm = existingPayload.start_km;
        if (!startKm || startKm === 0) {
          var prevLogRes = await client.from('delivery_schedules')
            .select('memo_full')
            .eq('source_sheet', 'VEHICLE_TRIP_LOGS')
            .eq('customer_name', vehNo)
            .lt('delivery_date', cleanDate)
            .order('delivery_date', { ascending: false })
            .limit(1);

          if (prevLogRes.data && prevLogRes.data.length > 0 && prevLogRes.data[0].memo_full) {
            try {
              var pLog = JSON.parse(prevLogRes.data[0].memo_full);
              var pEnd = Number(pLog.end_km || pLog.start_km || 0);
              if (pEnd > 0) startKm = pEnd;
            } catch(e) {}
          }

          if (!startKm || startKm === 0) {
            var targetVeh = (cfg.vehicles || []).find(function(v) { return v.vehicle_no === vehNo; }) || {};
            startKm = targetVeh.current_km || targetVeh.initial_km || 0;
          }
        }

        var endKm = existingPayload.end_km || startKm;
        var distKm = existingPayload.distance_km || (endKm >= startKm ? (endKm - startKm) : 0);

        var mergedPayload = Object.assign({}, existingPayload, {
          vehicle_no: vehNo,
          trip_date: cleanDate,
          driver_name: drvName,
          start_km: startKm,
          end_km: endKm,
          distance_km: distKm,
          destination_addr: origin.ADDR,
          destination_name: origin.NAME,
          stops: stops,
          is_unoperated: false
        });

        if (existingRowId) {
          await client.from('delivery_schedules')
            .update({
              driver_name: drvName,
              status: existingPayload.is_closed ? '운행마감' : '운행중',
              memo_full: JSON.stringify(mergedPayload)
            })
            .eq('id', existingRowId);
        } else {
          await client.from('delivery_schedules').insert([{
            customer_name: vehNo,
            source_sheet: 'VEHICLE_TRIP_LOGS',
            delivery_date: cleanDate,
            driver_name: drvName,
            status: '운행중',
            delivery_method: '직배송',
            memo_full: JSON.stringify(mergedPayload)
          }]);
        }
      }

      if (window.AuditService) {
        window.AuditService.log('CONFIRM_DIRECT_DISPATCH', 'VEHICLES', cleanDate, { assignments: assignments });
      }
      return { success: true };
    } catch(err) {
      console.error('[VehicleService] confirmDispatchAndGenerateLogs 예외:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * PC에서 배송 스케줄이 추가/삭제/변경되었을 때 운행일지 stops 자동 동기화
   * @param {string} dateStr 'YYYY-MM-DD'
   */
  async function autoSyncTripLogsAfterScheduleChange(dateStr) {
    if (!dateStr) return { success: false };
    try {
      var cleanDate = (dateStr || '').replace(/\./g, '-').trim();
      var cfgRes = await fetchVehiclesConfig();
      var cfg = cfgRes.data;
      var activeUsage = cfg.active_usage || {};

      var currentAssignments = [];
      Object.keys(activeUsage).forEach(function(vKey) {
        var u = activeUsage[vKey];
        var uDate = (u && u.date) ? u.date.replace(/\./g, '-') : '';
        if (u && (uDate === cleanDate || !uDate) && u.driver) {
          currentAssignments.push({ driver: u.driver, vehicle: vKey });
        }
      });

      if (currentAssignments.length === 0) {
        return { success: true, count: 0 };
      }

      return await confirmDispatchAndGenerateLogs(cleanDate, currentAssignments);
    } catch(err) {
      console.warn('[VehicleService] autoSyncTripLogsAfterScheduleChange 실패:', err);
      return { success: false, error: err.message };
    }
  }

  window.VehicleService = {
    fetchVehiclesConfig: fetchVehiclesConfig,
    saveVehiclesConfig: saveVehiclesConfig,
    acquireLock: acquireLock,
    releaseLock: releaseLock,
    fetchTripLogs: fetchTripLogs,
    deleteTripLog: deleteTripLog,
    syncVehicleOdometer: syncVehicleOdometer,
    confirmDispatchAndGenerateLogs: confirmDispatchAndGenerateLogs,
    autoSyncTripLogsAfterScheduleChange: autoSyncTripLogsAfterScheduleChange
  };

})(typeof window !== 'undefined' ? window : this);
