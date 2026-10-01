/**
 * geo-utils.js - 지오코딩, 주소 정제, 도로망 거리/시간 계산 및 연락처 파싱 공통 유틸리티
 * 
 * 100% 하위 호환성을 위해 기존 전역 함수명을 window 최상위 스코프에 그대로 제공합니다.
 */
(function(window) {
  'use strict';

  // 1. 주요 배송지 및 거점 좌표 사전
  var PRESET_COORDINATES = {
    "가산": { lat: 37.479493, lng: 126.884635 },
    "가산 센터": { lat: 37.479493, lng: 126.884635 },
    "가산센터": { lat: 37.479493, lng: 126.884635 },
    "SJ테크노빌": { lat: 37.479493, lng: 126.884635 },
    "서울특별시 금천구 벚꽃로 278": { lat: 37.479493, lng: 126.884635 },
    "서울 금천구 벚꽃로 278": { lat: 37.479493, lng: 126.884635 },
    "금천구 벚꽃로 278": { lat: 37.479493, lng: 126.884635 },
    "경기도 화성시 양감면 초록로 594-67": { lat: 37.0754, lng: 126.9325 },
    "인천광역시 남동구 만수로 107": { lat: 37.46474, lng: 126.73773 },
    "인천광역시 남동구 만수로 107 3층 현대렌탈서비스": { lat: 37.46474023, lng: 126.73773049 },
    "대한기계학회": { lat: 37.5003, lng: 127.0298 },
    "테헤란로7길 22": { lat: 37.5003, lng: 127.0298 },
    "헥사곤지엠아이": { lat: 37.5115, lng: 127.0378 },
    "언주로 603": { lat: 37.5115, lng: 127.0378 },
    "서울 중구 세종대로 55": { lat: 37.5618, lng: 126.9749 },
    "부영태평빌딩": { lat: 37.5618, lng: 126.9749 },
    "서울 중구 퇴계로 324": { lat: 37.5635, lng: 127.0039 },
    "서울 중구 명동길 26": { lat: 37.563066, lng: 126.986629 },
    "서울 중구 수표로 34": { lat: 37.5645, lng: 126.9904 },
    "서울 강서구 하늘길 13": { lat: 37.5585, lng: 126.8016 },
    "서울숲A타워": { lat: 37.5484, lng: 127.0468 },
    "서울 성동구 상원1길 26": { lat: 37.5484, lng: 127.0468 },
    "서울 영등포구 양산로 91": { lat: 37.5262, lng: 126.8962 },
    "서울 구로구 디지털로 288": { lat: 37.4848, lng: 126.8961 },
    "서울 구로구 디지털로26길 5": { lat: 37.48161, lng: 126.89347 },
    "서울 용산구 백범로 341": { lat: 37.53798, lng: 126.96798 },
    "서울 강남구 논현로81길 9": { lat: 37.49799, lng: 127.03735 },
    "서울 서대문구 통일로 440-1": { lat: 37.5887103667691, lng: 126.944242309924 },
    "경기 파주시 월롱면 홀작로 75-25": { lat: 37.7946, lng: 126.8085 },
    "경기 파주시 회동길 231-10": { lat: 37.7126, lng: 126.6853 },
    "경기 안양시 동안구 시민대로 180": { lat: 37.3942, lng: 126.9568 },
    "경기 용인시 기흥구 중부대로 262": { lat: 37.26975, lng: 127.09651 },
    "경기 수원시 팔달구 효원로 1": { lat: 37.2750, lng: 127.0105 }
  };

  // 2. 통합 지오코딩 캐시 관리 (메모리 + localStorage 동기화)
  var GEO_CACHE = window.GEO_CACHE || {};
  try {
    var storedCache = JSON.parse(localStorage.getItem('KAKAO_GEO_CACHE_V2') || '{}');
    Object.assign(GEO_CACHE, storedCache);
  } catch(e) {}

  for (var key in PRESET_COORDINATES) {
    GEO_CACHE[key] = PRESET_COORDINATES[key];
  }
  try {
    localStorage.setItem('KAKAO_GEO_CACHE_V2', JSON.stringify(GEO_CACHE));
  } catch(e) {}

  window.PRESET_COORDINATES = PRESET_COORDINATES;
  window.GEO_CACHE = GEO_CACHE;

  // 3. 도로명/지번 기본 주소 정제 함수 (검색 성공률 극대화)
  function extractRoadBaseAddress(addr) {
    if (!addr) return '';
    var cleaned = addr.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
    var m = cleaned.match(/^([가-힣0-9\s]+?(?:대로|로\d*길|로|길|가|동|리)\s+\d+(?:-\d+)?)/);
    if (m) return m[1].trim();
    return cleaned.replace(/\([^)]*\)/g, ' ').replace(/(빌딩|타워|센터|오피스텔|아파트|상가|지점|\d+층|\d+호).*/g, '').trim();
  }

  // 4. 카카오 지오코더를 이용한 정밀 주소 좌표 변환
  var kakaoGeocoder = null;
  var kakaoPlaces = null;

  function resolveAddressCoord(rawAddr) {
    return new Promise(function(resolve) {
      var centerFallback = { lat: 37.479493, lng: 126.884635 };
      if (!rawAddr) {
        resolve(centerFallback);
        return;
      }
      var cleanKey = rawAddr.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();

      // 1. 메모리 & 로컬 캐시 조회
      if (GEO_CACHE[cleanKey]) {
        resolve(GEO_CACHE[cleanKey]);
        return;
      }
      var baseAddr = extractRoadBaseAddress(cleanKey);
      if (baseAddr && GEO_CACHE[baseAddr]) {
        GEO_CACHE[cleanKey] = GEO_CACHE[baseAddr];
        resolve(GEO_CACHE[baseAddr]);
        return;
      }

      // 2. 카카오 SDK 로드 상태 확인 및 인스턴스화
      if (!kakaoGeocoder && window.kakao && window.kakao.maps && window.kakao.maps.services) {
        kakaoGeocoder = new kakao.maps.services.Geocoder();
        kakaoPlaces = new kakao.maps.services.Places();
      }

      if (!kakaoGeocoder) {
        resolve(centerFallback);
        return;
      }

      // 3. 원본 주소로 검색
      kakaoGeocoder.addressSearch(cleanKey, function(res1, st1) {
        if (st1 === kakao.maps.services.Status.OK && res1 && res1.length > 0) {
          var coord1 = { lat: parseFloat(res1[0].y), lng: parseFloat(res1[0].x) };
          GEO_CACHE[cleanKey] = coord1;
          try { localStorage.setItem('KAKAO_GEO_CACHE_V2', JSON.stringify(GEO_CACHE)); } catch(e) {}
          resolve(coord1);
        } else {
          // 정제된 도로명 기본 주소로 재검색
          if (baseAddr && baseAddr !== cleanKey) {
            kakaoGeocoder.addressSearch(baseAddr, function(res2, st2) {
              if (st2 === kakao.maps.services.Status.OK && res2 && res2.length > 0) {
                var coord2 = { lat: parseFloat(res2[0].y), lng: parseFloat(res2[0].x) };
                GEO_CACHE[cleanKey] = coord2;
                GEO_CACHE[baseAddr] = coord2;
                try { localStorage.setItem('KAKAO_GEO_CACHE_V2', JSON.stringify(GEO_CACHE)); } catch(e) {}
                resolve(coord2);
              } else {
                // 키워드 장소 검색 시도
                if (kakaoPlaces) {
                  kakaoPlaces.keywordSearch(baseAddr, function(res3, st3) {
                    if (st3 === kakao.maps.services.Status.OK && res3 && res3.length > 0) {
                      var coord3 = { lat: parseFloat(res3[0].y), lng: parseFloat(res3[0].x) };
                      GEO_CACHE[cleanKey] = coord3;
                      try { localStorage.setItem('KAKAO_GEO_CACHE_V2', JSON.stringify(GEO_CACHE)); } catch(e) {}
                      resolve(coord3);
                    } else {
                      resolve(centerFallback);
                    }
                  });
                } else {
                  resolve(centerFallback);
                }
              }
            });
          } else {
            if (kakaoPlaces) {
              kakaoPlaces.keywordSearch(cleanKey, function(res4, st4) {
                if (st4 === kakao.maps.services.Status.OK && res4 && res4.length > 0) {
                  var coord4 = { lat: parseFloat(res4[0].y), lng: parseFloat(res4[0].x) };
                  GEO_CACHE[cleanKey] = coord4;
                  try { localStorage.setItem('KAKAO_GEO_CACHE_V2', JSON.stringify(GEO_CACHE)); } catch(e) {}
                  resolve(coord4);
                } else {
                  resolve(centerFallback);
                }
              });
            } else {
              resolve(centerFallback);
            }
          }
        }
      });
    });
  }

  // 동기식 캐시 조회 전용 함수
  function getCoordForAddress(addr) {
    var centerFallback = { lat: 37.479493, lng: 126.884635 };
    if (!addr) return centerFallback;
    var clean = addr.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
    if (GEO_CACHE[clean]) return GEO_CACHE[clean];
    var base = extractRoadBaseAddress(clean);
    if (base && GEO_CACHE[base]) return GEO_CACHE[base];
    return centerFallback;
  }

  // 5. 서울/수도권 도심 실주행 소요시간 보정 모델 (OSRM 이론치 -> 실측 기준)
  function estimateRealisticUrbanTravelTime(distKm, osrmBaseDurationSec, stopCount) {
    var now = new Date();
    var hour = now.getHours();
    var day = now.getDay(); // 0: 일, 6: 토
    var isWeekend = (day === 0 || day === 6);

    // 도심 실주행 기본 속도 가중치 (OSRM 기본 50~60km/h 이론치 -> 서울 도심 평일 평균 17~20km/h 환산)
    var trafficMultiplier = 2.35;

    if (!isWeekend) {
      if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
        trafficMultiplier = 2.58; // 출퇴근 피크
      } else if (hour >= 10 && hour <= 16) {
        trafficMultiplier = 2.35; // 평일 낮
      } else if (hour >= 21 || hour <= 6) {
        trafficMultiplier = 1.45; // 심야/새벽
      }
    } else {
      trafficMultiplier = 1.85; // 주말
    }

    // 경유지 진출입 및 골목길/신호 대기 페널티 (개소당 평균 7.5분)
    var stopPenaltySec = stopCount * 450;

    // 실측 최소 소요시간(도심 평균 17.5km/h 기준) 비교 가드
    var calculatedSec = Math.round(osrmBaseDurationSec * trafficMultiplier + stopPenaltySec);
    var minUrbanDurationSec = Math.round((distKm / 17.5) * 3600);
    var finalSeconds = Math.max(calculatedSec, minUrbanDurationSec);

    var hrs = Math.floor(finalSeconds / 3600);
    var mins = Math.round((finalSeconds % 3600) / 60);

    var timeStr = (hrs > 0 ? (hrs + '시간 ') : '') + (mins < 1 ? 1 : mins) + '분';

    return {
      totalSeconds: finalSeconds,
      timeStr: timeStr,
      stopCount: stopCount
    };
  }

  // 6. 전화번호 및 연락처 정제 엔진
  function cleanPhoneNumber(raw) {
    if (!raw) return '';
    var cleaned = String(raw).trim();
    // Excel 지수 표기법 처리 (예: 1.01234E+10)
    if (/^\d+(\.\d+)?[eE]\+\d+$/.test(cleaned)) {
      try {
        cleaned = BigInt(Math.floor(Number(cleaned))).toString();
      } catch (e) {
        cleaned = Number(cleaned).toFixed(0);
      }
    }
    var digits = cleaned.replace(/[^0-9]/g, '');
    if (!digits) return '';

    // 엑셀에서 앞자리 0이 누락된 경우
    if ((digits.length === 10 || digits.length === 9) && digits.startsWith('10')) {
      digits = '0' + digits;
    }

    // 한국 표준 번호 서식
    if (digits.startsWith('02')) {
      if (digits.length === 9) return digits.replace(/(\d{2})(\d{3})(\d{4})/, '$1-$2-$3');
      if (digits.length === 10) return digits.replace(/(\d{2})(\d{4})(\d{4})/, '$1-$2-$3');
    } else if (digits.startsWith('01') || digits.startsWith('070') || digits.startsWith('050') || digits.startsWith('03') || digits.startsWith('04') || digits.startsWith('05') || digits.startsWith('06')) {
      if (digits.length === 10) return digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
      if (digits.length === 11) return digits.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
    }
    if (cleaned.indexOf('-') !== -1) return cleaned;
    return digits;
  }

  function parseContactInfo(raw) {
    if (!raw) return { name: '', phone: '' };
    var str = String(raw).trim();
    if (/^\d+(\.\d+)?[eE]\+\d+$/.test(str)) {
      return { name: '', phone: cleanPhoneNumber(str) };
    }
    var phoneMatch = str.match(/(?:0\d{1,2}|10)[-\s]?\d{3,4}[-\s]?\d{4}/);
    var phone = '';
    var name = str;
    if (phoneMatch) {
      phone = cleanPhoneNumber(phoneMatch[0]);
      name = str.replace(phoneMatch[0], '').replace(/[\(\)\[\],\/]/g, ' ').trim();
    } else {
      var onlyDigits = str.replace(/[^0-9]/g, '');
      if (onlyDigits.length >= 8 && onlyDigits.length <= 11) {
        phone = cleanPhoneNumber(onlyDigits);
        name = '';
      }
    }
    return { name: name, phone: phone };
  }

  // 전역 함수 바인딩 (100% 하위 호환성)
  window.extractRoadBaseAddress = extractRoadBaseAddress;
  window.resolveAddressCoord = resolveAddressCoord;
  window.resolveMobileAddressCoord = resolveAddressCoord; // 모바일 호환성
  window.getCoordForAddress = getCoordForAddress;
  window.estimateRealisticUrbanTravelTime = estimateRealisticUrbanTravelTime;
  window.cleanPhoneNumber = cleanPhoneNumber;
  window.parseContactInfo = parseContactInfo;

  window.GeoUtils = {
    PRESET_COORDINATES: PRESET_COORDINATES,
    GEO_CACHE: GEO_CACHE,
    extractRoadBaseAddress: extractRoadBaseAddress,
    resolveAddressCoord: resolveAddressCoord,
    getCoordForAddress: getCoordForAddress,
    estimateRealisticUrbanTravelTime: estimateRealisticUrbanTravelTime,
    cleanPhoneNumber: cleanPhoneNumber,
    parseContactInfo: parseContactInfo
  };

})(typeof window !== 'undefined' ? window : this);
