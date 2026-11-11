import { useEffect, useRef } from 'react';

const width = 360;
const height = 164;
const paper = '#fffdf5';
const ink = '#284039';
const edge = '#bacdc5';
const green = '#4c8b73';
const mint = '#a6d9ba';
const blue = '#447da9';
const sky = '#c4dfee';
const coral = '#d66855';
const peach = '#f5c0ab';
const gold = '#e9af46';
const cream = '#f9e8b5';
const plum = '#795a9b';
const lilac = '#dac9ea';

type Points = readonly (readonly [number, number])[];
const polygons = {
  triangle: [[0, -1], [0.92, 0.8], [-0.92, 0.8]],
  square: [[-0.83, -0.83], [0.83, -0.83], [0.83, 0.83], [-0.83, 0.83]],
  diamond: [[0, -1], [1, 0], [0, 1], [-1, 0]],
  arrow: [[-1, -0.32], [0.12, -0.32], [0.12, -0.83], [1, 0], [0.12, 0.83], [0.12, 0.32], [-1, 0.32]],
  star: [[0, -1], [0.26, -0.32], [0.95, -0.31], [0.42, 0.13], [0.59, 0.81], [0, 0.44], [-0.59, 0.81], [-0.42, 0.13], [-0.95, -0.31], [-0.26, -0.32]],
} satisfies Record<string, Points>;
type Shape = keyof typeof polygons | 'dot';

function drawPreview(ctx: CanvasRenderingContext2D, gameId: number) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  function path(points: Points, color: string, thickness = 2, solid = false) {
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
    if (solid) {
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = thickness;
      ctx.stroke();
    }
  }
  function box(x: number, y: number, w: number, h: number, fill: string, stroke?: string, radius = 8) {
    const r = Math.min(radius, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }
  function panel(x: number, y: number, w: number, h: number, fill = paper, stroke = edge) {
    box(x, y + 5, w, h, '#24383024', undefined, 13);
    box(x, y, w, h, fill, stroke, 13);
  }
  function ring(x: number, y: number, rx: number, ry: number, color: string, thickness = 2) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.stroke();
  }
  function mark(shape: Shape, x: number, y: number, radius: number, color: string, angle = 0) {
    if (shape === 'dot') {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      return;
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    path(polygons[shape].map(([px, py]) => [px * radius, py * radius]), color, 1, true);
    ctx.restore();
  }
  function label(value: string | number, x: number, y: number, size: number, color = ink) {
    ctx.font = '700 ' + size + 'px system-ui, "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(String(value), x, y);
  }
  function matrix(x: number, y: number, columns: number, rows: number, step: number, selected: number[], fill: string) {
    for (let i = 0; i < columns * rows; i++) {
      box(x + i % columns * step, y + Math.floor(i / columns) * step,
        step - 4, step - 4, selected.includes(i) ? fill : '#e7eee9', undefined, 4);
    }
  }
  function portrait(x: number, y: number, shirt: string, hair: string, glasses = false) {
    box(x - 25, y + 16, 50, 20, shirt, undefined, 11);
    mark('dot', x, y - 7, 21, hair);
    mark('dot', x, y - 2, 17, '#f3bc91');
    box(x - 17, y - 23, 34, 11, hair);
    if (glasses) {
      ring(x - 7, y - 2, 5, 4, ink);
      ring(x + 7, y - 2, 5, 4, ink);
      path([[x - 2, y - 2], [x + 2, y - 2]], ink);
    } else {
      mark('dot', x - 6, y - 1, 1.8, ink);
      mark('dot', x + 6, y - 1, 1.8, ink);
    }
    path([[x - 4, y + 7], [x, y + 9], [x + 4, y + 7]], coral, 1.5);
  }

  switch (gameId) {
    case 1: { // 瞬时记忆
      panel(42, 19, 276, 122, '#173430', '#2b544a');
      const shapes: [Shape, number, number, number, string][] = [
        ['dot', 88, 59, 13, '#90e3bd'], ['triangle', 139, 95, 14, '#ffc58b'],
        ['dot', 181, 49, 10, '#b4c6ff'], ['square', 231, 98, 15, '#90e3bd'],
        ['triangle', 266, 55, 15, '#b4c6ff'], ['dot', 290, 111, 8, '#ffc58b'],
        ['dot', 173, 119, 9, '#90e3bd'],
      ];
      shapes.forEach(([shape, x, y, radius, color]) => mark(shape, x, y, radius, color));
      break;
    }
    case 2: { // 视觉追踪
      panel(39, 22, 282, 115, '#eff8fa', '#abc8d7');
      ctx.setLineDash([4, 6]);
      path([[85, 99], [126, 80], [168, 102], [220, 63], [275, 55]], '#80b6cb', 2);
      ctx.setLineDash([]);
      ring(85, 99, 21, 21, '#edb3a3', 2);
      mark('dot', 85, 99, 13, coral);
      [[125, 52], [177, 105], [223, 71], [278, 52]].forEach(([x, y]) => mark('dot', x, y, 12, blue));
      break;
    }
    case 3: { // 舒尔特方格
      panel(55, 14, 250, 133);
      const rows = [[17, 1, 26, 8], [5, 22, 14, 2], [29, 11, 3, 19]];
      const spans = [[49, 64, 38, 53], [56, 36, 70, 42], [36, 60, 51, 57]];
      rows.forEach((row, r) => {
        let x = 69;
        row.forEach((number, c) => {
          const w = spans[r][c], y = 26 + 36 * r;
          box(x, y, w, 30, number === 1 ? cream : number === 2 ? mint : '#edf0e9');
          label(number, x + w / 2, y + 16, 17);
          x += w + 6;
        });
      });
      break;
    }
    case 4: { // 图形序列
      const shapes: Shape[] = ['dot', 'diamond', 'dot', 'diamond'];
      const colors = [green, coral, gold, plum];
      for (let i = 0; i < 5; i++) {
        const x = 34 + 60 * i, y = i % 2 ? 49 : 43;
        panel(x, y, 52, 73, i === 4 ? cream : paper);
        if (i === 4) label('?', x + 26, y + 36, 30);
        else mark(shapes[i], x + 26, y + 36, i % 2 ? 15 : 11, colors[i]);
      }
      break;
    }
    case 5: { // 颜色干扰
      panel(39, 53, 82, 60, '#f3e5e0');
      panel(239, 53, 82, 60, '#ece6f6');
      label('蓝', 79, 82, 23, coral);
      label('黄', 281, 82, 23, plum);
      panel(113, 26, 134, 107, '#fffdf9', '#a7bed5');
      label('红', 180, 70, 46, blue);
      box(161, 107, 38, 6, blue, undefined, 3);
      break;
    }
    case 6: { // 路径记忆
      panel(109, 12, 142, 134);
      matrix(125, 24, 4, 4, 28, [8, 9, 5, 6], mint);
      path([[137, 92], [165, 92], [165, 64], [193, 64]], green, 4);
      [[137, 92], [165, 92], [165, 64], [193, 64]].forEach(([x, y]) => mark('dot', x, y, 5, green));
      ring(221, 120, 7, 7, gold);
      break;
    }
    case 7: { // 数字闪记
      panel(45, 27, 270, 110, '#263f3a', '#3c6459');
      const symbols = ['7', 'H', '2', '#', '9', '4', 'B', '6'];
      symbols.forEach((symbol, i) => {
        const x = 83 + i % 4 * 64, y = i < 4 ? 54 : 104;
        const target = [0, 2, 4, 7].includes(i);
        label(symbol, x, y, 25, target ? '#baf2d1' : '#aabbb7');
        if (target) path([[x - 10, y + 15], [x + 10, y + 15]], '#baf2d1', 2.5);
      });
      break;
    }
    case 8: { // 位置复原
      panel(43, 29, 110, 103);
      matrix(55, 39, 3, 3, 29, [1, 3, 8], green);
      for (let i = 0; i < 3; i++) path([[119 + 5 * i, 78], [127 + 5 * i, 70]], plum, 2);
      mark('arrow', 180, 81, 13, green);
      panel(207, 29, 110, 103);
      matrix(219, 39, 3, 3, 29, [], mint);
      ring(289, 110, 8, 8, green, 2.5);
      break;
    }
    case 9: { // 配对翻牌
      for (const [x, angle] of [[108, -0.19], [251, 0.19]]) {
        ctx.save();
        ctx.translate(x, 82);
        ctx.rotate(angle);
        panel(-37, -52, 74, 99);
        mark('diamond', 0, -2, 22, coral);
        mark('diamond', 0, -2, 9, peach);
        ctx.restore();
      }
      panel(150, 30, 60, 100, '#4c7568', '#355a4e');
      ring(180, 80, 18, 18, '#a1c9ae');
      label('?', 180, 81, 21, paper);
      break;
    }
    case 10: { // 旋转判断
      panel(45, 28, 102, 104);
      panel(213, 28, 102, 104);
      matrix(58, 42, 3, 3, 26, [0, 3, 6, 7], plum);
      matrix(226, 42, 3, 3, 26, [0, 1, 2, 3], plum);
      label('↻', 180, 83, 36, plum);
      break;
    }
    case 11: { // 目标搜索
      panel(39, 44, 61, 74, '#f5dca3', '#d8af62');
      mark('star', 70, 79, 18, coral);
      panel(117, 20, 201, 122);
      const shapes: Shape[] = ['triangle', 'dot', 'star', 'square', 'star', 'diamond', 'dot', 'triangle'];
      shapes.forEach((shape, i) => mark(shape, 145 + i % 4 * 48, i < 4 ? 56 : 104, 13, [blue, green, coral, plum][i % 4]));
      ring(241, 56, 20, 20, '#a47322', 2.5);
      path([[255, 71], [267, 83]], '#a47322', 4);
      break;
    }
    case 12: { // 节奏复刻
      panel(43, 18, 274, 126, '#2a4851', '#3b6270');
      ring(180, 65, 28, 28, '#c1dfda', 2);
      mark('dot', 180, 65, 17, '#8edec6');
      mark('dot', 89, 65, 9, '#c4a4cb');
      mark('dot', 271, 65, 7, '#efb370');
      path([[69, 113], [291, 113]], '#82a4ad', 1.5);
      [93, 133, 200, 224, 271].forEach((x, i) => path([[x, 113], [x, 101 - i % 2 * 8]], '#ade8d4', 3.5));
      break;
    }
    case 13: { // 快速心算
      panel(39, 38, 282, 92, '#fffaf0', '#dcbb8d');
      label('7 + 4 × 3', 137, 85, 28);
      label('=', 224, 86, 22, green);
      box(249, 56, 53, 55, cream);
      label('?', 275, 85, 30, '#8e6428');
      break;
    }
    case 14: { // 规则切换
      panel(45, 22, 117, 43, '#3d7064', '#325b53');
      panel(198, 22, 117, 43, '#d9c8ea', '#bda8d0');
      label('按颜色', 104, 45, 19, paper);
      label('按形状', 256, 45, 19, ink);
      mark('arrow', 180, 44, 11, green);
      (['dot', 'triangle', 'square', 'triangle'] as Shape[]).forEach((shape, i) => {
        const x = 55 + i * 67;
        box(x, 85, 52, 48, paper, edge);
        mark(shape, x + 26, 109, 14, [coral, green, blue, coral][i]);
      });
      break;
    }
    case 15: { // 镜像辨认
      panel(44, 27, 111, 106, '#fffafc', '#cbbadc');
      panel(205, 27, 111, 106, '#fffafc', '#cbbadc');
      const shape: Points = [[-35, -28], [12, -28], [12, -12], [-2, -12], [-2, 2], [25, 2], [25, 27], [-35, 27]];
      path(shape.map(([x, y]) => [99 + x, 81 + y]), plum, 1, true);
      path(shape.map(([x, y]) => [261 - x, 81 + y]), plum, 1, true);
      ctx.setLineDash([5, 5]);
      path([[180, 30], [180, 135]], '#9b84b4', 2);
      ctx.setLineDash([]);
      break;
    }
    case 16: { // 顺序重排
      const values = [8, 2, 6, 4];
      values.forEach((value, i) => {
        const x = 53 + i * 67, y = 32 + i % 2 * 7;
        panel(x, y, 54, 68, [paper, '#f5dcae', '#e0eaf7', '#d9eadd'][i]);
        label(value, x + 27, y + 35, [36, 20, 30, 24][i]);
      });
      path([[65, 126], [282, 126]], green, 2);
      mark('arrow', 295, 126, 10, green);
      break;
    }
    case 17: { // 方块叠合
      const left = [0, 3, 4], right = [4, 5, 8];
      const grids: [number, number[], string][] = [[30, left, plum], [143, right, blue], [256, [...left, ...right], green]];
      grids.forEach(([x, cells, color]) => {
        panel(x, 40, 74, 82);
        matrix(x + 8, 52, 3, 3, 20, cells, color);
      });
      label('+', 123, 82, 21, plum);
      label('=', 236, 82, 21, plum);
      break;
    }
    case 18: { // 词义冲突
      panel(119, 16, 122, 37, '#754a67', '#754a67');
      label('水果', 180, 36, 20, paper);
      const words = ['苹果', '果汁', '香蕉', '水果刀', '橘子', '开心果'];
      words.forEach((word, i) => {
        const x = 44 + i % 3 * 93, y = 68 + Math.floor(i / 3) * 36;
        box(x, y, 85, 30, paper, '#e2c5b1');
        label(word, x + 42, y + 15, 15, [green, coral, plum][i % 3]);
      });
      break;
    }
    case 19: { // 多目标计数
      panel(34, 47, 61, 68, mint, '#78ae8a');
      mark('triangle', 64, 81, 17, green);
      panel(112, 21, 214, 121, '#fffaf0', '#dbc799');
      const shapes: Shape[] = ['dot', 'triangle', 'square', 'triangle', 'triangle', 'square', 'dot', 'triangle', 'square', 'triangle', 'triangle', 'dot'];
      const colors = [green, green, coral, plum, coral, green, plum, green, plum, green, coral, green];
      shapes.forEach((shape, i) => mark(shape, 137 + i % 4 * 54, 45 + Math.floor(i / 4) * 36, 10, colors[i]));
      break;
    }
    case 20: { // 反应抑制
      panel(47, 21, 266, 122, '#263a37', '#39534b');
      ring(180, 81, 44, 44, '#94d3ad', 1.5);
      mark('dot', 180, 81, 34, '#7bd79a');
      label('停', 180, 82, 28, '#234835');
      [[94, 58], [100, 104], [266, 58], [260, 104]].forEach(([x, y], i) => mark('dot', x, y, 8, [coral, gold, gold, coral][i]));
      break;
    }
    case 21: { // 图标拼绘
      panel(67, 15, 132, 132);
      matrix(77, 25, 3, 3, 38, [], mint);
      mark('triangle', 132, 42, 17, coral);
      box(115, 62, 34, 34, blue, undefined, 4);
      mark('dot', 132, 79, 8, sky);
      mark('triangle', 94, 82, 13, green, -Math.PI / 2);
      mark('triangle', 170, 82, 13, green, Math.PI / 2);
      mark('diamond', 132, 118, 13, gold);
      (['triangle', 'square', 'diamond'] as Shape[]).forEach((shape, i) => {
        box(225, 23 + i * 41, 53, 34, paper, edge);
        mark(shape, 251, 40 + i * 41, 11, [coral, blue, gold][i]);
      });
      break;
    }
    case 22: { // 特征寻人
      [95, 180, 265].forEach((x, i) => {
        panel(x - 34, 29, 68, 101, i === 1 ? '#fce8b4' : paper, i === 1 ? '#b99047' : edge);
        portrait(x, 77, [blue, green, plum][i], ['#644837', '#2e4339', '#9a5f43'][i], i === 1);
      });
      ring(194, 76, 25, 25, '#51785f', 3);
      path([[211, 95], [225, 109]], '#51785f', 5);
      break;
    }
    case 23: { // 记忆接力
      ctx.setLineDash([4, 5]);
      path([[97, 56], [97, 23], [263, 23], [263, 55]], green, 2);
      ctx.setLineDash([]);
      [97, 180, 263].forEach((x, i) => {
        panel(x - 34, 49, 68, 85, i === 2 ? '#e4f2e3' : paper);
        mark(i === 1 ? 'diamond' : 'triangle', x, 91, 20, [blue, plum, coral][i]);
      });
      break;
    }
    case 24: { // 货架管家
      panel(37, 24, 177, 117, '#ead6b9', '#bc966e');
      [58, 112].forEach(y => path([[48, y + 14], [204, y + 14]], '#a87952', 4));
      [66, 104, 149, 185].forEach((x, i) => {
        box(x - 12, 43, 24, 28, [green, mint, gold, peach][i], undefined, 4);
        box(x - 12, 96, 24, 28, [coral, sky, plum, cream][i], undefined, 4);
      });
      panel(234, 26, 83, 47, '#eff7df');
      label('+ 3', 275, 50, 22, green);
      panel(234, 88, 83, 47, '#f9e5df');
      label('− 2', 275, 112, 22, coral);
      break;
    }
    case 25: { // 变化侦探
      [42, 190].forEach((x, i) => {
        panel(x, 28, 128, 104, '#fff8e4', '#d2b792');
        box(x + 14, 42, 31, 29, '#bda4cf');
        mark('star', x + 30, 56, 9, paper);
        path([[x + 11, 112], [x + 116, 112]], '#b48e64', 4);
        mark(i ? 'square' : 'triangle', x + 71, 75, 16, i ? plum : gold);
        path([[x + 71, 87], [x + 71, 109]], '#aa7558', 3);
        box(x + 93, 92, 15, 19, sky);
        mark('diamond', x + 100, 84, 11, green);
      });
      ring(261, 75, 24, 24, coral, 2);
      break;
    }
    case 26: { // 双闪捕捉
      const shapes: Shape[] = ['star', 'dot', 'square', 'triangle'];
      shapes.forEach((shape, i) => {
        const x = 37 + i * 74, target = i === 0 || i === 2;
        if (target) panel(x, 36, 62, 91, i === 0 ? cream : sky, i === 0 ? '#bb8b3f' : blue);
        else {
          ctx.setLineDash([5, 4]);
          box(x, 46, 62, 71, '#fff9ec', '#a89478');
          ctx.setLineDash([]);
        }
        mark(shape, x + 31, 82, target ? 19 : 13, [plum, green, blue, coral][i]);
      });
      break;
    }
    case 27: { // 大小迷局
      panel(61, 18, 238, 126, '#fbf5e8', '#d4bc88');
      const arrow = ['0000100', '0000110', '1111111', '0000110', '0000100'];
      arrow.forEach((row, r) => [...row].forEach((active, c) => {
        if (active === '1') mark('arrow', 86 + c * 30, 35 + r * 23, 9, [plum, coral, blue][(r + c) % 3], (r + c) % 2 ? -Math.PI / 2 : Math.PI / 2);
      }));
      break;
    }
    case 28: { // 稳手画圆
      panel(53, 19, 254, 122, '#eaf4f7', '#b0cad5');
      ring(111, 83, 7, 7, '#77a1b9');
      mark('dot', 182, 81, 6, ink);
      ring(244, 55, 7, 7, '#77a1b9');
      ctx.beginPath();
      ctx.moveTo(225, 83);
      ctx.bezierCurveTo(226, 28, 160, 27, 142, 62);
      ctx.bezierCurveTo(119, 106, 173, 142, 209, 116);
      ctx.bezierCurveTo(217, 110, 223, 103, 224, 95);
      ctx.lineWidth = 4;
      ctx.strokeStyle = blue;
      ctx.stroke();
      mark('dot', 224, 95, 5, blue);
      break;
    }
    case 29: { // 轨道护航
      panel(43, 21, 274, 122, '#254851', '#476973');
      ring(180, 82, 101, 39, '#79a7af', 14);
      ring(180, 82, 101, 39, '#c4e2e5', 1.5);
      ring(249, 53, 24, 24, '#b5f2c7', 1.5);
      mark('dot', 249, 53, 12, '#9be9b7');
      ring(217, 46, 10, 10, cream, 3);
      break;
    }
    case 30: { // 时钟巡检
      [94, 180, 266].forEach((x, i) => {
        mark('dot', x, 84, 35, i === 1 ? cream : paper);
        ring(x, 84, 35, 35, i === 1 ? '#aa792b' : '#83a8ba', 2);
        for (let tick = 0; tick < 12; tick++) {
          const a = tick * Math.PI / 6;
          path([[x + 27 * Math.cos(a), 84 + 27 * Math.sin(a)], [x + 31 * Math.cos(a), 84 + 31 * Math.sin(a)]], blue, 1.5);
        }
        const hand = (i === 1 ? 2 : i === 0 ? 1 : 4) * Math.PI / 6;
        if (i === 1) {
          ctx.setLineDash([3, 3]);
          path([[x, 84], [x, 65]], '#b7894e');
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.arc(x, 84, 23, -Math.PI / 2, -Math.PI / 2 + hand);
          ctx.lineWidth = 2;
          ctx.strokeStyle = coral;
          ctx.stroke();
        }
        path([[x, 84], [x + 20 * Math.sin(hand), 84 - 20 * Math.cos(hand)]], i === 1 ? coral : blue, 3);
        mark('dot', x, 84, 3, ink);
      });
      break;
    }
    case 31: { // 折纸打孔
      panel(54, 36, 90, 90, '#fff9ff', '#c3aed6');
      path([[55, 37], [143, 37], [143, 125]], lilac, 1, true);
      ctx.setLineDash([4, 4]);
      path([[55, 37], [143, 125]], plum);
      ctx.setLineDash([]);
      mark('dot', 118, 58, 8, plum);
      mark('arrow', 179, 81, 13, plum);
      panel(216, 36, 90, 90, '#fff9ff', '#c3aed6');
      mark('dot', 280, 58, 8, plum);
      mark('dot', 238, 100, 8, plum);
      break;
    }
    case 32: { // 立方展开
      const colors = [lilac, sky, peach, mint, cream, '#af8dc8'];
      const net: Points = [[85, 22], [49, 58], [85, 58], [121, 58], [157, 58], [85, 94]];
      net.forEach(([x, y], i) => box(x, y, 35, 35, colors[i], '#a697ba', 2));
      mark('arrow', 207, 77, 10, plum);
      path([[263, 35], [311, 60], [263, 85], [215, 60]], lilac, 1, true);
      path([[215, 60], [263, 85], [263, 136], [215, 110]], '#af8dc8', 1, true);
      path([[263, 85], [311, 60], [311, 110], [263, 136]], '#7c64a1', 1, true);
      break;
    }
    case 33: { // 星图连线
      panel(32, 19, 296, 125, '#242d47', '#525779');
      const stars: Points = [[61, 110], [78, 55], [114, 81], [145, 46], [160, 107]];
      path(stars, '#a3b9e4', 2);
      path([[181, 38], [181, 123]], '#60708f', 1.5);
      const rotated: Points = stars.map(([x, y]) => [249 - (y - 81) * 0.9, 81 + (x - 108) * 0.9]);
      for (const points of [stars, rotated]) {
        points.forEach(([x, y], i) => {
          if (i === 4) ring(x, y, 6, 6, '#a3b9e4');
          else mark('dot', x, y, i === 1 ? 5 : 3.5, i === 1 ? '#ffd780' : paper);
        });
      }
      break;
    }
    case 34: { // 线索推理
      panel(42, 21, 276, 119, '#fff9f1', '#d9bba8');
      [98, 180, 262].forEach((x, i) => {
        portrait(x, 66, [green, coral, blue][i], ['#634430', '#b06946', '#3e4943'][i], i === 0);
        box(x - 24, 106, 48, 22, ['#dae9d6', cream, '#dcebf3'][i]);
        label(i === 1 ? '?' : i + 1, x, 117, 14);
      });
      mark('arrow', 139, 68, 8, '#a37658');
      mark('arrow', 221, 68, 8, '#a37658');
      break;
    }
    case 35: { // 数感天平
      path([[82, 57], [278, 57]], '#775f57', 5);
      path([[180, 56], [150, 136], [210, 136], [180, 56]], '#b98665', 1, true);
      [106, 254].forEach(x => {
        path([[x, 57], [x - 37, 113], [x + 37, 113], [x, 57]], '#9b795f', 2);
        box(x - 40, 109, 80, 9, '#9c724c', undefined, 4);
      });
      mark('square', 91, 98, 13, coral);
      mark('square', 120, 98, 13, coral);
      mark('square', 238, 98, 13, coral);
      label('?', 266, 97, 25, plum);
      break;
    }
    case 36: { // 矩阵推演
      panel(100, 13, 160, 137, '#fefaf5', '#dac3ad');
      const shapes: Shape[] = ['dot', 'triangle', 'diamond'];
      for (let i = 0; i < 9; i++) {
        const x = 112 + i % 3 * 46, y = 24 + Math.floor(i / 3) * 39;
        box(x, y, 43, 35, i === 8 ? cream : '#f0e8e0');
        if (i === 8) label('?', x + 21, y + 18, 20);
        else mark(shapes[(i + Math.floor(i / 3)) % 3], x + 21, y + 17, 10, [green, coral, plum][Math.floor(i / 3)]);
      }
      break;
    }
    case 37: { // 规则密码
      panel(43, 20, 274, 124, '#244640', '#406b5e');
      ['2', '◆', '4', '?'].forEach((value, i) => {
        const x = 63 + 61 * i;
        box(x, 40, 51, 53, i === 3 ? '#e9d0a5' : '#edf5e7');
        label(value, x + 25, 68, 24);
      });
      [86, 178, 260].forEach((x, i) => {
        label(i === 2 ? '○' : '✓', x, 119, 14, '#b3e9c8');
        path([[x + 12, 119], [x + 37, 119]], '#9bb7ac', 2);
      });
      break;
    }
    case 38: { // 预算挑战
      panel(50, 30, 154, 100, '#fff4da', '#c7ab76');
      path([[64, 69], [190, 69], [178, 115], [79, 115]], '#769986', 1, true);
      mark('dot', 95, 62, 15, coral);
      mark('dot', 129, 56, 17, gold);
      mark('diamond', 162, 61, 17, green);
      path([[84, 89], [172, 89]], '#b7d6bf', 3);
      panel(225, 35, 84, 91, '#fbefd4', '#cfaf70');
      mark('dot', 267, 70, 24, gold);
      label('100', 267, 70, 17, '#62421b');
      path([[248, 107], [286, 107]], '#a68650', 2);
      break;
    }
    case 39: { // 路线规划
      panel(66, 16, 228, 130);
      for (let i = 0; i < 18; i++) {
        box(81 + i % 6 * 34, 29 + Math.floor(i / 6) * 35, 29, 29,
          [1, 4, 7, 9, 15, 16].includes(i) ? '#c7e0ec' : '#e5ecda', undefined, 5);
      }
      path([[95, 112], [95, 77], [129, 77], [164, 77], [164, 43], [198, 43], [232, 43], [266, 43]], green, 4);
      mark('arrow', 266, 43, 9, green);
      [[95, 112], [164, 77], [232, 43]].forEach(([x, y], i) => {
        mark('dot', x, y, 10, i === 0 ? plum : green);
        label(i === 0 ? '起' : i, x, y + 1, 10, paper);
      });
      break;
    }
    case 40: { // 圆盘搬运
      panel(45, 28, 270, 112, '#fbf4e6', '#c9b28c');
      box(57, 117, 246, 10, '#9e775a', undefined, 5);
      [96, 180, 264].forEach(x => box(x - 3, 50, 6, 68, '#b79674', undefined, 3));
      [70, 57, 42].forEach((w, i) => box(96 - w / 2, 103 - i * 14, w, 12, [coral, gold, green][i], undefined, 6));
      box(252, 104, 24, 12, plum, undefined, 6);
      mark('arrow', 144, 70, 14, green);
      break;
    }
  }
}

export default function GamePreview({ gameId }: { gameId: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.clearRect(0, 0, width, height);
    drawPreview(ctx, gameId);
  }, [gameId]);

  return <canvas ref={ref} width={width * 2} height={height * 2} aria-hidden="true" />;
}
