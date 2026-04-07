const state = {
    bootstrap: null,
    pageErrors: [],
};

const els = {
    externalApiKey: document.getElementById('external-api-key'),
    loginPassword: document.getElementById('login-password'),
    saveBasicSettings: document.getElementById('save-basic-settings'),
    saveCaptchaSettings: document.getElementById('save-captcha-settings'),
    resetCaptchaSettingsBtn: document.getElementById('reset-captcha-settings-btn'),
    captchaMaxAttempts: document.getElementById('captcha-max-attempts'),
    visionResizeEnabled: document.getElementById('vision-resize-enabled'),
    visionCropMode: document.getElementById('vision-crop-mode'),
    visionResizeMax: document.getElementById('vision-resize-max'),
    visionResizeWidth: document.getElementById('vision-resize-width'),
    visionResizeHeight: document.getElementById('vision-resize-height'),
    visionResizeRef: document.getElementById('vision-resize-ref'),
    visionSaveThumbs: document.getElementById('vision-save-thumbs'),
    visionThumbDir: document.getElementById('vision-thumb-dir'),
    visionBlurKernel: document.getElementById('vision-blur-kernel'),
    visionCannyThreshold1: document.getElementById('vision-canny-threshold1'),
    visionCannyThreshold2: document.getElementById('vision-canny-threshold2'),
    visionDilateIterations: document.getElementById('vision-dilate-iterations'),
    visionErodeIterations: document.getElementById('vision-erode-iterations'),
    visionHoughDp: document.getElementById('vision-hough-dp'),
    visionHoughMinDist: document.getElementById('vision-hough-min-dist'),
    visionHoughParam1: document.getElementById('vision-hough-param1'),
    visionHoughParam2: document.getElementById('vision-hough-param2'),
    visionHoughMinRadiusRatio: document.getElementById('vision-hough-min-radius-ratio'),
    visionHoughMaxRadiusRatio: document.getElementById('vision-hough-max-radius-ratio'),
    visionHoughLinesThreshold: document.getElementById('vision-hough-lines-threshold'),
    visionMinLineLengthRatio: document.getElementById('vision-min-line-length-ratio'),
    visionMaxLineGap: document.getElementById('vision-max-line-gap'),
    visionCropMarginPairRatio: document.getElementById('vision-crop-margin-pair-ratio'),
    visionCropMarginFullRatio: document.getElementById('vision-crop-margin-full-ratio'),
    visionDayNightSystemPrompt: document.getElementById('vision-day-night-system-prompt'),
    visionDayNightUserPrompt: document.getElementById('vision-day-night-user-prompt'),
    visionTimeSystemPrompt: document.getElementById('vision-time-system-prompt'),
    visionTimeUserPrompt: document.getElementById('vision-time-user-prompt'),
    proxyTableBody: document.getElementById('proxy-table-body'),
    modelTableBody: document.getElementById('model-table-body'),
    addProxyBtn: document.getElementById('add-proxy-btn'),
    addModelBtn: document.getElementById('add-model-btn'),
    proxyModal: document.getElementById('proxy-form-modal'),
    proxyFormTitle: document.getElementById('proxy-form-title'),
    proxyFormId: document.getElementById('proxy-form-id'),
    proxyName: document.getElementById('proxy-name'),
    proxyMode: document.getElementById('proxy-mode'),
    proxyUrl: document.getElementById('proxy-url'),
    dynamicProxyUrl: document.getElementById('dynamic-proxy-url'),
    dynamicProxyProtocol: document.getElementById('dynamic-proxy-protocol'),
    proxyEnabled: document.getElementById('proxy-enabled'),
    proxyFixedPanel: document.getElementById('proxy-fixed-panel'),
    proxyDynamicPanel: document.getElementById('proxy-dynamic-panel'),
    proxyValidateResult: document.getElementById('proxy-validate-result'),
    validateProxyBtn: document.getElementById('validate-proxy-btn'),
    saveProxyBtn: document.getElementById('save-proxy-btn'),
    modelModal: document.getElementById('model-form-modal'),
    modelFormTitle: document.getElementById('model-form-title'),
    modelFormId: document.getElementById('model-form-id'),
    modelName: document.getElementById('model-name'),
    modelApiKey: document.getElementById('model-api-key'),
    modelBaseUrl: document.getElementById('model-base-url'),
    modelModelName: document.getElementById('model-model-name'),
    modelPriority: document.getElementById('model-priority'),
    modelEnabled: document.getElementById('model-enabled'),
    saveModelBtn: document.getElementById('save-model-btn'),
    settingsErrorPanel: document.getElementById('settings-error-panel'),
    settingsErrorSummary: document.getElementById('settings-error-summary'),
    settingsErrorList: document.getElementById('settings-error-list'),
    clearSettingsErrorsBtn: document.getElementById('clear-settings-errors-btn'),
};

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

async function api(url, options = {}) {
    const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        ...options,
    });
    const data = await response.json();
    if (!response.ok || data.success === false) {
        throw new Error(data.error || `请求失败: ${response.status}`);
    }
    return data;
}

function notify(message) {
    window.UI?.toast(message, 'info');
}

function formatErrorMessage(error) {
    if (!error) return '未知错误';
    if (error instanceof Error) return error.message || String(error);
    return String(error);
}

function recordPageError(error, source = 'runtime') {
    const message = formatErrorMessage(error);
    const entry = {
        ts: new Date().toLocaleString('zh-CN', { hour12: false }),
        source,
        message,
    };
    state.pageErrors.unshift(entry);
    state.pageErrors = state.pageErrors.slice(0, 20);
    renderPageErrors();
}

function renderPageErrors() {
    const hasErrors = state.pageErrors.length > 0;
    els.settingsErrorPanel?.classList.toggle('hidden', !hasErrors);
    if (!hasErrors) {
        if (els.settingsErrorSummary) els.settingsErrorSummary.textContent = '当前没有前端错误。';
        if (els.settingsErrorList) els.settingsErrorList.innerHTML = '';
        return;
    }
    if (els.settingsErrorSummary) {
        const latest = state.pageErrors[0];
        els.settingsErrorSummary.textContent = `最近错误：${latest.ts} · ${latest.source} · ${latest.message}`;
    }
    if (els.settingsErrorList) {
        els.settingsErrorList.innerHTML = state.pageErrors.map((item) => `
            <div class="settings-error-item">
                <div class="settings-error-meta">[${escapeHtml(item.ts)}] ${escapeHtml(item.source)}</div>
                <div class="settings-error-message">${escapeHtml(item.message)}</div>
            </div>
        `).join('');
    }
}

function setElementValue(element, value) {
    if (!element) return;
    element.value = value ?? '';
}

function getElementValue(element, fallback = '') {
    if (!element) return fallback;
    return element.value ?? fallback;
}

function openModal(modal) {
    if (!modal) return;
    modal.classList.add('active');
}

function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('active');
}

function renderProxyTable() {
    const profiles = state.bootstrap.proxy_profiles || [];
    if (!profiles.length) {
        els.proxyTableBody.innerHTML = '<tr><td colspan="5" class="empty-state">暂无代理配置</td></tr>';
        return;
    }
    els.proxyTableBody.innerHTML = profiles.map((profile) => {
        const address = profile.mode === 'fixed'
            ? profile.proxy_url || '-'
            : profile.mode === 'dynamic'
                ? `${profile.dynamic_proxy_protocol || 'socks5'} · ${profile.dynamic_proxy_url || '-'}`
                : '-';
        return `
            <tr>
                <td>${escapeHtml(profile.name)}</td>
                <td>${escapeHtml(profile.mode)}</td>
                <td><code>${escapeHtml(address)}</code></td>
                <td>${profile.enabled ? '是' : '否'}</td>
                <td>
                    <div class="inline-actions">
                        <button class="btn ghost small" data-action="edit-proxy" data-id="${profile.id}">编辑</button>
                        <button class="btn danger small" data-action="delete-proxy" data-id="${profile.id}">删除</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function renderModelTable() {
    const models = state.bootstrap.model_profiles || [];
    if (!models.length) {
        els.modelTableBody.innerHTML = '<tr><td colspan="6" class="empty-state">暂无识别模型</td></tr>';
        return;
    }
    els.modelTableBody.innerHTML = models.map((model) => `
        <tr>
            <td>${escapeHtml(model.name)}</td>
            <td><code>${escapeHtml(model.base_url)}</code></td>
            <td>${escapeHtml(model.model_name)}</td>
            <td>${escapeHtml(model.priority)}</td>
            <td>${model.enabled ? '是' : '否'}</td>
            <td>
                <div class="inline-actions">
                    <button class="btn ghost small" data-action="edit-model" data-id="${model.id}">编辑</button>
                    <button class="btn danger small" data-action="delete-model" data-id="${model.id}">删除</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderBasicSettings() {
    setElementValue(els.externalApiKey, state.bootstrap.settings.external_api_key || '');
}

function applyCaptchaSettings(settings) {
    const cfg = settings || {};
    setElementValue(els.captchaMaxAttempts, cfg.captcha_max_attempts ?? 5);
    setElementValue(els.visionResizeEnabled, cfg.vision_resize_enabled ? '1' : '0');
    setElementValue(els.visionCropMode, cfg.vision_crop_mode || 'auto');
    setElementValue(els.visionResizeMax, cfg.vision_resize_max ?? 256);
    setElementValue(els.visionResizeWidth, cfg.vision_resize_width ?? 0);
    setElementValue(els.visionResizeHeight, cfg.vision_resize_height ?? 0);
    setElementValue(els.visionResizeRef, cfg.vision_resize_ref || '');
    setElementValue(els.visionSaveThumbs, cfg.vision_save_thumbs ? '1' : '0');
    setElementValue(els.visionThumbDir, cfg.vision_thumb_dir || '');
    setElementValue(els.visionBlurKernel, cfg.vision_blur_kernel ?? 5);
    setElementValue(els.visionCannyThreshold1, cfg.vision_canny_threshold1 ?? 50);
    setElementValue(els.visionCannyThreshold2, cfg.vision_canny_threshold2 ?? 150);
    setElementValue(els.visionDilateIterations, cfg.vision_dilate_iterations ?? 1);
    setElementValue(els.visionErodeIterations, cfg.vision_erode_iterations ?? 1);
    setElementValue(els.visionHoughDp, cfg.vision_hough_dp ?? 1.2);
    setElementValue(els.visionHoughMinDist, cfg.vision_hough_min_dist ?? 100);
    setElementValue(els.visionHoughParam1, cfg.vision_hough_param1 ?? 50);
    setElementValue(els.visionHoughParam2, cfg.vision_hough_param2 ?? 30);
    setElementValue(els.visionHoughMinRadiusRatio, cfg.vision_hough_min_radius_ratio ?? 0.25);
    setElementValue(els.visionHoughMaxRadiusRatio, cfg.vision_hough_max_radius_ratio ?? 0.5);
    setElementValue(els.visionHoughLinesThreshold, cfg.vision_hough_lines_threshold ?? 80);
    setElementValue(els.visionMinLineLengthRatio, cfg.vision_min_line_length_ratio ?? 0.3);
    setElementValue(els.visionMaxLineGap, cfg.vision_max_line_gap ?? 20);
    setElementValue(els.visionCropMarginPairRatio, cfg.vision_crop_margin_pair_ratio ?? 0.35);
    setElementValue(els.visionCropMarginFullRatio, cfg.vision_crop_margin_full_ratio ?? 0.1);
    setElementValue(els.visionDayNightSystemPrompt, cfg.vision_day_night_system_prompt || '');
    setElementValue(els.visionDayNightUserPrompt, cfg.vision_day_night_user_prompt || '');
    setElementValue(els.visionTimeSystemPrompt, cfg.vision_time_system_prompt || '');
    setElementValue(els.visionTimeUserPrompt, cfg.vision_time_user_prompt || '');
}

function collectCaptchaSettings() {
    return {
        captcha_max_attempts: Number(getElementValue(els.captchaMaxAttempts, 5) || 5),
        vision_resize_enabled: getElementValue(els.visionResizeEnabled, '1') === '1',
        vision_crop_mode: getElementValue(els.visionCropMode, 'auto'),
        vision_resize_max: Number(getElementValue(els.visionResizeMax, 0) || 0),
        vision_resize_width: Number(getElementValue(els.visionResizeWidth, 0) || 0),
        vision_resize_height: Number(getElementValue(els.visionResizeHeight, 0) || 0),
        vision_resize_ref: String(getElementValue(els.visionResizeRef, '')).trim(),
        vision_save_thumbs: getElementValue(els.visionSaveThumbs, '1') === '1',
        vision_thumb_dir: String(getElementValue(els.visionThumbDir, '')).trim(),
        vision_blur_kernel: Number(getElementValue(els.visionBlurKernel, 5) || 5),
        vision_canny_threshold1: Number(getElementValue(els.visionCannyThreshold1, 50) || 50),
        vision_canny_threshold2: Number(getElementValue(els.visionCannyThreshold2, 150) || 150),
        vision_dilate_iterations: Number(getElementValue(els.visionDilateIterations, 0) || 0),
        vision_erode_iterations: Number(getElementValue(els.visionErodeIterations, 0) || 0),
        vision_hough_dp: Number(getElementValue(els.visionHoughDp, 1.2) || 1.2),
        vision_hough_min_dist: Number(getElementValue(els.visionHoughMinDist, 100) || 100),
        vision_hough_param1: Number(getElementValue(els.visionHoughParam1, 50) || 50),
        vision_hough_param2: Number(getElementValue(els.visionHoughParam2, 30) || 30),
        vision_hough_min_radius_ratio: Number(getElementValue(els.visionHoughMinRadiusRatio, 0.25) || 0.25),
        vision_hough_max_radius_ratio: Number(getElementValue(els.visionHoughMaxRadiusRatio, 0.5) || 0.5),
        vision_hough_lines_threshold: Number(getElementValue(els.visionHoughLinesThreshold, 80) || 80),
        vision_min_line_length_ratio: Number(getElementValue(els.visionMinLineLengthRatio, 0.3) || 0.3),
        vision_max_line_gap: Number(getElementValue(els.visionMaxLineGap, 20) || 20),
        vision_crop_margin_pair_ratio: Number(getElementValue(els.visionCropMarginPairRatio, 0.35) || 0.35),
        vision_crop_margin_full_ratio: Number(getElementValue(els.visionCropMarginFullRatio, 0.1) || 0.1),
        vision_day_night_system_prompt: String(getElementValue(els.visionDayNightSystemPrompt, '')).trim(),
        vision_day_night_user_prompt: String(getElementValue(els.visionDayNightUserPrompt, '')).trim(),
        vision_time_system_prompt: String(getElementValue(els.visionTimeSystemPrompt, '')).trim(),
        vision_time_user_prompt: String(getElementValue(els.visionTimeUserPrompt, '')).trim(),
    };
}

async function loadBootstrap() {
    try {
        state.bootstrap = await api('/api/dashboard/bootstrap');
        renderBasicSettings();
        applyCaptchaSettings(state.bootstrap.settings.captcha_settings || state.bootstrap.settings.captcha_settings_defaults || {});
        renderProxyTable();
        renderModelTable();
    } catch (error) {
        recordPageError(error, 'bootstrap');
        throw error;
    }
}

function syncProxyModeUI() {
    const mode = getElementValue(els.proxyMode, 'none');
    els.proxyFixedPanel?.classList.toggle('active', mode === 'fixed');
    els.proxyDynamicPanel?.classList.toggle('active', mode === 'dynamic');
    if (els.proxyUrl) els.proxyUrl.disabled = mode !== 'fixed';
    if (els.dynamicProxyUrl) els.dynamicProxyUrl.disabled = mode !== 'dynamic';
    if (els.dynamicProxyProtocol) els.dynamicProxyProtocol.disabled = mode !== 'dynamic';
}

function resetProxyValidationResult() {
    if (!els.proxyValidateResult) return;
    els.proxyValidateResult.className = 'proxy-validate-result hidden';
    els.proxyValidateResult.innerHTML = '';
}

function renderProxyValidationResult(type, message, extra = {}) {
    if (!els.proxyValidateResult) return;
    const details = [];
    if (extra.resolved_proxy) {
        details.push(`<div><span>实际代理：</span><code>${escapeHtml(extra.resolved_proxy)}</code></div>`);
    }
    if (typeof extra.latency_ms === 'number') {
        details.push(`<div><span>耗时：</span><strong>${escapeHtml(extra.latency_ms)} ms</strong></div>`);
    }
    els.proxyValidateResult.className = `proxy-validate-result ${type}`;
    els.proxyValidateResult.innerHTML = `
        <div class="proxy-validate-title">${type === 'success' ? '验证成功' : type === 'loading' ? '正在验证' : '验证失败'}</div>
        <div class="proxy-validate-message">${escapeHtml(message)}</div>
        ${details.length ? `<div class="proxy-validate-details">${details.join('')}</div>` : ''}
    `;
}

function resetProxyForm() {
    if (els.proxyFormTitle) els.proxyFormTitle.textContent = '新增代理配置';
    setElementValue(els.proxyFormId, '');
    setElementValue(els.proxyName, '');
    setElementValue(els.proxyMode, 'none');
    setElementValue(els.proxyUrl, '');
    setElementValue(els.dynamicProxyUrl, '');
    setElementValue(els.dynamicProxyProtocol, 'socks5');
    setElementValue(els.proxyEnabled, '1');
    syncProxyModeUI();
    resetProxyValidationResult();
}

function fillProxyForm(profile) {
    if (els.proxyFormTitle) els.proxyFormTitle.textContent = '编辑代理配置';
    setElementValue(els.proxyFormId, profile.id);
    setElementValue(els.proxyName, profile.name || '');
    setElementValue(els.proxyMode, profile.mode || 'none');
    setElementValue(els.proxyUrl, profile.proxy_url || '');
    setElementValue(els.dynamicProxyUrl, profile.dynamic_proxy_url || '');
    setElementValue(els.dynamicProxyProtocol, profile.dynamic_proxy_protocol || 'socks5');
    setElementValue(els.proxyEnabled, profile.enabled ? '1' : '0');
    syncProxyModeUI();
    resetProxyValidationResult();
}

function collectProxyPayload() {
    const payload = {
        name: String(getElementValue(els.proxyName, '')).trim(),
        mode: getElementValue(els.proxyMode, 'none'),
        proxy_url: String(getElementValue(els.proxyUrl, '')).trim(),
        dynamic_proxy_url: String(getElementValue(els.dynamicProxyUrl, '')).trim(),
        dynamic_proxy_protocol: String(getElementValue(els.dynamicProxyProtocol, 'socks5')).trim(),
        enabled: getElementValue(els.proxyEnabled, '1') === '1',
    };
    if (!payload.name) {
        throw new Error('代理名称不能为空');
    }
    if (payload.mode === 'fixed' && !payload.proxy_url) {
        throw new Error('固定代理模式必须填写代理地址');
    }
    if (payload.mode === 'dynamic' && !payload.dynamic_proxy_url) {
        throw new Error('动态代理模式必须填写接口地址');
    }
    if (payload.mode !== 'fixed') payload.proxy_url = '';
    if (payload.mode !== 'dynamic') {
        payload.dynamic_proxy_url = '';
        payload.dynamic_proxy_protocol = 'socks5';
    }
    return payload;
}

function resetModelForm() {
    if (els.modelFormTitle) els.modelFormTitle.textContent = '新增识别模型';
    setElementValue(els.modelFormId, '');
    setElementValue(els.modelName, '');
    setElementValue(els.modelApiKey, '');
    setElementValue(els.modelBaseUrl, '');
    setElementValue(els.modelModelName, '');
    setElementValue(els.modelPriority, '10');
    setElementValue(els.modelEnabled, '1');
}

function fillModelForm(model) {
    if (els.modelFormTitle) els.modelFormTitle.textContent = '编辑识别模型';
    setElementValue(els.modelFormId, model.id);
    setElementValue(els.modelName, model.name || '');
    setElementValue(els.modelApiKey, model.api_key || '');
    setElementValue(els.modelBaseUrl, model.base_url || '');
    setElementValue(els.modelModelName, model.model_name || '');
    setElementValue(els.modelPriority, String(model.priority ?? 10));
    setElementValue(els.modelEnabled, model.enabled ? '1' : '0');
}

function collectModelPayload() {
    const payload = {
        name: String(getElementValue(els.modelName, '')).trim(),
        api_key: String(getElementValue(els.modelApiKey, '')).trim(),
        base_url: String(getElementValue(els.modelBaseUrl, '')).trim(),
        model_name: String(getElementValue(els.modelModelName, '')).trim(),
        priority: Number(getElementValue(els.modelPriority, 10) || 10),
        enabled: getElementValue(els.modelEnabled, '1') === '1',
    };
    if (!payload.name || !payload.api_key || !payload.base_url || !payload.model_name) {
        throw new Error('模型名称、API Key、Base URL、模型名不能为空');
    }
    return payload;
}

async function saveBasicSettings() {
    const payload = {
        external_api_key: String(getElementValue(els.externalApiKey, '')).trim(),
        login_password: String(getElementValue(els.loginPassword, '')).trim(),
    };
    const data = await api('/api/settings', { method: 'PUT', body: JSON.stringify(payload) });
    setElementValue(els.loginPassword, '');
    notify(data.message || '保存成功');
    await loadBootstrap();
}

async function saveCaptchaSettings() {
    const payload = {
        captcha_settings: collectCaptchaSettings(),
    };
    const data = await api('/api/settings', { method: 'PUT', body: JSON.stringify(payload) });
    notify(data.message || '验证码配置已保存');
    await loadBootstrap();
}

async function resetCaptchaSettings() {
    const ok = await window.UI.confirm('确认将验证码识别配置恢复为当前默认稳定值吗？', {
        title: '恢复默认配置',
        confirmText: '恢复默认',
        danger: false,
        meta: '这会覆盖你当前保存的缩放、OpenCV 参数和提示词配置。',
    });
    if (!ok) return;
    const data = await api('/api/settings/captcha/reset', { method: 'POST', body: '{}' });
    applyCaptchaSettings(data.settings || {});
    notify(data.message || '已恢复默认配置');
    await loadBootstrap();
}

async function saveProxy() {
    const payload = collectProxyPayload();
    const id = String(getElementValue(els.proxyFormId, '')).trim();
    if (id) {
        await api(`/api/proxy-profiles/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
        notify('代理配置已更新');
    } else {
        await api('/api/proxy-profiles', { method: 'POST', body: JSON.stringify(payload) });
        notify('代理配置已新增');
    }
    closeModal(els.proxyModal);
    await loadBootstrap();
}

async function validateProxy() {
    const payload = collectProxyPayload();
    renderProxyValidationResult('loading', '正在测试当前代理与 Tuta 接口的连通性...');
    const data = await api('/api/proxy-profiles/validate', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    renderProxyValidationResult('success', data.message || '代理验证成功', {
        resolved_proxy: data.resolved_proxy,
        latency_ms: data.latency_ms,
    });
    if (data.normalized) {
        setElementValue(els.proxyUrl, data.normalized.proxy_url || '');
        setElementValue(els.dynamicProxyProtocol, data.normalized.dynamic_proxy_protocol || 'socks5');
    }
    notify(data.message || '代理验证成功');
}

async function saveModel() {
    const payload = collectModelPayload();
    const id = String(getElementValue(els.modelFormId, '')).trim();
    if (id) {
        await api(`/api/model-profiles/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
        notify('模型配置已更新');
    } else {
        await api('/api/model-profiles', { method: 'POST', body: JSON.stringify(payload) });
        notify('模型配置已新增');
    }
    closeModal(els.modelModal);
    await loadBootstrap();
}

async function handleTableClick(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const id = Number(button.dataset.id);
    const action = button.dataset.action;

    try {
        if (action === 'edit-proxy') {
            const existing = state.bootstrap.proxy_profiles.find((item) => item.id === id);
            if (!existing) throw new Error('代理配置不存在');
            fillProxyForm(existing);
            openModal(els.proxyModal);
        }
        if (action === 'delete-proxy') {
            const existing = state.bootstrap.proxy_profiles.find((item) => item.id === id);
            const ok = await window.UI.confirm(`确认删除代理配置 “${existing?.name || id}” 吗？`, {
                title: '删除代理配置',
                confirmText: '删除',
                danger: true,
                meta: '已绑定到分组的代理不会自动替换，相关分组会回落到默认配置或失去可用代理。',
            });
            if (!ok) return;
            await api(`/api/proxy-profiles/${id}`, { method: 'DELETE', body: '{}' });
            notify('代理配置已删除');
            await loadBootstrap();
        }
        if (action === 'edit-model') {
            const existing = state.bootstrap.model_profiles.find((item) => item.id === id);
            if (!existing) throw new Error('模型配置不存在');
            fillModelForm(existing);
            openModal(els.modelModal);
        }
        if (action === 'delete-model') {
            const existing = state.bootstrap.model_profiles.find((item) => item.id === id);
            const ok = await window.UI.confirm(`确认删除识别模型 “${existing?.name || id}” 吗？`, {
                title: '删除识别模型',
                confirmText: '删除',
                danger: true,
                meta: '删除后注册流程的验证码识别 fallback 链会立即变化。',
            });
            if (!ok) return;
            await api(`/api/model-profiles/${id}`, { method: 'DELETE', body: '{}' });
            notify('模型配置已删除');
            await loadBootstrap();
        }
    } catch (error) {
        notify(error.message || String(error));
    }
}

els.saveBasicSettings?.addEventListener('click', () => {
    saveBasicSettings().catch((error) => notify(error.message || String(error)));
});

els.saveCaptchaSettings?.addEventListener('click', () => {
    saveCaptchaSettings().catch((error) => notify(error.message || String(error)));
});

els.resetCaptchaSettingsBtn?.addEventListener('click', () => {
    resetCaptchaSettings().catch((error) => notify(error.message || String(error)));
});

els.addProxyBtn?.addEventListener('click', () => {
    resetProxyForm();
    openModal(els.proxyModal);
});

els.addModelBtn?.addEventListener('click', () => {
    resetModelForm();
    openModal(els.modelModal);
});

els.saveProxyBtn?.addEventListener('click', () => {
    saveProxy().catch((error) => notify(error.message || String(error)));
});

els.validateProxyBtn?.addEventListener('click', () => {
    validateProxy().catch((error) => {
        renderProxyValidationResult('error', error.message || String(error));
        notify(error.message || String(error));
    });
});

els.saveModelBtn?.addEventListener('click', () => {
    saveModel().catch((error) => notify(error.message || String(error)));
});

els.proxyMode?.addEventListener('change', syncProxyModeUI);
['input', 'change'].forEach((eventName) => {
    els.proxyName?.addEventListener(eventName, resetProxyValidationResult);
    els.proxyMode?.addEventListener(eventName, resetProxyValidationResult);
    els.proxyUrl?.addEventListener(eventName, resetProxyValidationResult);
    els.dynamicProxyUrl?.addEventListener(eventName, resetProxyValidationResult);
    els.dynamicProxyProtocol?.addEventListener(eventName, resetProxyValidationResult);
});
els.proxyTableBody?.addEventListener('click', handleTableClick);
els.modelTableBody?.addEventListener('click', handleTableClick);

document.querySelectorAll('[data-close-modal]').forEach((button) => {
    button.addEventListener('click', () => {
        const modal = document.getElementById(button.dataset.closeModal);
        if (modal) closeModal(modal);
    });
});

els.clearSettingsErrorsBtn?.addEventListener('click', () => {
    state.pageErrors = [];
    renderPageErrors();
});

window.addEventListener('error', (event) => {
    recordPageError(event.error || event.message || '脚本错误', 'window.error');
});

window.addEventListener('unhandledrejection', (event) => {
    recordPageError(event.reason || 'Promise 未处理异常', 'unhandledrejection');
});

syncProxyModeUI();
loadBootstrap().catch((error) => notify(error.message || String(error)));
