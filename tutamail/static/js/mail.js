const state = {
    bootstrap: null,
    selectedGroupId: null,
    selectedAccountEmail: null,
    selectedMailId: null,
    selectedAccountIds: new Set(),
    editingAccountId: null,
    mailSkip: 0,
    hasMore: false,
    accountKeyword: '',
    accountStatusFilter: 'all',
    currentEmails: [],
    currentMailMethod: '-',
    emailCache: {},
    isLoadingMails: false,
    isLoadingMailDetail: false,
    mailRequestSeq: 0,
    detailRequestSeq: 0,
    pendingExportGroupIds: [],
    pendingExportMode: 'minimal',
    mailRefreshTaskId: null,
    mailRefreshPollTimer: null,
    mailRefreshLastLogCount: 0,
    mailRefreshPollErrorShown: false,
    accountActionLoading: {},
    mailListPlaceholder: {
        title: '请先选择一个邮箱账号',
        message: '选择左侧账号后，再点击“获取邮件”拉取收件箱。',
        loading: false,
    },
    mailDetailPlaceholder: {
        title: '请选择一封邮件查看正文',
        message: '选中邮件后，这里会显示完整正文与元信息。',
        loading: false,
    },
};

const STORAGE_KEYS = {
    lastGroupId: 'tutamail_last_group_id',
    lastAccountEmail: 'tutamail_last_account_email',
    lastMailRef: 'tutamail_last_mail_ref',
    accountStatusFilter: 'tutamail_account_status_filter',
};

const els = {
    groupList: document.getElementById('group-list'),
    accountList: document.getElementById('account-list'),
    accountSearch: document.getElementById('account-search'),
    accountSummaryRow: document.getElementById('account-summary-row'),
    summaryOkCount: document.getElementById('summary-ok-count'),
    summaryRevokedCount: document.getElementById('summary-revoked-count'),
    summaryIssueCount: document.getElementById('summary-issue-count'),
    summaryDisabledCount: document.getElementById('summary-disabled-count'),
    accountStatusFilter: document.getElementById('account-status-filter'),
    toggleRevokedFilterBtn: document.getElementById('toggle-revoked-filter-btn'),
    exportFilteredAccountsBtn: document.getElementById('export-filtered-accounts-btn'),
    currentGroupColor: document.getElementById('current-group-color'),
    currentGroupName: document.getElementById('current-group-name'),
    mailList: document.getElementById('mail-list'),
    mailDetail: document.getElementById('mail-detail'),
    currentAccountBanner: document.getElementById('current-account-banner'),
    currentAccountCopyEmail: document.getElementById('current-account-copy-email'),
    mailMethodLabel: document.getElementById('mail-method-label'),
    mailCountLabel: document.getElementById('mail-count-label'),
    mailCacheLabel: document.getElementById('mail-cache-label'),
    loadMoreMailsBtn: document.getElementById('load-more-mails-btn'),
    refreshMailsBtn: document.getElementById('refresh-mails-btn'),
    addGroupBtn: document.getElementById('add-group-btn'),
    addAccountBtn: document.getElementById('add-account-btn'),
    importAccountBtn: document.getElementById('import-account-btn'),
    importAccountBtnSecondary: document.getElementById('import-account-btn-secondary'),
    accountFooterImportBtn: document.getElementById('account-footer-import-btn'),
    exportAccountBtn: document.getElementById('export-account-btn'),
    exportAccountBtnSecondary: document.getElementById('export-account-btn-secondary'),
    refreshGroupMailsBtn: document.getElementById('refresh-group-mails-btn'),
    refreshAllMailsBtn: document.getElementById('refresh-all-mails-btn'),
    selectAllAccountsBtn: document.getElementById('select-all-accounts-btn'),
    accountBatchBar: document.getElementById('account-batch-bar'),
    selectedAccountCount: document.getElementById('selected-account-count'),
    clearAccountSelectionBtn: document.getElementById('clear-account-selection-btn'),
    refreshSelectedStatusBtn: document.getElementById('refresh-selected-status-btn'),
    refreshSelectedMailsBtn: document.getElementById('refresh-selected-mails-btn'),
    batchDeleteAccountsBtn: document.getElementById('batch-delete-accounts-btn'),
    importModal: document.getElementById('account-import-modal'),
    importGroupSelect: document.getElementById('import-group-select'),
    accountImportData: document.getElementById('account-import-data'),
    accountImportHint: document.getElementById('account-import-hint'),
    accountImportResult: document.getElementById('account-import-result'),
    clearAccountImportBtn: document.getElementById('clear-account-import-btn'),
    submitAccountImportBtn: document.getElementById('submit-account-import-btn'),
    exportModal: document.getElementById('account-export-modal'),
    exportGroupList: document.getElementById('export-group-list'),
    exportMode: document.getElementById('export-mode'),
    exportSelectAllGroups: document.getElementById('export-select-all-groups'),
    confirmExportGroupsBtn: document.getElementById('confirm-export-groups-btn'),
    exportVerifyModal: document.getElementById('account-export-verify-modal'),
    exportVerifyPassword: document.getElementById('export-verify-password'),
    submitExportBtn: document.getElementById('submit-export-btn'),
    accountModal: document.getElementById('account-form-modal'),
    accountFormTitle: document.getElementById('account-form-title'),
    accountFormId: document.getElementById('account-form-id'),
    accountEmail: document.getElementById('account-email'),
    accountPassword: document.getElementById('account-password'),
    accountClientId: document.getElementById('account-client-id'),
    accountAccessToken: document.getElementById('account-access-token'),
    accountUserId: document.getElementById('account-user-id'),
    accountGroupId: document.getElementById('account-group-id'),
    accountStatus: document.getElementById('account-status'),
    accountFetchStatus: document.getElementById('account-fetch-status'),
    accountRemark: document.getElementById('account-remark'),
    accountLastError: document.getElementById('account-last-error'),
    saveAccountBtn: document.getElementById('save-account-btn'),
    deleteAccountFromModalBtn: document.getElementById('delete-account-from-modal-btn'),
    groupModal: document.getElementById('group-form-modal'),
    groupFormTitle: document.getElementById('group-form-title'),
    groupFormId: document.getElementById('group-form-id'),
    groupName: document.getElementById('group-name'),
    groupDescription: document.getElementById('group-description'),
    groupColor: document.getElementById('group-color'),
    groupColorPicker: document.getElementById('group-color-picker'),
    groupCustomColorInput: document.getElementById('group-custom-color-input'),
    groupProxyProfileId: document.getElementById('group-proxy-profile-id'),
    saveGroupBtn: document.getElementById('save-group-btn'),
    mailRefreshModal: document.getElementById('mail-refresh-modal'),
    mailRefreshModalTitle: document.getElementById('mail-refresh-modal-title'),
    mailRefreshStatus: document.getElementById('mail-refresh-status'),
    mailRefreshProgressText: document.getElementById('mail-refresh-progress-text'),
    mailRefreshResultText: document.getElementById('mail-refresh-result-text'),
    mailRefreshProgressBar: document.getElementById('mail-refresh-progress-bar'),
    mailRefreshResultList: document.getElementById('mail-refresh-result-list'),
    mailRefreshLogList: document.getElementById('mail-refresh-log-list'),
    cancelMailRefreshBtn: document.getElementById('cancel-mail-refresh-btn'),
};

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function formatLocalDateTime(value) {
    if (!value) return '';
    let normalized = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalized)) {
        return normalized;
    }
    normalized = normalized.replace(/\.(\d{3})\d+Z$/, '.$1Z');
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return String(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function mailCacheKey(email, folder = 'inbox') {
    return `${email}_${folder}`;
}

function getMailCache(email = state.selectedAccountEmail, folder = 'inbox') {
    if (!email) return null;
    return state.emailCache[mailCacheKey(email, folder)] || null;
}

function setMailCache(email, payload, folder = 'inbox') {
    if (!email) return;
    state.emailCache[mailCacheKey(email, folder)] = payload;
}

function renderPlaceholder(title, message, loading = false) {
    if (loading) {
        return `
            <div class="loading-state">
                <strong>${escapeHtml(title)}</strong>
                <div>${escapeHtml(message)}</div>
                <div class="loading-dots" aria-hidden="true">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;
    }
    return `
        <div class="empty-state">
            <strong>${escapeHtml(title)}</strong>
            <div class="small muted" style="margin-top:8px;">${escapeHtml(message)}</div>
        </div>
    `;
}

function setMailListPlaceholder(title, message, loading = false) {
    state.mailListPlaceholder = { title, message, loading };
    if (!state.currentEmails.length) {
        els.mailList.innerHTML = renderPlaceholder(title, message, loading);
    }
}

function setMailDetailPlaceholder(title, message, loading = false) {
    state.mailDetailPlaceholder = { title, message, loading };
    els.mailDetail.innerHTML = renderPlaceholder(title, message, loading);
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

function openModal(modal) {
    modal.classList.add('active');
}

function closeModal(modal) {
    modal.classList.remove('active');
}

function renderGroupOptions(select, selectedValue) {
    const groups = state.bootstrap?.groups || [];
    select.innerHTML = groups.map((group) => `
        <option value="${group.id}" ${String(group.id) === String(selectedValue) ? 'selected' : ''}>${escapeHtml(group.name)}</option>
    `).join('');
}

function getStoredGroupId() {
    const raw = window.localStorage?.getItem(STORAGE_KEYS.lastGroupId);
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
}

function storeGroupId(groupId) {
    if (!groupId) return;
    window.localStorage?.setItem(STORAGE_KEYS.lastGroupId, String(groupId));
}

function getStoredAccountEmail() {
    const value = window.localStorage?.getItem(STORAGE_KEYS.lastAccountEmail);
    return value ? String(value) : null;
}

function storeAccountEmail(email) {
    if (!email) return;
    window.localStorage?.setItem(STORAGE_KEYS.lastAccountEmail, String(email));
}

function clearStoredAccountEmail() {
    window.localStorage?.removeItem(STORAGE_KEYS.lastAccountEmail);
}

function getStoredMailRef() {
    const raw = window.localStorage?.getItem(STORAGE_KEYS.lastMailRef);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.email || !parsed.mailId) return null;
        return parsed;
    } catch (_error) {
        return null;
    }
}

function storeMailRef(email, mailId) {
    if (!email || !mailId) return;
    window.localStorage?.setItem(STORAGE_KEYS.lastMailRef, JSON.stringify({ email, mailId }));
}

function clearStoredMailRef() {
    window.localStorage?.removeItem(STORAGE_KEYS.lastMailRef);
}

function getStoredAccountStatusFilter() {
    const value = window.localStorage?.getItem(STORAGE_KEYS.accountStatusFilter);
    let normalized = value ? String(value) : 'all';
    if (normalized === 'auth_failed') normalized = 'not_authenticated';
    if (normalized === 'server_error') normalized = 'internal_server_error';
    const allowed = new Set([
        'all',
        'issue',
        'ok',
        'account_exists_but_login_revoked',
        'not_authenticated',
        'session_expired',
        'access_deactivated',
        'access_blocked',
        'access_expired',
        'not_found',
        'network_error',
        'too_many_requests',
        'internal_server_error',
        'service_unavailable',
        'unknown',
        'disabled',
    ]);
    return allowed.has(normalized) ? normalized : 'all';
}

function storeAccountStatusFilter(value) {
    window.localStorage?.setItem(STORAGE_KEYS.accountStatusFilter, String(value || 'all'));
}

function isAccountIssueStatus(fetchStatus) {
    return (fetchStatus || 'unknown') !== 'ok';
}

function getAccountActionKey(accountId, action) {
    return `${accountId}:${action}`;
}

function isAccountActionLoading(accountId, action) {
    return Boolean(state.accountActionLoading[getAccountActionKey(accountId, action)]);
}

function setAccountActionLoading(accountId, action, loading) {
    const key = getAccountActionKey(accountId, action);
    if (loading) state.accountActionLoading[key] = true;
    else delete state.accountActionLoading[key];
}

function matchesAccountStatusFilter(account) {
    const filter = state.accountStatusFilter || 'all';
    if (filter === 'all') return true;
    if (filter === 'disabled') return account.status === 'disabled';
    if (filter === 'issue') return account.status !== 'disabled' && isAccountIssueStatus(account.fetch_status);
    return account.status !== 'disabled' && (account.fetch_status || 'unknown') === filter;
}

async function restoreSelectedMailForCurrentAccount() {
    if (!state.selectedAccountEmail || !state.currentEmails.length) return;
    const mailRef = getStoredMailRef();
    if (!mailRef || mailRef.email !== state.selectedAccountEmail) return;
    const matched = state.currentEmails.find((item) => item.id === mailRef.mailId);
    if (!matched) return;
    try {
        await loadMailDetail(mailRef.mailId, false);
    } catch (_error) {
        // 忽略恢复失败，保留当前列表视图
    }
}

function currentAccounts() {
    let accounts = state.bootstrap?.accounts || [];
    if (state.selectedGroupId) {
        accounts = accounts.filter((item) => Number(item.group_id) === Number(state.selectedGroupId));
    }
    accounts = accounts.filter(matchesAccountStatusFilter);
    if (state.accountKeyword) {
        const keyword = state.accountKeyword.toLowerCase();
        accounts = accounts.filter((item) => `${item.email} ${item.remark || ''}`.toLowerCase().includes(keyword));
    }
    return accounts;
}

function getAccountSummaryStats() {
    let accounts = state.bootstrap?.accounts || [];
    if (state.selectedGroupId) {
        accounts = accounts.filter((item) => Number(item.group_id) === Number(state.selectedGroupId));
    }
    if (state.accountKeyword) {
        const keyword = state.accountKeyword.toLowerCase();
        accounts = accounts.filter((item) => `${item.email} ${item.remark || ''}`.toLowerCase().includes(keyword));
    }
    let ok = 0;
    let revoked = 0;
    let issue = 0;
    let disabled = 0;
    accounts.forEach((account) => {
        if (account.status === 'disabled') {
            disabled += 1;
            return;
        }
        if (account.fetch_status === 'ok') {
            ok += 1;
            return;
        }
        if (account.fetch_status === 'account_exists_but_login_revoked') {
            revoked += 1;
            issue += 1;
            return;
        }
        issue += 1;
    });
    return { ok, revoked, issue, disabled };
}

function renderAccountSummary() {
    if (!els.accountSummaryRow) return;
    const stats = getAccountSummaryStats();
    if (els.summaryOkCount) els.summaryOkCount.textContent = String(stats.ok);
    if (els.summaryRevokedCount) els.summaryRevokedCount.textContent = String(stats.revoked);
    if (els.summaryIssueCount) els.summaryIssueCount.textContent = String(stats.issue);
    if (els.summaryDisabledCount) els.summaryDisabledCount.textContent = String(stats.disabled);
    els.accountSummaryRow.querySelectorAll('[data-summary-filter]').forEach((chip) => {
        const filter = chip.dataset.summaryFilter || 'all';
        chip.classList.toggle('active', (state.accountStatusFilter || 'all') === filter);
    });
    if (els.toggleRevokedFilterBtn) {
        const active = (state.accountStatusFilter || 'all') === 'account_exists_but_login_revoked';
        els.toggleRevokedFilterBtn.classList.toggle('active', active);
        els.toggleRevokedFilterBtn.textContent = active ? '显示全部' : '仅看禁登';
    }
}

function applyAccountStatusFilter(targetFilter) {
    state.accountStatusFilter = targetFilter || 'all';
    if (els.accountStatusFilter) {
        els.accountStatusFilter.value = state.accountStatusFilter;
    }
    storeAccountStatusFilter(state.accountStatusFilter);
    trimSelectedAccountsToVisible();
    resetHiddenAccountContext();
    renderAccounts();
    updateCurrentAccountLabel();
    updateMailMethodLabel();
    updateMailSummaryBar();
    updateMailButtons();
}

function resetHiddenAccountContext() {
    const visibleEmails = new Set(currentAccounts().map((item) => item.email));
    if (state.selectedAccountEmail && !visibleEmails.has(state.selectedAccountEmail)) {
        state.selectedAccountEmail = null;
        state.selectedMailId = null;
        state.currentEmails = [];
        state.currentMailMethod = '-';
        state.hasMore = false;
        clearStoredAccountEmail();
        clearStoredMailRef();
        setMailListPlaceholder('请先选择一个邮箱账号', '当前筛选结果已变化，请重新选择账号后获取邮件。');
        setMailDetailPlaceholder('请选择一封邮件查看正文', '筛选后如需查看正文，请先重新选择左侧账号。');
    }
}

function trimSelectedAccountsToVisible() {
    const visibleIds = new Set(currentAccounts().map((item) => Number(item.id)));
    state.selectedAccountIds = new Set([...state.selectedAccountIds].filter((id) => visibleIds.has(Number(id))));
}

function updateBatchBar() {
    const count = state.selectedAccountIds.size;
    els.selectedAccountCount.textContent = `已选 ${count} 项`;
    els.accountBatchBar.classList.toggle('hidden', count === 0);
    els.batchDeleteAccountsBtn.disabled = count === 0;
    if (els.refreshSelectedMailsBtn) {
        els.refreshSelectedMailsBtn.disabled = count === 0 || isMailRefreshRunning();
    }
}

function renderGroups() {
    const groups = state.bootstrap?.groups || [];
    const proxyMap = state.bootstrap?.group_proxy_map || {};
    const proxies = state.bootstrap?.proxy_profiles || [];

    if (!groups.length) {
        els.groupList.innerHTML = '<div class="empty-state">暂无分组。</div>';
        return;
    }

    els.groupList.innerHTML = groups.map((group) => {
        const active = Number(state.selectedGroupId) === Number(group.id) ? 'active' : '';
        const proxyProfileId = proxyMap[String(group.id)] || 1;
        const proxyProfile = proxies.find((item) => Number(item.id) === Number(proxyProfileId));
        const canDelete = Number(group.id) !== 1;
        return `
            <div class="group-item ${active}" data-group-id="${group.id}">
                <div class="group-row-1">
                    <div class="group-color" style="background-color:${escapeHtml(group.color || '#666')}"></div>
                    <span class="group-name">${escapeHtml(group.name)}</span>
                </div>
                <div class="group-row-2">
                    <span class="group-count">${group.account_count || 0} 个邮箱</span>
                    <div class="group-actions">
                        <button class="group-action-btn" data-action="edit-group" data-id="${group.id}" title="编辑">✏️</button>
                        ${canDelete ? `<button class="group-action-btn" data-action="delete-group" data-id="${group.id}" title="删除">🗑️</button>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderAccounts() {
    const accounts = currentAccounts();
    if (!accounts.length) {
        const emptyText = state.accountKeyword || state.accountStatusFilter !== 'all'
            ? '当前筛选条件下没有匹配的邮箱账号。'
            : '当前分组下没有邮箱账号。';
        els.accountList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-text">${escapeHtml(emptyText)}</div>
            </div>
        `;
        updateBatchBar();
        return;
    }

    els.accountList.innerHTML = accounts.map((account, index) => {
        const active = account.email === state.selectedAccountEmail ? 'active' : '';
        const inactive = account.status === 'disabled' ? 'inactive' : '';
        const revoked = account.fetch_status === 'account_exists_but_login_revoked' ? 'revoked' : '';
        const checked = state.selectedAccountIds.has(account.id) ? 'checked' : '';
        const cache = getMailCache(account.email);
        const cacheText = cache ? `已缓存 ${cache.emails.length} 封` : `上次检查 ${escapeHtml(account.last_check_at || '未取件')}`;
        const activeBadge = active ? '<span class="account-status-tag">当前</span>' : '';
        const disabledBadge = account.status === 'disabled' ? '<span class="account-status-tag">停用</span>' : '';
        const revokedBadge = account.fetch_status === 'account_exists_but_login_revoked'
            ? '<span class="account-corner-badge">禁登</span>'
            : '';
        const fetchStatusTone = account.fetch_status_tone || 'muted';
        const fetchStatusBadge = account.fetch_status_label
            ? `<span class="account-status-tag fetch-status-${escapeHtml(fetchStatusTone)}">${escapeHtml(account.fetch_status_label)}</span>`
            : '';
        const lastErrorHtml = account.last_error ? `<div class="small account-error-text fetch-status-${escapeHtml(fetchStatusTone)}">错误：${escapeHtml(account.last_error)}</div>` : '';
        const statusMeta = [account.last_official_error, account.last_http_status ? `HTTP ${account.last_http_status}` : '', account.last_fetch_step].filter(Boolean).join(' · ');
        const statusMetaHtml = statusMeta ? `<div class="small account-status-meta">${escapeHtml(statusMeta)}</div>` : '';
        const sessionRefreshedHtml = account.session_refreshed_at ? `<div class="small account-session-time">会话刷新：${escapeHtml(account.session_refreshed_at)}</div>` : '';
        const refreshStatusLoading = isAccountActionLoading(account.id, 'refresh-status');
        const refreshSessionLoading = isAccountActionLoading(account.id, 'refresh-session');
        return `
            <div class="account-item ${active} ${inactive} ${revoked}" data-account-email="${escapeHtml(account.email)}">
                ${revokedBadge}
                <div class="account-item-layout">
                    <input type="checkbox" class="account-select-checkbox" data-account-id="${account.id}" ${checked}>
                    <div class="account-item-content">
                        <div class="account-email" title="${escapeHtml(account.email)}">
                            <span class="account-number">${index + 1}.</span> ${escapeHtml(account.email)}
                        </div>
                        ${account.remark ? `<div class="account-remark" title="${escapeHtml(account.remark)}">📝 ${escapeHtml(account.remark)}</div>` : ''}
                        <div class="account-refresh-time">🕐 ${escapeHtml(cacheText)}</div>
                        ${statusMetaHtml}
                        ${sessionRefreshedHtml}
                        ${lastErrorHtml}
                        <div class="account-meta-row">
                            <div class="account-statuses">${activeBadge}${disabledBadge}${fetchStatusBadge}</div>
                            <div class="account-actions">
                                <button class="account-action-btn status" data-action="refresh-account-status" data-id="${account.id}" ${refreshStatusLoading ? 'disabled' : ''}>${refreshStatusLoading ? '刷新中...' : '复检状态'}</button>
                                <button class="account-action-btn session" data-action="refresh-account-session" data-id="${account.id}" ${refreshSessionLoading ? 'disabled' : ''}>${refreshSessionLoading ? '刷新中...' : '刷新会话'}</button>
                                <button class="account-action-btn" data-action="edit-account" data-id="${account.id}">编辑</button>
                                <button class="account-action-btn delete" data-action="delete-account" data-id="${account.id}">删除</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    renderAccountSummary();
    updateBatchBar();
}

function renderMailList() {
    if (!state.currentEmails.length) {
        const placeholder = state.mailListPlaceholder;
        els.mailList.innerHTML = renderPlaceholder(placeholder.title, placeholder.message, placeholder.loading);
        return;
    }

    els.mailList.innerHTML = state.currentEmails.map((mail) => {
        const active = mail.id === state.selectedMailId ? 'active' : '';
        const formattedDate = mail.date_display || formatLocalDateTime(mail.date) || '-';
        return `
            <div class="email-item ${active}" data-mail-id="${escapeHtml(mail.id)}">
                <div class="email-item-main">
                    <div class="email-item-head">
                        <div class="email-from">${escapeHtml(mail.from || '-')}</div>
                        <div class="email-date">${escapeHtml(formattedDate)}</div>
                    </div>
                    <div class="email-subject">${escapeHtml(mail.subject || '无主题')}</div>
                    <div class="email-preview">${escapeHtml(mail.body_preview || '')}</div>
                </div>
            </div>
        `;
    }).join('');
}

function renderDetail(mail) {
    els.mailDetail.innerHTML = `
        <div class="email-detail-header">
            <div class="email-detail-subject">${escapeHtml(mail.subject || '无主题')}</div>
            <div class="email-detail-meta">
                <div class="email-detail-meta-row">
                    <span class="email-detail-meta-label">发件人</span>
                    <span class="email-detail-meta-value">${escapeHtml(mail.from || '-')}</span>
                </div>
                ${mail.to ? `
                <div class="email-detail-meta-row">
                    <span class="email-detail-meta-label">收件人</span>
                    <span class="email-detail-meta-value">${escapeHtml(mail.to)}</span>
                </div>
                ` : ''}
                <div class="email-detail-meta-row">
                    <span class="email-detail-meta-label">时间</span>
                    <span class="email-detail-meta-value">${escapeHtml(mail.date_display || formatLocalDateTime(mail.date) || '-')}</span>
                </div>
                <div class="email-detail-meta-row">
                    <span class="email-detail-meta-label">标识</span>
                    <span class="email-detail-meta-value mail-id-text">${escapeHtml(mail.id || '-')}</span>
                </div>
            </div>
        </div>
        <div class="email-detail-body">
            <div class="mail-body-html">${mail.body || `<pre class="mail-body-text">${escapeHtml(mail.body_text || '')}</pre>`}</div>
        </div>
    `;
}

function updateCurrentAccountLabel() {
    if (!state.selectedAccountEmail) {
        els.currentAccountBanner?.classList.remove('show');
        if (els.currentAccountCopyEmail) els.currentAccountCopyEmail.textContent = '';
        return;
    }

    els.currentAccountBanner?.classList.add('show');
    if (els.currentAccountCopyEmail) {
        els.currentAccountCopyEmail.textContent = state.selectedAccountEmail;
    }

    if (state.isLoadingMails) {
        return;
    }
}

function updateMailMethodLabel() {
    if (!state.selectedAccountEmail || state.currentMailMethod === '-') {
        els.mailMethodLabel.textContent = '-';
        els.mailMethodLabel.style.display = 'none';
        return;
    }
    const countText = state.currentEmails.length ? ` · ${state.currentEmails.length} 封` : '';
    els.mailMethodLabel.textContent = `${state.currentMailMethod}${countText}`;
    els.mailMethodLabel.style.display = 'inline-flex';
}

function updateMailSummaryBar() {
    if (!state.selectedAccountEmail) {
        els.mailCountLabel.textContent = '';
        els.mailCacheLabel.textContent = '尚未选择账号';
        return;
    }

    const cache = getMailCache();
    const total = state.currentEmails.length || cache?.emails?.length || 0;
    els.mailCountLabel.textContent = total ? `(${total})` : '';

    if (state.isLoadingMails) {
        els.mailCacheLabel.textContent = '正在同步收件箱';
        return;
    }
    if (cache?.fetchedAt) {
        els.mailCacheLabel.textContent = `最近获取：${formatLocalDateTime(cache.fetchedAt)}`;
        return;
    }
    els.mailCacheLabel.textContent = '尚未获取';
}

function updateMailButtons() {
    const hasAccount = Boolean(state.selectedAccountEmail);
    const loading = state.isLoadingMails || state.isLoadingMailDetail;
    els.refreshMailsBtn.disabled = !hasAccount || state.isLoadingMails;
    els.refreshMailsBtn.textContent = state.isLoadingMails ? '获取中...' : '获取邮件';
    els.loadMoreMailsBtn.disabled = !hasAccount || loading || !state.hasMore;
    els.loadMoreMailsBtn.textContent = loading && state.isLoadingMails && state.mailSkip > 0 ? '加载中...' : '加载更多';
}

function isMailRefreshRunning() {
    return Boolean(state.mailRefreshTaskId);
}

function getCurrentGroup() {
    return (state.bootstrap?.groups || []).find((item) => Number(item.id) === Number(state.selectedGroupId)) || null;
}

function getMailRefreshScopeLabel(scope) {
    if (scope === 'group') {
        return `当前分组 · ${getCurrentGroup()?.name || '未命名分组'}`;
    }
    if (scope === 'selected') {
        const count = Number((state.bootstrap?.accounts || []).filter((item) => (state.selectedAccountIds || new Set()).has(item.id)).length || 0);
        return `已选账号 · ${count} 个`;
    }
    return '全部分组';
}

function updateMailRefreshButtons() {
    const hasGroup = Boolean(state.selectedGroupId);
    const running = isMailRefreshRunning();
    if (els.refreshGroupMailsBtn) {
        els.refreshGroupMailsBtn.disabled = !hasGroup || running;
        els.refreshGroupMailsBtn.textContent = running ? '取件中...' : '取本组';
    }
    if (els.refreshAllMailsBtn) {
        els.refreshAllMailsBtn.disabled = running;
        els.refreshAllMailsBtn.textContent = running ? '取件中...' : '取全部';
    }
    if (els.refreshSelectedMailsBtn) {
        const hasSelected = state.selectedAccountIds.size > 0;
        els.refreshSelectedMailsBtn.disabled = running || !hasSelected;
        els.refreshSelectedMailsBtn.textContent = running ? '复检中...' : '复检已选';
    }
    if (els.refreshSelectedStatusBtn) {
        const hasSelected = state.selectedAccountIds.size > 0;
        els.refreshSelectedStatusBtn.disabled = running || !hasSelected;
        els.refreshSelectedStatusBtn.textContent = '刷新状态';
    }
    if (els.cancelMailRefreshBtn) {
        els.cancelMailRefreshBtn.disabled = !running;
    }
}

function stopMailRefreshPolling() {
    if (state.mailRefreshPollTimer) {
        window.clearTimeout(state.mailRefreshPollTimer);
        state.mailRefreshPollTimer = null;
    }
}

function renderMailRefreshTask(task) {
    const payload = task?.payload || {};
    const progress = task?.progress || {};
    const results = task?.results || [];
    const logs = task?.logs || [];
    const total = Number(progress.total || 0);
    const done = Number(progress.done || 0);
    const success = Number(progress.success || 0);
    const failed = Number(progress.failed || 0);
    const percent = total > 0 ? Math.max(0, Math.min(100, Math.round((done / total) * 100))) : 0;
    const statusMap = {
        pending: '等待中',
        running: '进行中',
        completed: '已完成',
        failed: '已失败',
        cancelled: '已取消',
    };

    if (els.mailRefreshModalTitle) {
        els.mailRefreshModalTitle.textContent = `批量获取邮件 · ${getMailRefreshScopeLabel(payload.scope || 'group')}`;
    }
    if (els.mailRefreshStatus) {
        els.mailRefreshStatus.textContent = statusMap[task?.status] || '未开始';
        els.mailRefreshStatus.className = `mail-refresh-status-text ${task?.status || 'pending'}`;
    }
    if (els.mailRefreshProgressText) {
        els.mailRefreshProgressText.textContent = `${done} / ${total}`;
    }
    if (els.mailRefreshResultText) {
        els.mailRefreshResultText.textContent = `成功 ${success} · 失败 ${failed}`;
    }
    if (els.mailRefreshProgressBar) {
        els.mailRefreshProgressBar.style.width = `${percent}%`;
    }

    if (els.mailRefreshResultList) {
        if (!results.length) {
            els.mailRefreshResultList.innerHTML = '<div class="empty-state">任务启动后，这里会显示成功/失败明细。</div>';
        } else {
            els.mailRefreshResultList.innerHTML = results.map((item) => `
                <div class="mail-refresh-result-item ${item.status === 'failed' ? 'failed' : 'success'}">
                    <div class="mail-refresh-result-main">
                        <strong>${escapeHtml(item.email || '-')}</strong>
                        <div class="small muted">${item.status === 'failed'
                            ? `失败：${escapeHtml(item.fetch_status_label || '异常')}${item.official_error ? ` · ${escapeHtml(item.official_error)}` : ''}${item.http_status ? ` · HTTP ${escapeHtml(item.http_status)}` : ''}${item.step ? ` · ${escapeHtml(item.step)}` : ''} · ${escapeHtml(item.error || '未知错误')}`
                            : `成功刷新，缓存 ${escapeHtml(item.count || 0)} 封邮件`}</div>
                    </div>
                    <span class="mail-refresh-result-tag ${item.status === 'failed' ? 'failed' : 'success'}">${item.status === 'failed' ? escapeHtml(item.fetch_status_label || '失败') : '成功'}</span>
                </div>
            `).join('');
        }
    }

    if (els.mailRefreshLogList) {
        if (!logs.length) {
            els.mailRefreshLogList.innerHTML = '<div class="empty-state">等待任务开始...</div>';
        } else {
            els.mailRefreshLogList.innerHTML = logs.map((item) => `
                <div class="mail-refresh-log-item ${escapeHtml(item.level || 'info')}">
                    <span class="mail-refresh-log-time">[${escapeHtml(item.ts || '--:--:--')}]</span>
                    <span class="mail-refresh-log-message">${escapeHtml(item.message || '')}</span>
                </div>
            `).join('');
            if (logs.length !== state.mailRefreshLastLogCount) {
                els.mailRefreshLogList.scrollTop = els.mailRefreshLogList.scrollHeight;
                state.mailRefreshLastLogCount = logs.length;
            }
        }
    }

    updateMailRefreshButtons();
}

function currentAccountCoveredByTask(task) {
    if (!state.selectedAccountEmail || !task?.payload) return false;
    if ((task.payload.scope || 'group') === 'all') return true;
    if ((task.payload.scope || 'group') === 'selected') {
        const currentAccount = (state.bootstrap?.accounts || []).find((item) => item.email === state.selectedAccountEmail);
        return Boolean(currentAccount) && (task.payload.account_ids || []).map(Number).includes(Number(currentAccount.id));
    }
    const currentAccount = (state.bootstrap?.accounts || []).find((item) => item.email === state.selectedAccountEmail);
    return Boolean(currentAccount) && Number(currentAccount.group_id) === Number(task.payload.group_id);
}

async function syncCurrentMailboxAfterBatch(task) {
    if (!currentAccountCoveredByTask(task) || !state.selectedAccountEmail) return;
    try {
        await hydratePersistedMailbox(state.selectedAccountEmail);
    } catch (_error) {
        // 批量任务已完成，不再额外打断用户
    }
}

async function pollMailRefreshTask(taskId) {
    try {
        const data = await api(`/api/mail-refresh/tasks/${encodeURIComponent(taskId)}`);
        if (state.mailRefreshTaskId !== taskId) return;
        state.mailRefreshPollErrorShown = false;
        const task = data.task;
        renderMailRefreshTask(task);
        if (['completed', 'failed', 'cancelled'].includes(task.status)) {
            state.mailRefreshTaskId = null;
            stopMailRefreshPolling();
            updateMailRefreshButtons();
            await loadBootstrap();
            await syncCurrentMailboxAfterBatch(task);
            if (task.status === 'completed') {
                notify(`批量取件完成：成功 ${task.progress?.success || 0}，失败 ${task.progress?.failed || 0}`);
            } else if (task.status === 'failed') {
                notify(`批量取件失败：${task.error || '全部邮箱取件失败'}`);
            } else {
                notify('批量取件已取消');
            }
            return;
        }
        state.mailRefreshPollTimer = window.setTimeout(() => pollMailRefreshTask(taskId), 1500);
    } catch (error) {
        if (state.mailRefreshTaskId !== taskId) return;
        state.mailRefreshPollTimer = window.setTimeout(() => pollMailRefreshTask(taskId), 3000);
        if (!state.mailRefreshPollErrorShown) {
            state.mailRefreshPollErrorShown = true;
            notify(error.message || String(error));
        }
    }
}

async function startMailRefresh(scope) {
    if (isMailRefreshRunning()) {
        openModal(els.mailRefreshModal);
        notify('批量取件任务正在运行');
        return;
    }
    if (scope === 'group' && !state.selectedGroupId) {
        throw new Error('请先选择分组');
    }
    if (scope === 'selected' && !state.selectedAccountIds.size) {
        throw new Error('请先选择要复检的账号');
    }

    const payload = {
        scope,
        group_id: Number(state.selectedGroupId || 0),
        include_disabled: false,
    };
    if (scope === 'selected') {
        payload.account_ids = [...state.selectedAccountIds];
    }
    const data = await api('/api/mail-refresh/start', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    state.mailRefreshTaskId = data.task_id;
    state.mailRefreshLastLogCount = 0;
    state.mailRefreshPollErrorShown = false;
    renderMailRefreshTask({
        status: 'pending',
        payload,
        progress: { total: 0, done: 0, success: 0, failed: 0 },
        results: [],
        logs: [{ ts: new Date().toLocaleString('zh-CN', { hour12: false }), level: 'info', message: '[系统] 任务已提交，等待开始' }],
    });
    openModal(els.mailRefreshModal);
    updateMailRefreshButtons();
    pollMailRefreshTask(data.task_id).catch((error) => notify(error.message || String(error)));
}

async function cancelMailRefreshTask() {
    if (!state.mailRefreshTaskId) return;
    await api(`/api/mail-refresh/tasks/${encodeURIComponent(state.mailRefreshTaskId)}/cancel`, {
        method: 'POST',
        body: '{}',
    });
    notify('已请求取消批量取件');
}

function updateCurrentGroupIndicator() {
    const groups = state.bootstrap?.groups || [];
    const group = groups.find((item) => Number(item.id) === Number(state.selectedGroupId));
    els.currentGroupName.textContent = group?.name || '选择分组';
    els.currentGroupColor.style.backgroundColor = group?.color || '#666';
}

function clearSelectionForMissingAccounts() {
    const existingIds = new Set((state.bootstrap?.accounts || []).map((item) => item.id));
    state.selectedAccountIds = new Set([...state.selectedAccountIds].filter((id) => existingIds.has(id)));
}

function resetImportModal() {
    renderGroupOptions(els.importGroupSelect, state.selectedGroupId || 1);
    els.accountImportData.value = '';
    els.accountImportHint.textContent = '格式：邮箱----密码----client_id----access_token----user_id，后两项可选。';
    els.accountImportResult.className = 'hidden';
    els.accountImportResult.innerHTML = '';
}

function showImportResult(result) {
    const items = result.items || [];
    const failedCount = result.failed || 0;
    const itemHtml = items.length ? `
        <div class="result-list">
            ${items.map((item) => `
                <div class="result-item ${item.status === 'failed' ? 'failed' : 'success'}">
                    <strong>${escapeHtml(item.email || item.raw || `第 ${item.line} 行`)}</strong>
                    <div class="small muted">${item.status === 'failed' ? `失败：${escapeHtml(item.error || '未知错误')}` : `成功导入${item.account_id ? `，账号 ID=${item.account_id}` : ''}`}</div>
                </div>
            `).join('')}
        </div>
    ` : '';
    els.accountImportResult.className = '';
    els.accountImportResult.innerHTML = `
        <div class="import-stats">
            <span>✅ 成功导入: <strong>${result.imported || 0}</strong></span>
            <span>❌ 失败: <strong>${failedCount}</strong></span>
        </div>
        ${result.errors?.length ? `<div class="import-errors"><strong>错误详情：</strong><ul>${result.errors.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>` : ''}
        ${itemHtml}
    `;
}

function resetAccountForm() {
    state.editingAccountId = null;
    els.accountFormTitle.textContent = '新增邮箱账号';
    els.accountFormId.value = '';
    els.accountEmail.value = '';
    els.accountPassword.value = '';
    els.accountClientId.value = '';
    els.accountAccessToken.value = '';
    els.accountUserId.value = '';
    els.accountStatus.value = 'active';
    els.accountFetchStatus.value = '待检查';
    els.accountRemark.value = '';
    els.accountLastError.value = '';
    els.accountLastError.placeholder = '暂无错误';
    els.deleteAccountFromModalBtn.classList.add('hidden');
    renderGroupOptions(els.accountGroupId, state.selectedGroupId || 1);
}

function fillAccountForm(account) {
    state.editingAccountId = account.id;
    els.accountFormTitle.textContent = '编辑邮箱账号';
    els.accountFormId.value = account.id;
    els.accountEmail.value = account.email || '';
    els.accountPassword.value = account.password || '';
    els.accountClientId.value = account.client_id || '';
    els.accountAccessToken.value = account.access_token || '';
    els.accountUserId.value = account.user_id || '';
    els.accountStatus.value = account.status || 'active';
    els.accountFetchStatus.value = account.fetch_status_label || '待检查';
    els.accountRemark.value = account.remark || '';
    els.accountLastError.value = account.last_error || '';
    els.accountLastError.placeholder = '暂无错误';
    els.deleteAccountFromModalBtn.classList.remove('hidden');
    renderGroupOptions(els.accountGroupId, account.group_id || 1);
}

function resetGroupForm() {
    els.groupFormTitle.textContent = '新建分组';
    els.groupFormId.value = '';
    els.groupName.value = '';
    els.groupDescription.value = '';
    applyGroupColorSelection('#1a1a1a');
    const proxyProfileId = state.bootstrap?.group_proxy_map?.[String(state.selectedGroupId || 1)] || 1;
    const proxies = state.bootstrap?.proxy_profiles || [];
    els.groupProxyProfileId.innerHTML = proxies.map((item) => `
        <option value="${item.id}" ${String(item.id) === String(proxyProfileId) ? 'selected' : ''}>${escapeHtml(item.name)} · ${escapeHtml(item.mode)}</option>
    `).join('');
}

function fillGroupForm(group) {
    els.groupFormTitle.textContent = '编辑分组';
    els.groupFormId.value = group.id;
    els.groupName.value = group.name || '';
    els.groupDescription.value = group.description || '';
    applyGroupColorSelection(group.color || '#1a1a1a');
    const selectedProxy = state.bootstrap?.group_proxy_map?.[String(group.id)] || 1;
    const proxies = state.bootstrap?.proxy_profiles || [];
    els.groupProxyProfileId.innerHTML = proxies.map((item) => `
        <option value="${item.id}" ${String(item.id) === String(selectedProxy) ? 'selected' : ''}>${escapeHtml(item.name)} · ${escapeHtml(item.mode)}</option>
    `).join('');
}

function normalizeHexColor(value) {
    const raw = String(value || '').trim();
    return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw.toLowerCase() : null;
}

function applyGroupColorSelection(color) {
    const normalized = normalizeHexColor(color) || '#1a1a1a';
    els.groupColor.value = normalized;
    els.groupCustomColorInput.value = normalized;
    els.groupColorPicker.querySelectorAll('.color-option').forEach((button) => {
        button.classList.toggle('selected', (button.dataset.color || '').toLowerCase() === normalized);
    });
}

async function loadBootstrap() {
    state.bootstrap = await api('/api/dashboard/bootstrap');
    state.accountStatusFilter = getStoredAccountStatusFilter();
    if (els.accountStatusFilter) {
        els.accountStatusFilter.value = state.accountStatusFilter;
    }
    const groupIds = (state.bootstrap.groups || []).map((item) => Number(item.id));
    const storedGroupId = getStoredGroupId();
    if (!state.selectedGroupId || !groupIds.includes(Number(state.selectedGroupId))) {
        if (storedGroupId && groupIds.includes(Number(storedGroupId))) {
            state.selectedGroupId = storedGroupId;
        } else {
            state.selectedGroupId = state.bootstrap.groups?.[0]?.id || null;
        }
    }
    if (state.selectedGroupId) storeGroupId(state.selectedGroupId);

    const accountEmails = (state.bootstrap.accounts || []).map((item) => item.email);
    if (state.selectedAccountEmail && !accountEmails.includes(state.selectedAccountEmail)) {
        state.selectedAccountEmail = null;
        state.selectedMailId = null;
        state.currentEmails = [];
        state.currentMailMethod = '-';
        clearStoredAccountEmail();
        clearStoredMailRef();
        setMailListPlaceholder('请先选择一个邮箱账号', '选择左侧账号后，再点击“获取邮件”拉取收件箱。');
        setMailDetailPlaceholder('请选择一封邮件查看正文', '选中邮件后，这里会显示完整正文与元信息。');
    }

    clearSelectionForMissingAccounts();
    trimSelectedAccountsToVisible();
    resetHiddenAccountContext();
    renderGroups();
    renderAccounts();
    renderGroupOptions(els.importGroupSelect, state.selectedGroupId || 1);
    renderGroupOptions(els.accountGroupId, state.selectedGroupId || 1);

    const storedAccountEmail = getStoredAccountEmail();
    const visibleAccounts = currentAccounts();
    const visibleEmails = visibleAccounts.map((item) => item.email);
    if (!state.selectedAccountEmail && storedAccountEmail && visibleEmails.includes(storedAccountEmail)) {
        state.selectedAccountEmail = storedAccountEmail;
        restoreAccountMailbox(state.selectedAccountEmail);
        if (!getMailCache(state.selectedAccountEmail)) {
            hydratePersistedMailbox(state.selectedAccountEmail).catch(() => {});
        }
    }

    updateCurrentGroupIndicator();
    updateCurrentAccountLabel();
    updateMailMethodLabel();
    updateMailSummaryBar();
    updateMailButtons();
    updateMailRefreshButtons();
}

async function loadEmails(reset = true, forceRefresh = reset) {
    if (!state.selectedAccountEmail) {
        notify('请先选择一个邮箱账号。');
        return;
    }

    const requestSeq = ++state.mailRequestSeq;
    const skip = reset ? 0 : state.mailSkip;
    state.isLoadingMails = true;
    if (reset) {
        state.selectedMailId = null;
        state.currentEmails = [];
        setMailListPlaceholder('正在获取收件箱', `${state.selectedAccountEmail} 的邮件列表加载中，请稍候。`, true);
        setMailDetailPlaceholder('等待选择邮件', '邮件列表更新后，点击左侧邮件查看详情。');
    } else {
        setMailListPlaceholder('正在加载更多邮件', '请稍候，正在继续拉取后续邮件。', true);
    }
    updateCurrentAccountLabel();
    updateMailButtons();
    updateMailSummaryBar();

    try {
        const data = await api(`/api/emails/${encodeURIComponent(state.selectedAccountEmail)}?folder=inbox&skip=${skip}&top=20&refresh=${forceRefresh ? '1' : '0'}`);
        if (requestSeq !== state.mailRequestSeq) return;

        state.currentMailMethod = data.method || '-';
        state.hasMore = Boolean(data.has_more);

        if (reset) {
            state.currentEmails = data.emails || [];
        } else {
            const merged = [...state.currentEmails, ...(data.emails || [])];
            const seen = new Set();
            state.currentEmails = merged.filter((item) => {
                if (seen.has(item.id)) return false;
                seen.add(item.id);
                return true;
            });
        }
        state.mailSkip = state.currentEmails.length;

        const existingCache = getMailCache(state.selectedAccountEmail) || {};
        setMailCache(state.selectedAccountEmail, {
            emails: [...state.currentEmails],
            hasMore: state.hasMore,
            skip: state.mailSkip,
            method: state.currentMailMethod,
            fetchedAt: new Date().toISOString(),
            details: existingCache.details || {},
        });

        if (state.currentEmails.length) {
            setMailListPlaceholder('请选择一封邮件', '点击左侧邮件即可切换查看正文与详细信息。');
            setMailDetailPlaceholder('请选择一封邮件查看正文', '邮件列表已更新，请从左侧选择一封邮件。');
        } else {
            setMailListPlaceholder('收件箱为空', '当前账号暂时没有可展示的收件箱邮件。');
            setMailDetailPlaceholder('暂无邮件详情', '当前账号收件箱为空，暂无可查看内容。');
        }
        renderMailList();
        updateCurrentAccountLabel();
        updateMailMethodLabel();
        updateMailSummaryBar();
        await restoreSelectedMailForCurrentAccount();
    } catch (error) {
        if (requestSeq !== state.mailRequestSeq) return;
        state.hasMore = false;
        setMailListPlaceholder('获取邮件失败', error.message || String(error));
        setMailDetailPlaceholder('无法加载邮件详情', '请先重新获取邮件列表，成功后再查看详情。');
        updateCurrentAccountLabel();
        updateMailMethodLabel();
        updateMailSummaryBar();
        throw error;
    } finally {
        if (requestSeq !== state.mailRequestSeq) return;
        state.isLoadingMails = false;
        updateCurrentAccountLabel();
        updateMailSummaryBar();
        updateMailButtons();
    }
}

async function loadMailDetail(mailId, persistSelection = true) {
    if (!state.selectedAccountEmail || !mailId) return;
    const detailSeq = ++state.detailRequestSeq;
    state.selectedMailId = mailId;
    if (persistSelection) {
        storeMailRef(state.selectedAccountEmail, mailId);
    }
    state.isLoadingMailDetail = true;
    renderMailList();
    setMailDetailPlaceholder('正在加载邮件详情', '正文与头信息正在获取，请稍候。', true);
    updateMailButtons();

    const cache = getMailCache();
    const cachedDetail = cache?.details?.[mailId];
    if (cachedDetail) {
        if (detailSeq !== state.detailRequestSeq) return;
        renderDetail(cachedDetail);
        state.isLoadingMailDetail = false;
        updateMailSummaryBar();
        updateMailButtons();
        return;
    }

    try {
        const data = await api(`/api/email/${encodeURIComponent(state.selectedAccountEmail)}/${encodeURIComponent(mailId)}`);
        if (detailSeq !== state.detailRequestSeq) return;
        const nextCache = getMailCache() || { emails: [...state.currentEmails], hasMore: state.hasMore, skip: state.mailSkip, method: state.currentMailMethod, details: {} };
        nextCache.details = { ...(nextCache.details || {}), [mailId]: data.email };
        setMailCache(state.selectedAccountEmail, nextCache);
        renderDetail(data.email);
    } catch (error) {
        if (detailSeq !== state.detailRequestSeq) return;
        setMailDetailPlaceholder('加载邮件详情失败', error.message || String(error));
        throw error;
    } finally {
        if (detailSeq !== state.detailRequestSeq) return;
        state.isLoadingMailDetail = false;
        updateMailSummaryBar();
        updateMailButtons();
    }
}

async function submitAccountImport() {
    const payload = {
        account_string: els.accountImportData.value.trim(),
        group_id: Number(els.importGroupSelect.value || 1),
    };
    if (!payload.account_string) {
        throw new Error('请输入账号信息');
    }
    const result = await api('/api/accounts', { method: 'POST', body: JSON.stringify(payload) });
    showImportResult(result);
    state.selectedGroupId = payload.group_id;
    await loadBootstrap();
    notify(result.message || '导入完成');
}

async function saveAccount() {
    const payload = {
        email: els.accountEmail.value.trim(),
        password: els.accountPassword.value.trim(),
        client_id: els.accountClientId.value.trim(),
        access_token: els.accountAccessToken.value.trim(),
        user_id: els.accountUserId.value.trim(),
        group_id: Number(els.accountGroupId.value || 1),
        status: els.accountStatus.value,
        remark: els.accountRemark.value.trim(),
    };
    if (!payload.email || !payload.password) {
        throw new Error('邮箱和密码不能为空');
    }
    const id = els.accountFormId.value.trim();
    if (id) {
        await api(`/api/accounts/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
        notify('账号已更新');
    } else {
        await api('/api/accounts', { method: 'POST', body: JSON.stringify(payload) });
        notify('账号已新增');
    }
    closeModal(els.accountModal);
    state.selectedGroupId = payload.group_id;
    await loadBootstrap();
}

async function saveGroup() {
    const payload = {
        name: els.groupName.value.trim(),
        description: els.groupDescription.value.trim(),
        color: normalizeHexColor(els.groupColor.value.trim()) || '#1a1a1a',
        proxy_profile_id: Number(els.groupProxyProfileId.value || 1),
    };
    if (!payload.name) {
        throw new Error('分组名称不能为空');
    }
    const id = els.groupFormId.value.trim();
    if (id) {
        await api(`/api/groups/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
        notify('分组已更新');
    } else {
        const result = await api('/api/groups', { method: 'POST', body: JSON.stringify(payload) });
        state.selectedGroupId = result.group_id;
        storeGroupId(state.selectedGroupId);
        notify('分组已创建');
    }
    closeModal(els.groupModal);
    await loadBootstrap();
}

async function editAccount(accountId) {
    const data = await api(`/api/accounts/${accountId}`);
    fillAccountForm(data.account);
    openModal(els.accountModal);
}

async function deleteAccount(accountId) {
    const account = (state.bootstrap?.accounts || []).find((item) => Number(item.id) === Number(accountId));
    const ok = await window.UI.confirm(`确定删除账号 “${account?.email || accountId}” 吗？`, {
        title: '删除账号',
        confirmText: '删除',
        danger: true,
        meta: '删除后该账号将从当前系统移除，邮件缓存不会再继续更新。',
    });
    if (!ok) return;
    await api(`/api/accounts/${accountId}`, { method: 'DELETE', body: '{}' });
    if (account?.email && account.email === state.selectedAccountEmail) {
        state.selectedAccountEmail = null;
        state.selectedMailId = null;
        state.currentEmails = [];
        state.currentMailMethod = '-';
        state.hasMore = false;
        clearStoredAccountEmail();
        clearStoredMailRef();
    }
    state.selectedAccountIds.delete(accountId);
    notify('账号已删除');
    closeModal(els.accountModal);
    await loadBootstrap();
}

async function batchDeleteAccounts() {
    const accountIds = [...state.selectedAccountIds];
    if (!accountIds.length) {
        notify('请先选择账号');
        return;
    }
    const ok = await window.UI.confirm(`确定要删除选中的 ${accountIds.length} 个账号吗？`, { title: '批量删除', confirmText: '删除', danger: true });
    if (!ok) return;
    const result = await api('/api/accounts/batch-delete', { method: 'POST', body: JSON.stringify({ account_ids: accountIds }) });
    const deletedAccounts = (state.bootstrap?.accounts || []).filter((item) => accountIds.includes(item.id));
    if (deletedAccounts.some((item) => item.email === state.selectedAccountEmail)) {
        state.selectedAccountEmail = null;
        state.selectedMailId = null;
        state.currentEmails = [];
        state.currentMailMethod = '-';
        state.hasMore = false;
        clearStoredAccountEmail();
        clearStoredMailRef();
    }
    state.selectedAccountIds.clear();
    notify(result.message || '批量删除完成');
    await loadBootstrap();
}

function openCreateAccountModal() {
    resetAccountForm();
    openModal(els.accountModal);
}

function openImportModal() {
    resetImportModal();
    openModal(els.importModal);
}

function renderExportGroupList() {
    const groups = state.bootstrap?.groups || [];
    if (!groups.length) {
        els.exportGroupList.innerHTML = '<div class="empty-state">暂无可导出分组。</div>';
        return;
    }
    const selectedIds = new Set(
        (state.pendingExportGroupIds?.length ? state.pendingExportGroupIds : [state.selectedGroupId])
            .filter(Boolean)
            .map((item) => Number(item))
    );
    els.exportGroupList.innerHTML = groups.map((group) => `
        <label class="export-group-row">
            <input type="checkbox" class="export-group-checkbox" value="${group.id}" ${selectedIds.has(Number(group.id)) ? 'checked' : ''}>
            <span class="export-group-color" style="background:${escapeHtml(group.color || '#666')}"></span>
            <span class="export-group-name">${escapeHtml(group.name)}</span>
            <span class="export-group-count">${group.account_count || 0}</span>
        </label>
    `).join('');
    const allChecked = groups.length > 0 && [...els.exportGroupList.querySelectorAll('.export-group-checkbox')].every((item) => item.checked);
    els.exportSelectAllGroups.checked = allChecked;
}

function openExportModal() {
    state.pendingExportGroupIds = [];
    state.pendingExportMode = 'minimal';
    renderExportGroupList();
    if (els.exportMode) {
        els.exportMode.value = state.pendingExportMode;
    }
    openModal(els.exportModal);
}

function syncExportSelectAll() {
    const checkboxes = [...els.exportGroupList.querySelectorAll('.export-group-checkbox')];
    els.exportSelectAllGroups.checked = checkboxes.length > 0 && checkboxes.every((checkbox) => checkbox.checked);
}

function toggleExportSelectAll() {
    const checked = Boolean(els.exportSelectAllGroups.checked);
    els.exportGroupList.querySelectorAll('.export-group-checkbox').forEach((checkbox) => {
        checkbox.checked = checked;
    });
}

function collectExportGroupIds() {
    return [...els.exportGroupList.querySelectorAll('.export-group-checkbox:checked')].map((checkbox) => Number(checkbox.value));
}

function beginExportVerification() {
    const groupIds = collectExportGroupIds();
    if (!groupIds.length) {
        throw new Error('请选择要导出的分组');
    }
    state.pendingExportGroupIds = groupIds;
    state.pendingExportMode = els.exportMode?.value || 'minimal';
    closeModal(els.exportModal);
    els.exportVerifyPassword.value = '';
    openModal(els.exportVerifyModal);
    window.setTimeout(() => els.exportVerifyPassword.focus(), 60);
}

async function submitExport() {
    const password = els.exportVerifyPassword.value.trim();
    if (!password) {
        throw new Error('请输入登录密码');
    }
    if (!state.pendingExportGroupIds.length) {
        throw new Error('请选择要导出的分组');
    }

    const verifyData = await api('/api/export/verify', {
        method: 'POST',
        body: JSON.stringify({ password }),
    });

    const response = await fetch('/api/accounts/export-selected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            group_ids: state.pendingExportGroupIds,
            verify_token: verifyData.verify_token,
            export_mode: state.pendingExportMode,
        }),
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `导出失败: ${response.status}`);
    }

    const contentDisposition = response.headers.get('Content-Disposition') || '';
    let filename = state.pendingExportMode === 'full' ? 'tutamail_accounts_full.jsonl' : 'tutamail_accounts.txt';
    const match = contentDisposition.match(/filename\*?=(?:UTF-8'')?([^;\n]+)/i);
    if (match) {
        filename = decodeURIComponent(match[1]);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);

    state.pendingExportGroupIds = [];
    state.pendingExportMode = 'minimal';
    els.exportVerifyPassword.value = '';
    closeModal(els.exportVerifyModal);
    notify('导出成功');
}

function openCreateGroupModal() {
    resetGroupForm();
    openModal(els.groupModal);
}

function openEditGroupModal(groupId) {
    const group = (state.bootstrap?.groups || []).find((item) => Number(item.id) === Number(groupId));
    if (!group) {
        notify('分组不存在');
        return;
    }
    fillGroupForm(group);
    openModal(els.groupModal);
}

async function deleteGroup(groupId) {
    const group = (state.bootstrap?.groups || []).find((item) => Number(item.id) === Number(groupId));
    const ok = await window.UI.confirm(`确认删除分组 “${group?.name || groupId}” 吗？`, {
        title: '删除分组',
        confirmText: '删除',
        danger: true,
        meta: '该分组下的账号会自动迁移到“默认分组”，取件代理映射也会失效。',
    });
    if (!ok) return;
    await api(`/api/groups/${groupId}`, { method: 'DELETE', body: '{}' });
    if (Number(state.selectedGroupId) === Number(groupId)) {
        state.selectedGroupId = 1;
        storeGroupId(state.selectedGroupId);
    }
    notify('分组已删除');
    await loadBootstrap();
}

function selectAllVisibleAccounts() {
    const accounts = currentAccounts();
    if (!accounts.length) return;
    accounts.forEach((account) => {
        state.selectedAccountIds.add(account.id);
    });
    renderAccounts();
}

async function refreshSelectedAccounts() {
    if (!state.selectedAccountIds.size) {
        notify('请先选择账号');
        return;
    }
    const ok = await window.UI.confirm(`将对已选 ${state.selectedAccountIds.size} 个账号再次取件复检，确认状态后再删除，是否继续？`, {
        title: '复检已选账号',
        confirmText: '开始复检',
        meta: '适合先筛出“未认证/会话过期/不存在”等账号，再进行二次确认。',
    });
    if (!ok) return;
    await startMailRefresh('selected');
}

async function refreshAccountStatus(accountId, { refreshMailbox = false } = {}) {
    const account = (state.bootstrap?.accounts || []).find((item) => Number(item.id) === Number(accountId));
    if (!account) throw new Error('账号不存在');
    setAccountActionLoading(accountId, 'refresh-status', true);
    renderAccounts();
    try {
        if (refreshMailbox) {
            await api(`/api/emails/${encodeURIComponent(account.email)}?refresh=1&folder=inbox&skip=0&top=20`);
        } else {
            await api(`/api/accounts/${accountId}/probe-status`, {
                method: 'POST',
                body: '{}',
            });
        }
        await loadBootstrap();
        notify(`${account.email} 状态已更新`);
    } finally {
        setAccountActionLoading(accountId, 'refresh-status', false);
        renderAccounts();
    }
}

async function refreshAccountSession(accountId) {
    const account = (state.bootstrap?.accounts || []).find((item) => Number(item.id) === Number(accountId));
    if (!account) throw new Error('账号不存在');
    setAccountActionLoading(accountId, 'refresh-session', true);
    renderAccounts();
    try {
        const result = await api(`/api/accounts/${accountId}/refresh-session`, {
            method: 'POST',
            body: '{}',
        });
        await loadBootstrap();
        notify(result.message || `${account.email} session 已刷新`);
    } finally {
        setAccountActionLoading(accountId, 'refresh-session', false);
        renderAccounts();
    }
}

async function refreshSelectedStatuses() {
    const accountIds = [...state.selectedAccountIds];
    if (!accountIds.length) {
        notify('请先选择账号');
        return;
    }
    const ok = await window.UI.confirm(`将对已选 ${accountIds.length} 个账号执行状态复检，确认继续？`, {
        title: '刷新账号状态',
        confirmText: '开始刷新',
        meta: '只校验账号当前登录状态，不会删除账号。',
    });
    if (!ok) return;

    let success = 0;
    let failed = 0;
    for (const accountId of accountIds) {
        try {
            await refreshAccountStatus(accountId);
            success += 1;
        } catch (error) {
            failed += 1;
            notify(error.message || String(error));
        }
    }
    notify(`状态刷新完成：成功 ${success}，失败 ${failed}`);
}

function exportFilteredAccounts() {
    const accounts = currentAccounts();
    if (!accounts.length) {
        notify('当前筛选结果为空');
        return;
    }
    const lines = accounts.map((account) => [
        account.email || '',
        account.fetch_status_label || '',
        account.last_official_error || '',
        account.last_http_status || '',
        account.last_fetch_step || '',
        (account.last_error || '').replace(/[\r\n]+/g, ' ').trim(),
    ].join('----'));
    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    const filename = `tutamail_filtered_accounts_${state.accountStatusFilter || 'all'}_${stamp}.txt`;
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
    notify(`已导出 ${accounts.length} 个账号`);
}

function clearSelectedAccounts() {
    state.selectedAccountIds.clear();
    renderAccounts();
}

function restoreAccountMailbox(email) {
    const cache = getMailCache(email);
    storeAccountEmail(email);
    state.selectedMailId = null;
    state.currentMailMethod = cache?.method || '-';
    state.hasMore = Boolean(cache?.hasMore);
    state.mailSkip = cache?.skip || 0;
    state.currentEmails = cache?.emails ? [...cache.emails] : [];

    if (state.currentEmails.length) {
        setMailListPlaceholder('请选择一封邮件', '已恢复上次获取的邮件列表，点击任意邮件查看详情。');
    } else {
        setMailListPlaceholder('等待获取邮件', `${email} 已选中，点击“获取邮件”拉取收件箱。`);
    }
    setMailDetailPlaceholder('请选择一封邮件查看正文', '切换邮箱后，正文区域会等待新的邮件选择。');
    renderAccounts();
    renderMailList();
    updateCurrentAccountLabel();
    updateMailMethodLabel();
    updateMailSummaryBar();
    updateMailButtons();
    restoreSelectedMailForCurrentAccount();
}

async function hydratePersistedMailbox(email) {
    const requestSeq = ++state.mailRequestSeq;
    state.isLoadingMails = true;
    setMailListPlaceholder('正在恢复缓存邮件', `${email} 的本地缓存正在加载。`, true);
    updateCurrentAccountLabel();
    updateMailSummaryBar();
    updateMailButtons();

    try {
        const data = await api(`/api/emails/${encodeURIComponent(email)}?folder=inbox&skip=0&top=20&refresh=0`);
        if (requestSeq !== state.mailRequestSeq || state.selectedAccountEmail !== email) return;
        if (!data.has_cache || !(data.emails || []).length) {
            state.currentEmails = [];
            state.currentMailMethod = '-';
            state.hasMore = false;
            state.mailSkip = 0;
            setMailListPlaceholder('等待获取邮件', `${email} 当前没有可恢复的缓存，请点击“获取邮件”。`);
            setMailDetailPlaceholder('请选择一封邮件查看正文', '拉取到邮件后，再从左侧选择查看。');
            return;
        }

        state.currentEmails = data.emails || [];
        state.currentMailMethod = data.method || '-';
        state.hasMore = Boolean(data.has_more);
        state.mailSkip = state.currentEmails.length;
        setMailCache(email, {
            emails: [...state.currentEmails],
            hasMore: state.hasMore,
            skip: state.mailSkip,
            method: state.currentMailMethod,
            fetchedAt: new Date().toISOString(),
            details: {},
        });
        setMailListPlaceholder('请选择一封邮件', '已恢复上次缓存的邮件列表，点击任意邮件查看详情。');
        setMailDetailPlaceholder('请选择一封邮件查看正文', '缓存已恢复，请从左侧选择邮件。');
        renderMailList();
        updateMailMethodLabel();
        await restoreSelectedMailForCurrentAccount();
    } catch (_error) {
        if (requestSeq !== state.mailRequestSeq || state.selectedAccountEmail !== email) return;
        setMailListPlaceholder('等待获取邮件', `${email} 缓存恢复失败，请点击“获取邮件”重试。`);
    } finally {
        if (requestSeq !== state.mailRequestSeq || state.selectedAccountEmail !== email) return;
        state.isLoadingMails = false;
        updateCurrentAccountLabel();
        updateMailSummaryBar();
        updateMailButtons();
    }
}

els.groupList.addEventListener('click', async (event) => {
    const actionButton = event.target.closest('button[data-action]');
    if (actionButton) {
        event.stopPropagation();
        const id = Number(actionButton.dataset.id);
        try {
            if (actionButton.dataset.action === 'edit-group') openEditGroupModal(id);
            if (actionButton.dataset.action === 'delete-group') await deleteGroup(id);
        } catch (error) {
            notify(error.message || String(error));
        }
        return;
    }

    const item = event.target.closest('[data-group-id]');
    if (!item) return;
    state.selectedGroupId = Number(item.dataset.groupId);
    storeGroupId(state.selectedGroupId);
    trimSelectedAccountsToVisible();
    resetHiddenAccountContext();
    renderGroups();
    renderAccounts();
    renderGroupOptions(els.importGroupSelect, state.selectedGroupId);
    renderGroupOptions(els.accountGroupId, state.selectedGroupId);
    updateCurrentGroupIndicator();
    updateCurrentAccountLabel();
    updateMailMethodLabel();
    updateMailSummaryBar();
    updateMailButtons();
    updateMailRefreshButtons();
});

els.accountList.addEventListener('click', async (event) => {
    const checkbox = event.target.closest('.account-select-checkbox');
    if (checkbox) {
        event.stopPropagation();
        const accountId = Number(checkbox.dataset.accountId);
        if (checkbox.checked) state.selectedAccountIds.add(accountId);
        else state.selectedAccountIds.delete(accountId);
        updateBatchBar();
        return;
    }

    const actionButton = event.target.closest('button[data-action]');
    if (actionButton) {
        event.stopPropagation();
        const id = Number(actionButton.dataset.id);
        try {
            if (actionButton.dataset.action === 'edit-account') await editAccount(id);
            if (actionButton.dataset.action === 'delete-account') await deleteAccount(id);
            if (actionButton.dataset.action === 'refresh-account-status') await refreshAccountStatus(id);
            if (actionButton.dataset.action === 'refresh-account-session') await refreshAccountSession(id);
        } catch (error) {
            notify(error.message || String(error));
        }
        return;
    }

    const item = event.target.closest('[data-account-email]');
    if (!item) return;
    state.selectedAccountEmail = item.dataset.accountEmail;
    restoreAccountMailbox(state.selectedAccountEmail);
    if (!getMailCache(state.selectedAccountEmail)) {
        hydratePersistedMailbox(state.selectedAccountEmail).catch(() => {});
    }
});

els.mailList.addEventListener('click', async (event) => {
    const item = event.target.closest('[data-mail-id]');
    if (!item) return;
    try {
        await loadMailDetail(item.dataset.mailId);
    } catch (error) {
        notify(error.message || String(error));
    }
});

els.accountSearch.addEventListener('input', (event) => {
    state.accountKeyword = event.target.value.trim();
    trimSelectedAccountsToVisible();
    resetHiddenAccountContext();
    renderAccounts();
    updateCurrentAccountLabel();
    updateMailMethodLabel();
    updateMailSummaryBar();
    updateMailButtons();
});

els.accountStatusFilter?.addEventListener('change', (event) => {
    applyAccountStatusFilter(event.target.value || 'all');
});

els.accountSummaryRow?.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-summary-filter]');
    if (!chip) return;
    applyAccountStatusFilter(chip.dataset.summaryFilter || 'all');
});

els.toggleRevokedFilterBtn?.addEventListener('click', () => {
    const next = (state.accountStatusFilter || 'all') === 'account_exists_but_login_revoked'
        ? 'all'
        : 'account_exists_but_login_revoked';
    applyAccountStatusFilter(next);
});

els.exportFilteredAccountsBtn?.addEventListener('click', exportFilteredAccounts);

els.currentAccountBanner?.addEventListener('click', async () => {
    const email = state.selectedAccountEmail;
    if (!email) return;
    try {
        await navigator.clipboard.writeText(email);
        notify(`已复制邮箱：${email}`);
    } catch (_error) {
        notify('复制失败，请检查浏览器权限');
    }
});

els.groupColorPicker?.addEventListener('click', (event) => {
    const option = event.target.closest('.color-option');
    if (!option) return;
    applyGroupColorSelection(option.dataset.color);
});

els.groupCustomColorInput?.addEventListener('input', (event) => {
    applyGroupColorSelection(event.target.value);
});

els.groupColor?.addEventListener('change', (event) => {
    applyGroupColorSelection(event.target.value);
});

els.addGroupBtn.addEventListener('click', openCreateGroupModal);
els.addAccountBtn.addEventListener('click', openCreateAccountModal);
els.importAccountBtn.addEventListener('click', openImportModal);
els.importAccountBtnSecondary?.addEventListener('click', openImportModal);
els.accountFooterImportBtn?.addEventListener('click', openImportModal);
els.exportAccountBtn.addEventListener('click', openExportModal);
els.exportAccountBtnSecondary?.addEventListener('click', openExportModal);
els.refreshGroupMailsBtn?.addEventListener('click', () => startMailRefresh('group').catch((error) => notify(error.message || String(error))));
els.refreshAllMailsBtn?.addEventListener('click', () => startMailRefresh('all').catch((error) => notify(error.message || String(error))));
els.cancelMailRefreshBtn?.addEventListener('click', () => cancelMailRefreshTask().catch((error) => notify(error.message || String(error))));
els.selectAllAccountsBtn.addEventListener('click', selectAllVisibleAccounts);
els.clearAccountSelectionBtn.addEventListener('click', clearSelectedAccounts);
els.refreshSelectedStatusBtn?.addEventListener('click', () => refreshSelectedStatuses().catch((error) => notify(error.message || String(error))));
els.refreshSelectedMailsBtn?.addEventListener('click', () => refreshSelectedAccounts().catch((error) => notify(error.message || String(error))));
els.batchDeleteAccountsBtn.addEventListener('click', () => batchDeleteAccounts().catch((error) => notify(error.message || String(error))));
els.refreshMailsBtn.addEventListener('click', () => loadEmails(true, true).catch((error) => notify(error.message || String(error))));
els.loadMoreMailsBtn.addEventListener('click', () => loadEmails(false, true).catch((error) => notify(error.message || String(error))));
els.clearAccountImportBtn.addEventListener('click', resetImportModal);
els.submitAccountImportBtn.addEventListener('click', () => submitAccountImport().catch((error) => notify(error.message || String(error))));
els.confirmExportGroupsBtn.addEventListener('click', () => {
    try {
        beginExportVerification();
    } catch (error) {
        notify(error.message || String(error));
    }
});
els.exportSelectAllGroups?.addEventListener('change', toggleExportSelectAll);
els.exportGroupList?.addEventListener('change', (event) => {
    if (event.target.closest('.export-group-checkbox')) {
        syncExportSelectAll();
    }
});
els.submitExportBtn?.addEventListener('click', () => submitExport().catch((error) => notify(error.message || String(error))));
els.exportVerifyPassword?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        submitExport().catch((error) => notify(error.message || String(error)));
    }
});
els.saveAccountBtn.addEventListener('click', () => saveAccount().catch((error) => notify(error.message || String(error))));
els.deleteAccountFromModalBtn.addEventListener('click', () => {
    if (state.editingAccountId) {
        deleteAccount(state.editingAccountId).catch((error) => notify(error.message || String(error)));
    }
});
els.saveGroupBtn.addEventListener('click', () => saveGroup().catch((error) => notify(error.message || String(error))));

document.querySelectorAll('[data-close-modal]').forEach((button) => {
    button.addEventListener('click', () => {
        const modal = document.getElementById(button.dataset.closeModal);
        if (modal) closeModal(modal);
    });
});

document.querySelectorAll('.modal').forEach((modal) => {
    modal.addEventListener('click', (event) => {
        if (event.target === modal) closeModal(modal);
    });
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(closeModal);
    }
});

updateMailButtons();
updateMailSummaryBar();
updateMailRefreshButtons();
setMailListPlaceholder('请先选择一个邮箱账号', '选择左侧账号后，再点击“获取邮件”拉取收件箱。');
setMailDetailPlaceholder('请选择一封邮件查看正文', '选中邮件后，这里会显示完整正文与元信息。');
loadBootstrap().catch((error) => notify(error.message || String(error)));
