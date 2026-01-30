/**
 * Modal Module - Handles modal dialogs
 */

const Modal = {
    overlay: null,
    modal: null,
    title: null,
    body: null,
    footer: null,
    closeBtn: null,
    cancelBtn: null,
    saveBtn: null,
    currentCallback: null,

    /**
     * Initialize modal elements
     */
    init() {
        this.overlay = document.getElementById('modalOverlay');
        this.modal = document.getElementById('modal');
        this.title = document.getElementById('modalTitle');
        this.body = document.getElementById('modalBody');
        this.footer = document.getElementById('modalFooter');
        this.closeBtn = document.getElementById('modalClose');
        this.cancelBtn = document.getElementById('btnModalCancel');
        this.saveBtn = document.getElementById('btnModalSave');

        // Event listeners
        this.closeBtn.addEventListener('click', () => this.close());
        this.cancelBtn.addEventListener('click', () => this.close());
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.overlay.classList.contains('active')) {
                this.close();
            }
        });
    },

    /**
     * Open modal with content
     * @param {Object} options - Modal options
     */
    open(options = {}) {
        const {
            title = 'Modal',
            content = '',
            saveText = 'Simpan',
            cancelText = 'Batal',
            onSave = null,
            onOpen = null,
            showFooter = true,
            size = 'default'
        } = options;

        this.title.textContent = title;
        this.body.innerHTML = content;
        this.saveBtn.textContent = saveText;
        this.cancelBtn.textContent = cancelText;
        this.currentCallback = onSave;

        // Footer visibility
        this.footer.style.display = showFooter ? 'flex' : 'none';

        // Size
        if (size === 'full') {
            this.modal.style.maxWidth = '95%';
            this.modal.style.width = '95%';
        } else {
            this.modal.style.maxWidth = size === 'large' ? '800px' : size === 'small' ? '400px' : '600px';
            this.modal.style.width = '';
        }

        // Save button handler
        this.saveBtn.onclick = () => {
            if (this.currentCallback) {
                const formData = this.getFormData();
                if (this.currentCallback(formData)) {
                    this.close();
                }
            } else {
                this.close();
            }
        };

        // Show modal
        this.overlay.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Focus first input and call onOpen callback
        setTimeout(() => {
            const firstInput = this.body.querySelector('input, select, textarea');
            if (firstInput) firstInput.focus();

            // Call onOpen callback if provided
            if (onOpen && typeof onOpen === 'function') {
                onOpen();
            }
        }, 100);
    },

    /**
     * Close modal
     */
    close() {
        this.overlay.classList.remove('active');
        document.body.style.overflow = '';
        this.currentCallback = null;
    },

    /**
     * Get form data from modal body
     * @returns {Object} - Form data as key-value pairs
     */
    getFormData() {
        const formData = {};
        const inputs = this.body.querySelectorAll('input, select, textarea');

        inputs.forEach(input => {
            if (input.name) {
                if (input.type === 'checkbox') {
                    formData[input.name] = input.checked;
                } else if (input.type === 'file') {
                    formData[input.name] = input.files;
                } else {
                    formData[input.name] = input.value;
                }
            }
        });

        return formData;
    },

    /**
     * Validate form fields
     * @param {Array} requiredFields - Array of required field names
     * @returns {boolean} - True if valid
     */
    validateForm(requiredFields = []) {
        let isValid = true;

        requiredFields.forEach(fieldName => {
            const input = this.body.querySelector(`[name="${fieldName}"]`);
            if (input) {
                const value = input.value.trim();
                if (!value) {
                    isValid = false;
                    input.style.borderColor = 'var(--danger)';
                    input.addEventListener('input', function handler() {
                        this.style.borderColor = '';
                        this.removeEventListener('input', handler);
                    });
                }
            }
        });

        return isValid;
    },

    /**
     * Show confirmation dialog
     * @param {Object} options - Confirmation options
     * @returns {Promise} - Resolves with true/false
     */
    confirm(options = {}) {
        return new Promise((resolve) => {
            const {
                title = 'Konfirmasi',
                message = 'Apakah Anda yakin?',
                confirmText = 'Ya',
                cancelText = 'Batal',
                type = 'warning'
            } = options;

            const icons = {
                warning: '⚠️',
                danger: '🗑️',
                info: 'ℹ️',
                success: '✅'
            };

            const content = `
                <div class="confirm-dialog">
                    <div class="confirm-icon">${icons[type] || icons.warning}</div>
                    <p class="confirm-message">${message}</p>
                </div>
                <style>
                    .confirm-dialog {
                        text-align: center;
                        padding: var(--spacing-lg);
                    }
                    .confirm-icon {
                        font-size: 3rem;
                        margin-bottom: var(--spacing-md);
                    }
                    .confirm-message {
                        color: var(--text-secondary);
                        font-size: 1rem;
                    }
                </style>
            `;

            this.open({
                title,
                content,
                saveText: confirmText,
                cancelText,
                onSave: () => {
                    resolve(true);
                    return true;
                }
            });

            // Override close to resolve false
            const originalClose = this.close.bind(this);
            this.close = () => {
                originalClose();
                this.close = originalClose;
                resolve(false);
            };
        });
    }
};

// Initialize modal when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    Modal.init();
});
