const state = {
    taskId: null,
    pollTimer: null,
    bootstrap: null,
    renderedLogs: 0,
    pollInFlight: false,
};

const STORAGE_KEY = 'tutamail_register_form_state';
const ACTIVE_TASK_KEY = 'tutamail_register_active_task_id';

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
    const { timeoutMs = 0, headers = {}, ...rest } = options;
    const controller = timeoutMs > 0 ? new AbortController() : null;
    let timer = null;
    try {
        if (controller) {
            timer = window.setTimeout(() => controller.abort(), timeoutMs);
        }
        const response = await fetch(url, {
            headers: { 'Content-Type': 'application/json', ...headers },
            signal: controller?.signal,
            ...rest,
        });
        const data = await response.json();
        if (!response.ok || data.success === false) {
            throw new Error(data.error || `请求失败: ${response.status}`);
        }
        return data;
    } catch (error) {
        if (error?.name === 'AbortError') {
            throw new Error(`请求超时: ${url}`);
        }
        throw error;
    } finally {
        if (timer) {
            window.clearTimeout(timer);
        }
    }
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

function saveActiveTaskId(taskId) {
    try {
        if (taskId) {
            window.localStorage?.setItem(ACTIVE_TASK_KEY, String(taskId));
        } else {
            window.localStorage?.removeItem(ACTIVE_TASK_KEY);
        }
    } catch (error) {
        console.warn('save active register task failed', error);
    }
}

function loadActiveTaskId() {
    try {
        const raw = window.localStorage?.getItem(ACTIVE_TASK_KEY);
        return raw ? String(raw) : null;
    } catch (error) {
        console.warn('load active register task failed', error);
        return null;
    }
}

function clearActiveTaskId() {
    saveActiveTaskId(null);
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

function appendSystemLog(message, level = 'info') {
    appendLog({
        ts: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
        level,
        message,
    });
}

function nextFrame() {
    return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}

function resetConsole() {
    els.consoleLog.innerHTML = '<div class="log-line info">[系统] 准备就绪，等待开始注册...</div>';
    state.renderedLogs = 0;
}

function resetTaskUI(message = '[系统] 准备就绪，等待开始注册...') {
    if (state.pollTimer) {
        clearInterval(state.pollTimer);
        state.pollTimer = null;
    }
    state.taskId = null;
    clearActiveTaskId();
    els.statusGrid.classList.add('hidden');
    els.progressBlock.classList.add('hidden');
    els.startBtn.disabled = false;
    els.cancelBtn.disabled = true;
    els.consoleLog.innerHTML = `<div class="log-line info">${escapeHtml(message)}</div>`;
    state.renderedLogs = 0;
    els.progressFill.style.width = '0%';
    setBadge('pending');
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

async function renderTaskLogs(logs) {
    const chunkSize = 100;
    while (state.renderedLogs < logs.length) {
        const upper = Math.min(state.renderedLogs + chunkSize, logs.length);
        while (state.renderedLogs < upper) {
            appendLog(logs[state.renderedLogs]);
            state.renderedLogs += 1;
        }
        if (state.renderedLogs < logs.length) {
            await nextFrame();
        }
    }
}

async function updateTaskUI(task) {
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

    await renderTaskLogs(task.logs || []);

    const active = task.status === 'pending' || task.status === 'running';
    els.startBtn.disabled = active;
    els.cancelBtn.disabled = !active;
    if (task.id) {
        state.taskId = task.id;
    }
    if (active) {
        saveActiveTaskId(task.id);
    } else {
        clearActiveTaskId();
    }
    if (!active && state.pollTimer) {
        clearInterval(state.pollTimer);
        state.pollTimer = null;
    }
}

async function pollTask(forceTaskId) {
    const taskId = forceTaskId || state.taskId;
    if (!taskId || state.pollInFlight) return;
    state.pollInFlight = true;
    try {
        console.debug('[register] pollTask', { taskId, forceTaskId: Boolean(forceTaskId) });
        const data = await api(`/api/registration/tasks/${taskId}`, { timeoutMs: 8000 });
        state.taskId = taskId;
        await updateTaskUI(data.task);
        if (['completed', 'failed', 'cancelled'].includes(data.task.status)) {
            appendSystemLog(`[系统] 任务轮询结束，状态=${data.task.status}`, data.task.status === 'completed' ? 'success' : 'warning');
            await loadBootstrap();
        }
    } finally {
        state.pollInFlight = false;
    }
}

async function restoreActiveTask() {
    const savedTaskId = loadActiveTaskId();
    if (!savedTaskId) return;
    try {
        resetConsole();
        appendSystemLog(`[系统] 检测到活动任务 ${savedTaskId}，尝试恢复监控台`, 'info');
        state.taskId = savedTaskId;
        await pollTask(savedTaskId);
        const active = els.cancelBtn.disabled === false;
        if (active) {
            appendSystemLog('[系统] 已恢复正在运行的注册任务', 'info');
            if (state.pollTimer) clearInterval(state.pollTimer);
            state.pollTimer = setInterval(() => pollTask().catch(handleError), 1500);
        } else {
            appendSystemLog('[系统] 已恢复最近一次任务状态', 'info');
        }
    } catch (error) {
        clearActiveTaskId();
        resetTaskUI('[系统] 未找到正在运行的注册任务，监控台已重置');
        window.UI?.toast('任务已失效，监控台已重置。', 'warning');
        appendSystemLog(`[系统] 恢复任务失败：${error.message || String(error)}`, 'error');
        console.warn('restore active task failed', error);
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
        saveActiveTaskId(data.task_id);
        appendSystemLog(`[系统] 已绑定注册任务 ${data.task_id}`, 'info');
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
    appendSystemLog(error.message || String(error), 'error');
    console.error(error);
}

els.form.addEventListener('submit', startTask);
els.cancelBtn.addEventListener('click', cancelTask);
els.clearLogBtn.addEventListener('click', resetConsole);
els.refreshAccountsBtn.addEventListener('click', () => loadBootstrap().catch(handleError));
['change', 'input'].forEach((eventName) => {
    els.form.addEventListener(eventName, () => saveFormState());
});

loadBootstrap()
    .then(() => restoreActiveTask())
    .catch(handleError);
