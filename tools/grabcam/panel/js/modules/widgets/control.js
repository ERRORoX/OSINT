/** Виджет: управление безопасной учебной демонстрацией. */
export const html = `<section class="gc-widget gc-widget-control" data-gc-module="control">
<h3 class="gc-control-title">Учебный сервер</h3>
<p class="gc-control-desc">Локальный сервер и публичные туннели для демонстрационной страницы.</p>
<div class="gc-control-inner">
<div class="gc-control-toggles">
<label class="gc-control-toggle"><span class="gc-control-toggle-icon gc-icon-check"></span><input type="checkbox" id="gc-feat-status" disabled><span class="gc-control-toggle-slider"></span><span class="gc-control-toggle-label">Статус сервера</span></label>
</div>
<form id="gc-form" class="gc-control-form">
<label class="gc-control-form-label" for="gc-method">Метод запуска</label>
<select name="method" id="gc-method" class="gc-control-select" aria-label="Метод запуска">
<option value="php_only">Локальный сервер</option>
<option value="localhost_run">localhost.run</option>
<option value="cloudflared">Cloudflare Tunnel</option>
<option value="serveo">Serveo</option>
</select>
<button type="submit" class="gc-control-btn-start" id="gc-btn-start">ЗАПУСТИТЬ</button>
<button type="button" class="gc-control-btn-stop" id="gc-btn-stop" style="display:none">ОСТАНОВИТЬ</button>
</form>
</div>
<p id="gc-method-hint" class="gc-control-hint" aria-live="polite"></p>
<p class="gc-control-desc">Камера и геолокация запрашиваются отдельно после действия посетителя. Страница показывает их локально: фото, файлы, звук, экран, формы и координаты не отправляются в панель и не сохраняются.</p>
</section>`;