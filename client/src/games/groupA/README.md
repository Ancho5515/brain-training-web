# Games 1–14

练习界面、题目生成和图形均为原创。每个组件负责一道练习，由宿主汇总三回合成绩。难度和随机种子决定题目，瞬时记忆还参考前一回合的答案。切换难度或种子时重新加载本回合。

`l` below is the integer level clamped to 1–30. Formula changes affect presentation, amount of information, interference, angle or response time; touch hit areas remain at least 44 px. These are independent project parameters, not a reproduction of an upstream scoring scheme.

| ID | Core rule and level parameters | Accuracy |
|---|---|---|
| 1 瞬时记忆 | 只数圆点。第 `l` 级从 `2+floor((l−1)×0.4)` 起随机取四个连续整数之一，排除上一回合的答案。三角形和方形合计 `2+floor(l/3)` 个，图案散布在画面上，展示 `2100−35l` 毫秒。 | `max(0,1−绝对计数误差/圆点数量)` |
| 2 视觉追踪 | One red target turns blue; all balls move, then selection unlocks. Balls `3+floor((l−1)/5)`, speed `11+0.8l` percent/sec, motion `2600+70l` ms. Positions derive from elapsed time with boundary reflection. | Correct identity 0/1 |
| 3 舒尔特方格 | Always 1–30 in cells spanning 2/3/4 units. Mental search for `42000−650l` ms, then last number is self-reported. | Last found / 30; explicitly tagged self-reported |
| 4 图形序列 | Repeating shapes only, with color and size distractors. Period `2+floor((l−1)/7)`; size interference increases each level. | Correct next shape 0/1 |
| 5 颜色干扰 | Central ink color, conflicting word meaning and side words. 3–6 choices; side-word font size `13+0.55l` px and more distractors at higher levels. | Correct ink color 0/1 |
| 6 路径记忆 | Recall only solid-marked cells in their original order, excluding hollow marks. Side 3–5; span `3+floor((l−1)/5)`; each frame `1000−15l` ms with a blank interval. | Correct ordered positions / longer sequence length |
| 7 数字闪记 | Recall underlined digits only in row-major order; underlined X and unmarked digits do not count. 3–10 targets on 4–6 columns; timed exposure. Leading zeros are preserved. | Correct positions / longer string length |
| 8 位置复原 | Unordered recall of solid cells, excluding striped cells. Side 3–5, targets 3–8, exposure `2500−30l` ms. Select all then submit. | Hits / (target count + false positives) |
| 9 配对翻牌 | Shape, texture and orientation must all match. 3–10 pairs; limit `50000−550l` ms. Only two cards can be open; mismatch is concealed before another attempt. | Matched pairs / total pairs |
| 10 旋转判断 | Connected chiral polyominoes; mirrors are rejected. 4–11 cells and an extra 0/15/30/45° display rotation between complexity increases. | Rotation-equivalence decision 0/1 |
| 11 目标搜索 | Select all exact shape/texture/orientation matches, then submit. `8+l` items and 2–8 targets. | Hits / (target count + false positives) |
| 12 节奏复刻 | Recall the bordered central dot, ignoring peripheral accompaniment; playback and tapping are separate stages. 2–7 gaps, more gap values, and faster peripheral interference. | Mean `max(0,1−abs(actual−expected)/expected)` across gaps, including missing/extra gaps in denominator |
| 13 快速心算 | Whole displayed expression with precedence and parentheses. Operand range grows every level; operators/grouping become more involved in five-level bands. All generated answers are integers. | Exact result 0/1 |
| 14 规则切换 | Top cue selects color or shape; at least one switch and one repeat per exercise. 4–11 stimuli, 3–5 options, per-stimulus limit `12000−200l` ms. Late responses require input but are scored incorrect. | Correct responses within the window / stimulus count |

Memory targets are removed from the rendered DOM before recall. The original target state remains in generator data for checking, as expected for a local client application. The UI never renders it as a recall hint. Presentation clocks use `performance.now()` and `requestAnimationFrame`; card concealment timers are removed on unmount. Background interruptions reset ongoing presentations, and the host also restarts interrupted exercises. A result latch prevents repeated input from calling `onFinish` twice. A pairing timeout waits for an explicit submission.

## Checks

- `npx vitest run src/games/groupA`: generator/checker tests, all 30 levels × three seeds, adjacent-level load checks, and server rendering of all 14 at levels 1/15/30 without a finish callback.
- `npx tsc --noEmit`: full client type check.
- `npm test` and `npm run build`: full client regression/build checks.
- `npx vite --host 127.0.0.1 --port 5175`, then `node src/games/groupA/browser-smoke.mjs`: actual component interaction at levels 1/15/30, recall hiding, motion, exact answers, repeated submission latch and target dimensions. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` if the binary is elsewhere. The harness is a development fixture, not imported by the application build.

A successful generated-answer test does not establish clinical validity, physical-device compatibility, or exact upstream scoring fidelity.
