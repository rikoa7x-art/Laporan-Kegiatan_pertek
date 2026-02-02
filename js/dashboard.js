/**
 * Dashboard Module - Handles dashboard page functionality
 */

const Dashboard = {
    /**
     * Initialize dashboard
     */
    init() {
        this.updateStats();
        this.renderProgressCards();
        this.renderActivityList();
        this.updateCurrentDate();
    },

    /**
     * Update current date display
     */
    updateCurrentDate() {
        const dateElement = document.getElementById('currentDate');
        if (dateElement) {
            dateElement.textContent = Utils.formatDate(new Date(), {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
        }
    },

    /**
     * Update statistics cards
     */
    updateStats() {
        const rencanaBulanan = Storage.get(Storage.KEYS.RENCANA_BULANAN);
        const rencanaMingguan = Storage.get(Storage.KEYS.RENCANA_MINGGUAN);
        const tugas = Storage.get(Storage.KEYS.TUGAS);
        const pekerja = Storage.get(Storage.KEYS.PEKERJA);

        document.getElementById('statRencanaBulanan').textContent = rencanaBulanan.length;
        document.getElementById('statRencanaMingguan').textContent = rencanaMingguan.length;
        document.getElementById('statTugas').textContent = tugas.length;
        document.getElementById('statPekerja').textContent = pekerja.length;
    },

    /**
     * Render progress cards
     */
    renderProgressCards() {
        const container = document.getElementById('progressCards');
        const rencanaMingguan = Storage.get(Storage.KEYS.RENCANA_MINGGUAN);
        const tugas = Storage.get(Storage.KEYS.TUGAS);
        const laporan = Storage.get(Storage.KEYS.LAPORAN_HARIAN);

        if (rencanaMingguan.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📊</span>
                    <p>Belum ada data progress</p>
                </div>
            `;
            return;
        }

        // Get last 4 weekly plans
        const recentPlans = rencanaMingguan.slice(-4).reverse();

        container.innerHTML = recentPlans.map(plan => {
            const planTugas = tugas.filter(t => t.rencanaMingguan === plan.id);
            const completedTugas = planTugas.filter(t => t.status === 'selesai').length;
            const totalTugas = planTugas.length;
            const progress = Utils.calculatePercentage(completedTugas, totalTugas);

            return `
                <div class="progress-card">
                    <div class="progress-header">
                        <span class="progress-title">Minggu ke-${plan.mingguKe}</span>
                        <span class="progress-badge ${plan.kategori}">${Utils.getCategoryDisplay(plan.kategori)}</span>
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar" style="width: ${progress}%"></div>
                    </div>
                    <div class="progress-stats">
                        <span>${completedTugas}/${totalTugas} tugas selesai</span>
                        <span>${progress}%</span>
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * Render recent activity list
     */
    renderActivityList() {
        const container = document.getElementById('activityList');
        const laporan = Storage.get(Storage.KEYS.LAPORAN_HARIAN);

        if (laporan.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📝</span>
                    <p>Belum ada aktivitas</p>
                </div>
            `;
            return;
        }

        // Get last 10 reports
        const recentLaporan = laporan.slice(-10).reverse();
        const pekerja = Storage.get(Storage.KEYS.PEKERJA);
        const tugas = Storage.get(Storage.KEYS.TUGAS);

        container.innerHTML = recentLaporan.map(lap => {
            const surveyor = pekerja.find(p => p.id === lap.surveyorId);
            const task = tugas.find(t => t.id === lap.tugasId);

            const icons = {
                sipil: '🏗️',
                perpipaan: '🔧',
                pengawasan: '👁️'
            };

            return `
                <div class="activity-item">
                    <div class="activity-icon">${icons[lap.kategori] || '📝'}</div>
                    <div class="activity-content">
                        <div class="activity-title">${Utils.escapeHtml(task?.namaTugas || 'Tugas tidak ditemukan')}</div>
                        <div class="activity-meta">
                            ${surveyor ? surveyor.nama : 'Unknown'} • ${Utils.formatDateShort(lap.tanggal)} • Progress: ${lap.progress}%
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * Refresh dashboard data
     */
    refresh() {
        this.updateStats();
        this.renderProgressCards();
        this.renderActivityList();
    }
};
