# AGENTS.md

모든 AI 에이전트(Claude Code, Codex, Antigravity 등)가 공통으로 따르는 프로젝트 안내예요.

## 프로젝트
- 삼일PwC AX War 1 해커톤 프로젝트. 가상 화장품 그룹 Aurora의 AI 운영 시스템을 만들어요.
- 마감: **2026-11-15(일) 23:59 KST**
- 배경·평가 기준: [docs/hackathon-overview.md](docs/hackathon-overview.md)
- 8개 업무 목록: [docs/mission.md](docs/mission.md)
- 제출 방법: [docs/submission-guide.md](docs/submission-guide.md)
- 문제 자료·원본 데이터: `01_참가자_배포용/` (읽기 전용 자료로 다뤄요)

## 구조
- `public/` — 배포되는 정적 사이트 (`public/index.html`)
- `axhub.yaml` — AXHub 배포 설정 (`deploy_method: static`, `static_output_dir: public`)
- `docs/` — 해커톤 요약 문서

## 반드시 지킬 것
- `.claude/` · `.codex/` · `.agents/` 폴더와 `.gitignore` 는 **지우거나 고치지 않아요.** 개인 기록 키가 들어 있어요.
- 위 세 폴더 내용은 커밋·공유·출력하지 않아요. 소스 zip 을 만들 때도 빼요.
- 모든 작업은 이 폴더(프로젝트 루트)에서 해요.

## 작업 방식
- 사용자와는 한국어로 대화해요.
- 배포는 AXHub 로 해요. 정적 산출물은 `public/` 에 둬요.
