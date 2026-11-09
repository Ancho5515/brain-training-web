import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';

// Run with a Vite dev server: node src/games/groupA/browser-smoke.mjs
// Override GROUP_A_URL and PLAYWRIGHT_CHROMIUM_EXECUTABLE when needed.
const base = process.env.GROUP_A_URL || 'http://127.0.0.1:5175';
const browser = await chromium.launch({headless:true, executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || chromium.executablePath(), args:['--no-sandbox']});
const seed=43, failures=[], checks=[];
const click=async(page,name)=>page.getByRole('button',{name,exact:true}).click({force:true});
const advance=async(page,ms)=>{await page.clock.fastForward(ms+40);};
const generated=async(page,name,level)=>page.evaluate(async({name,level,seed})=>{const e=await import('/src/games/groupA/engines.ts');return e[name](level,seed);},{name,level,seed});
async function result(page,id,level,expected=1){
  await expect.poll(()=>page.evaluate(()=>window.__results.length)).toBe(1);
  const r=await page.evaluate(()=>window.__results[0]);
  assert.ok(Math.abs(r.accuracy-expected)<0.005,`id ${id} level ${level}: ${r.accuracy} != ${expected}`);
  assert.ok(Number.isFinite(r.durationMs)&&r.durationMs>=0);
  assert.ok(r.score>=0&&r.score<=100);
  await advance(page,90000);
  assert.equal(await page.evaluate(()=>window.__results.length),1,'one finish only');
}
try {
  for(const level of [1,15,30]) for(let id=1;id<=14;id++){
    const page=await browser.newPage({viewport:{width:level===30?360:900,height:900}});
    const errors=[]; page.on('pageerror',e=>errors.push(String(e)));
    try{
      const baseTime=new Date('2026-11-09T12:00:00Z');
      await page.clock.install({time:baseTime});
      await page.goto(`${base}/src/games/groupA/harness.html?id=${id}&level=${level}&seed=${seed}`);
      await expect(page.locator('.game-instructions h2')).toBeVisible();
      await page.clock.pauseAt(new Date(baseTime.getTime()+3000));
      assert.equal(await page.evaluate(()=>window.__results.length),0,'must not finish on mount');
      switch(id){
        case 1:{
          const t=await generated(page,'generateCount',level);
          await click(page,'开始闪现');
          await expect(page.getByLabel('计数画面')).toBeVisible();
          await advance(page,t.exposureMs);
          await expect(page.getByLabel('计数画面')).toHaveCount(0);
          assert.equal(await page.locator('.game-scene svg').count(),0,'stimuli hidden for recall');
          await page.getByLabel('刚才有几个圆点？').fill(String(t.answer));
          await click(page,'提交答案');await click(page,'提交答案');break;
        }
        case 2:{
          const t=await generated(page,'generateTracking',level);
          await click(page,'开始追踪');
          const target=page.getByRole('button',{name:`球 ${t.target+1}`,exact:true});
          await expect(target).toBeDisabled();
          const initial=await target.getAttribute('style');
          await advance(page,t.cueMs);await expect(page.getByText('保持追踪，暂时不能选择')).toBeVisible();
          await advance(page,1000);const moved=await target.getAttribute('style');assert.notEqual(moved,initial);
          assert.ok(!(await moved).includes('rgb(217, 78, 66)'),'target becomes blue');
          await advance(page,t.travelMs-1000);await expect(target).toBeEnabled();
          await target.click({force:true});await target.click({force:true});break;
        }
        case 3:{
          const t=await generated(page,'generateSchulte',level);
          await page.getByRole('button',{name:/开始寻找/}).click({force:true});
          await expect(page.getByLabel('不规则数字表')).toBeVisible();
          assert.equal(await page.locator('.game-grid .tile').count(),30);
          await advance(page,t.timeMs);
          await expect(page.getByLabel('不规则数字表')).toHaveCount(0);
          await page.getByLabel('最后找到的数字（0–30，自报）').fill('30');await click(page,'提交答案');await click(page,'提交答案');break;
        }
        case 4:{
          const t=await generated(page,'generateSequence',level);
          const answer=page.locator('.answer-grid button').nth(t.options.indexOf(t.answer));
          await answer.click({force:true});await answer.click({force:true});break;
        }
        case 5:{
          const t=await generated(page,'generateStroop',level);
          const answer=page.locator('.answer-grid button').nth(t.options.indexOf(t.ink));
          await answer.click({force:true});await answer.click({force:true});break;
        }
        case 6:{
          const t=await generated(page,'generatePath',level);
          await click(page,'开始观察');await advance(page,t.frames.length*t.stepMs);
          await expect(page.getByLabel('路径作答')).toBeVisible();
          assert.equal(await page.locator('.game-grid svg').count(),0,'no target markers remain during recall');
          for(const n of t.targets) await click(page,`位置 ${n+1}`);
          await click(page,'提交路径');await click(page,'提交路径');break;
        }
        case 7:{
          const t=await generated(page,'generateDigits',level);
          await click(page,'开始观察');await advance(page,t.exposureMs);
          await expect(page.getByLabel('字符记忆画面')).toHaveCount(0);
          await page.getByLabel('按行顺序输入数字').fill(t.answer);await click(page,'提交数字');await click(page,'提交数字');break;
        }
        case 8:{
          const t=await generated(page,'generateLocations',level);
          await click(page,'开始观察');await advance(page,t.exposureMs);
          await expect(page.getByLabel('位置作答')).toBeVisible();
          assert.equal(await page.locator('.game-grid [style*="repeating-linear"]').count(),0,'no striped cue remains during recall');
          for(const n of [...t.targets].reverse()) await click(page,`位置 ${n+1}`);
          await click(page,'提交位置');await click(page,'提交位置');break;
        }
        case 9:{
          const t=await generated(page,'generatePairs',level), used=new Set();
          await click(page,'开始翻牌');
          for(let i=0;i<t.cards.length;i++){
            if(used.has(i)) continue;
            const a=t.cards[i],j=t.cards.findIndex((b,j)=>j!==i&&!used.has(j)&&a.shape===b.shape&&a.striped===b.striped&&a.rotation===b.rotation);
            await click(page,`牌 ${i+1}`);await click(page,`牌 ${j+1}`);used.add(i);used.add(j);await advance(page,380);
          }break;
        }
        case 10:{
          const t=await generated(page,'generateRotation',level),name=t.same?'可以旋转重合':'不能旋转重合';
          await click(page,name);await click(page,name);break;
        }
        case 11:{
          const t=await generated(page,'generateSearch',level);
          for(const n of t.targets) await click(page,`图案 ${n+1}`);
          await click(page,'提交全部目标');await click(page,'提交全部目标');break;
        }
        case 12:{
          const t=await generated(page,'generateRhythm',level);
          await click(page,'播放节奏');await advance(page,1200+t.gaps.reduce((a,b)=>a+b,0));
          await expect(page.getByLabel('节奏展示')).toHaveCount(0);
          const tap=page.getByRole('button',{name:'敲击节奏',exact:true});
          await tap.dispatchEvent('pointerdown');
          for(const gap of t.gaps){await page.clock.fastForward(gap);await tap.dispatchEvent('pointerdown');}
          await click(page,'提交节奏');await click(page,'提交节奏');break;
        }
        case 13:{
          const t=await generated(page,'generateArithmetic',level);
          await page.getByLabel('计算结果').fill(String(Math.abs(t.answer)));if(t.answer<0)await click(page,'切换正负');await click(page,'提交答案');await click(page,'提交答案');break;
        }
        case 14:{
          const t=await generated(page,'generateSwitch',level);
          for(const trial of t){const answer=trial.rule==='color'?trial.color:trial.shape;await page.locator('.answer-grid button').nth(trial.options.indexOf(answer)).click({force:true});}
          await page.locator('.answer-grid button').first().click({force:true});break;
        }
      }
      await result(page,id,level);
      assert.deepEqual(errors,[]);
      const small=await page.locator('.game-scene button:not([disabled])').evaluateAll(buttons=>buttons.map(b=>({label:b.getAttribute('aria-label')||b.textContent,width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height})).filter(b=>b.width<43.9||b.height<43.9));
      assert.deepEqual(small,[],'touch targets at least 44 px');
      checks.push({id,level});console.log(`PASS id=${id} level=${level}`);
    }catch(error){failures.push({id,level,error:String(error)});console.error(`FAIL id=${id} level=${level}:`,error);}
    finally{await page.close();}
  }
}finally{await browser.close();}
console.log(JSON.stringify({passed:checks.length,failed:failures.length,failures},null,2));
if(failures.length)process.exitCode=1;
