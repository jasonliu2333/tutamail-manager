const state = {
    taskId: null,
    pollTimer: null,
    bootstrap: null,
    renderedLogs: 0,
};

const STORAGE_KEY = 'tutamail_register_form_state';

const els = {
    form: document.getElementById('register-form'),
    domain: document.getElementById('mail-domain'),
    batchCount: document.getElementById('batch-count'),
    maxWorkers: document.getElementById('max-workers'),
    groupId: document.getElementById('group-id'),
    proxyProfileId: document.getElementById('proxy-profile-id'),
    modelCheckboxes: document.getElementById('model-checkboxes'),
    startBtn: document.getElementById('start-register-btn'),
    cancelBtn: document.getElementById('cancel-register-btn'),
    statusBadge: document.getElementById('task-status-badge'),
    statusGrid: document.getElementById('task-status-grid'),
    progressBlock: document.getElementById('progress-block'),
    consoleLog: document.getElementById('console-log'),
    clearLogBtn: document.getElementById('clear-log-btn'),
    refreshAccountsBtn: document.getElementById('refresh-register-accounts'),
    recentAccounts: document.getElementById('recent-register-accounts'),
    taskIdLabel: document.getElementById('task-id'),
    taskStatus: document.getElementById('task-status'),
    taskSuccess: document.getElementById('task-success'),
    taskFailed: document.getElementById('task-failed'),
    progressText: document.getElementById('progress-text'),
    progressPercent: document.getElementById('progress-percent'),
    progressFill: document.getElementById('progress-fill'),
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

function renderSelectOptions(select, items, valueKey, labelFn, selectedValue) {
    select.innerHTML = items.map((item) => {
        const value = item[valueKey];
        const selected = String(value) === String(selectedValue) ? 'selected' : '';
        return `<option value="${escapeHtml(value)}" ${selected}>${escapeHtml(labelFn(item))}</option>`;
    }).join('');
}

function renderModelCheckboxes(models) {
    if (!models.length) {
        els.modelCheckboxes.innerHTML = '<div class="empty-state">请先在设置页配置可用识别模型。</div>';
        return;
    }
    els.modelCheckboxes.innerHTML = models.map((model) => {
        const checked = model.enabled ? 'checked' : '';
        return `
            <label class="checkbox-item">
                <input type="checkbox" value="${model.id}" ${checked} ${model.enabled ? '' : 'disabled'}>
                <div>
                    <strong>${escapeHtml(model.name)}</strong>
                    <small>${escapeHtml(model.model_name)} · 优先级 ${escapeHtml(model.priority)}</small>
                </div>
            </label>
        `;
    }).join('');
}

function getFormState() {
    const modelIds = [...els.modelCheckboxes.querySelectorAll('input[type="checkbox"]:checked')]
        .map((checkbox) => Number(checkbox.value))
        .filter(Boolean);
    return {
        mail_domain: els.domain.value,
        batch_count: Number(els.batchCount.value || 1),
        max_workers: Number(els.maxWorkers.value || 1),
        group_id: Number(els.groupId.value || 1),
        proxy_profile_id: Number(els.proxyProfileId.value || 1),
        model_profile_ids: modelIds,
    };
}

function saveFormState() {
    try {
        window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(getFormState()));
    } catch (error) {
        console.warn('save register state failed', error);
    }
}

function loadSavedFormState() {
    try {
        const raw = window.localStorage?.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.warn('load register state failed', error);
        return null;
    }
}

function applySavedFormState(savedState, bootstrap) {
    if (!savedState || !bootstrap) return;
    if (savedState.mail_domain && bootstrap.domains.includes(savedState.mail_domain)) {
        els.domain.value = savedState.mail_domain;
    }
    if (savedState.batch_count) {
        els.batchCount.value = savedState.batch_count;
    }
    if (savedState.max_workers) {
        els.maxWorkers.value = savedState.max_workers;
    }
    if (savedState.group_id && bootstrap.groups.some((item) => String(item.id) === String(savedState.group_id))) {
        els.groupId.value = String(savedState.group_id);
    }
    if (savedState.proxy_profile_id && bootstrap.proxy_profiles.some((item) => String(item.id) === String(savedState.proxy_profile_id))) {
        els.proxyProfileId.value = String(savedState.proxy_profile_id);
    }

    const savedModelIds = new Set((savedState.model_profile_ids || []).map((item) => Number(item)));
    if (savedModelIds.size) {
        els.modelCheckboxes.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
            checkbox.checked = savedModelIds.has(Number(checkbox.value)) && !checkbox.disabled;
        });
    }
}

function renderRecentAccounts(accounts) {
    if (!accounts.length) {
        els.recentAccounts.innerHTML = '<tr><td colspan="4" class="empty-state">暂无账号</td></tr>';
        return;
    }
    els.recentAccounts.innerHTML = accounts.map((account) => `
        <tr>
            <td>${account.id}</td>
            <td><code>${escapeHtml(account.email)}</code></td>
            <td>${escapeHtml(account.group_name || '-')}</td>
            <td>${escapeHtml(account.status || '-')}</td>
        </tr>
    `).join('');
}

function appendLog(log) {
    const line = document.createElement('div');
    line.className = `log-line ${log.level || 'info'}`;
    line.textContent = `[${log.ts}] ${log.message}`;
    els.consoleLog.appendChild(line);
    els.consoleLog.scrollTop = els.consoleLog.scrollHeight;
}

function resetConsole() {
    els.consoleLog.innerHTML = '<div class="log-line info">[系统] 准备就绪，等待开始注册...</div>';
    state.renderedLogs = 0;
}

function setBadge(status) {
    els.statusBadge.classList.remove('hidden', 'pending', 'running', 'completed', 'failed', 'cancelled');
    els.statusBadge.classList.add(status || 'pending');
    const textMap = {
        pending: '等待中',
        running: '执行中',
        completed: '已完成',
        failed: '失败',
        cancelled: '已取消',
    };
    els.statusBadge.textContent = textMap[status] || status || '等待中';
}

function updateTaskUI(task) {
    els.statusGrid.classList.remove('hidden');
    els.progressBlock.classList.remove('hidden');
    els.taskIdLabel.textContent = task.id;
    els.taskStatus.textContent = task.status;
    els.taskSuccess.textContent = task.progress.success;
    els.taskFailed.textContent = task.progress.failed;
    els.progressText.textContent = `${task.progress.done} / ${task.progress.total}`;
    const percent = task.progress.total ? Math.round((task.progress.done / task.progress.total) * 100) : 0;
    els.progressPercent.textContent = `${percent}%`;
    els.progressFill.style.width = `${percent}%`;
    setBadge(task.status);

    while (state.renderedLogs < task.logs.length) {
        appendLog(task.logs[state.renderedLogs]);
        state.renderedLogs += 1;
    }

    const active = task.status === 'pending' || task.status === 'running';
    els.startBtn.disabled = active;
    els.cancelBtn.disabled = !active;
    if (!active && state.pollTimer) {
        clearInterval(state.pollTimer);
        state.pollTimer = null;
    }
}

async function pollTask(forceTaskId) {
    const taskId = forceTaskId || state.taskId;
    if (!taskId) return;
    const data = await api(`/api/registration/tasks/${taskId}`);
    state.taskId = taskId;
    updateTaskUI(data.task);
    if (['completed', 'failed', 'cancelled'].includes(data.task.status)) {
        await loadBootstrap();
    }
}

async function loadBootstrap() {
    const data = await api('/api/dashboard/bootstrap');
    state.bootstrap = data;
    renderSelectOptions(els.domain, data.domains.map((item) => ({ value: item })), 'value', (item) => item.value, data.settings.default_register_domain);
    renderSelectOptions(els.groupId, data.groups, 'id', (item) => `${item.name} (${item.account_count})`, 1);
    renderSelectOptions(els.proxyProfileId, data.proxy_profiles, 'id', (item) => `${item.name} · ${item.mode}`, 1);
    renderModelCheckboxes(data.model_profiles);
    applySavedFormState(loadSavedFormState(), data);
    renderRecentAccounts(data.recent_accounts || []);
}

async function startTask(event) {
    event.preventDefault();
    const modelIds = [...els.modelCheckboxes.querySelectorAll('input[type="checkbox"]:checked')].map((checkbox) => Number(checkbox.value));
    if (!modelIds.length) {
        window.UI?.toast('请至少选择一个识别模型。', 'warning');
        return;
    }
    resetConsole();
    els.statusGrid.classList.remove('hidden');
    els.progressBlock.classList.remove('hidden');
    setBadge('pending');
    const payload = getFormState();
    try {
        saveFormState();
        const data = await api('/api/registration/start', { method: 'POST', body: JSON.stringify(payload) });
        state.taskId = data.task_id;
        state.renderedLogs = 0;
        await pollTask(data.task_id);
        if (state.pollTimer) clearInterval(state.pollTimer);
        state.pollTimer = setInterval(() => pollTask().catch(handleError), 1500);
    } catch (error) {
        handleError(error);
        els.startBtn.disabled = false;
        els.cancelBtn.disabled = true;
    }
}

async function cancelTask() {
    if (!state.taskId) return;
    try {
        await api(`/api/registration/tasks/${state.taskId}/cancel`, { method: 'POST', body: '{}' });
        await pollTask();
    } catch (error) {
        handleError(error);
    }
}

function handleError(error) {
    appendLog({ ts: new Date().toLocaleTimeString('zh-CN', { hour12: false }), level: 'error', message: error.message || String(error) });
    console.error(error);
}

els.form.addEventListener('submit', startTask);
els.cancelBtn.addEventListener('click', cancelTask);
els.clearLogBtn.addEventListener('click', resetConsole);
els.refreshAccountsBtn.addEventListener('click', () => loadBootstrap().catch(handleError));
['change', 'input'].forEach((eventName) => {
    els.form.addEventListener(eventName, () => saveFormState());
});

loadBootstrap().catch(handleError);
