"""Shared browser checks for the FRAME canvas.

Every case here exists because a delivered version broke it once: R5 shipped one
arrow for every endpoint, R6 lost the asset rename on a poisoned project, R7
regressed the agent preview, R8 rewrote the whole project on every save.
Run them through ``run_all.py`` before shipping.
"""
import base64
import json

PNG = base64.b64encode(bytes.fromhex(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f00050001ff'
    '5f1d5b6b0000000049454e44ae426082')).decode()

STATE = """()=>{
  const root=document.querySelector('#frameFlowRoot');
  const card=document.querySelector('#frameFlowRoot .rfa-card');
  const canvas=document.querySelector('#frameFlowRoot .rfa-aurora-canvas');
  const paths=[...document.querySelectorAll('#frameFlowRoot .react-flow__edge-path')];
  const p0=paths[0];
  const handle=document.querySelector('#frameFlowRoot .react-flow__handle');
  let painted=false;
  if(canvas&&canvas.width>0){
    const ctx=canvas.getContext('2d');
    const data=ctx.getImageData(0,0,Math.min(canvas.width,300),Math.min(canvas.height,300)).data;
    for(let i=3;i<data.length;i+=4){if(data[i]>0){painted=true;break}}
  }
  return {
    cardBg:card?getComputedStyle(card).backgroundColor:null,
    marker:p0?p0.getAttribute('marker-end'):null,
    stroke:p0?p0.style.stroke:null,
    handleOpacity:handle?getComputedStyle(handle).opacity:null,
    nodes:document.querySelectorAll('#frameFlowRoot .react-flow__node').length,
    assets:document.querySelectorAll('#frameFlowRoot .rfa-asset').length,
    aurora:canvas?{hidden:canvas.hidden,opacity:getComputedStyle(canvas).opacity,painted}:null
  };
}"""


async def open_canvas(page, url, mode='canvas'):
    await page.goto(url, wait_until='networkidle')
    await page.wait_for_timeout(1200)
    await page.click(f'[data-home-mode="{mode}"]', force=True)
    await page.wait_for_selector('#frameFlowRoot', timeout=45000)
    await page.wait_for_timeout(3200)


async def open_settings(page):
    await page.evaluate("()=>document.querySelector('[data-inspector-tab=settings]')?.click()")
    await page.wait_for_timeout(1200)


async def set_control(page, kind, key, value):
    js = """([kind,key,value])=>{
      const sel = kind==='select'?`[data-appearance-select="${key}"]`:kind==='number'?`[data-appearance-number="${key}"]`:kind==='check'?`[data-appearance-check="${key}"]`:`[data-appearance-color="${key}"]`;
      const el=document.querySelector('.canvasSettings '+sel);
      if(!el) return 'missing '+sel;
      if(kind==='check'){ if(el.checked!==value){ el.checked=value; el.dispatchEvent(new Event('change',{bubbles:true})) } return 'ok' }
      if(kind==='number'){ el.value=value; el.dispatchEvent(new Event('input',{bubbles:true})); return 'ok' }
      el.value=value; el.dispatchEvent(new Event('change',{bubbles:true})); el.dispatchEvent(new Event('input',{bubbles:true})); return 'ok'
    }"""
    result = await page.evaluate(js, [kind, key, value])
    await page.wait_for_timeout(1300)
    return result


async def drop_file(page, selector, data=PNG):
    js = """async ([sel,b64])=>{
      const el=document.querySelector(sel); if(!el) return 'missing';
      const bin=atob(b64); const arr=new Uint8Array(bin.length);
      for(let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
      const dt=new DataTransfer(); dt.items.add(new File([arr],'drop.png',{type:'image/png'}));
      const r=el.getBoundingClientRect();
      const o={bubbles:true,cancelable:true,dataTransfer:dt,clientX:r.left+r.width/2,clientY:r.top+r.height/2};
      el.dispatchEvent(new DragEvent('dragover',o)); el.dispatchEvent(new DragEvent('drop',o)); return 'ok';
    }"""
    return await page.evaluate(js, [selector, data])


def canvas_appearance(page, url, report):
    async def body():
        await open_canvas(page, url)
        await open_settings(page)
        await page.evaluate("()=>document.querySelector('.canvasSettings [data-reset-appearance]')?.click()")
        await page.wait_for_timeout(1500)
        state = await page.evaluate(STATE)
        report('画布已渲染', state['nodes'] > 0, state['nodes'])
        report('端点使用自定义 marker', 'rfa-arrow' in (state['marker'] or ''), state['marker'])

        await set_control(page, 'select', 'arrowType', 'jack')
        state = await page.evaluate(STATE)
        hierarchy = await page.evaluate("()=>document.querySelector('.canvasSettings [data-appearance-check=hierarchy]')?.checked")
        report('手动选端点后取消层级覆盖', 'jack' in (state['marker'] or '') and hierarchy is False, f"{state['marker']} hierarchy={hierarchy}")

        await set_control(page, 'color', 'lineColor', '#22cc88')
        state = await page.evaluate(STATE)
        report('连线颜色生效', state['stroke'] in ('rgb(34, 204, 136)', '#22cc88'), state['stroke'])

        await set_control(page, 'check', 'pins', False)
        await page.mouse.move(20, 20)
        await page.wait_for_timeout(400)
        state = await page.evaluate(STATE)
        report('关闭焊盘后端点隐藏', state['handleOpacity'] == '0', state['handleOpacity'])
        await set_control(page, 'check', 'pins', True)
    return body


def asset_rename(page, url, report):
    async def body():
        await open_canvas(page, url)
        name = '回归改名' + str(int(__import__('time').time()))[-4:]
        await page.locator('#frameFlowRoot .rfa-asset textarea[aria-label="素材名称"]').first.fill(name)
        await page.locator('.rfa-toolbar strong').click()
        await page.wait_for_timeout(2500)
        status = await page.evaluate("()=>document.querySelector('.rfa-status span')?.textContent")
        report('素材卡内改名保存成功', '已保存' in (status or ''), status)
        await open_canvas(page, url)
        names = await page.evaluate("()=>[...document.querySelectorAll('#frameFlowRoot .rfa-asset header strong')].map(e=>e.textContent)")
        report('重开后名称保留', name in names, names)
    return body


def drop_replace(page, url, report):
    async def body():
        await open_canvas(page, url)
        before = await page.evaluate("()=>document.querySelectorAll('#frameFlowRoot .rfa-asset').length")
        await drop_file(page, '#frameFlowRoot .react-flow__node[data-id^="a:"]')
        await page.wait_for_timeout(2600)
        after = await page.evaluate("()=>document.querySelectorAll('#frameFlowRoot .rfa-asset').length")
        report('拖到卡片边缘是替换不是新增', after == before, f'{before}->{after}')
        toast = await page.evaluate("()=>document.querySelector('#toast')?.textContent")
        report('替换有明确提示', '替换' in (toast or ''), toast)
    return body


CHECKS = [canvas_appearance, asset_rename, drop_replace]

def media_urls(page, url, report):
    """R9: the browser must fetch media by path, not receive 200MB of base64."""
    async def body():
        await open_canvas(page, url)
        await page.wait_for_timeout(1500)
        info = await page.evaluate("""()=>({
          imgs:[...document.querySelectorAll('#frameFlowRoot img')].map(i=>i.getAttribute('src')||''),
          loaded:[...document.querySelectorAll('#frameFlowRoot img')].filter(i=>i.naturalWidth>0).length,
          total:document.querySelectorAll('#frameFlowRoot img').length,
          dataUrls:[...document.querySelectorAll('#frameFlowRoot img')].filter(i=>(i.getAttribute('src')||'').startsWith('data:')).length
        })""")
        report('素材图片走接口而不是 base64', info['dataUrls'] == 0, f"data:{info['dataUrls']} total:{info['total']}")
        report('素材图片已真正解码', info['loaded'] > 0 and info['loaded'] == info['total'], f"{info['loaded']}/{info['total']}")

        probe = await page.evaluate("""async (base)=>{
          const boot = await (await fetch('/api/bootstrap')).json();
          const r = await fetch(base + '/api/project', {headers:{'X-Workbench-Token': boot.token}});
          return {status:r.status, size:Number(r.headers.get('Content-Length')||0)};
        }""", url)
        report('工程响应不再携带媒体体积', probe['size'] < 4 * 1024 * 1024, probe)

        sample = await page.evaluate("""async ()=>{
          const img = document.querySelector('#frameFlowRoot img');
          if(!img) return null;
          const r = await fetch(img.src, {headers:{Range:'bytes=0-31'}});
          const buf = await r.arrayBuffer();
          return {status:r.status, range:r.headers.get('Content-Range'), bytes:buf.byteLength};
        }""")
        report('媒体接口支持范围请求', sample and sample['status'] == 206 and sample['bytes'] == 32, sample)
    return body


CHECKS.append(media_urls)

def undo_edits(page, url, report):
    """P1: field edits, deletes and replacements all go through one undo stack."""
    async def body():
        await open_canvas(page, url)
        field = page.locator('#frameFlowRoot .rfa-segment textarea[aria-label="片段名称"]').first
        before = await field.input_value()
        changed = before + '·改'
        await field.fill(changed)
        await page.locator('.rfa-toolbar strong').click()
        await page.wait_for_timeout(2200)
        after = await page.locator('#frameFlowRoot .rfa-segment textarea[aria-label="片段名称"]').first.input_value()
        report('编辑已保存', after == changed, f'{before} -> {after}')

        await page.keyboard.press('Control+z')
        await page.wait_for_timeout(2200)
        undone = await page.locator('#frameFlowRoot .rfa-segment textarea[aria-label="片段名称"]').first.input_value()
        report('Ctrl+Z 撤销编辑', undone == before, f'{changed} -> {undone}')

        await page.keyboard.press('Control+Shift+z')
        await page.wait_for_timeout(2200)
        redone = await page.locator('#frameFlowRoot .rfa-segment textarea[aria-label="片段名称"]').first.input_value()
        report('Ctrl+Shift+Z 重做', redone == changed, f'{undone} -> {redone}')

        await page.keyboard.press('Control+z')
        await page.wait_for_timeout(2200)
        asset = await page.evaluate("()=>document.querySelector('#frameFlowRoot .rfa-asset')?.dataset.rfaId||''")
        assets_before = await page.evaluate("()=>document.querySelectorAll('#frameFlowRoot .rfa-asset').length")
        if asset:
            await page.evaluate("(id)=>window.frameFlowHost.remove([id])", asset)
            await page.wait_for_timeout(2200)
            assets_after = await page.evaluate("()=>document.querySelectorAll('#frameFlowRoot .rfa-asset').length")
            await page.keyboard.press('Control+z')
            await page.wait_for_timeout(2400)
            assets_back = await page.evaluate("()=>document.querySelectorAll('#frameFlowRoot .rfa-asset').length")
            report('删除素材后可撤销', assets_after == assets_before - 1 and assets_back == assets_before, f'{assets_before}->{assets_after}->{assets_back}')
        else:
            report('删除素材后可撤销', False, '没有素材卡')
    return body


CHECKS.append(undo_edits)

def theme_presets(page, url, report):
    """P2: presets change backdrop, particles and big type, and persist."""
    async def body():
        await open_canvas(page, url)
        await open_settings(page)
        state = "()=>{const d=document.querySelector('#overviewDialog');const c=document.querySelector('#frameFlowRoot .rfa-particles');const t=document.querySelector('#frameFlowRoot .rfa-bigtype');let painted=false;if(c&&c.width){const x=c.getContext('2d').getImageData(0,0,Math.min(200,c.width),Math.min(200,c.height)).data;for(let i=3;i<x.length;i+=4){if(x[i]>0){painted=true;break}}}return {preset:d.dataset.themeCurrent,particles:c?{hidden:c.hidden,painted}:null,style:window.frameParticles?.style,count:window.frameParticles?.count}}"
        await page.evaluate("()=>document.querySelector('button[data-theme-preset=cyber]')?.click()")
        await page.wait_for_timeout(2200)
        first = await page.evaluate(state)
        report('预设切换到赛博底片', first['preset'] == 'cyber', first['preset'])
        report('数据雨粒子已绘制', first['particles'] and first['particles']['painted'] and first['style'] == 'rain', first)

        await page.evaluate("()=>document.querySelector('button[data-theme-preset=quiet]')?.click()")
        await page.wait_for_timeout(1600)
        quiet = await page.evaluate(state)
        report('静默预设关闭粒子', quiet['preset'] == 'quiet' and quiet['particles']['hidden'], quiet)

        await page.evaluate("()=>document.querySelector('button[data-theme-preset=forest]')?.click()")
        await page.wait_for_timeout(1800)
        forest = await page.evaluate(state)
        report('萤火预设使用萤火粒子', forest['style'] == 'fireflies' and forest['count'] > 0, forest)

        await page.evaluate("""()=>{const el=document.querySelector('[data-theme-field="particles.count"]');if(el){el.value=40;el.dispatchEvent(new Event('input',{bubbles:true}))}}""")
        await page.wait_for_timeout(1400)
        dense = await page.evaluate(state)
        report('密度滑杆立即生效', dense['count'] == 40, dense['count'])

        # The layers must repaint on change, not only on reload.
        backdrop = "()=>getComputedStyle(document.querySelector('#frameFlowRoot .rfa-backdrop')).backgroundImage.slice(0,60)"
        await page.evaluate("()=>document.querySelector('button[data-theme-preset=cyber]')?.click()")
        await page.wait_for_timeout(1300)
        first_bg = await page.evaluate(backdrop)
        await page.evaluate("()=>document.querySelector('button[data-theme-preset=forge]')?.click()")
        await page.wait_for_timeout(1300)
        second_bg = await page.evaluate(backdrop)
        report('切换预设底片立即变化', first_bg != second_bg and second_bg != 'none', f'{first_bg} -> {second_bg}')

        picker = await page.evaluate("""()=>{const select=document.querySelector('[data-theme-field="backdrop.url"]');const upload=document.querySelector('[data-theme-backdrop-upload]');return {hasSelect:!!select,options:select?select.options.length:0,hasUpload:!!upload,bigType:!!document.querySelector('.rfa-bigtype')}}""")
        report('底片素材可下拉与上传', picker['hasSelect'] and picker['hasUpload'] and picker['options'] >= 1, picker)
        report('项目大字已移除', picker['bigType'] is False, picker['bigType'])

        await page.evaluate("()=>document.querySelector('button[data-theme-preset=aurora]')?.click()")
        await page.wait_for_timeout(1600)
        await open_canvas(page, url)
        kept = await page.evaluate("()=>document.querySelector('#overviewDialog').dataset.themeCurrent")
        report('重开后主题保留', kept == 'aurora', kept)
    return body


CHECKS.append(theme_presets)

def appearance_panel(page, url, report):
    """The theme block must stay outside the collapsed block, and the block must open."""
    async def body():
        await open_canvas(page, url)
        await open_settings(page)
        info = await page.evaluate("""()=>{
          const panel=document.querySelector('.canvasSettings');
          const adv=panel.querySelector('.appearanceAdvanced');
          const theme=panel.querySelector('.canvasThemeSection');
          return {first:panel.firstElementChild?.className||'', themeParent:theme?.parentElement?.className||'',
                  hasAdvanced:!!adv, open:adv?.open};
        }""")
        report('主题区在设置面板顶部', 'canvasThemeSection' in info['first'] and info['themeParent'] == 'canvasSettings', info)
        opened = await page.evaluate("""()=>{const adv=document.querySelector('.appearanceAdvanced');const s=adv.querySelector(':scope > summary');s.click();return adv.open}""")
        report('更多高级外观微调可以展开', opened is True, opened)
        preset = await page.evaluate("()=>document.querySelector('#overviewDialog').dataset.themeCurrent")
        report('展开折叠块不会误切主题', preset == 'aurora', preset)
        await page.evaluate("()=>{const adv=document.querySelector('.appearanceAdvanced');if(adv.open)adv.querySelector(':scope > summary').click()}")
    return body


CHECKS.append(appearance_panel)
