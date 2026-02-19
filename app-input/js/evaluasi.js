/**
 * Evaluasi Module - Handles weekly evaluations
 */

const Evaluasi = {
    /**
     * Initialize module
     */
    init() {
        this.render();
        this.bindEvents();
    },

    /**
     * Bind event listeners
     */
    bindEvents() {
        document.getElementById('btnAddEvaluasi').addEventListener('click', () => {
            this.showForm();
        });
    },

    /**
     * Render evaluation cards
     */
    render() {
        const container = document.getElementById('evaluationCards');
        const evaluasi = Storage.get(Storage.KEYS.EVALUASI);

        if (evaluasi.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📊</span>
                    <p>Belum ada evaluasi mingguan</p>
                </div>
            `;
            return;
        }

        const rencanaMingguan = Storage.get(Storage.KEYS.RENCANA_MINGGUAN);
        const tugas = Storage.get(Storage.KEYS.TUGAS);
        const laporan = Storage.get(Storage.KEYS.LAPORAN_HARIAN);

        container.innerHTML = evaluasi.map(item => {
            const rencana = rencanaMingguan.find(r => r.id === item.rencanaMingguan);
            const itemTugas = tugas.filter(t => t.rencanaMingguan === item.rencanaMingguan);
            const completedTugas = itemTugas.filter(t => t.status === 'selesai').length;
            const totalTugas = itemTugas.length;
            const progress = Utils.calculatePercentage(completedTugas, totalTugas);
            const scoreClass = item.skorCapaian >= 90 ? 'high' : item.skorCapaian >= 70 ? 'medium' : 'low';

            return `
                <div class="evaluation-card">
                    <div class="evaluation-header">
                        <div>
                            <div class="evaluation-title">Minggu ke-${rencana?.mingguKe || '?'}</div>
                            <span class="text-muted" style="font-size: 0.75rem;">
                                ${rencana ? Utils.formatDateShort(rencana.tanggalMulai) + ' - ' + Utils.formatDateShort(rencana.tanggalSelesai) : '-'}
                            </span>
                        </div>
                        <div class="evaluation-score ${scoreClass}">${item.skorCapaian}%</div>
                    </div>
                    <div class="evaluation-body">
                        <div class="evaluation-stat">
                            <span class="evaluation-stat-label">Total Tugas</span>
                            <span>${totalTugas}</span>
                        </div>
                        <div class="evaluation-stat">
                            <span class="evaluation-stat-label">Selesai</span>
                            <span>${completedTugas}</span>
                        </div>
                        <div class="evaluation-stat">
                            <span class="evaluation-stat-label">Progress Aktual</span>
                            <span>${progress}%</span>
                        </div>
                        <div class="evaluation-stat">
                            <span class="evaluation-stat-label">Status</span>
                            <span class="status-badge ${item.status}">${Utils.getStatusDisplay(item.status)}</span>
                        </div>
                        
                        ${item.catatan ? `
                            <div style="margin-top: var(--spacing-md); padding-top: var(--spacing-md); border-top: 1px solid var(--border-color);">
                                <span class="text-muted" style="font-size: 0.75rem;">Catatan Evaluasi:</span>
                                <p style="font-size: 0.875rem; margin-top: var(--spacing-xs);">${Utils.escapeHtml(item.catatan)}</p>
                            </div>
                        ` : ''}

                        <div class="action-buttons" style="margin-top: var(--spacing-md);">
                            <button class="btn btn-secondary btn-sm" onclick="Evaluasi.showForm('${item.id}')">✏️ Edit</button>
                            <button class="btn btn-primary btn-sm" onclick="Evaluasi.generateReport('${item.id}')">📄 Laporan Direksi</button>
                            <button class="btn btn-danger btn-sm" onclick="Evaluasi.delete('${item.id}')">🗑️ Hapus</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * Show add/edit form
     * @param {string} id - Item ID for editing (optional)
     */
    showForm(id = null) {
        const item = id ? Storage.findById(Storage.KEYS.EVALUASI, id) : null;
        const isEdit = !!item;

        const rencanaOptions = RencanaMingguan.getOptions().map(opt =>
            `<option value="${opt.value}" ${item?.rencanaMingguan === opt.value ? 'selected' : ''}>${opt.label}</option>`
        ).join('');

        const content = `
            <form id="formEvaluasi">
                <div class="form-group">
                    <label class="form-label">Rencana Mingguan</label>
                    <select name="rencanaMingguan" class="form-select" required ${isEdit ? 'disabled' : ''}>
                        <option value="">Pilih Rencana Mingguan</option>
                        ${rencanaOptions}
                    </select>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Skor Capaian (%)</label>
                        <input type="number" name="skorCapaian" class="form-input" min="0" max="100" value="${item?.skorCapaian || ''}" required placeholder="0-100">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Status</label>
                        <select name="status" class="form-select" required>
                            <option value="pending" ${item?.status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="aktif" ${item?.status === 'aktif' ? 'selected' : ''}>Disetujui</option>
                            <option value="selesai" ${item?.status === 'selesai' ? 'selected' : ''}>Final</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Catatan Evaluasi</label>
                    <textarea name="catatan" class="form-textarea" rows="3" placeholder="Catatan evaluasi, analisis kinerja...">${item?.catatan || ''}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Rekomendasi</label>
                    <textarea name="rekomendasi" class="form-textarea" rows="3" placeholder="Rekomendasi untuk perbaikan, tindak lanjut...">${item?.rekomendasi || ''}</textarea>
                </div>
            </form>
        `;

        Modal.open({
            title: isEdit ? 'Edit Evaluasi' : 'Buat Evaluasi Mingguan',
            content,
            onSave: (data) => {
                if (!isEdit && !data.rencanaMingguan) {
                    Toast.show('Pilih rencana mingguan', 'error');
                    return false;
                }

                if (!data.skorCapaian) {
                    Toast.show('Skor capaian harus diisi', 'error');
                    return false;
                }

                data.skorCapaian = parseInt(data.skorCapaian);

                if (isEdit) {
                    // Keep original rencanaMingguan if editing
                    data.rencanaMingguan = item.rencanaMingguan;
                    Storage.update(Storage.KEYS.EVALUASI, id, data);
                    Toast.show('Evaluasi berhasil diperbarui', 'success');
                } else {
                    // Check if evaluation already exists
                    const existing = Storage.filter(Storage.KEYS.EVALUASI,
                        e => e.rencanaMingguan === data.rencanaMingguan);
                    if (existing.length > 0) {
                        Toast.show('Evaluasi untuk minggu ini sudah ada', 'error');
                        return false;
                    }

                    Storage.add(Storage.KEYS.EVALUASI, data);
                    Toast.show('Evaluasi berhasil dibuat', 'success');
                }

                this.render();
                return true;
            }
        });
    },

    /**
     * Generate report for directors
     * @param {string} evaluasiId - Evaluation ID
     */
    async generateReport(evaluasiId) {
        const evaluasi = Storage.findById(Storage.KEYS.EVALUASI, evaluasiId);
        if (!evaluasi) return;

        const confirmed = await Modal.confirm({
            title: 'Generate Laporan Direksi',
            message: 'Buat laporan untuk direksi berdasarkan evaluasi ini?',
            type: 'info',
            confirmText: 'Generate'
        });

        if (!confirmed) return;

        const rencana = Storage.findById(Storage.KEYS.RENCANA_MINGGUAN, evaluasi.rencanaMingguan);

        const laporan = Storage.add(Storage.KEYS.LAPORAN_DIREKSI, {
            evaluasiId: evaluasiId,
            periode: rencana ? `Minggu ke-${rencana.mingguKe} (${Utils.formatDateShort(rencana.tanggalMulai)} - ${Utils.formatDateShort(rencana.tanggalSelesai)})` : 'N/A',
            kategori: rencana?.kategori || 'unknown',
            skorCapaian: evaluasi.skorCapaian,
            catatan: evaluasi.catatan,
            rekomendasi: evaluasi.rekomendasi,
            status: 'draft'
        });

        Toast.show('Laporan direksi berhasil dibuat', 'success');
        LaporanDireksi.render();
    },

    /**
     * Delete an evaluation
     * @param {string} id - Item ID
     */
    async delete(id) {
        const confirmed = await Modal.confirm({
            title: 'Hapus Evaluasi',
            message: 'Apakah Anda yakin ingin menghapus evaluasi ini?',
            type: 'danger'
        });

        if (confirmed) {
            Storage.delete(Storage.KEYS.EVALUASI, id);
            Toast.show('Evaluasi berhasil dihapus', 'success');
            this.render();
        }
    }
};

/**
 * Laporan Direksi Module - Handles reports for directors
 */
const LaporanDireksi = {
    /**
     * Initialize module
     */
    init() {
        this.render();
        this.bindEvents();
    },

    /**
     * Bind event listeners
     */
    bindEvents() {
        document.getElementById('btnGenerateReport').addEventListener('click', () => {
            this.showGenerateOptions();
        });
    },

    /**
     * Render reports list
     */
    render() {
        const container = document.getElementById('reportsList');
        const reports = Storage.get(Storage.KEYS.LAPORAN_DIREKSI);

        if (reports.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📈</span>
                    <p>Belum ada laporan untuk direksi</p>
                    <p class="text-muted" style="font-size: 0.875rem;">Buat laporan dari halaman Evaluasi Mingguan</p>
                </div>
            `;
            return;
        }

        container.innerHTML = reports.map(report => {
            const scoreClass = report.skorCapaian >= 90 ? 'high' : report.skorCapaian >= 70 ? 'medium' : 'low';

            return `
                <div class="report-item">
                    <div class="report-info">
                        <div class="report-icon">📊</div>
                        <div class="report-details">
                            <h4>Laporan ${report.periode}</h4>
                            <span class="report-meta">
                                ${Utils.getCategoryDisplay(report.kategori)} • 
                                Skor: <span class="text-${scoreClass === 'high' ? 'success' : scoreClass === 'medium' ? 'warning' : 'danger'}">${report.skorCapaian}%</span> • 
                                ${Utils.formatDate(report.createdAt)}
                            </span>
                        </div>
                    </div>
                    <div class="action-buttons">
                        <button class="btn btn-secondary btn-sm" onclick="LaporanDireksi.view('${report.id}')" title="Lihat">👁️</button>
                        <button class="btn btn-primary btn-sm" onclick="LaporanDireksi.print('${report.id}')" title="Cetak">🖨️</button>
                        <button class="btn btn-danger btn-sm" onclick="LaporanDireksi.delete('${report.id}')" title="Hapus">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * Show generate options
     */
    showGenerateOptions() {
        Toast.show('Buat laporan dari halaman Evaluasi Mingguan', 'info');
        // Navigate to evaluation page
        App.navigateTo('evaluasi');
    },

    /**
     * View report detail
     * @param {string} id - Report ID
     */
    view(id) {
        const report = Storage.findById(Storage.KEYS.LAPORAN_DIREKSI, id);
        if (!report) return;

        const scoreClass = report.skorCapaian >= 90 ? 'high' : report.skorCapaian >= 70 ? 'medium' : 'low';
        const statusLabel = report.skorCapaian >= 90 ? '🟢 On Track' : report.skorCapaian >= 70 ? '🟡 Perlu Perhatian' : '🔴 Kritis';

        const content = `
            <div style="display: grid; gap: var(--spacing-lg);">
                <div style="text-align: center; padding: var(--spacing-lg); background: var(--bg-tertiary); border-radius: var(--radius-lg);">
                    <h2 style="margin-bottom: var(--spacing-sm);">LAPORAN EVALUASI MINGGUAN</h2>
                    <p class="text-muted">${report.periode}</p>
                    <div style="margin-top: var(--spacing-md);">
                        <span class="category-badge ${report.kategori}" style="font-size: 1rem; padding: var(--spacing-sm) var(--spacing-md);">
                            ${Utils.getCategoryDisplay(report.kategori)}
                        </span>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--spacing-lg);">
                    <div style="text-align: center; padding: var(--spacing-lg); background: var(--bg-tertiary); border-radius: var(--radius-md);">
                        <span class="text-muted" style="font-size: 0.75rem;">Skor Capaian</span>
                        <div class="evaluation-score ${scoreClass}" style="font-size: 3rem;">${report.skorCapaian}%</div>
                    </div>
                    <div style="text-align: center; padding: var(--spacing-lg); background: var(--bg-tertiary); border-radius: var(--radius-md);">
                        <span class="text-muted" style="font-size: 0.75rem;">Status</span>
                        <div style="font-size: 1.5rem; margin-top: var(--spacing-sm);">${statusLabel}</div>
                    </div>
                </div>

                ${report.catatan ? `
                    <div>
                        <h4 style="margin-bottom: var(--spacing-sm);">📋 Catatan Evaluasi</h4>
                        <p style="white-space: pre-wrap; background: var(--bg-tertiary); padding: var(--spacing-md); border-radius: var(--radius-md);">
                            ${Utils.escapeHtml(report.catatan)}
                        </p>
                    </div>
                ` : ''}

                ${report.rekomendasi ? `
                    <div>
                        <h4 style="margin-bottom: var(--spacing-sm);">💡 Rekomendasi</h4>
                        <p style="white-space: pre-wrap; background: var(--bg-tertiary); padding: var(--spacing-md); border-radius: var(--radius-md);">
                            ${Utils.escapeHtml(report.rekomendasi)}
                        </p>
                    </div>
                ` : ''}

                <div class="text-muted text-center" style="font-size: 0.75rem;">
                    Dibuat: ${Utils.formatDate(report.createdAt)}
                </div>
            </div>
        `;

        Modal.open({
            title: 'Laporan Direksi',
            content,
            size: 'large',
            showFooter: false
        });
    },

    /**
     * Print report
     * @param {string} id - Report ID
     */
    print(id) {
        const report = Storage.findById(Storage.KEYS.LAPORAN_DIREKSI, id);
        if (!report) return;

        const scoreClass = report.skorCapaian >= 90 ? 'high' : report.skorCapaian >= 70 ? 'medium' : 'low';
        const statusLabel = report.skorCapaian >= 90 ? 'On Track' : report.skorCapaian >= 70 ? 'Perlu Perhatian' : 'Kritis';

        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Laporan Direksi - ${report.periode}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; }
                    .header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #333; }
                    .header h1 { font-size: 24px; margin-bottom: 10px; }
                    .header p { color: #666; }
                    .score-box { text-align: center; padding: 30px; background: #f5f5f5; border-radius: 10px; margin: 30px 0; }
                    .score { font-size: 64px; font-weight: bold; color: ${scoreClass === 'high' ? '#10b981' : scoreClass === 'medium' ? '#f59e0b' : '#ef4444'}; }
                    .status { font-size: 24px; margin-top: 10px; }
                    .section { margin: 30px 0; }
                    .section h3 { margin-bottom: 10px; color: #444; }
                    .section p { padding: 15px; background: #f9f9f9; border-radius: 5px; white-space: pre-wrap; }
                    .footer { margin-top: 60px; text-align: center; color: #999; font-size: 12px; }
                    .signature-area { margin-top: 80px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 40px; text-align: center; }
                    .signature-box { padding-top: 60px; border-top: 1px solid #333; }
                    @media print { body { padding: 20px; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>LAPORAN EVALUASI MINGGUAN</h1>
                    <p>${report.periode}</p>
                    <p style="margin-top: 10px; font-size: 14px;">Kategori: ${Utils.getCategoryDisplay(report.kategori).replace(/[🏗️🔧]/g, '')}</p>
                </div>

                <div class="score-box">
                    <div class="score">${report.skorCapaian}%</div>
                    <div class="status">${statusLabel}</div>
                </div>

                ${report.catatan ? `
                    <div class="section">
                        <h3>Catatan Evaluasi</h3>
                        <p>${report.catatan}</p>
                    </div>
                ` : ''}

                ${report.rekomendasi ? `
                    <div class="section">
                        <h3>Rekomendasi</h3>
                        <p>${report.rekomendasi}</p>
                    </div>
                ` : ''}

                <div class="signature-area">
                    <div class="signature-box">
                        <p>Dibuat oleh</p>
                        <p style="margin-top: 5px; font-weight: bold;">Supervisor</p>
                    </div>
                    <div class="signature-box">
                        <p>Diperiksa oleh</p>
                        <p style="margin-top: 5px; font-weight: bold;">Manager</p>
                    </div>
                    <div class="signature-box">
                        <p>Disetujui oleh</p>
                        <p style="margin-top: 5px; font-weight: bold;">Direksi</p>
                    </div>
                </div>

                <div class="footer">
                    <p>Dicetak pada: ${Utils.formatDate(new Date())}</p>
                </div>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            Toast.show('Popup diblokir browser. Izinkan popup untuk mencetak.', 'warning');
            return;
        }
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 250);
    },

    /**
     * Delete a report
     * @param {string} id - Report ID
     */
    async delete(id) {
        const confirmed = await Modal.confirm({
            title: 'Hapus Laporan',
            message: 'Apakah Anda yakin ingin menghapus laporan ini?',
            type: 'danger'
        });

        if (confirmed) {
            Storage.delete(Storage.KEYS.LAPORAN_DIREKSI, id);
            Toast.show('Laporan berhasil dihapus', 'success');
            this.render();
        }
    }
};
