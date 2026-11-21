/** Виджет статуса и ссылки учебного сервера. */
export const html = `<section class="gc-widget gc-widget-link" data-gc-module="demo-link">
<div class="gc-link-row-wrap">
<div id="gc-result" class="gc-link-box gc-link-placeholder">(ссылка появится после запуска)</div>
<button type="button" class="gc-link-btn-copy" id="gc-copy-btn" style="display:none" title="Копировать"><span class="gc-copy-icon"></span> Копировать</button>
</div>
<div id="gc-status" class="gc-link-status" role="status" aria-live="polite">Сервер остановлен.</div>
</section>`;