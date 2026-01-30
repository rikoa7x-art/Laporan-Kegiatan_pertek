/**
 * Toast Notification Module
 */
const Toast = {
    container: null,

    /**
     * Initialize toast container
     */
    init() {
        this.container = document.getElementById('toastContainer');
    },

    /**
     * Show a toast notification
     * @param {string} message - Message to display
     * @param {string} type - Toast type: success, error, warning, info
     * @param {number} duration - Duration in milliseconds
     */
    show(message, type = 'info', duration = 3000) {
        if (!this.container) this.init();

        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;

        this.container.appendChild(toast);

        // Auto remove after duration
        setTimeout(() => {
            if (toast.parentElement) {
                toast.style.animation = 'slideIn var(--transition-normal) reverse';
                setTimeout(() => toast.remove(), 250);
            }
        }, duration);
    }
};

/**
 * Main Application Module
 */
const App = {
    currentPage: 'dashboard',
    currentUser: null,

    /**
     * Initialize the application
     */
    init() {
        // Initialize Toast
        Toast.init();

        // Initialize all modules
        Dashboard.init();
        RencanaBulanan.init();
        RencanaMingguan.init();
        Laporan.init();
        Pekerjaan.init();
        Evaluasi.init();
        LaporanDireksi.init();
        Pekerja.init();

        // Setup user selector
        this.setupUserSelector();

        // Setup navigation
        this.setupNavigation();

        // Setup sidebar toggle
        this.setupSidebar();

        // Check for saved user
        this.loadSavedUser();

        // Listen for hash changes
        window.addEventListener('hashchange', () => this.handleHashChange());

        console.log('📊 Laporan Kegiatan Pertek - Initialized');
    },

    /**
     * Setup user selector
     */
    setupUserSelector() {
        const selector = document.getElementById('userSelector');
        const pekerja = Storage.get(Storage.KEYS.PEKERJA);

        // Group pekerja by role
        const roleOrder = ['manager', 'asman_sipil', 'asman_perpipaan', 'surveyor', 'estimator', 'drafter', 'wasdal'];

        pekerja.sort((a, b) => {
            return roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role);
        });

        selector.innerHTML = '<option value="">Pilih User...</option>' +
            pekerja.map(p => `<option value="${p.id}">${p.nama} - ${Utils.getRoleDisplay(p.role)}</option>`).join('');

        selector.addEventListener('change', () => {
            const userId = selector.value;
            if (userId) {
                const user = pekerja.find(p => p.id === userId);
                this.setCurrentUser(user);
            } else {
                this.clearCurrentUser();
            }
        });
    },

    /**
     * Load saved user from localStorage
     */
    loadSavedUser() {
        const savedUserId = localStorage.getItem('pertek_current_user');
        if (savedUserId) {
            const pekerja = Storage.get(Storage.KEYS.PEKERJA);
            const user = pekerja.find(p => p.id === savedUserId);
            if (user) {
                document.getElementById('userSelector').value = savedUserId;
                this.setCurrentUser(user);
                return;
            }
        }
        // No saved user, show all menu hidden state
        this.updateMenuVisibility(null);
    },

    /**
     * Set current user and update UI
     */
    setCurrentUser(user) {
        this.currentUser = user;
        localStorage.setItem('pertek_current_user', user.id);
        this.updateMenuVisibility(user.role);

        // Navigate to appropriate default page
        const isManagement = ['manager', 'asman_sipil', 'asman_perpipaan'].includes(user.role);
        const defaultPage = isManagement ? 'dashboard' : 'daftar-pekerjaan';

        this.navigateTo(defaultPage);
        Toast.show(`Login sebagai ${user.nama}`, 'success');
    },

    /**
     * Clear current user
     */
    clearCurrentUser() {
        this.currentUser = null;
        localStorage.removeItem('pertek_current_user');
        this.updateMenuVisibility(null);
    },

    /**
     * Update menu visibility based on role
     */
    updateMenuVisibility(role) {
        const navItems = document.querySelectorAll('.nav-item');

        navItems.forEach(item => {
            const allowedRoles = item.dataset.roles;
            if (!allowedRoles) {
                item.style.display = '';
                return;
            }

            if (!role) {
                // No user logged in, hide role-specific items
                item.style.display = 'none';
                return;
            }

            if (allowedRoles === 'all') {
                item.style.display = '';
            } else {
                const roles = allowedRoles.split(',');
                item.style.display = roles.includes(role) ? '' : 'none';
            }
        });
    },

    /**
     * Check if current user can access a page
     */
    canAccessPage(page) {
        if (!this.currentUser) return false;

        const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
        if (!navItem) return false;

        const allowedRoles = navItem.dataset.roles;
        if (allowedRoles === 'all') return true;

        const roles = allowedRoles.split(',');
        return roles.includes(this.currentUser.role);
    },

    /**
     * Setup navigation event listeners
     */
    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');

        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                this.navigateTo(page);
            });
        });
    },

    /**
     * Setup sidebar toggle
     */
    setupSidebar() {
        const sidebar = document.getElementById('sidebar');
        const sidebarToggle = document.getElementById('sidebarToggle');
        const menuToggle = document.getElementById('menuToggle');

        // Desktop toggle
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });

        // Mobile toggle
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });

        // Close sidebar on mobile when clicking outside
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 1024) {
                if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                    sidebar.classList.remove('open');
                }
            }
        });
    },

    /**
     * Navigate to a page
     * @param {string} page - Page name
     */
    navigateTo(page) {
        if (!this.currentUser) {
            Toast.show('Silakan pilih user terlebih dahulu', 'warning');
            return;
        }

        if (!this.canAccessPage(page)) {
            Toast.show('Anda tidak memiliki akses ke halaman ini', 'error');
            return;
        }

        window.location.hash = page;
        this.showPage(page);
    },

    /**
     * Handle hash changes for navigation
     */
    handleHashChange() {
        const hash = window.location.hash.slice(1);
        if (hash && this.currentUser && this.canAccessPage(hash)) {
            this.showPage(hash);
        }
    },

    /**
     * Show a specific page
     * @param {string} page - Page name
     */
    showPage(page) {
        // Update nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });

        // Update pages
        document.querySelectorAll('.page').forEach(p => {
            p.classList.toggle('active', p.id === `page-${page}`);
        });

        // Update page title
        const titles = {
            'dashboard': 'Dashboard',
            'rencana-bulanan': 'Rencana Kerja Bulanan',
            'rencana-mingguan': 'Rencana Kerja Mingguan',
            'input-laporan': 'Input Laporan Harian',
            'daftar-pekerjaan': 'Daftar Pekerjaan',
            'evaluasi': 'Evaluasi Mingguan',
            'laporan-direksi': 'Laporan untuk Direksi',
            'pekerja': 'Data Pekerja'
        };
        document.getElementById('pageTitle').textContent = titles[page] || 'Dashboard';

        // Refresh page data
        this.refreshPage(page);

        // Close mobile sidebar
        document.getElementById('sidebar').classList.remove('open');

        this.currentPage = page;
    },

    /**
     * Refresh page data
     * @param {string} page - Page name
     */
    refreshPage(page) {
        switch (page) {
            case 'dashboard':
                Dashboard.refresh();
                break;
            case 'rencana-bulanan':
                RencanaBulanan.render();
                break;
            case 'rencana-mingguan':
                RencanaMingguan.render();
                RencanaMingguan.populateFilters();
                break;
            case 'input-laporan':
                Laporan.render();
                break;
            case 'daftar-pekerjaan':
                Pekerjaan.render();
                break;
            case 'evaluasi':
                Evaluasi.render();
                break;
            case 'laporan-direksi':
                LaporanDireksi.render();
                break;
            case 'pekerja':
                Pekerja.render();
                break;
        }
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
