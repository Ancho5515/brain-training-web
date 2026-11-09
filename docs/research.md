# 前额叶训练网页：40款游戏调研与实施建议

调研日期：2026-11-09（Asia/Shanghai）。建议仓库：**brain-training-web**。本文交付的是玩法与来源清单、实现建议和准备事项；新项目尚未构建或验收。

## 1. 结论与核验范围

可以做成在家中电脑运行、手机与 iPad 通过同一局域网访问的独立网站。已核对原站 **40款游戏的名称、六类归属和公开玩法**，并为每款整理了免费体验、相关开源成品或可用的基础组件。部分是同类实现，部分仍需要独立编写，清单中逐项说明。

[原站首页](https://qey.luqingheceshi.cn/?screen=home)可以查看目录与规则。实际以匿名身份点击“颜色干扰”的开始按钮后出现登录/注册提示，未进入正式游戏。玩法依据包括公开规则弹窗和用于显示同一文案的公开目录元数据；没有登录原站、购买会员或取得授权后页面。原站完整计分、各游戏全部30级参数和登录后完整流程，本轮没有核验。

开源项目的 README、实际 LICENSE 或具体包的许可声明，以及关键玩法文件已读取。下面的“试玩”是免费体验入口；不是逐个完成游戏的测试报告。部分上游演示地址只确认来自作者 README，读取器无法完整运行，已在相关条目或来源表标出。新项目实施时仍需本地运行和设备验证。

建议：以公开玩法为功能目标，原创界面、题目与图形，使用有明确许可的代码部件；为难度和评分制定独立、透明、可复现的规则。训练记录展示实际游戏表现，保留同级别比较，不制作未经验证的 IQ、脑龄或医疗结论。

## 2. 用户提供的 CozyPlay 参考

[CozyPlay前额叶分类](https://cozyplay.games/zh/category/brain/)有5款，加上记忆分类里的翻牌，可以给原站 **6项玩法**提供直接体验。已读取每项玩法页、关于页和隐私页。免费、无需账号的说明可以确认；没有找到其公开源码仓库或明确的开源许可证，因此目前按**免费玩法参考**登记，不作为已获许可的代码源。

| 原站项目 | CozyPlay直接入口 | 已确认的主要区别 |
|---|---|---|
| 舒尔特方格 | [Schulte](https://cozyplay.games/zh/games/schulte/) | 3×3/4×4/5×5按序点击；原站是1–30与限时自报进度。 |
| 位置复原 | [Memory Matrix](https://cozyplay.games/zh/games/memory-matrix/) | 亮格位置回忆；需另补原站的实心/条纹干扰和一次提交。 |
| 配对翻牌 | [Memory Match](https://cozyplay.games/zh/games/memory-match/) | 常规配对；原站要求形状、纹理、朝向全部一致并限时。 |
| 记忆接力 | [N-back](https://cozyplay.games/zh/games/nback/) | 使用数字；原站按形状判断并忽略颜色。 |
| 颜色干扰 | [Stroop](https://cozyplay.games/zh/games/stroop/) | 中央色词判断；原站另有两侧文字干扰。 |
| 规则切换 | [Task Switch](https://cozyplay.games/zh/games/task-switch/) | 由背景色提示数字奇偶/大小；原站按顶部提示选颜色/形状。 |

[隐私页](https://cozyplay.games/zh/privacy/)说明其最高分与部分进度保存在浏览器 localStorage，换设备不会同步。这能参考访客模式；你要求的账号、跨设备进度需要由我们自己的服务端保存。个别页面的说明存在三条生命/一次错误结束等不一致，具体实现应使用本项目明确定义的规则，不照抄营销文案。

## 3. 全40款玩法与来源

编号沿用原站公开卡片编号，排序按六个类别。链接分为：**免费体验**、**完整同类源码**、**邻近源码/组件**。每个来源都注明实质差异；“同类”不表示逐项复刻了原站难度或计分。GPL来源只作明确登记的参考，是否直接采用其代码取决于后续项目许可选择。

### 注意力（7款）

| 编号 / 原站名称 | 具体玩法：公开规则摘要 | 免费体验与开源参考 | 匹配程度、必须补充的内容 |
|---|---|---|---|
| 03 **舒尔特方格** | 在不等大的格子中依序寻找1–30，限时后填入最后找到的数。原版以自报进度计分。 | [CozyPlay试玩](https://cozyplay.games/zh/games/schulte/)；[Schulte源码](https://github.com/BerkYeni/schultetable)（MIT） | 同类。参考版主要按序点击1–25；需增加不规则布局、1–30和原版自报模式。可另提供点击核验模式，记录时分开。 |
| 11 **目标搜索** | 按顶部目标找出所有相同图案，多选后一次提交。 | [jsPsych点选搜索](https://github.com/jspsych/jspsych-contrib/tree/main/packages/plugin-visual-search-click-target)（MIT包声明）；[Puzzle取消搜索](https://github.com/sidhant947/Puzzle/tree/main/lib/ui/features/games/letter_cancellation)（GPL-3.0） | 同类部件。前者通常找到一个就结束，后者是字母筛选；需要图形多选与提交核算。 |
| 18 **词义冲突** | 按词语完整含义选指定类别，排除只含相关汉字的词，忽略字色。 | [jsPsych按钮任务](https://www.jspsych.org/v8/plugins/html-button-response/)（MIT框架） | 需独立编写语义任务和中文词库。普通Stroop/Reverse Stroop只能作邻近参考，不能代替语义分类。 |
| 19 **多目标计数** | 只数符合指定颜色与形状组合的物体，画面消失后填数量。 | [Puzzle特征联合搜索](https://github.com/sidhant947/Puzzle/tree/main/lib/ui/features/games/conjunction_search)（GPL-3.0） | 仅刺激生成邻近；原站公开规则是条件计数，不是任意多路计数器，需自行实现展示、隐藏和数值作答。 |
| 25 **变化侦探** | 两幅场景交替显示，选中物品发生变化的位置后提交，忽略背景装饰。 | [Puzzle Change Blindness源码](https://github.com/sidhant947/Puzzle/tree/main/lib/ui/features/games/change_blindness)（GPL-3.0）；[合集入口](https://puzzle.fossgames.online/) | 同类完整任务；需原创场景、背景干扰和多选提交规则。合集入口由上游提供，未完成逐局试玩。 |
| 26 **双闪捕捉** | 快速图案流中记住实线框标出的两个目标，忽略虚线框，结束后按出现顺序选择。 | [Puzzle Attentional Blink源码](https://github.com/sidhant947/Puzzle/tree/main/lib/ui/features/games/attentional_blink)（GPL-3.0） | 同类RSVP双目标任务。参考源码用数字目标/字母干扰，需替换为图案与实虚线框。 |
| 27 **大小迷局** | 判断小箭头组成的大箭头朝向，忽略局部箭头方向与颜色。 | [Puzzle Navon层级刺激](https://github.com/sidhant947/Puzzle/tree/main/lib/ui/features/games/navon_hierarchical)（GPL-3.0） | 同类。参考版是大字母由小字母组成，需生成箭头；原版始终看整体，不能悄悄改为整体/局部交替。 |

### 专注力（4款）

| 编号 / 原站名称 | 具体玩法：公开规则摘要 | 免费体验与开源参考 | 匹配程度、必须补充的内容 |
|---|---|---|---|
| 02 **视觉追踪** | 先认准红球；所有球变蓝并运动，停下后点出最初的红球。 | [MIT作者试玩](https://svanhedger.github.io/jspsych/scripts/object-tracking/)；[作者源码](https://github.com/svanhedger/jspsych/tree/master/scripts/object-tracking)；[Puzzle动态追踪](https://github.com/sidhant947/Puzzle/tree/main/lib/ui/features/games/multiple_object_tracking)（GPL-3.0） | 同类。MIT例子用预制视频和2–3目标；Puzzle可配置目标数。原版是单目标身份追踪。 |
| 28 **稳手画圆** | 围绕实心中心一笔画完整圆，忽略空心假中心；直径至少为画面短边的40%。 | [固定中心试玩](https://neal.fun/perfect-circle/)；[HTML源码](https://github.com/Pac-Dessert1436/Circle-Drawing-Game)（MIT） | 试玩站无已核实开源授权。MIT源码会估计中心，需改为固定真中心并校验最小直径、闭合与覆盖。 |
| 29 **轨道护航** | 按住并拖动小球跟随轨道上的实心目标，尽量保持在目标周围的轨道范围内。 | [jsPsych Pursuit Rotor源码](https://github.com/jspsych/jspsych-contrib/tree/main/packages/plugin-pursuit-rotor)（MIT包声明） | 邻近追踪任务；源码已有鼠标/触摸与跟踪指标，但仅圆周目标。轨道与实心目标规则需独立实现。 |
| 30 **时钟巡检** | 盯住钟针前进刻度，发现异常的两刻度跳动时点相应时钟。 | [PsyToolkit触屏试玩](https://www.psytoolkit.org/experiment-library/experiment_mackworth2.html)；[Puzzle vigilance源码](https://github.com/sidhant947/Puzzle/tree/main/lib/ui/features/games/vigilance_task)（GPL-3.0） | 同类Mackworth警觉任务。PsyToolkit仅列为体验参考，当前网页代码使用条款不是通用宽松开源许可。 |

### 记忆力（11款）

| 编号 / 原站名称 | 具体玩法：公开规则摘要 | 免费体验与开源参考 | 匹配程度、必须补充的内容 |
|---|---|---|---|
| 01 **瞬时记忆** | 短暂图中只数圆点，排除三角与方形；隐藏后填圆点数。 | [Flash Count试玩](https://memtry.com/games/flash-count/)；[Puzzle Subitize Rush源码](https://github.com/sidhant947/Puzzle/tree/main/lib/ui/features/games/subitizing_rush)（GPL-3.0） | 同类计数记忆。参考源码只有点阵，需加入其他形状干扰；不是位置复原游戏。 |
| 06 **路径记忆** | 按顺序记实心标记的亮格，跳过空心标记，展示结束再按原顺序点击。 | [jsPsych Corsi源码/示例](https://github.com/jspsych/jspsych-contrib/tree/main/packages/plugin-corsi-blocks)（MIT包声明） | 同类顺序空间记忆；需设置网格布局、插入空心干扰并仅记录有效序列。 |
| 07 **数字闪记** | 只记带下划线的数字，忽略其他字符；消失后按行优先顺序输入。 | [ExpFactory digit-span源码](https://github.com/expfactory-experiments/digit-span)（MIT）；[HumanEval数字记忆](https://github.com/ShaikhWarsi/HumanEval/blob/main/components/tests/number-memory-test.tsx)（MIT） | 同类。前者多为逐个呈现，后者整串展示；原版是带筛选标记的二维字符排布，需改造。 |
| 08 **位置复原** | 记实心亮格，排除条纹格；隐藏后多选全部目标位置再提交，不要求顺序。 | [CozyPlay试玩](https://cozyplay.games/zh/games/memory-matrix/)；[HumanEval源码](https://github.com/ShaikhWarsi/HumanEval/blob/main/components/tests/visual-memory-test.tsx)（MIT） | 核心无序位置记忆一致；需增加条纹干扰和提交步骤。不能用顺序Corsi直接替代。 |
| 09 **配对翻牌** | 每次翻两张；形状、纹理、朝向都完全相同才成对，倒计时后按配对数评分。 | [CozyPlay试玩](https://cozyplay.games/zh/games/memory-match/)；[Tania Rascia源码](https://github.com/taniarascia/memory)（MIT） | 核心一致；需复合特征卡牌与限时计分。MIT示例里的马里奥图片不随代码许可证自动变为可复用素材，使用原创几何牌面。 |
| 12 **节奏复刻** | 记住中央带边框圆点的闪烁节奏，忽略外围伴奏；结束后按相同节奏敲击。 | [Echo试玩](https://reactiontests.net/games/echo)；[jsPsych基础框架](https://github.com/jspsych/jsPsych)（MIT） | Echo是邻近的先听/看再敲击参考，未核实OSS授权。需原创节奏回放、干扰与敲击时刻判分；同步跟拍游戏不能代替。 |
| 16 **顺序重排** | 记数字数值并忽略字体大小；隐藏后依提示按升序或降序输入。 | [ExpFactory数字跨度](https://github.com/expfactory-experiments/digit-span)（MIT）；[HumanEval数字记忆](https://github.com/ShaikhWarsi/HumanEval/blob/main/components/tests/number-memory-test.tsx)（MIT） | 只有记数/倒背部件相关；原版是数值排序，不是倒序记忆，排序题生成和计分需独立写。 |
| 21 **图标拼绘** | 观察零件与位置；隐藏后先选零件再点网格复原，可点击已放零件替换。 | [Puzzle Mandala Recall](https://github.com/sidhant947/Puzzle/tree/main/lib/ui/features/games/mandala_recall) / [Pixel Mimic](https://github.com/sidhant947/Puzzle/tree/main/lib/ui/features/games/pixel_mimic)（GPL-3.0） | 仅邻近的网格重建。需原创图标零件、选件/落格/替换交互；未核实逐项相同的独立开源游戏。 |
| 22 **特征寻人** | 合并证人给出的有效特征，忽略无关话语；明确更正会覆盖旧线索，按最新条件找人。 | [Puzzle Face-Trait源码](https://github.com/sidhant947/Puzzle/tree/main/lib/ui/features/games/face_trait_association)（GPL-3.0） | 邻近的特征绑定；参考版没有更正覆盖机制，需原创可更新线索与人物生成器。 |
| 23 **记忆接力** | 判断当前形状是否与指定N步前相同，忽略颜色；每张只能回答一次。 | [CozyPlay N-back试玩](https://cozyplay.games/zh/games/nback/)；[ExpFactory n-back源码](https://github.com/expfactory-experiments/n-back)（MIT） | 同类N-back。CozyPlay用数字；需形状身份、颜色干扰与一次作答约束，并明确前N项热身规则。 |
| 24 **货架管家** | 记住初始库存，依有效单据增减数量，跳过作废单据；最后填各物品余量。 | [jsPsych基础框架](https://github.com/jspsych/jsPsych)（MIT） | 需独立实现。未核实同样含有效/作废单据的开源成品；普通购物清单或多路计数不等同。 |

### 空间判断（6款）

| 编号 / 原站名称 | 具体玩法：公开规则摘要 | 免费体验与开源参考 | 匹配程度、必须补充的内容 |
|---|---|---|---|
| 10 **旋转判断** | 判断右图能否仅靠旋转与左图重合；镜像不算。 | [magpie JS源码](https://github.com/magpie-ea/magpie-mental-rotation)（MIT）；[Puzzle二维源码](https://github.com/sidhant947/Puzzle/tree/main/lib/ui/features/games/mental_rotation)（GPL-3.0） | 同类；MIT例子使用3D图片，Puzzle是二维格图。选择原创二维图形更贴近规则。 |
| 15 **镜像辨认** | 判断左右图案是否为水平镜像。 | [空间推理试玩](https://www.brainworkout.org/games/spatial-reasoning-test/)；[Puzzle mirror_image源码](https://github.com/sidhant947/Puzzle/tree/main/lib/ui/features/games/mirror_image)（GPL-3.0） | 同类；参考源码有不同镜像轴，原版已明确水平反射，需固定轴并排除旋转等价歧义。 |
| 17 **方块叠合** | 把两张方格的着色区域合并，选出并集图案；重叠位置仍着色。 | [含叠合规则的矩阵试玩](https://www.brainworkout.org/games/pattern-recognition/)；[jsPsych选择题框架](https://github.com/jspsych/jsPsych)（MIT） | 试玩仅邻近；未核实专门的同款OSS成品。独立位集合并集即可；不能误写成异或消除。 |
| 31 **折纸打孔** | 按图示折叠与打孔步骤，选出展开后的完整孔位。 | [Holepunch试玩](https://millslogan.github.io/holepunch/#game)；[Holepunch源码](https://github.com/MillsLogan/holepunch)（MIT） | 同类完整几何任务；参考版通过点格作答，需改成原版的候选孔图选择或保留独立练习模式。 |
| 32 **立方展开** | 根据展开图选能正确折成的三面立方体；带箭头时也核对朝向。 | [OpenFold源码](https://github.com/paladini/OpenFold)（MIT）；[含立方体试玩](https://www.brainworkout.org/games/spatial-reasoning-test/) | 同类。OpenFold提供TypeScript立方体展开/错误选项生成，但无已核实公共托管演示，需本地构建。 |
| 33 **星图连线** | 对照参考图，在旋转后的星点中连接相同结构，利用实心/空心两锚点定位；点两星连边。 | [Star Weaver玩法/入口](https://glowbox.dev/game/star-weaver)；[jsPsych框架](https://github.com/jspsych/jsPsych)（MIT） | 免费游戏为近似参考，未核实其OSS授权。需独立点图旋转、锚点与边集合校验；固定格路径记忆不是同款。 |

### 逻辑思维（5款）

| 编号 / 原站名称 | 具体玩法：公开规则摘要 | 免费体验与开源参考 | 匹配程度、必须补充的内容 |
|---|---|---|---|
| 04 **图形序列** | 只按形状的重复规律选下一形状，忽略颜色与大小。 | [dMAT Drill Room源码](https://github.com/PaddyCH96/dmat-drill-room)（MIT）；[上游演示入口](https://paddych96.github.io/dmat-drill-room/) | 同类图形规律生成器；其部分题同时使用颜色/运动并预测两帧。原版应限制为形状规则、预测一步。托管演示未完整试玩。 |
| 13 **快速心算** | 限时计算显示的算式并输入答案；需要遵守乘法优先与括号。 | [Puzzle Quick Math源码](https://github.com/sidhant947/Puzzle/tree/main/lib/ui/features/games/quick_math) / [Calculation Sprint](https://github.com/sidhant947/Puzzle/tree/main/lib/ui/features/games/calculation_sprint)（GPL-3.0） | 同类心算，但参考源码只含简单二元式；需独立多运算符/括号题生成与输入。不是逐项闪现后求累积值的Chain Calc。 |
| 34 **线索推理** | 人物按从左到右排列，用全部线索为每人分配物品和颜色，各组属性不重复。 | [Brainzilla试玩](https://www.brainzilla.com/logic/zebra/basic-1/)；[LogikGrid源码](https://github.com/KevinGundlach/LogikGrid)（MIT）；[Puzzle Einstein Riddle](https://github.com/sidhant947/Puzzle/tree/main/lib/ui/features/games/einstein_riddle)（GPL-3.0） | 同类关系推理；MIT源主要是标记网格，仍需中文线索、生成器与解的唯一性校验。 |
| 35 **数感天平** | 同形同重，根据已平衡关系推断问号位置重量并选择答案。 | [Puzzle Balance Scale源码](https://github.com/sidhant947/Puzzle/tree/main/lib/ui/features/games/balance_scale)（GPL-3.0）；[合集入口](https://puzzle.fossgames.online/) | 同类形状重量推理；独立生成可解方程与干扰选项，不用已知数字砝码摆放游戏冒充。 |
| 36 **矩阵推演** | 找出矩阵中形状、数量、方向的行列规律，选择右下角缺格。 | [矩阵试玩](https://www.brainworkout.org/games/pattern-recognition/)；[matRiks生成器](https://github.com/OttaviaE/matRiks)（MIT，R语言）；[Puzzle矩阵源码](https://github.com/sidhant947/Puzzle/tree/main/lib/ui/features/games/matrix_reasoning)（GPL-3.0） | 同类。matRiks是题目生成器而非浏览器成品；需独立网页题型和保证选项唯一。使用原创几何题，不引入商业测验图版。 |

### 执行控制（7款）

| 编号 / 原站名称 | 具体玩法：公开规则摘要 | 免费体验与开源参考 | 匹配程度、必须补充的内容 |
|---|---|---|---|
| 05 **颜色干扰** | 只按中央文字的字色选择，忽略文字意思和左右两侧干扰词。 | [CozyPlay试玩](https://cozyplay.games/zh/games/stroop/)；[jsPsych Stroop源码](https://github.com/jspsych/jspsych-timelines/tree/main/packages/stroop-task)（MIT） | 同类Stroop；需增加两侧干扰文字并按原版目标限定中央。 |
| 14 **规则切换** | 依每轮顶部提示选择颜色或形状；提示规则会改变。 | [CozyPlay试玩](https://cozyplay.games/zh/games/task-switch/)；[CrowdCog源码](https://github.com/hci-unimelb/crowdcog)（MIT）；[Puzzle Rule Switcher](https://github.com/sidhant947/Puzzle/tree/main/lib/ui/features/games/rule_switcher)（GPL-3.0） | 同类切换任务。CozyPlay判数字奇偶/大小，不能照搬；需显式颜色/形状规则与中文提示。 |
| 20 **反应抑制** | 只看中央圆：绿点击、红不动；外围灯与圆中文字都忽略。 | [jsPsych Go/No-Go源码](https://github.com/jspsych/jspsych-timelines/tree/main/packages/go-nogo)（MIT） | 同类完整任务；需中央目标与外围/文字干扰，不可把见到任何绿灯都点设为正确。 |
| 37 **规则密码** | 用数字/符号填满密码格，同时满足列出的全部条件；不同合法排列都接受。 | [Logic Solver代码](https://github.com/meteor/logic-solver)（MIT） | 仅求解/约束部件，未核实同款完整开源游戏。自行设计符号、条件和格子；不能只和一份预存答案比较，也不是普通Mastermind。 |
| 38 **预算挑战** | 用100枚虚拟金币采购，逐项调整商品数量；所有采购要求与预算条件满足再提交。 | [Logic Solver代码](https://github.com/meteor/logic-solver)（MIT，支持整数和不等式） | 仅约束求解参考，未核实同款完整成品；自行实现商品数量、采购约束与可行方案验证。不同于只选/不选的0–1背包。 |
| 39 **路线规划** | 从起点沿通道按编号经过检查点到终点，考虑单向箭头和不同地形步数。 | [PathFinding试玩](https://qiao.github.io/PathFinding.js/visual/)；[PathFinding.js源码](https://github.com/qiao/PathFinding.js)（MIT） | 仅寻路算法部件。需要有向边、地形权重、检查点顺序状态；不能直接用普通无权起终点A*小游戏代替。 |
| 40 **圆盘搬运** | 先点来源柱再点目标柱，只搬最上层圆盘，始终小盘压大盘，达到目标图布局。 | [Hanoi源码](https://github.com/Douile/tower-of-hanoi)（MIT）；[上游试玩入口](https://douile.github.io/tower-of-hanoi/) | 同类汉诺塔。试玩入口当前跳转至douile.com；需支持任意合法目标图，不仅所有盘搬到最后一柱。伦敦塔彩球并非同一规则。 |

## 4. 开源来源与许可登记

以下是主要代码源的许可证据。单个框架开源不等于所有示例图片、字体或题库都自动得到同样授权。引入代码时应锁定提交版本、保留版权声明，并在项目的 THIRD_PARTY_NOTICES 中记录采用的文件及改动。

| 来源 | 许可证据 | 实际用途与限制 |
|---|---|---|
| jsPsych | [MIT全文](https://github.com/jspsych/jsPsych/blob/main/license.txt) | 浏览器任务时序、按钮/键盘、反应记录；是框架，不是40款成品。 |
| jsPsych Corsi | [包许可声明](https://github.com/jspsych/jspsych-contrib/blob/main/packages/plugin-corsi-blocks/package.json) | MIT；顺序空间点击。contrib按包核查，不假设仓库里所有包同一许可。 |
| jsPsych点击搜索 / pursuit-rotor | [搜索包声明](https://github.com/jspsych/jspsych-contrib/blob/main/packages/plugin-visual-search-click-target/package.json)、[追踪包声明](https://github.com/jspsych/jspsych-contrib/blob/main/packages/plugin-pursuit-rotor/package.json) | MIT；分别是点选与触摸追踪部件。 |
| jsPsych timelines | [MIT全文](https://github.com/jspsych/jspsych-timelines/blob/main/LICENSE) | Stroop和Go/No-Go完整同类流程；仍需中文、干扰和训练关卡。 |
| BerkYeni/schultetable | [MIT全文](https://github.com/BerkYeni/schultetable/blob/main/LICENSE) | React/TS舒尔特；旧构建工具无需整套照搬。 |
| HumanEval | [MIT全文](https://github.com/ShaikhWarsi/HumanEval/blob/main/LICENSE) | React/TS数字与无序位置记忆；其中百分位或“脑评分”不是可直接采信的常模。 |
| Experiment Factory | [数字跨度MIT](https://github.com/expfactory-experiments/digit-span/blob/master/LICENSE)、[n-back MIT](https://github.com/expfactory-experiments/n-back/blob/master/LICENSE) | 旧版JS实验代码，适合任务逻辑参考，需迁移旧插件接口。 |
| Tania Rascia memory | [MIT全文](https://github.com/taniarascia/memory/blob/master/LICENSE) | 简洁翻牌逻辑；替换其主题图片。 |
| Van Hedger jspsych | [MIT全文](https://github.com/svanhedger/jspsych/blob/master/LICENSE) | 多目标追踪实验，含预制视频；不是通用动态球引擎。 |
| Circle-Drawing-Game | [MIT全文](https://github.com/Pac-Dessert1436/Circle-Drawing-Game/blob/master/LICENSE) | 仓库的 CircleDrawing.html 是浏览器实现；其中心估计方式需调整。 |
| Holepunch | [MIT全文](https://github.com/MillsLogan/holepunch/blob/main/LICENSE) | 折纸打孔几何与React界面；[作者演示](https://millslogan.github.io/holepunch/)为JS页面，未逐局验证。 |
| OpenFold | [MIT全文](https://github.com/paladini/OpenFold/blob/main/LICENSE) | TypeScript/Three.js的立方展开与干扰项；需本地构建，无已核实的公共演示。 |
| dMAT Drill Room | [MIT全文](https://github.com/PaddyCH96/dmat-drill-room/blob/main/LICENSE) | 原创/非官方的图形规律生成；取适合原站规则的子集。 |
| magpie mental rotation | [MIT全文](https://github.com/magpie-ea/magpie-mental-rotation/blob/master/LICENSE) | 3D同异判断实验；使用其第三方图片前另核素材许可，优先生成原创图形。 |
| LogikGrid | [MIT全文](https://github.com/KevinGundlach/LogikGrid/blob/main/LICENSE) | 排除网格交互，不包含题库/线索生成器。 |
| matRiks | [MIT全文](https://github.com/OttaviaE/matRiks/blob/main/LICENSE.md) | R语言矩阵题生成器；可作离线生成或规则参考，不是即插即用网页游戏。 |
| CrowdCog | [MIT全文](https://github.com/hci-unimelb/crowdcog/blob/master/LICENSE) | 有任务切换等任务；整个旧Django/MySQL平台无需引入。 |
| Logic Solver | [MIT全文](https://github.com/meteor/logic-solver/blob/master/LICENSE) | JS约束求解与整数不等式；适合检验规则密码/预算题，不是现成游戏。 |
| PathFinding.js | [README内MIT全文](https://github.com/qiao/PathFinding.js/blob/master/README.md#license) | 二维寻路；有向边、检查点顺序和地形代价需另实现。 |
| Douile Hanoi | [MIT全文](https://github.com/Douile/tower-of-hanoi/blob/master/LICENSE) | 浏览器汉诺塔；补任意目标图与移动计数。 |
| sidhant947/Puzzle | [GPL-3.0全文](https://github.com/sidhant947/Puzzle/blob/main/LICENSE)、[README](https://github.com/sidhant947/Puzzle) | Flutter/Dart的300多款合集，覆盖多项核心范式。直接移植/改写其实现须保留适用的GPL条件，不能将移植代码标成MIT。 |

[PsyToolkit当前条款](https://www.psytoolkit.org/copyright.html)对网页代码/教学材料有教育科研等使用条件；本清单把它作为可体验参考，不以旧Linux运行时GPL推断当前全部网页代码可自由复用。CozyPlay、Neal.fun、Echo、Star Weaver、Brain Workout、Brainzilla等未核实代码许可证的站点，也仅作为玩法与体验参考。未找到授权声明的公开源码，不列为可直接复制的OSS代码。

## 5. 每款难度与记录建议

以下全部是**本项目建议**，不是声称已测得原站评分。每款定义30套显式参数，参数版本随训练记录保存。先记录可解释的原始表现，再视需要添加0–100的游戏分数；不同游戏的100分不自动代表同一能力水平。

| 游戏 | 建议难度参数与记录指标 |
|---|---|
| 03 舒尔特方格 | 数字数目、布局不规则度、时间；进度/用时，注明自报或核验。 |
| 11 目标搜索 | 目标/干扰物数量、相似度；命中、漏选、误选及用时。 |
| 18 词义冲突 | 类别接近度、干扰词占比、时间；正确率、误分类、正确反应时。 |
| 19 多目标计数 | 物体数、条件相似度、显示时长；数量误差/正确率。 |
| 25 变化侦探 | 物品数、变化幅度、闪烁间隔；检出率/误选/耗时。 |
| 26 双闪捕捉 | 流速、目标间隔、干扰相似度；第一目标与第二目标正确率、顺序正确率。 |
| 27 大小迷局 | 方向冲突比例、尺寸、密度；准确率/正确反应时。 |
| 02 视觉追踪 | 球数、速度、运动时长；目标识别率。 |
| 28 稳手画圆 | 容差、假中心数；径向偏差、闭合误差、覆盖角度。 |
| 29 轨道护航 | 轨迹曲率、速度、轨道宽度；在轨时间比例/偏离距离。 |
| 30 时钟巡检 | 时钟数、步速、异常率；命中、漏报、误报、反应时。 |
| 01 瞬时记忆 | 圆点及干扰数量、曝光时间；数量误差/准确率。 |
| 06 路径记忆 | 有效序列长、干扰比例、亮格速度；完整序列正确率/最长跨度。 |
| 07 数字闪记 | 有效数字数、字符干扰、曝光时间；整串/逐位准确率。 |
| 08 位置复原 | 网格、目标格/干扰格数、曝光时间；集合准确率、漏选/误选。 |
| 09 配对翻牌 | 牌对数、特征相似度；配对数/翻牌次数/时间。 |
| 12 节奏复刻 | 节拍数、间隔变化、干扰；敲击数与相邻间隔误差。 |
| 16 顺序重排 | 数字数量、重复数字/位数、字号干扰；排序后的完整序列正确率。 |
| 21 图标拼绘 | 零件数、位置、干扰零件、曝光；部件与坐标的组合正确率。 |
| 22 特征寻人 | 特征数、人物数、更正数；最新条件匹配准确率。 |
| 23 记忆接力 | N、速度、形状数量；命中/漏报/误报/正确拒绝分开。 |
| 24 货架管家 | 物品种类、单据数、作废率、数量范围；各物品最终库存准确率。 |
| 10 旋转判断 | 旋转角度、形状复杂度、镜像干扰；准确率/反应时。 |
| 15 镜像辨认 | 图形复杂度、近似干扰；准确率/反应时。 |
| 17 方块叠合 | 网格、着色密度、重叠度；正确率/用时。 |
| 31 折纸打孔 | 折叠次数/轴、孔数；完整孔位图准确率。 |
| 32 立方展开 | 面标记、展开网、箭头朝向；选项准确率。 |
| 33 星图连线 | 顶点/边数、旋转角、干扰星；边正确率/整体结构正确率。 |
| 04 图形序列 | 周期长度、候选形状、干扰颜色/大小；正确率/时间。 |
| 13 快速心算 | 操作数范围、运算符、括号深度；正确题数/每题耗时。 |
| 34 线索推理 | 人数、属性组、关系类型、线索数；整题解与耗时。 |
| 35 数感天平 | 未知形状、关系链层数；推断准确率/时间。 |
| 36 矩阵推演 | 规则组合、属性数量、干扰项；正确率/时间。 |
| 05 颜色干扰 | 一致/冲突比例、干扰强度、时限；准确率与正确反应时。 |
| 14 规则切换 | 切换概率、提示持续时间、特征冲突；切换/重复题分别统计。 |
| 20 反应抑制 | 刺激速度、No-Go比例、干扰；漏按、错按、正确反应时。 |
| 37 规则密码 | 格数、条件数与依赖；约束满足率/完成时间。 |
| 38 预算挑战 | 商品数、单位价格、约束数；是否全部满足、预算使用情况。 |
| 39 路线规划 | 地图、检查点数、权重/单向边；合法性、总代价、相对最优代价。 |
| 40 圆盘搬运 | 盘数、初末状态、最短路径；合法步数、超额步数/用时。 |

难度遵循任务负荷递增，触摸目标不随难度缩小到难以点击。节奏题比较相邻敲击间隔；画圆题先验证直径、闭合与覆盖，再计算误差；规则密码验证全部条件而非唯一答案；预算题接受所有合法采购组合；路线题用有向带权状态图核对编号检查点；圆盘题支持合法任意目标布局。题目生成需检查可解性、候选项去重和实际答案数量。

## 6. 建议产品与技术方案

### 功能范围

- 六类目录、40款玩法、独立规则说明、练习示例、1–30级自由选择和可选的30天训练安排。
- 用户名/密码注册、登录、退出、改密码；可提供访客练习，登录后保存个人进度。局域网账号不要求购买邮箱或短信服务。
- 服务端保存每用户每游戏的关卡、历史成绩、最好成绩、练习时间和未完成状态。同一账号在电脑、手机与iPad访问同一台服务器即可看到相同历史。
- 每局记录 gameId、规则/参数版本、随机种子、关卡、刺激与反应摘要、准确率、反应时、开始/结束时间及中断状态；训练日期按Asia/Shanghai归档。
- 完成一局立即保存，分步骤任务在安全节点保存；短时断网暂存待提交，恢复后按唯一局ID补传，避免重复记分。快速刺激任务被切后台时标为中断/重启当前试次，不把后台冻结时间算成反应慢。
- 记录页按游戏与关卡比较近期表现；重做、换设备、参数版本变更保留区别。账号相互隔离。
- 数据导出、数据库备份/恢复和管理员重置密码。应用数据及密钥保存在独立数据目录，源码与开发文档进入Git，真实密码、数据库和密钥不提交。

### 三条可行路线

| 路线 | 优点 | 代价 | 建议 |
|---|---|---|---|
| React + TypeScript前端，ASP.NET Core + SQLite服务端 | 适合Windows常驻运行；账号使用成熟Identity；前端适合SVG/Canvas和触屏；可发布带运行时的服务端 | 前端TS和后端C#两种语言；需要我们完成游戏统一适配 | **推荐**，优先长期维护和局域网运行。 |
| React + TypeScript，Node.js + SQLite | 游戏与后端共享TS类型，一个语言栈 | 注册、会话与运维需要选定并集成相应组件 | 若你希望整项目TS，可选。 |
| 改造Flutter Puzzle，再接账号服务 | 现成同类游戏较多，可继续扩展其他游戏 | Dart/Flutter构建、界面改造与40款特定干扰规则工作仍在；直接采用代码要按GPL处理 | 可行备选，未作为推荐路线。 |

这是技术建议，未当作你已经确定的选择。推荐路线参考：[ASP.NET Core Identity](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/identity?view=aspnetcore-10.0)、[EF Core SQLite](https://learn.microsoft.com/en-us/ef/core/providers/sqlite/)、[独立部署说明](https://learn.microsoft.com/en-us/dotnet/core/deploying/)。采用Identity的用户/密码机制时，我们配置独立用户名注册表单；官方模板默认把邮箱和用户名合并，需要调整，不能直接宣称模板已满足要求。

前端以React/TypeScript、SVG/Canvas为主，共用游戏开始/练习/刺激展示/作答/结算/保存流程。参考代码只按需引入。优先采用MIT等许可清楚的部件和独立题目生成器；如果选择直接采用GPL实现，再明确该部分与项目的许可方案。

服务端提供同域API和前端静态资源；SQLite集中保存家庭小规模数据。前端构建需要Node，发布后的推荐.NET服务可以打包运行时，日常启动无需前端开发服务器。初次部署需要安装/下载构建依赖；日常训练所需资源全部放在本地，不依赖CDN、原站接口或云数据库。版本、依赖和启动流程会在仓库锁定。

### 手机与iPad适配

- 提供桌面、平板横竖屏、手机竖屏布局；iPad分屏时按实际可视区域缩放。
- 点击/拖动使用统一Pointer Events，拖动时处理捕获、取消和手指抬起；抬起后不继续累计跟踪成功时间。[MDN依据](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)
- 点选目标按约44px或以上的触摸区域设计；密集棋盘限制最大规模或调整布局。字体与Canvas按像素比渲染，不只缩小整张桌面截图。
- 画圆、轨道、连线等区域控制触摸滚动；区域外仍正常滚动。必要时使用先选后点替代精细拖动，避免手指遮挡。
- 计时基于真实经过时间；动画按时间步推进，快速序列记录实际帧时刻。训练切后台、锁屏、旋转和断线时有明确处理。
- 首版以普通浏览器访问验收。若以后要PWA离线缓存，局域网IP上的普通HTTP不具备service worker要求的安全上下文，需要另配HTTPS；不能把电脑的localhost豁免套用到手机访问的局域网IP。[MDN依据](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- 浏览器模拟视口/WebKit测试之后，仍要在你的真实手机与iPad Safari上验证。iPad Air的代数或iPadOS版本会决定最低兼容目标。

## 7. 局域网部署方式

推荐先在一台常开的Windows电脑运行，示例地址是 **http://电脑局域网IP:8787**。手机/iPad连同一局域网后访问此地址。实际IP和端口在部署时由脚本显示；电脑必须运行服务，路由器的访客Wi-Fi隔离需关闭或改接允许相互访问的网络。

交付目标包含Windows启动/停止/构建脚本、依赖检查、数据库初始化、可读错误提示和备份恢复说明。开发用源码构建；也可生成带运行时的发布目录。局域网发布只需放行所用端口的专用网络入站访问，不需要域名、公网服务器或原站账号。

备份使用SQLite一致性备份方式，或停服后复制数据库及相关必要文件，避免在WAL写入时只复制主db文件。若使用记住登录，认证密钥也要持久化。恢复流程与升级迁移要实际演练。

本阶段尚未创建防火墙规则、安装服务或更改用户电脑设置。这些是后续仓库实现与本机部署阶段的工作。

## 8. 开发批次与验收

1. **基础阶段**：仓库、研究资料、账号/权限、数据库迁移、目录与统一游戏框架；验证注册登录、用户隔离、重启后数据还在。
2. **首批8款**：舒尔特方格、视觉追踪、路径记忆、旋转判断、图形序列、颜色干扰、反应抑制、圆盘搬运。覆盖六类与点击/记忆/移动/约束等代表交互。
3. **补齐其余32款**：分批加入，每款完成规则、实际交互、题目生成、计分、服务端存档和移动端适配后登记通过；最终目标仍是全部40款。
4. **完整验证与发布**：每款至少简单/中间/最高档冒烟；所有30档进行题目生成/答案可验证检查；浏览器、手机、iPad与局域网访问验收；备份与恢复演练。

必要检查包括：升降序重复数字、无序位置与顺序路径的区别、真假标记筛选、词义类别歧义、颜色与形状键、Go/No-Go最后一题结算窗口、多个合法密码/采购答案、单向带权路线和检查点顺序、箭头面立方体朝向、圆盘任意目标状态。保存接口验证未登录访问、越权读写、重复提交及中断补传。

每个可审阅阶段与bug修复分别Git提交，仓库文档记录已测和未测事项。Git保存源码、原创静态资源、规则配置、许可证与开发资料；运行数据独立保存。本项目不要求使用GitHub Actions或Artifact才能构建、运行、发版。

## 9. Ancho现在需要准备的事项

| 事项 | 建议操作 |
|---|---|
| 新建GitHub仓库 | 名称 **brain-training-web**；建议先Private，勾选生成README，默认main分支。描述可写“可自托管的认知训练网页：40款小游戏、账号、训练进度与手机/iPad适配”。 |
| 许可证 | 若按推荐的原创实现和MIT部件路线，可选MIT；GPL代码是否直接采用以后单独登记。README和许可证由我后续完善。 |
| 连接权限 | 把新仓库加入当前已连接GitHub应用的可访问范围；建好后发送仓库链接，无需在聊天里提供密码或Token。 |
| 部署机器 | 告诉我最终运行在Windows电脑、Linux还是NAS。默认方案先按Windows电脑设计。暂时不用安装数据库、Docker或购买服务器。 |
| iPad版本 | 提供iPad Air代数或iPadOS版本，便于确定Safari兼容范围；手机按Safari/Chrome触屏访问设计。 |
| 技术路线 | 推荐React/TypeScript + ASP.NET Core + SQLite；如果希望前后端都用TS，选择Node备选。此项可在仓库准备好时一并确定。 |

现有资料足够进入需求/方案确认和初版实现。原站会员、截图补拍或源代码授权不是启动独立实现的前置条件。若后续需要逐像素复原登录后界面或对齐隐藏计分，则是额外的核验范围，应另行取得可观察的资料。
