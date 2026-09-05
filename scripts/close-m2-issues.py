#!/usr/bin/env python3
"""Update and close completed M2 GitHub issues with evidence."""
import subprocess
import time

REPO = "ther12k/rz-quran"

M2_EVIDENCE = {
    "T026": """### Implemented & Tested Evidence
- **Catalog search & category filtering**: Implemented in `apps/api/src/modules/learning.ts` (`GET /api/v1/catalog?search=...&lesson_type=...&stage_key=...`) and in `apps/web/src/pages/catalog.tsx`.
- **Category chips**: All, Huruf (listening), Surat Pendek (surah), Kuis (quiz), Permainan (game).
- **Test verification**: Verified in `tests/api/m2-learning-experience.test.ts` (search, category filter).""",

    "T027": """### Implemented & Tested Evidence
- **DAG prerequisite evaluation**: Server evaluates stage prerequisites against child completed lessons (`apps/api/src/modules/learning.ts`).
- **Access locking**: Stage 3 short surahs locked until foundational lessons are completed, unless bypassed via parent stage override.
- **Test verification**: Tested in `tests/api/m2-learning-experience.test.ts` (locked state -> foundational completion -> unlocked state).""",

    "T028": """### Implemented & Tested Evidence
- **Single audio controller**: Implemented `apps/web/src/audio/controller.ts` with generation tokens, cancellation on navigation, and stop/replay methods.
- **Error handling & cleanup**: Guaranteed single audio source playing at any moment.""",

    "T029": """### Implemented & Tested Evidence
- **Authorized media delivery**: `GET /api/v1/media/:assetId/playback` verifies active child session, verified asset status, and returns short-lived tokenized stream URL.
- **Honest missing media state**: If unverified or missing, returns 503 `MEDIA_UNAVAILABLE`.""",

    "T030": """### Implemented & Tested Evidence
- **Listen-and-imitate steps**: Implemented repetition targets (1x / 3x) and self-directed practice acknowledgment in `apps/web/src/pages/lesson-player.tsx`.
- **Honest no-recording invariant**: Clear notice: 'Dengarkan pelafalan... lalu tirukan. Suaramu tidak direkam.'""",

    "T031": """### Implemented & Tested Evidence
- **Short-surah & Ayah practice**: 5 pilot surahs (Al-Fatihah, Al-Kautsar, Al-Ikhlas, Al-Falaq, An-Nas) seeded with authentic Tanzil simple clean text.
- **Ayah-by-ayah rendering**: Authentic diacritics, RTL Arabic font (`apps/web/src/pages/lesson-player.tsx`).
- **Test verification**: Tested in `tests/api/m2-learning-experience.test.ts`.""",

    "T032": """### Implemented & Tested Evidence
- **Question choices serialization**: Server stores answer keys in private `questions` table; public DTO omits `correct_option_id` and explanations.
- **Test verification**: Tested in `tests/api/e2e-slice.test.ts`.""",

    "T033": """### Implemented & Tested Evidence
- **First-response scoring & retries**: `POST /learning/sessions/:id/answers` records first attempt in `first_answers` table; subsequent attempts do not overwrite first score.
- **Test verification**: Tested in `tests/api/e2e-slice.test.ts` (`first_response: true` on first try, `false` on retry).""",

    "T034": """### Implemented & Tested Evidence
- **5-question Quiz UI**: Implemented in `apps/web/src/pages/lesson-player.tsx` and seeded in `packages/database/src/seed-pilot.ts`.
- **Supportive feedback**: Step indicator ('Soal 3 dari 5'), instant answer evaluation, no timer pressure.""",

    "T035": """### Implemented & Tested Evidence
- **Sound-matching 5-round game**: Seeded in `packages/database/src/seed-pilot.ts` (`game_match_sound_1`) and supported in `apps/web/src/pages/lesson-player.tsx`.
- **Accessible tap selection**: Primary tap interface with separate playing, feedback, and completion states.""",

    "T036": """### Implemented & Tested Evidence
- **Resume & sequence tracking**: Active session resume returns current question and progress fraction. Contiguous event sequences enforced transactional via `last_sequence`.
- **Test verification**: Tested in `tests/api/e2e-slice.test.ts` and `isolation.test.ts`.""",

    "T037": """### Implemented & Tested Evidence
- **Parent memorization assessments**: `GET` and `POST /api/v1/parent/children/:childId/assessments` records append-only observations (`needs_practice`, `developing`, `parent_confirmed`).
- **UI controls**: Tab in `apps/web/src/pages/parent-progress.tsx` for the 5 short surahs.
- **Test verification**: Tested in `tests/api/m2-learning-experience.test.ts`.""",

    "T038": """### Implemented & Tested Evidence
- **Active-time buckets & weekly report**: Heartbeat clamping (max 15s) and transactional daily rollups in `daily_activity`.
- **Reporting display**: Weekly chart and accessible table alternative in `apps/web/src/pages/parent-progress.tsx`.""",

    "T039": """### Implemented & Tested Evidence
- **Child achievements & stars**: First-completion stars in `rewards` table; descriptive non-competitive practice badges ('Langkah Pertama', 'Sahabat Huruf', 'Latihan Surat Pendek') in `GET /learning/progress`.
- **Test verification**: Tested in `tests/api/m2-learning-experience.test.ts`.""",

    "T040": """### Implemented & Tested Evidence
- **Soft session goals & comfort settings**: `GET/PUT /api/v1/parent/children/:childId/settings` supporting 5, 10, 15 min goals, quiet celebrations, and reduced motion.
- **UI in parent area & child break affordance**: 'Selesai dulu dan istirahat' button in `lesson-player.tsx`.
- **Test verification**: Tested in `tests/api/m2-learning-experience.test.ts`.""",

    "T071": """### Implemented & Tested Evidence
- **Landing page polish**: `apps/web/src/pages/landing.tsx` contains complete 8 feature benefit cards, clear parent sign-up CTAs, and explicit non-production demo disclaimers.
- **Screenshots captured**: Verified at 390px, 768px, and 1440px viewports.""",

    "T072": """### Implemented & Tested Evidence
- **Parent stage override & session replacement**: `POST /parent/children/:childId/stage-overrides` and `POST /parent/children/:childId/replace-session`.
- **UI controls**: Stage override button in Parent Dashboard Settings tab (`apps/web/src/pages/parent-progress.tsx`)."""
}

def sh(*args):
    return subprocess.run(args, capture_output=True, text=True)

def main():
    import json
    issues = json.loads(sh("gh", "issue", "list", "-R", REPO, "--state", "open", "--limit", "100", "--json", "number,title").stdout or "[]")
    
    for issue in issues:
        num = issue["number"]
        title = issue["title"]
        tid = title.split(" ")[0]
        if tid in M2_EVIDENCE:
            comment = M2_EVIDENCE[tid]
            print(f"Closing {tid} (#{num})...")
            sh("gh", "issue", "comment", str(num), "-R", REPO, "-b", comment)
            sh("gh", "issue", "close", str(num), "-R", REPO, "-r", "completed")
            time.sleep(0.5)

    print("Completed M2 issue updates.")

if __name__ == "__main__":
    main()
