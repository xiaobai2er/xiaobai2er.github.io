const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('@playwright/test');

const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

const root = __dirname;
const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
  const apiMock = `window.YT={PlayerState:{UNSTARTED:-1,ENDED:0,PLAYING:1,PAUSED:2,BUFFERING:3,CUED:5},Player:function(target,options){
    const playlists={PLLatW7JFqfww:['ac66DA0pDbg','ZqdMPCDsCeE','RZBHAjojJhg'],PLUNBkD51DRF0:['8e0cdY3CM9s','Uh2MjQ9Q324','4b3deIpxkSk']};
    const frame=document.createElement('iframe');frame.id='mock-youtube-iframe';(typeof target==='string'?document.getElementById(target):target).replaceWith(frame);
    let current=0,duration=240,state=-1,volume=25,playlist=[],playlistIndex=-1,activeVideoId='',loadGeneration=0;
    const rasIds=['8e0cdY3CM9s','Uh2MjQ9Q324','4b3deIpxkSk','oXN2YFZH0ig','2gJfjLGCf9U','ci5Ot5n-8_k','5gUl74wG2DE','AxEUw6LdHR4','gSVSgtA9ke4','9iOltuunbvs','DfJT_frR5GY','gHqSTnDDmJk','mKt2u5a3-H8','6AYEq-aacmU','5AL7kBxbMI8','eLpe02tbeYU','CmEGhNuz_zs','m5z-mCUwmxM','DkMyx_sLMlk','eJp3_buirj4','9V7m4YJvFQ0','rRo4HYj654A','ckqNhklWz6I','-0OIoHQv5qY','caxxCfDdklI','vHZF9D4gAoQ','pW01z1Q-MQY','4i9vGzhaCg0','bjHImc6cTqE','zle_8SGQgcg','0fBH7M4EY1M','M-6HMvPPnLM','pB350d7RuAg','cmwOP8goDTw','e_5VjvDrHz8'];
    const api={options,playCalls:0,loads:[],getIframe:()=>frame,getCurrentTime:()=>{if(state===1)current+=0.5;return current},getDuration:()=>duration,getVideoData:()=>({title:'Mock song',video_id:activeVideoId}),getPlayerState:()=>state,getPlaylist:()=>playlist.slice(),getPlaylistIndex:()=>playlistIndex,setVolume:v=>{volume=v},getVolume:()=>volume,unMute:()=>{},mute:()=>{},loadPlaylist:args=>{const generation=++loadGeneration;api.lastLoad={...args};api.loads.push({...args});const selected=playlists[args.list]||[];const index=Math.min(args.index||0,Math.max(0,selected.length-1));activeVideoId=selected[index]||'';current=0;state=1;options.events.onStateChange({data:1});setTimeout(()=>{if(generation===loadGeneration){playlist=selected.slice();playlistIndex=index;options.events.onStateChange({data:state})}},100)},cueVideoById:({videoId})=>{api.lastVideoRequest={videoId,kind:'cue'};activeVideoId=videoId;playlistIndex=rasIds.indexOf(videoId);current=0;state=5;options.events.onStateChange({data:5})},loadVideoById:({videoId})=>{api.lastVideoRequest={videoId,kind:'load'};activeVideoId=videoId;playlistIndex=rasIds.indexOf(videoId);current=0;state=1;options.events.onStateChange({data:1})},playVideo:()=>{api.playCalls++;state=1;options.events.onStateChange({data:1})},pauseVideo:()=>{state=2;options.events.onStateChange({data:2})},nextVideo:()=>{},previousVideo:()=>{},seekTo:s=>{current=s}};
    window.mockYTPlayer=api;setTimeout(()=>options.events.onReady({target:api}),0);return api}};if(window.onYouTubeIframeAPIReady)window.onYouTubeIframeAPIReady();`;

(async () => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const filePath = path.join(root, decodeURIComponent(url.pathname.slice(1) || 'index.html'));
    if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'content-type': contentTypes[path.extname(filePath)] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.route('**/*', route => {
      const requestUrl = route.request().url();
      if (requestUrl.includes('youtube.com/iframe_api')) return route.fulfill({ contentType: 'text/javascript', body: apiMock });
      if (new URL(requestUrl).origin !== `http://127.0.0.1:${port}`) {
        const type = route.request().resourceType();
        const contentType = type === 'image' ? 'image/gif' : type === 'document' ? 'text/html' : type === 'stylesheet' ? 'text/css' : 'text/plain';
        const body = type === 'image' ? Buffer.from('R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=', 'base64') : '';
        return route.fulfill({ status: 200, contentType, body });
      }
      return route.continue();
    });
    await page.goto(`http://127.0.0.1:${port}/index.html`);
    await page.waitForFunction(() => window.mockYTPlayer && window.bandPlayer?.player);
    await page.waitForFunction(() => window.mockYTPlayer.getPlayerState() === 2);
    await page.waitForFunction(() => window.mockYTPlayer.getPlaylist()[0] === 'ac66DA0pDbg');
    assert.equal(await page.evaluate(() => window.mockYTPlayer.lastLoad.list), 'PLLatW7JFqfww', 'Roselia playlist is loaded from its configured ID');
    assert.equal(await page.evaluate(() => window.mockYTPlayer.getPlaylist()[0]), 'ac66DA0pDbg', 'Roselia API playlist contents are available');
    await page.locator('#music-next').click();
    assert.equal(await page.evaluate(() => window.mockYTPlayer.lastLoad.index), 1, 'Roselia next requests the next playlist index');
    await page.waitForFunction(() => window.mockYTPlayer.getPlaylistIndex() === 1);
    assert.equal(await page.evaluate(() => window.mockYTPlayer.getPlaylistIndex()), 1, 'Roselia next advances within the configured playlist');
    await page.locator('#music-prev').click();
    await page.waitForFunction(() => window.mockYTPlayer.getPlaylistIndex() === 0);
    assert.equal(await page.evaluate(() => window.mockYTPlayer.getPlaylistIndex()), 0, 'Roselia previous returns to the prior track');
    await page.evaluate(() => { document.querySelector('#music-queue').value = 'ras'; document.querySelector('#music-queue').dispatchEvent(new Event('change', { bubbles: true })); document.querySelector('#music-volume').value = '63'; document.querySelector('#music-volume').dispatchEvent(new Event('input', { bubbles: true })); });
    assert.equal(await page.evaluate(() => window.mockYTPlayer.lastVideoRequest.videoId), '8e0cdY3CM9s', 'RAISE A SUILEN starts with its real first video ID');
    assert.equal(await page.evaluate(() => window.mockYTPlayer.lastVideoRequest.kind), 'cue', 'changing queue cues the first track without autoplay');
    assert.deepEqual(await page.evaluate(() => ({ state: window.mockYTPlayer.getPlayerState(), calls: window.mockYTPlayer.playCalls, volume: window.mockYTPlayer.getVolume() })), { state: 5, calls: 0, volume: 0 }, 'changing queue remains cued and muted without starting playback');
    await page.locator('#music-next').click();
    assert.deepEqual(await page.evaluate(() => window.mockYTPlayer.lastVideoRequest), { videoId: 'Uh2MjQ9Q324', kind: 'cue' }, 'next selects the real second RAS video despite stale playlist metadata');
    await page.locator('#music-prev').click();
    assert.deepEqual(await page.evaluate(() => window.mockYTPlayer.lastVideoRequest), { videoId: '8e0cdY3CM9s', kind: 'cue' }, 'previous returns to the real first RAS video');
    await page.waitForFunction(() => window.mockYTPlayer.getPlaylistIndex() === 0);
    assert.equal(await page.evaluate(() => window.mockYTPlayer.getPlaylistIndex()), 0, 'RAISE A SUILEN previous returns to the prior track');
    assert.equal(await page.evaluate(() => window.mockYTPlayer.getVideoData().video_id), '8e0cdY3CM9s', 'RAISE A SUILEN previous selects the prior video ID');
    const rasIds = ['8e0cdY3CM9s','Uh2MjQ9Q324','4b3deIpxkSk','oXN2YFZH0ig','2gJfjLGCf9U','ci5Ot5n-8_k','5gUl74wG2DE','AxEUw6LdHR4','gSVSgtA9ke4','9iOltuunbvs','DfJT_frR5GY','gHqSTnDDmJk','mKt2u5a3-H8','6AYEq-aacmU','5AL7kBxbMI8','eLpe02tbeYU','CmEGhNuz_zs','m5z-mCUwmxM','DkMyx_sLMlk','eJp3_buirj4','9V7m4YJvFQ0','rRo4HYj654A','ckqNhklWz6I','-0OIoHQv5qY','caxxCfDdklI','vHZF9D4gAoQ','pW01z1Q-MQY','4i9vGzhaCg0','bjHImc6cTqE','zle_8SGQgcg','0fBH7M4EY1M','M-6HMvPPnLM','pB350d7RuAg','cmwOP8goDTw','e_5VjvDrHz8'];
    for (const expectedId of rasIds.slice(1)) {
      await page.locator('#music-next').click();
      assert.equal(await page.evaluate(() => window.mockYTPlayer.lastVideoRequest.videoId), expectedId, 'RAISE A SUILEN next follows the real playlist video order');
    }
    await page.locator('#music-next').click();
    assert.equal(await page.locator('#music-status').textContent(), 'You are at the start or end of this playlist.', 'RAISE A SUILEN next stops at the last track');
    for (const expectedId of rasIds.slice(0, -1).reverse()) {
      await page.locator('#music-prev').click();
      assert.equal(await page.evaluate(() => window.mockYTPlayer.lastVideoRequest.videoId), expectedId, 'RAISE A SUILEN previous follows the real playlist video order');
    }
    await page.locator('#music-queue').selectOption('roselia');
    await page.waitForFunction(() => window.mockYTPlayer.getPlaylist()[0] === 'ac66DA0pDbg');
    assert.equal(await page.evaluate(() => window.mockYTPlayer.getPlayerState()), 2, 'switching back to Roselia keeps its playlist cued and paused');
    await page.locator('#music-queue').selectOption('ras');
    assert.equal(await page.evaluate(() => window.mockYTPlayer.getVideoData().video_id), '8e0cdY3CM9s', 'switching back to RAS selects its real first video');
    assert.equal(await page.evaluate(() => window.mockYTPlayer.playCalls), 0, 'queue switches never call Play automatically');
    await page.locator('#music-next').click();
    await page.waitForFunction(() => window.mockYTPlayer.getVideoData().video_id === 'Uh2MjQ9Q324');
    const freshRoute = await page.evaluate(() => ({ state: window.mockYTPlayer.getPlayerState(), calls: window.mockYTPlayer.playCalls, autoplay: window.bandPlayer.player.options.playerVars.autoplay }));
    assert.equal(freshRoute.state, 5, 'fresh route remains cued after its initial track load');
    assert.equal(freshRoute.calls, 0, 'fresh route does not start playback automatically');
    assert.equal(freshRoute.autoplay, 0);

    await page.evaluate(() => { window.initialPlayerFrame = window.bandPlayer.player.getIframe(); window.initialPlayerApi = window.bandPlayer.player; window.initialBandPlayer = window.bandPlayer; });
    await page.locator('#music-toggle').click();
    assert.equal(await page.evaluate(() => window.mockYTPlayer.getVolume()), 63, 'explicit Play restores the configured volume');
    await page.locator('#music-next').click();
    await page.waitForFunction(() => window.mockYTPlayer.getPlaylistIndex() === 2);
    assert.equal(await page.evaluate(() => window.mockYTPlayer.getPlayerState()), 1, 'next while playing keeps playback active');
    assert.equal(await page.evaluate(() => window.mockYTPlayer.getVideoData().video_id), '4b3deIpxkSk', 'next while playing selects the following RAS video ID');
    await page.locator('#music-prev').click();
    await page.waitForFunction(() => window.mockYTPlayer.getPlaylistIndex() === 1);
    assert.equal(await page.evaluate(() => window.mockYTPlayer.getPlayerState()), 1, 'previous while playing keeps playback active');
    const initial = await page.evaluate(() => ({ time: window.bandPlayer.player.getCurrentTime() }));
    await page.waitForTimeout(700);
    const advancing = await page.evaluate(() => window.bandPlayer.player.getCurrentTime());
    assert.ok(advancing > initial.time, 'mock playback advances before navigation');

    await page.locator('.route-node[href^="career.html"]').click();
    await page.waitForURL(url => url.pathname === '/career.html');
    await page.waitForFunction(() => !window.siteNavigation.busy);
    await page.waitForSelector('#career-list');
    const branchState = await page.evaluate(() => ({ same: window.bandPlayer.player.getIframe() === window.initialPlayerFrame, sameApi: window.bandPlayer.player === window.initialPlayerApi, sameShell: window.bandPlayer === window.initialBandPlayer, loadCount: performance.getEntriesByType('navigation').length, playerCount: document.querySelectorAll('.music-dock').length }));
    assert.equal(branchState.same, true, `SVG career branch keeps the same iframe: ${JSON.stringify(branchState)}`);
    assert.equal(branchState.sameApi, true, 'SVG career branch keeps the same player API instance');
    assert.equal(branchState.loadCount, 1, 'SVG career branch does not reload the document');
    const careerTime = await page.evaluate(() => window.bandPlayer.player.getCurrentTime());
    assert.ok(careerTime > initial.time, 'playback advances after clicking the SVG career branch');
    await page.locator('nav a[href^="index.html"]').click();
    await page.waitForURL(url => url.pathname === '/index.html');
    await page.waitForFunction(() => !window.siteNavigation.busy);
    await page.waitForSelector('#map');
    const bandRoute = page.locator('.route-node[href^="bands.html"]');
    await bandRoute.hover();
    await page.waitForFunction(() => [...document.querySelectorAll('.route-node')].some(node => /^bands\.html(?:\?|$)/.test(node.getAttribute('href') || '') && node.getAttribute('aria-expanded') === 'true'));
    await page.locator('.band-subitem[href*="#roselia"]').click();
    await page.waitForURL(url => url.pathname === '/bands.html' && url.hash === '#roselia');
    await page.waitForFunction(() => !window.siteNavigation.busy);
    await page.waitForSelector('.bands-page');
    assert.equal(await page.locator('body > .bands-backdrop').count(), 1, 'bands backdrop is restored with its route');
    assert.equal(await page.evaluate(() => window.bandPlayer.player.getIframe() === window.initialPlayerFrame), true, 'SVG bands branch keeps the same iframe');
    assert.equal(await page.evaluate(() => window.bandPlayer.player === window.initialPlayerApi), true, 'SVG bands branch keeps the same player API instance');

    await page.locator('nav a[href^="ramen.html"]').click();
    await page.waitForURL(url => url.pathname === '/ramen.html');
    await page.waitForFunction(() => !window.siteNavigation.busy);
    await page.waitForSelector('#ramen-map');
    assert.equal(await page.locator('body > .bands-backdrop').count(), 0, 'bands backdrop is removed from other routes');
    await page.locator('[data-select-place="birdman"]').click();
    assert.ok((await page.locator('#ramen-map-status').textContent()).length > 0, 'ramen map interaction is initialized after navigation');
    await page.locator('nav a[href^="voice.html"]').click();
    await page.waitForURL(url => url.pathname === '/voice.html');
    await page.waitForFunction(() => !window.siteNavigation.busy);
    await page.waitForSelector('.voice-page');
    await page.locator('nav a[href^="index.html"]').click();
    await page.waitForURL(url => url.pathname === '/index.html');
    await page.waitForFunction(() => !window.siteNavigation.busy);
    await page.waitForSelector('#map');
    assert.equal(await page.locator('body').getAttribute('data-page'), null, 'home route clears stale page metadata');
    await page.locator('#map a[data-topic="career"]').hover();
    assert.equal(await page.locator('#category').textContent(), 'CAREER / EXPERIENCE', 'home interactions are initialized after navigation');
    const preserved = await page.evaluate(() => ({
      sameFrame: window.bandPlayer.player.getIframe() === window.initialPlayerFrame && window.bandPlayer.player.getIframe() === document.querySelector('#mock-youtube-iframe'),
      queue: document.querySelector('#music-queue').value,
      volume: Number(document.querySelector('#music-volume').value),
      playing: window.bandPlayer.player.getPlayerState() === YT.PlayerState.PLAYING,
      time: window.bandPlayer.player.getCurrentTime(),
      playlistRequest: window.mockYTPlayer.lastVideoRequest,
      playCalls: window.mockYTPlayer.playCalls,
      playerCount: document.querySelectorAll('.music-dock').length,
    }));
    assert.ok(preserved.sameFrame, 'iframe identity survives four page transitions');
    assert.equal(preserved.queue, 'ras');
    assert.equal(preserved.volume, 63);
    assert.ok(preserved.playing, `active playback remains active: ${JSON.stringify(preserved)}`);
    assert.ok(preserved.time > advancing, 'playback time keeps advancing across routes');
    assert.equal(await page.evaluate(() => performance.getEntriesByType('navigation').length), 1, 'internal route changes do not perform full page reloads');
    assert.equal(preserved.playlistRequest.videoId, 'Uh2MjQ9Q324');
    assert.equal(preserved.playerCount, 1);
    assert.equal(preserved.playCalls, 1, 'new pages do not trigger autoplay');

    await page.goBack();
    await page.waitForURL('**/voice.html');
    await page.waitForFunction(() => !window.siteNavigation.busy);
    await page.waitForSelector('.voice-page');
    await page.goForward();
    await page.waitForURL('**/index.html');
    await page.waitForFunction(() => !window.siteNavigation.busy);
    await page.waitForSelector('#map');
    assert.equal(await page.evaluate(() => window.bandPlayer.player.getIframe() === document.querySelector('#mock-youtube-iframe')), true, 'back/forward keeps the iframe');

    const desktop = await page.evaluate(() => {
      const box = document.querySelector('.music-dock').getBoundingClientRect();
      const record = document.querySelector('.music-dock__record').getBoundingClientRect();
      const main = document.querySelector('.music-dock__main').getBoundingClientRect();
      const volume = document.querySelector('.music-dock__volume').getBoundingClientRect();
      const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
      return { width: box.width, height: box.height, record: { left: record.left, right: record.right, top: record.top, bottom: record.bottom }, main: { left: main.left, right: main.right, top: main.top, bottom: main.bottom }, volume: { left: volume.left, right: volume.right, top: volume.top, bottom: volume.bottom, width: volume.width, height: volume.height }, dock: { left: box.left, right: box.right, top: box.top, bottom: box.bottom }, parts: Object.fromEntries(['.music-dock__queue-label', '#music-queue', '.music-dock__title', '.music-dock__timeline', '.music-dock__controls'].map(selector => [selector, rect(selector)])) };
    });
    assert.ok(desktop.width <= 510 * 0.76 && desktop.height <= 112 * 0.8, `desktop dock is about 25% smaller: ${JSON.stringify(desktop)}`);
    assert.ok(desktop.record.right <= desktop.main.left, 'desktop record and center content do not overlap');
    assert.ok(desktop.volume.top <= desktop.dock.top + 17 && desktop.volume.right <= desktop.dock.right && desktop.volume.width <= 90, 'desktop volume is bounded and sits upper right');
    for (const [name, rect] of Object.entries(desktop.parts)) assert.ok(!overlaps(desktop.volume, rect), `desktop volume does not overlap ${name}: ${JSON.stringify({ volume: desktop.volume, rect })}`);

    await page.setViewportSize({ width: 320, height: 780 });
    const mobile = await page.evaluate(() => {
      const box = document.querySelector('.music-dock').getBoundingClientRect();
      const record = document.querySelector('.music-dock__record').getBoundingClientRect();
      const main = document.querySelector('.music-dock__main').getBoundingClientRect();
      const volume = document.querySelector('.music-dock__volume').getBoundingClientRect();
      const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
      return { width: box.width, height: box.height, record: { left: record.left, right: record.right, top: record.top, bottom: record.bottom }, main: { left: main.left, right: main.right, top: main.top, bottom: main.bottom }, volume: { left: volume.left, right: volume.right, top: volume.top, bottom: volume.bottom, width: volume.width, height: volume.height }, dock: { left: box.left, right: box.right, top: box.top, bottom: box.bottom }, parts: Object.fromEntries(['.music-dock__queue-label', '#music-queue', '.music-dock__title', '.music-dock__timeline', '.music-dock__controls'].map(selector => [selector, rect(selector)])) };
    });
    assert.ok(mobile.width <= 320 && mobile.height <= 102 * 0.82, `mobile dock fits viewport and is about 20% shorter: ${JSON.stringify(mobile)}`);
    assert.ok(mobile.record.right <= mobile.main.left, 'mobile record and center content do not overlap');
    assert.ok(mobile.volume.top <= mobile.dock.top + 14 && mobile.volume.right <= mobile.dock.right && mobile.volume.width <= 80, 'mobile volume is bounded and sits upper right');
    for (const [name, rect] of Object.entries(mobile.parts)) assert.ok(!overlaps(mobile.volume, rect), `mobile volume does not overlap ${name}: ${JSON.stringify({ volume: mobile.volume, rect })}`);
    assert.deepEqual(errors, [], `no browser exceptions: ${errors.join('; ')}`);
    console.log(JSON.stringify({ transitions: 'bands -> ramen -> voice -> home; back/forward', preserved, desktop, mobile, browserErrors: errors }, null, 2));
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
