/**
 * constants-master.js - 배송스케줄 통합 관제 시스템 공통 상수 및 설정 마스터
 * 
 * 100% 하위 호환성을 위해 window 최상위 전역 스코프에 바인딩됩니다.
 */
(function(window) {
  'use strict';

  var ConstantsMaster = {
    // 1. 기본 본사/거점 센터 정보
    CENTER_INFO: {
      NAME: '가산 센터',
      ADDR: '서울특별시 금천구 벚꽃로 278 (SJ테크노빌)',
      SHORT_ADDR: '서울 금천구 벚꽃로 278',
      COORDS: { lat: 37.479493, lng: 126.884635 }
    },

    // 2. Supabase source_sheet 명칭 표준
    SHEETS: {
      SCHEDULE_CSV: 'CSV업로드',
      SCHEDULE_MANUAL: '직접추가',
      VEHICLE_TRIP_LOGS: 'VEHICLE_TRIP_LOGS',
      VEHICLE_MAINTENANCE_LOGS: 'VEHICLE_MAINTENANCE_LOGS',
      VEHICLE_DAMAGE_PHOTOS: 'VEHICLE_DAMAGE_PHOTOS',
      AS_RECORDS: 'AS_RECORDS',
      CONFIG_VEHICLES: 'SYSTEM_CONFIG_VEHICLES',
      CONFIG_USERS: 'SYSTEM_CONFIG_USERS',
      CONFIG_DRIVER_ORIGINS: 'SYSTEM_CONFIG_DRIVER_ORIGINS',
      CONFIG_ASSET_MASTER: 'SYSTEM_CONFIG_ASSET_AUDIT_MASTER',
      CONFIG_ASSET_SCANS: 'SYSTEM_CONFIG_ASSET_AUDIT_SCANS',
      CONFIG_QUICK_MEMOS: 'SYSTEM_CONFIG_QUICK_MEMOS'
    },

    // 3. 법인차량 기본 마스터 (클라우드 조회 실패 시 안전 폴백)
    DEFAULT_CORPORATE_VEHICLES: [
      { vehicle_no: '801부8744', model_name: '스타리아', default_driver: '김승지', initial_km: 70000, current_km: 72247, is_active: true },
      { vehicle_no: '826라8911', model_name: '스타리아', default_driver: '조경찬', initial_km: 180000, current_km: 182000, is_active: true }
    ],

    // 4. 기본 배송 기사 목록 (클라우드 조회 실패 시 안전 폴백)
    DEFAULT_DRIVERS: ['조경찬', '김승지', '한민혁', '신동선'],

    // 5. 주요 지역별 폴백 좌표 (지오코딩 실패 시 안전 거리 계산용)
    REGION_COORDS: {
      '가산': { lat: 37.479493, lng: 126.884635 },
      '가산 센터': { lat: 37.479493, lng: 126.884635 },
      'SJ테크노빌': { lat: 37.479493, lng: 126.884635 },
      '금천': { lat: 37.4568, lng: 126.8954 },
      '구로': { lat: 37.4954, lng: 126.8874 },
      '영등포': { lat: 37.5264, lng: 126.8962 },
      '강남': { lat: 37.4979, lng: 127.0276 },
      '서초': { lat: 37.4836, lng: 127.0327 },
      '송파': { lat: 37.5145, lng: 127.1058 },
      '마포': { lat: 37.5663, lng: 126.9016 },
      '종로': { lat: 37.5730, lng: 126.9794 },
      '중구': { lat: 37.5636, lng: 126.9975 },
      '성동': { lat: 37.5634, lng: 127.0369 },
      '광진': { lat: 37.5385, lng: 127.0823 },
      '용산': { lat: 37.5326, lng: 126.9900 },
      '인천': { lat: 37.4563, lng: 126.7052 },
      '수원': { lat: 37.2636, lng: 127.0286 },
      '성남': { lat: 37.4200, lng: 127.1265 }
    }
  };

  // 전역 네임스페이스 바인딩
  window.ConstantsMaster = ConstantsMaster;

  // 호환성용 전역 변수 매핑
  if (!window.REGION_COORDS) window.REGION_COORDS = ConstantsMaster.REGION_COORDS;

})(typeof window !== 'undefined' ? window : this);
