/* =========================================================================
   Supabase 접속 정보

   Supabase 대시보드 → Project Settings → API 에서 두 값을 복사해 넣는다.
     url     : Project URL          (예: https://abcdefgh.supabase.co)
     anonKey : anon / public key    (eyJ... 로 시작하는 긴 문자열)

   anon key 는 브라우저에 노출되는 것이 정상이다. 공개되어도 되는 키이며,
   실제 접근 통제는 schema.sql 의 RLS 정책이 한다.
   반대로 service_role key 는 절대 이 파일에 넣지 않는다. RLS를 무시하는 키다.
   ========================================================================= */

const SUPABASE_CONFIG = {
  url:     "여기에_PROJECT_URL",
  anonKey: "여기에_ANON_KEY",
};
