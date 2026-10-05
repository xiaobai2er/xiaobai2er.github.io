# 個人網站

這是以 GitHub Pages 靜態發布的個人網站，沒有建置流程或外部套件需求。網站由根目錄的 HTML、CSS 與 JavaScript 檔案組成，連結採用根目錄相對路徑。

## 預覽網站

在專案根目錄啟動本機靜態伺服器：

```bash
python -m http.server 8765
```

接著瀏覽 `http://localhost:8765/`。主入口是 `index.html`；其他主網站頁面包括 `career.html`、`projects.html`、`resume.html`、`voice.html`、`bands.html` 與 `ramen.html`。`templates.html` 與 `site.html` 是獨立的舊版版型預覽系統，可直接開啟 `templates.html`，或以 `site.html?theme=minimal`、`?theme=lab`、`?theme=editorial`、`?theme=dashboard`、`?theme=timeline` 切換預覽版型。

## 檔案分工

- 主網站 HTML 頁面提供各頁內容與結構；`index.html` 是路線圖首頁，其餘頁面呈現職涯、專案、履歷、聲優、樂團與拉麵地圖內容。
- `content.js` 集中保存主網站共用的個人資料與頁面內容資料，由首頁及需要資料的內頁載入。
- `style.css` 是主網站共用的唯一樣式表，包含基礎樣式、內頁共用樣式，以及樂團時間軸與聲優頁專屬樣式。主網站各 HTML 頁面以帶版本參數的連結載入此檔。
- `styles.css`、`site.js`、`gallery.js` 僅供舊版 `templates.html`／`site.html` 預覽系統使用；`styles.css` 不屬於主網站的樣式表。
- 功能腳本各自維持獨立：`navigation.js` 處理導覽，`bands-player.js` 與 `bands-background.js` 負責播放器及樂團頁背景，`ramen-map.js` 負責拉麵地圖，`bands-timeline.js` 負責樂團時間軸，`pages.js` 負責內頁顯示效果，`script.js` 負責首頁路線圖互動。

網站可直接部署至 GitHub Pages，不需要安裝相依套件或執行打包程序。
