/**
 * supabase-config.js - Supabase 클라우드 클라이언트 단일 초기화 및 마스터 설정 모듈
 * 
 * 100% 하위 호환성을 위해 window 최상위 전역 스코프에 바인딩되며,
 * 게으른 초기화(Lazy Initialization)를 통해 스크립트 로드 순서와 무관하게 안정적으로 동작합니다.
 */
(function(window) {
  'use strict';

  var SUPABASE_URL = "https://gideypynmhpjucgszyce.supabase.co";
  var SUPABASE_ANON_KEY = "sb_publishable_pLF_neZMUjj3G7PsiH_tuw_rfRuu8eP";

  var clientInstance = null;

  function initClient() {
    if (!clientInstance && window.supabase && typeof window.supabase.createClient === 'function') {
      try {
        clientInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      } catch (err) {
        console.error('Supabase 클라이언트 초기화 오류:', err);
      }
    }
    return clientInstance;
  }

  // 즉시 초기화 시도
  initClient();

  // window.SUPABASE_URL & window.SUPABASE_ANON_KEY 바인딩
  window.SUPABASE_URL = SUPABASE_URL;
  window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

  // window.supabaseClient getter/setter 정의 (항상 유효한 클라이언트 인스턴스 반환)
  try {
    Object.defineProperty(window, 'supabaseClient', {
      configurable: true,
      enumerable: true,
      get: function() {
        return initClient();
      },
      set: function(val) {
        clientInstance = val;
      }
    });
  } catch (e) {
    window.supabaseClient = initClient();
  }

  // SupabaseConfig 네임스페이스 노출
  window.SupabaseConfig = {
    URL: SUPABASE_URL,
    ANON_KEY: SUPABASE_ANON_KEY,
    getClient: initClient
  };

})(typeof window !== 'undefined' ? window : this);
