/**
 * Pekerjaan Module - Handles workflow-based task management
 * Workflow: Survey → Drafting → Estimasi → Review Asman → Approval → Wasdal → Selesai
 */

const Pekerjaan = {
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
        document.getElementById('btnAddPekerjaan').addEventListener('click', () => {
            this.showInputForm();
        });

        // Filters
        document.getElementById('filterStatusPekerjaan').addEventListener('change', () => this.render());
        document.getElementById('filterKategoriPekerjaan').addEventListener('change', () => this.render());
    },

    /**
     * Render the pekerjaan list
     */
    render() {
        const container = document.getElementById('pekerjaanList');
        const btnAdd = document.getElementById('btnAddPekerjaan');
        let data = Storage.get(Storage.KEYS.PEKERJAAN);

        // Get current user
        const currentUser = App.currentUser;

        // Control visibility of add button (only for management)
        if (currentUser && ['manager', 'asman_sipil', 'asman_perpipaan'].includes(currentUser.role)) {
            btnAdd.style.display = '';
        } else {
            btnAdd.style.display = 'none';
        }

        // Filter based on role for non-management users
        if (currentUser && !['manager', 'asman_sipil', 'asman_perpipaan'].includes(currentUser.role)) {
            // Filter to show only tasks where current user is assigned in current stage
            data = data.filter(item => {
                const currentTahap = item.tahapan[item.tahapan.length - 1];
                if (!currentTahap || !currentTahap.pelaksana) return false;
                return currentTahap.pelaksana.includes(currentUser.id);
            });
        }

        // Apply filters
        const filterStatus = document.getElementById('filterStatusPekerjaan').value;
        const filterKategori = document.getElementById('filterKategoriPekerjaan').value;

        if (filterStatus) {
            data = data.filter(item => item.status === filterStatus);
        }
        if (filterKategori) {
            data = data.filter(item => item.kategori === filterKategori);
        }

        // Sort by latest first
        data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        if (data.length === 0) {
            const isManagement = currentUser && ['manager', 'asman_sipil', 'asman_perpipaan'].includes(currentUser.role);
            const emptyMessage = isManagement
                ? 'Klik "Input Pekerjaan" untuk membuat baru'
                : 'Tidak ada pekerjaan yang ditugaskan kepada Anda saat ini';

            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📋</span>
                    <p>Belum ada pekerjaan</p>
                    <p class="text-muted" style="font-size: 0.875rem;">${emptyMessage}</p>
                </div>
            `;
            return;
        }

        const pekerja = Storage.get(Storage.KEYS.PEKERJA);
        const isManagement = currentUser && ['manager', 'asman_sipil', 'asman_perpipaan'].includes(currentUser.role);

        container.innerHTML = data.map(item => {
            const statusColor = Utils.getWorkflowStatusColor(item.status);
            const currentTahap = item.tahapan[item.tahapan.length - 1];
            const pelaksanaNames = this.getPelaksanaNames(currentTahap?.pelaksana, pekerja);
            const progress = this.calculateProgress(item.status);

            // Aging warning logic for Drafting (Gambar) and Estimasi (RAB)
            let agingWarning = '';
            if (['drafting', 'estimasi'].includes(item.status)) {
                const days = Utils.getDaysDifference(currentTahap.tanggalMulai);
                if (days >= 3) {
                    agingWarning = `<span class="badge badge-danger" style="font-size: 0.7rem; margin-left: 5px;">⚠️ >3 Hari</span>`;
                }
            }

            // Check if current user is assigned to this task's current stage
            const isAssigned = currentUser && currentTahap?.pelaksana?.includes(currentUser.id);
            const canHandoff = isManagement || isAssigned;

            return `
                <div class="pekerjaan-card">
                    <div class="pekerjaan-header">
                        <div>
                            <h3 class="pekerjaan-title">${Utils.escapeHtml(item.namaPekerjaan)}</h3>
                            <div class="pekerjaan-meta">
                                <span class="category-badge ${item.kategori}">${Utils.getCategoryDisplay(item.kategori)}</span>
                                <span class="text-muted">📍 ${Utils.escapeHtml(item.lokasi || '-')}</span>
                            </div>
                        </div>
                        <span class="workflow-status ${statusColor}">${Utils.getStatusDisplay(item.status)}${agingWarning}</span>
                    </div>
                    
                    <div class="pekerjaan-progress">
                        <div class="progress-bar-container">
                            <div class="progress-bar" style="width: ${progress}%"></div>
                        </div>
                        <span class="progress-text">${progress}%</span>
                    </div>

                    <div class="pekerjaan-info">
                        <div class="info-item">
                            <span class="info-label">Pelaksana Aktif:</span>
                            <span class="info-value">${pelaksanaNames || '-'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Dibuat:</span>
                            <span class="info-value">${Utils.formatDateShort(item.createdAt)}</span>
                        </div>
                    </div>

                    <div class="pekerjaan-actions">
                        <button class="btn btn-secondary btn-sm" onclick="Pekerjaan.viewDetail('${item.id}')">
                            👁️ Detail
                        </button>
                        ${item.status !== 'selesai' && canHandoff ? `
                            <button class="btn btn-primary btn-sm" onclick="Pekerjaan.showHandoffForm('${item.id}')">
                                ➡️ Selesai & Lanjutkan
                            </button>
                        ` : ''}
                        ${isManagement ? `
                            <button class="btn btn-danger btn-sm" onclick="Pekerjaan.delete('${item.id}')">
                                🗑️
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * Get pelaksana names from IDs
     */
    getPelaksanaNames(pelaksanaIds, pekerja) {
        if (!pelaksanaIds || pelaksanaIds.length === 0) return null;

        const names = pelaksanaIds.map(id => {
            const p = pekerja.find(pk => pk.id === id);
            return p ? p.nama : null;
        }).filter(Boolean);

        return names.join(', ');
    },

    /**
     * Calculate progress based on status
     */
    calculateProgress(status) {
        const progressMap = {
            survey: 15,
            drafting: 30,
            estimasi: 50,
            review_asman: 70,
            approval: 85,
            wasdal: 95,
            selesai: 100
        };
        return progressMap[status] || 0;
    },

    /**
     * Show input form for new pekerjaan (Survey stage)
     */
    showInputForm() {
        const pekerja = Storage.get(Storage.KEYS.PEKERJA);
        const rencanaMingguan = Storage.get(Storage.KEYS.RENCANA_MINGGUAN);

        // All workers can do survey (no role filter)
        const pekerjaCheckboxes = pekerja.map(p => `
            <label class="checkbox-label">
                <input type="checkbox" name="surveyors" value="${p.id}">
                <span>${Utils.escapeHtml(p.nama)}</span>
            </label>
        `).join('');

        const rencanaOptions = rencanaMingguan.map(r => {
            const periode = `${Utils.formatDateShort(r.tanggalMulai)} - ${Utils.formatDateShort(r.tanggalSelesai)}`;
            return `<option value="${r.id}">Minggu ke-${r.mingguKe} (${periode})</option>`;
        }).join('');

        const today = Utils.formatDateInput(new Date());

        const content = `
            <form id="formPekerjaan">
                <div class="form-group">
                    <label class="form-label">Nama Pekerjaan</label>
                    <input type="text" name="namaPekerjaan" class="form-input" required placeholder="Contoh: Pembangunan Gedung Kantor">
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Kategori</label>
                        <select name="kategori" class="form-select" required>
                            <option value="">Pilih Kategori</option>
                            <option value="sipil">🏗️ Bangunan Sipil</option>
                            <option value="perpipaan">🔧 Perpipaan</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Tanggal Survey</label>
                        <input type="date" name="tanggalSurvey" class="form-input" value="${today}" required>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Lokasi</label>
                    <input type="text" name="lokasi" class="form-input" placeholder="Alamat lokasi pekerjaan">
                </div>

                <div class="form-group">
                    <label class="form-label">Link ke Rencana Mingguan (opsional)</label>
                    <select name="rencanaMingguan" class="form-select">
                        <option value="">-- Tidak ada --</option>
                        ${rencanaOptions}
                    </select>
                </div>

                <div style="background: var(--bg-tertiary); padding: var(--spacing-md); border-radius: var(--radius-md); margin-bottom: var(--spacing-lg);">
                    <h4 style="margin-bottom: var(--spacing-md); font-size: 0.875rem; color: var(--text-secondary);">🔍 Tim Survey (pilih 2-3 orang)</h4>
                    <div class="checkbox-group">
                        ${pekerjaCheckboxes || '<p class="text-muted">Belum ada pekerja. Tambahkan di Data Pekerja.</p>'}
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Catatan Survey</label>
                    <textarea name="catatan" class="form-textarea" rows="3" placeholder="Hasil pengamatan, kondisi lapangan, dll..."></textarea>
                </div>
            </form>
        `;

        Modal.open({
            title: '📍 Input Pekerjaan Baru (Survey)',
            content,
            size: 'large',
            onSave: (data) => {
                if (!data.namaPekerjaan.trim()) {
                    Toast.show('Nama pekerjaan harus diisi', 'error');
                    return false;
                }

                if (!data.kategori) {
                    Toast.show('Kategori harus dipilih', 'error');
                    return false;
                }

                // Get selected surveyors
                const selectedSurveyors = [];
                document.querySelectorAll('input[name="surveyors"]:checked').forEach(cb => {
                    selectedSurveyors.push(cb.value);
                });

                if (selectedSurveyors.length < 2) {
                    Toast.show('Pilih minimal 2 surveyor', 'error');
                    return false;
                }

                if (selectedSurveyors.length > 3) {
                    Toast.show('Maksimal 3 surveyor', 'error');
                    return false;
                }

                // Create pekerjaan with initial survey stage
                const pekerjaan = {
                    namaPekerjaan: data.namaPekerjaan.trim(),
                    kategori: data.kategori,
                    lokasi: data.lokasi.trim(),
                    rencanaMingguan: data.rencanaMingguan || null,
                    status: 'survey',
                    tahapan: [
                        {
                            status: 'survey',
                            pelaksana: selectedSurveyors,
                            tanggalMulai: data.tanggalSurvey,
                            tanggalSelesai: null,
                            catatan: data.catatan.trim(),
                            dokumen: []
                        }
                    ]
                };

                Storage.add(Storage.KEYS.PEKERJAAN, pekerjaan);
                Toast.show('Pekerjaan berhasil dibuat', 'success');
                this.render();
                Dashboard.refresh();
                return true;
            }
        });
    },

    /**
     * Show handoff form to move to next stage
     */
    showHandoffForm(id) {
        const pekerjaan = Storage.findById(Storage.KEYS.PEKERJAAN, id);
        if (!pekerjaan) return;

        const nextStatus = Utils.getNextWorkflowStatus(pekerjaan.status);
        if (!nextStatus) {
            Toast.show('Pekerjaan sudah selesai', 'info');
            return;
        }

        const pekerja = Storage.get(Storage.KEYS.PEKERJA);

        // All workers can be assigned to any stage (no role-based filter)
        const eligiblePekerja = pekerja;

        const today = Utils.formatDateInput(new Date());

        // Show dropdown for single assignment
        const pelaksanaInput = `
            <select name="pelaksanaId" class="form-select" required>
                <option value="">Pilih Pelaksana</option>
                ${eligiblePekerja.map(p => `
                    <option value="${p.id}">${Utils.escapeHtml(p.nama)}</option>
                `).join('')}
            </select>
        `;

        const content = `
            <form id="formHandoff">
                <div style="background: var(--bg-tertiary); padding: var(--spacing-md); border-radius: var(--radius-md); margin-bottom: var(--spacing-lg);">
                    <p class="text-muted" style="margin-bottom: var(--spacing-sm);">Pekerjaan:</p>
                    <h3>${Utils.escapeHtml(pekerjaan.namaPekerjaan)}</h3>
                    <p style="margin-top: var(--spacing-sm);">
                        Status saat ini: <span class="workflow-status ${Utils.getWorkflowStatusColor(pekerjaan.status)}">${Utils.getStatusDisplay(pekerjaan.status)}</span>
                        → <span class="workflow-status ${Utils.getWorkflowStatusColor(nextStatus)}">${Utils.getStatusDisplay(nextStatus)}</span>
                    </p>
                </div>

                <div class="form-group">
                    <label class="form-label">Catatan untuk tahap sebelumnya</label>
                    <textarea name="catatanSelesai" class="form-textarea" rows="2" placeholder="Catatan penyelesaian tahap ${Utils.getStatusDisplay(pekerjaan.status)}..."></textarea>
                </div>

                <div class="form-group">
                    <label class="form-label">Tanggal Mulai ${Utils.getStatusDisplay(nextStatus)}</label>
                    <input type="date" name="tanggalMulai" class="form-input" value="${today}" required>
                </div>

                <div class="form-group">
                    <label class="form-label">Pelaksana ${Utils.getStatusDisplay(nextStatus)}</label>
                    ${pelaksanaInput}
                </div>

                <div class="form-group">
                    <label class="form-label">Instruksi / Catatan</label>
                    <textarea name="catatan" class="form-textarea" rows="2" placeholder="Instruksi untuk pelaksana..."></textarea>
                </div>
            </form>
        `;

        Modal.open({
            title: `➡️ Lanjutkan ke ${Utils.getStatusDisplay(nextStatus)}`,
            content,
            size: 'large',
            onSave: (data) => {
                let pelaksanaIds = [];

                if (data.pelaksanaId) {
                    pelaksanaIds = [data.pelaksanaId];
                }

                if (pelaksanaIds.length === 0) {
                    Toast.show('Pilih pelaksana', 'error');
                    return false;
                }

                // Complete current stage
                const currentTahap = pekerjaan.tahapan[pekerjaan.tahapan.length - 1];
                currentTahap.tanggalSelesai = Utils.formatDateInput(new Date());
                if (data.catatanSelesai) {
                    currentTahap.catatan = (currentTahap.catatan ? currentTahap.catatan + '\n\n' : '') +
                        'Catatan penyelesaian: ' + data.catatanSelesai;
                }

                // Add new stage
                pekerjaan.tahapan.push({
                    status: nextStatus,
                    pelaksana: pelaksanaIds,
                    tanggalMulai: data.tanggalMulai,
                    tanggalSelesai: null,
                    catatan: data.catatan || '',
                    dokumen: []
                });

                // Update status
                pekerjaan.status = nextStatus;

                Storage.update(Storage.KEYS.PEKERJAAN, id, pekerjaan);
                Toast.show(`Pekerjaan dilanjutkan ke ${Utils.getStatusDisplay(nextStatus)}`, 'success');
                this.render();
                Dashboard.refresh();
                return true;
            }
        });
    },

    /**
     * View pekerjaan detail with timeline
     */
    viewDetail(id) {
        const pekerjaan = Storage.findById(Storage.KEYS.PEKERJAAN, id);
        if (!pekerjaan) return;

        const pekerja = Storage.get(Storage.KEYS.PEKERJA);
        const progress = this.calculateProgress(pekerjaan.status);

        const timelineHtml = pekerjaan.tahapan.map((tahap, index) => {
            const isActive = index === pekerjaan.tahapan.length - 1 && pekerjaan.status !== 'selesai';
            const pelaksanaNames = this.getPelaksanaNames(tahap.pelaksana, pekerja);

            let tahapWarning = '';
            if (!tahap.tanggalSelesai && ['drafting', 'estimasi'].includes(tahap.status)) {
                const days = Utils.getDaysDifference(tahap.tanggalMulai);
                if (days >= 3) {
                    tahapWarning = `<span class="badge badge-danger" style="font-size: 0.75rem; vertical-align: middle; margin-left: 8px;">⚠️ Terlambat (>3 Hari)</span>`;
                }
            }

            return `
                <div class="timeline-item ${isActive ? 'active' : ''} ${tahap.tanggalSelesai ? 'completed' : ''}">
                    <div class="timeline-marker"></div>
                    <div class="timeline-content">
                        <div class="timeline-header">
                            <span class="workflow-status ${Utils.getWorkflowStatusColor(tahap.status)}">
                                ${Utils.getStatusDisplay(tahap.status)}${tahapWarning}
                            </span>
                            <span class="timeline-date">
                                ${Utils.formatDateShort(tahap.tanggalMulai)}
                                ${tahap.tanggalSelesai ? ' - ' + Utils.formatDateShort(tahap.tanggalSelesai) : ' (berlangsung)'}
                            </span>
                        </div>
                        <div class="timeline-body">
                            <p><strong>Pelaksana:</strong> ${pelaksanaNames || '-'}</p>
                            ${tahap.catatan ? `<p><strong>Catatan:</strong> ${Utils.escapeHtml(tahap.catatan)}</p>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        const content = `
            <div style="display: grid; gap: var(--spacing-lg);">
                <div>
                    <h2 style="margin-bottom: var(--spacing-sm);">${Utils.escapeHtml(pekerjaan.namaPekerjaan)}</h2>
                    <div style="display: flex; gap: var(--spacing-md); flex-wrap: wrap;">
                        <span class="category-badge ${pekerjaan.kategori}">${Utils.getCategoryDisplay(pekerjaan.kategori)}</span>
                        <span class="workflow-status ${Utils.getWorkflowStatusColor(pekerjaan.status)}">${Utils.getStatusDisplay(pekerjaan.status)}</span>
                        <span class="text-muted">📍 ${Utils.escapeHtml(pekerjaan.lokasi || '-')}</span>
                    </div>
                </div>

                <div>
                    <div class="d-flex align-center gap-2 mb-1">
                        <span class="text-muted">Progress:</span>
                        <div class="progress-bar-container" style="flex: 1; height: 10px;">
                            <div class="progress-bar" style="width: ${progress}%"></div>
                        </div>
                        <span style="font-weight: 600;">${progress}%</span>
                    </div>
                </div>

                <div>
                    <h4 style="margin-bottom: var(--spacing-md);">📋 Timeline Pekerjaan</h4>
                    <div class="timeline">
                        ${timelineHtml}
                    </div>
                </div>
            </div>
        `;

        Modal.open({
            title: 'Detail Pekerjaan',
            content,
            size: 'large',
            showFooter: false
        });
    },

    /**
     * Delete pekerjaan
     */
    async delete(id) {
        const confirmed = await Modal.confirm({
            title: 'Hapus Pekerjaan',
            message: 'Apakah Anda yakin ingin menghapus pekerjaan ini? Semua data akan hilang.',
            type: 'danger'
        });

        if (confirmed) {
            Storage.delete(Storage.KEYS.PEKERJAAN, id);
            Toast.show('Pekerjaan berhasil dihapus', 'success');
            this.render();
            Dashboard.refresh();
        }
    }
};
