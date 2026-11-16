-- 주요 업무 키워드 집계
--
-- 공고의 업무(duties) 문장에서 키워드 사전에 해당하는 표현을 정규식으로 찾아
-- 키워드마다 "언급한 공고 수"와 비율을 전체 공고 기준으로 계산한다.
-- 표본이나 LLM 추정이 아니라 모든 업무 항목을 직접 세므로 같은 입력이면 항상 같은 결과가 나온다.
--
-- 비율의 분모는 업무 정보(duties)가 있는 공고 수다.
-- 공백 문자 차이(NBSP·제로폭 공백)는 집계 전에 정규화한다.
-- 짧은 영문 토큰은 한글 조사가 바로 붙어도("AI를") 찾도록 \b 대신 영문자 전후 검사를 쓴다.
create or replace function public.get_duties_keyword_stats(top_n integer default 20)
returns jsonb
language sql
stable
set search_path = public
as $$
with
keyword_dict(keyword, pattern) as (
  values
    ('React',                   '(?<![a-z])react(?:\.?js)?(?![a-z])(?!\s*native)|리액트(?!\s*네이티브)'),
    ('React Native',            'react\s*native|리액트\s*네이티브'),
    ('Next.js',                 'next\.?js|넥스트'),
    ('TypeScript',              'typescript|타입스크립트|(?<![a-z])ts(?![a-z])'),
    ('JavaScript',              'javascript|자바스크립트|(?<![a-z])js(?![a-z])|es6'),
    ('Vue.js',                  '(?<![a-z])vue(?![a-z])|뷰\.?js'),
    ('상태 관리',                 '상태\s*관리|redux|zustand|recoil|jotai|mobx|react[\s-]*query|tanstack'),
    ('REST API 연동',            'rest\s*(?:ful)?\s*api|api\s*(?:연동|연계|개발|통신)|open\s*api'),
    ('GraphQL',                 'graphql'),
    ('실시간 통신',                'websocket|webrtc|웹\s*소켓|실시간'),
    ('UI/UX 구현',               '(?<![a-z])ui(?![a-z])|(?<![a-z])ux(?![a-z])|사용자\s*(?:인터페이스|경험)|화면\s*(?:개발|구현|설계)|페이지\s*(?:개발|구현)'),
    ('컴포넌트 개발',               '컴포넌트|component'),
    ('디자인 시스템',               '디자인\s*시스템|design\s*system'),
    ('반응형·크로스브라우징',          '반응형|크로스\s*브라우징|cross[\s-]*browsing|모바일\s*웹|웹뷰|webview'),
    ('웹 접근성',                  '접근성|accessibility|(?<![a-z])a11y(?![a-z])|웹\s*표준'),
    ('성능 최적화',                 '성능|최적화|optimi[sz]|lighthouse|web\s*vitals|속도\s*개선'),
    ('SEO',                     '(?<![a-z])seo(?![a-z])|검색\s*엔진\s*최적화'),
    ('코드 리뷰',                  '코드\s*리뷰|code\s*review'),
    ('테스트',                    '테스트|(?<![a-z])test|jest|cypress|playwright|vitest|(?<![a-z])qa(?![a-z])'),
    ('CI/CD·배포',               'ci\s*/\s*cd|(?<![a-z])ci(?![a-z])|(?<![a-z])cd(?![a-z])|배포|deploy|jenkins|github\s*actions|파이프라인'),
    ('클라우드·인프라',              '(?<![a-z])aws(?![a-z])|gcp|azure|docker|kubernetes|(?<![a-z])k8s(?![a-z])|클라우드|인프라'),
    ('협업·커뮤니케이션',             '협업|협의|소통|커뮤니케이션'),
    ('요구사항 분석·기획',            '요구\s*사항|기획'),
    ('유지보수·운영',               '유지\s*보수|운영|리팩토링|리팩터링|버그|장애'),
    ('데이터 시각화·대시보드',          '시각화|대시보드|dashboard|chart|차트'),
    ('백엔드·풀스택',               '백엔드|back[\s-]*end|풀스택|full[\s-]*stack|node\.?js|nestjs|spring'),
    ('모바일 앱',                  '모바일\s*앱|앱\s*(?:개발|서비스)|(?<![a-z])ios(?![a-z])|android|flutter'),
    ('AI·LLM 활용',              '(?<![a-z])ai(?![a-z])|llm|인공지능|생성형|chatgpt|(?<![a-z])gpt(?![a-z])|copilot|cursor'),
    ('빌드·번들링',                 'webpack|(?<![a-z])vite(?![a-z])|번들|빌드|turborepo|monorepo|모노레포'),
    ('문서화',                    '문서화|storybook|스토리북'),
    ('보안·인증',                  '보안|인증|oauth|(?<![a-z])jwt(?![a-z])'),
    ('모니터링',                   '모니터링|sentry|datadog|(?<![a-z])ga4(?![a-z])|analytics')
),
postings as (
  select id, duties
  from public.job_postings
  where duties is not null and cardinality(duties) > 0
),
total as (
  select count(*)::integer as n from postings
),
-- 업무 문장마다 한 번만 정규화한다. 데이터에는 NBSP(U+00A0)·제로폭 공백(U+200B) 등이 섞여 있어
-- Postgres의 \s가 놓치므로 일반 공백으로 바꾸거나 제거한 뒤 매칭한다.
duty_items as materialized (
  select
    p.id,
    regexp_replace(
      regexp_replace(duty, '[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]', ' ', 'g'),
      '[\u200b\ufeff]', '', 'g'
    ) as duty
  from postings p
  cross join lateral unnest(p.duties) as duty
),
-- 키워드를 바깥 루프로 고정해 같은 정규식을 문장 전체에 연속해서 적용한다
-- Postgres는 컴파일한 정규식을 32개까지만 캐시하므로 문장마다 키워드를 번갈아 돌리면 매번 다시 컴파일한다
matched as (
  select d.keyword, m.posting_count
  from keyword_dict d
  cross join lateral (
    select count(distinct i.id)::integer as posting_count
    from duty_items i
    where i.duty ~* d.pattern
  ) m
  where m.posting_count > 0
),
top_keywords as (
  select keyword, posting_count
  from matched
  order by posting_count desc, keyword
  limit greatest(top_n, 1)
)
select jsonb_build_object(
  'totalPostings', (select n from total),
  'keywords', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'keyword', keyword,
        'count', posting_count,
        'percent', round(posting_count * 100.0 / nullif((select n from total), 0))::integer
      ) order by posting_count desc, keyword
    )
    from top_keywords
  ), '[]'::jsonb)
);
$$;

grant execute on function public.get_duties_keyword_stats(integer) to anon, authenticated;
