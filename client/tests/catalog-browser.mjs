import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';

// 对隔离测试实例运行：设置 BRAIN_BROWSER_TEST_URL 后在仓库根目录执行 node client/tests/catalog-browser.mjs。
const base = process.env.BRAIN_BROWSER_TEST_URL;
assert.ok(base, '请设置隔离测试实例的 BRAIN_BROWSER_TEST_URL');
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const cards = page.locator('.game-card');
  const category = name => page.getByRole('button', { name, exact: true });
  await page.goto(base);
  await expect(cards).toHaveCount(40);

  await page.getByLabel('建议年龄筛选').selectOption('6');
  await expect(cards).toHaveCount(23);
  await expect(category('全部 23')).toBeVisible();
  await expect(category('记忆力 8')).toBeVisible();
  await page.getByRole('checkbox', { name: '无需已学数字' }).check();
  await expect(category('全部 18')).toBeVisible();
  await category('记忆力 5').click();
  await expect(cards).toHaveCount(5);
  await expect(page.getByText('5 款游戏', { exact: true })).toBeVisible();
  await page.getByLabel('搜索游戏').fill('路径');
  await expect(category('记忆力 1')).toBeVisible();
  await expect(cards).toHaveCount(1);
  await page.getByLabel('搜索游戏').fill('没有这个游戏');
  await expect(category('全部 0')).toBeVisible();
  await expect(cards).toHaveCount(0);
  await page.getByRole('button', { name: '显示全部游戏' }).click();
  await expect(cards).toHaveCount(40);

  const previews = page.locator('.card-visual canvas');
  await expect(previews).toHaveCount(40);
  await expect.poll(() => previews.evaluateAll(items => {
    const blank = document.createElement('canvas');
    blank.width = items[0].width;
    blank.height = items[0].height;
    const empty = blank.toDataURL();
    return new Set(items.map(item => item.toDataURL()).filter(url => url !== empty)).size;
  })).toBe(40);
  await cards.filter({ hasText: '视觉追踪' }).locator('.card-visual').click();
  await expect(page).toHaveURL(/#\/game\/2\?level=1$/);
  await expect(page.getByRole('heading', { name: '视觉追踪' })).toBeVisible();
  await page.getByRole('button', { name: '返回目录' }).click();
  const flashCard = page.getByRole('link', { name: /瞬时记忆/ });
  await flashCard.focus();
  await flashCard.press('Enter');
  await expect(page).toHaveURL(/#\/game\/1\?level=1$/);
  const flashTitle = page.getByRole('heading', { name: '瞬时记忆', level: 1 });
  await expect(flashTitle).toBeFocused();

  await page.getByRole('button', { name: '选择账号开始练习' }).click();
  await page.getByRole('button', { name: '创建新账号' }).click();
  await page.getByLabel('账号名称').fill('目录浏览器验收');
  await page.getByLabel('密码', { exact: true }).fill('Catalog-Test-4821');
  await page.getByRole('button', { name: '创建并登录' }).click();
  await expect(page.getByText(/只记圆点的数量，忽略三角形和方形/)).toBeVisible();
  await expect(flashTitle).toBeFocused();

  const counts = [];
  for (let round = 0; round < 3; round++) {
    if (round === 1) {
      await page.reload();
      await expect(page.getByLabel('第2回合')).toBeVisible();
    }
    await page.getByRole('button', { name: '开始闪现' }).click();
    const board = page.getByLabel('计数画面');
    await expect(board).toBeVisible();
    const count = await board.getByRole('img', { name: '圆形' }).count();
    assert.ok(count >= 2 && count <= 5);
    assert.notEqual(count, counts[round - 1]);
    counts.push(count);
    await expect(board.getByRole('img', { name: '三角形' }).first()).toBeVisible();
    await expect(board.getByRole('img', { name: '方形' }).first()).toBeVisible();
    await expect(board).toHaveCount(0);
    await page.getByLabel('刚才有几个圆点？').fill(String(count));
    await page.getByRole('button', { name: '提交答案' }).click();
    await expect(page.getByText('100 分', { exact: true })).toBeVisible();
    if (round < 2) await page.getByRole('button', { name: '下一回合 →' }).click();
  }
  await page.getByRole('button', { name: '保存本局训练' }).click();
  await expect(page.getByRole('status').filter({ hasText: '已保存到主机' })).toBeVisible();
  assert.deepEqual(errors, []);

  const phone = await browser.newPage({ viewport: { width: 360, height: 800 }, hasTouch: true });
  await phone.goto(base);
  await expect(phone.locator('.game-card')).toHaveCount(40);
  assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await phone.locator('.game-card').last().locator('.card-visual').tap();
  await expect(phone).toHaveURL(/#\/game\/40\?level=1$/);
  const title = phone.getByRole('heading', { name: '圆盘搬运' });
  await expect(title).toBeInViewport();
  await expect(title).toBeFocused();
  console.log(`通过：筛选数字、40 幅不同预览、鼠标/键盘/触屏整卡入口、瞬时记忆三回合 ${counts.join(' → ')} 与保存`);
} finally {
  await browser.close();
}
