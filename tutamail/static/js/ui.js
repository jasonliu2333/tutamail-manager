(() => {
    const state = {
        toastContainer: null,
        confirmModal: null,
        confirmTitle: null,
        confirmMessage: null,
        confirmMeta: null,
        confirmCancel: null,
        confirmOk: null,
        resolver: null,
    };

    const ICONS = {
        success: '✓',
        error: '!',
        warning: '!',
        info: 'i',
    };

    function ensureToastContainer() {
        if (state.toastContainer) return state.toastContainer;
        const container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
        state.toastContainer = container;
        return container;
    }

    function ensureConfirmModal() {
        if (state.confirmModal) return state.confirmModal;
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'app-confirm-modal';
        modal.innerHTML = `
            <div class="modal-content narrow">
                <div class="modal-header">
                    <h3 id="app-confirm-title">请确认</h3>
                    <button class="modal-close" id="app-confirm-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="confirm-copy" id="app-confirm-message"></div>
                    <div class="confirm-meta hidden" id="app-confirm-meta"></div>
                </div>
                <div class="modal-footer">
                    <button class="btn secondary" id="app-confirm-cancel">取消</button>
                    <button class="btn primary" id="app-confirm-ok">确定</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        state.confirmModal = modal;
        state.confirmTitle = modal.querySelector('#app-confirm-title');
        state.confirmMessage = modal.querySelector('#app-confirm-message');
        state.confirmMeta = modal.querySelector('#app-confirm-meta');
        state.confirmCancel = modal.querySelector('#app-confirm-cancel');
        state.confirmOk = modal.querySelector('#app-confirm-ok');

        const cancel = () => resolveConfirm(false);
        modal.addEventListener('click', (event) => {
            if (event.target === modal) cancel();
        });
        modal.querySelector('#app-confirm-close').addEventListener('click', cancel);
        state.confirmCancel.addEventListener('click', cancel);
        state.confirmOk.addEventListener('click', () => resolveConfirm(true));

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && modal.classList.contains('active')) {
                cancel();
            }
        });

        return modal;
    }

    function resolveConfirm(value) {
        if (!state.confirmModal || !state.confirmModal.classList.contains('active')) return;
        state.confirmModal.classList.remove('active');
        const resolver = state.resolver;
        state.resolver = null;
        if (resolver) resolver(value);
    }

    function toast(message, type = 'info', title = '', options = {}) {
        const container = ensureToastContainer();
        const item = document.createElement('div');
        item.className = `toast ${type}`;
        const titleText = title || ({
            success: '成功',
            error: '错误',
            warning: '提示',
            info: '消息',
        }[type] || '消息');
        item.innerHTML = `
            <div class="toast-icon">${ICONS[type] || 'i'}</div>
            <div>
                <div class="toast-title">${titleText}</div>
                <div class="toast-message"></div>
            </div>
            <button class="toast-close" aria-label="关闭">&times;</button>
        `;
        item.querySelector('.toast-message').textContent = message;
        const remove = () => {
            item.style.opacity = '0';
            item.style.transform = 'translateY(-6px)';
            window.setTimeout(() => item.remove(), 180);
        };
        item.querySelector('.toast-close').addEventListener('click', remove);
        container.appendChild(item);
        const duration = options.duration ?? (type === 'error' ? 4200 : 2600);
        window.setTimeout(remove, duration);
    }

    function confirmDialog(message, options = {}) {
        ensureConfirmModal();
        state.confirmTitle.textContent = options.title || '请确认';
        state.confirmMessage.innerHTML = options.html ? message : '';
        if (!options.html) {
            state.confirmMessage.textContent = message;
        }
        const meta = options.meta || '';
        if (meta) {
            state.confirmMeta.textContent = meta;
            state.confirmMeta.classList.remove('hidden');
        } else {
            state.confirmMeta.textContent = '';
            state.confirmMeta.classList.add('hidden');
        }
        state.confirmCancel.textContent = options.cancelText || '取消';
        state.confirmOk.textContent = options.confirmText || '确定';
        state.confirmOk.className = `btn ${options.danger ? 'danger' : 'primary'}`;
        state.confirmModal.classList.add('active');
        return new Promise((resolve) => {
            state.resolver = resolve;
        });
    }

    window.UI = {
        toast,
        confirm: confirmDialog,
    };
})();
