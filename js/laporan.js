/**
 * Laporan Module - Handles daily reports with surveyor, estimator, drafter tracking
 */

const Laporan = {
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
        document.getElementById('btnAddLaporan').addEventListener('click', () => {
            this.showForm();
        });

        document.getElementById('filterKategoriLaporan').addEventListener('change', () => this.render());
        document.getElementById('filterTanggal').addEventListener('change', () => this.render());
    },

    /**
     * Render the table
     */
    render() {
        const tbody = document.getElementById('tableLaporan');
        let data = Storage.get(Storage.KEYS.LAPORAN_HARIAN);

        // Apply filters
        const filterKategori = document.getElementById('filterKategoriLaporan').value;
        const filterTanggal = document.getElementById('filterTanggal').value;

        if (filterKategori) {
            data = data.filter(item => item.kategori === filterKategori);
        }
        if (filterTanggal) {
            data = data.filter(item => item.tanggal === filterTanggal);
        }

        // Sort by date descending
        data.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

        if (data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="text-center text-muted" style="padding: 2rem;">
                        Belum ada laporan harian. Klik "Tambah Laporan" untuk membuat.
                    </td>
                </tr>
            `;
            return;
        }

        const pekerja = Storage.get(Storage.KEYS.PEKERJA);
        const tugas = Storage.get(Storage.KEYS.TUGAS);

        tbody.innerHTML = data.map((item, index) => {
            const task = tugas.find(t => t.id === item.tugasId);
            const surveyor = pekerja.find(p => p.id === item.surveyorId);
            const estimator = pekerja.find(p => p.id === item.estimatorId);
            const drafter = pekerja.find(p => p.id === item.drafterId);
            const wasdal = pekerja.find(p => p.id === item.wasdalId);
            const progressColor = Utils.getProgressColor(item.progress);

            return `
                <tr>
                    <td>${index + 1}</td>
                    <td>${Utils.formatDateShort(item.tanggal)}</td>
                    <td>${Utils.escapeHtml(Utils.truncate(task?.namaTugas || item.namaTugas || '-', 30))}</td>
                    <td><span class="category-badge ${item.kategori}">${Utils.getCategoryDisplay(item.kategori)}</span></td>
                    <td>${surveyor?.nama || '-'}</td>
                    <td>${estimator?.nama || '-'}</td>
                    <td>${drafter?.nama || '-'}</td>
                    <td>${wasdal?.nama || '-'}</td>
                    <td>
                        <div class="d-flex align-center gap-1">
                            <div class="progress-bar-container" style="flex: 1; height: 6px;">
                                <div class="progress-bar" style="width: ${item.progress}%"></div>
                            </div>
                            <span class="text-${progressColor}" style="min-width: 35px;">${item.progress}%</span>
                        </div>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-secondary btn-sm" onclick="Laporan.showForm('${item.id}')" title="Edit">✏️</button>
                            <button class="btn btn-secondary btn-sm" onclick="Laporan.viewDetail('${item.id}')" title="Detail">👁️</button>
                            <button class="btn btn-danger btn-sm" onclick="Laporan.delete('${item.id}')" title="Hapus">🗑️</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    /**
     * Show add/edit form
     * @param {string} id - Item ID for editing (optional)
     */
    showForm(id = null) {
        const item = id ? Storage.findById(Storage.KEYS.LAPORAN_HARIAN, id) : null;
        const isEdit = !!item;

        const pekerja = Storage.get(Storage.KEYS.PEKERJA);
        const tugas = Storage.get(Storage.KEYS.TUGAS);
        const rencanaMingguan = Storage.get(Storage.KEYS.RENCANA_MINGGUAN);

        // Build rencana mingguan options
        const rencanaOptions = rencanaMingguan.map(r => {
            const periode = `${Utils.formatDateShort(r.tanggalMulai)} - ${Utils.formatDateShort(r.tanggalSelesai)}`;
            const label = `Minggu ke-${r.mingguKe} (${periode}) - ${Utils.getCategoryDisplay(r.kategori)}`;
            return `<option value="${r.id}" ${item?.rencanaMingguan === r.id ? 'selected' : ''}>${label}</option>`;
        }).join('');

        // Build tugas options grouped by rencana mingguan
        const buildTugasOptions = () => {
            return tugas.map(t => {
                const rm = rencanaMingguan.find(r => r.id === t.rencanaMingguan);
                const rmInfo = rm ? ` (Minggu ke-${rm.mingguKe})` : '';
                return `<option value="${t.id}" data-rencana="${t.rencanaMingguan || ''}" ${item?.tugasId === t.id ? 'selected' : ''}>${Utils.escapeHtml(t.namaTugas)}${rmInfo}</option>`;
            }).join('');
        };

        const getPekerjaOptions = (role, selectedId = '') => {
            const filtered = pekerja.filter(p => p.role === role);
            return filtered.map(p =>
                `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${p.nama}</option>`
            ).join('');
        };

        const today = Utils.formatDateInput(new Date());

        const content = `
            <form id="formLaporan">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Tanggal</label>
                        <input type="date" name="tanggal" class="form-input" value="${item?.tanggal || today}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Kategori</label>
                        <select name="kategori" class="form-select" required>
                            <option value="">Pilih Kategori</option>
                            <option value="sipil" ${item?.kategori === 'sipil' ? 'selected' : ''}>🏗️ Bangunan Sipil</option>
                            <option value="perpipaan" ${item?.kategori === 'perpipaan' ? 'selected' : ''}>🔧 Perpipaan</option>
                        </select>
                    </div>
                </div>

                <div style="background: var(--bg-tertiary); padding: var(--spacing-md); border-radius: var(--radius-md); margin-bottom: var(--spacing-lg);">
                    <h4 style="margin-bottom: var(--spacing-md); font-size: 0.875rem; color: var(--text-secondary);">📋 Pilih dari Rencana Mingguan</h4>
                    
                    <div class="form-group">
                        <label class="form-label">Rencana Mingguan</label>
                        <select name="rencanaMingguan" id="selectRencanaMingguan" class="form-select">
                            <option value="">-- Pilih Rencana Mingguan --</option>
                            ${rencanaOptions}
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Tugas</label>
                        <select name="tugasId" id="selectTugas" class="form-select">
                            <option value="">-- Pilih Tugas --</option>
                            ${buildTugasOptions()}
                        </select>
                    </div>

                    <div id="tugasInfo" style="display: none; margin-top: var(--spacing-md); padding: var(--spacing-md); background: var(--bg-secondary); border-radius: var(--radius-sm); border-left: 3px solid var(--primary);">
                        <div id="tugasInfoContent"></div>
                    </div>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Nama Pekerjaan (jika tugas baru)</label>
                    <input type="text" name="namaTugas" class="form-input" value="${item?.namaTugas || ''}" placeholder="Isi jika tidak memilih dari daftar tugas">
                </div>

                <div style="background: var(--bg-tertiary); padding: var(--spacing-md); border-radius: var(--radius-md); margin-bottom: var(--spacing-lg);">
                    <h4 style="margin-bottom: var(--spacing-md); font-size: 0.875rem; color: var(--text-secondary);">👥 Pekerja yang Terlibat</h4>
                    <div class="form-row">
                        <div class="form-group mb-0">
                            <label class="form-label">🔍 Surveyor</label>
                            <select name="surveyorId" class="form-select">
                                <option value="">Pilih Surveyor</option>
                                ${getPekerjaOptions('surveyor', item?.surveyorId)}
                            </select>
                        </div>
                        <div class="form-group mb-0">
                            <label class="form-label">📊 Estimator</label>
                            <select name="estimatorId" class="form-select">
                                <option value="">Pilih Estimator</option>
                                ${getPekerjaOptions('estimator', item?.estimatorId)}
                            </select>
                        </div>
                    </div>
                    <div class="form-row" style="margin-top: var(--spacing-md);">
                        <div class="form-group mb-0">
                            <label class="form-label">✏️ Drafter</label>
                            <select name="drafterId" class="form-select">
                                <option value="">Pilih Drafter</option>
                                ${getPekerjaOptions('drafter', item?.drafterId)}
                            </select>
                        </div>
                        <div class="form-group mb-0">
                            <label class="form-label">👁️ Wasdal</label>
                            <select name="wasdalId" class="form-select">
                                <option value="">Pilih Wasdal</option>
                                ${getPekerjaOptions('wasdal', item?.wasdalId)}
                            </select>
                        </div>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Progress (%)</label>
                        <input type="number" name="progress" class="form-input" min="0" max="100" value="${item?.progress || 0}" required>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Catatan / Keterangan</label>
                    <textarea name="catatan" class="form-textarea" rows="3" placeholder="Catatan pekerjaan, kendala, dll...">${item?.catatan || ''}</textarea>
                </div>
            </form>
        `;

        Modal.open({
            title: isEdit ? 'Edit Laporan Harian' : 'Tambah Laporan Harian',
            content,
            size: 'large',
            onOpen: () => {
                const selectRencana = document.getElementById('selectRencanaMingguan');
                const selectTugas = document.getElementById('selectTugas');
                const tugasInfo = document.getElementById('tugasInfo');
                const tugasInfoContent = document.getElementById('tugasInfoContent');

                // Filter tugas based on selected rencana mingguan
                selectRencana.addEventListener('change', () => {
                    const selectedRencana = selectRencana.value;
                    const options = selectTugas.querySelectorAll('option');

                    options.forEach(option => {
                        if (!option.value) return; // Skip default option
                        const rencanaId = option.getAttribute('data-rencana');
                        if (!selectedRencana || rencanaId === selectedRencana) {
                            option.style.display = '';
                        } else {
                            option.style.display = 'none';
                        }
                    });

                    // Reset tugas selection
                    selectTugas.value = '';
                    tugasInfo.style.display = 'none';
                });

                // Show tugas info when selected
                selectTugas.addEventListener('change', () => {
                    const selectedTugasId = selectTugas.value;
                    if (!selectedTugasId) {
                        tugasInfo.style.display = 'none';
                        return;
                    }

                    const selectedTugas = tugas.find(t => t.id === selectedTugasId);
                    if (selectedTugas) {
                        const rm = rencanaMingguan.find(r => r.id === selectedTugas.rencanaMingguan);
                        const surveyor = pekerja.find(p => p.id === selectedTugas.surveyorId);
                        const estimator = pekerja.find(p => p.id === selectedTugas.estimatorId);
                        const drafter = pekerja.find(p => p.id === selectedTugas.drafterId);
                        const wasdalPerson = pekerja.find(p => p.id === selectedTugas.wasdalId);

                        tugasInfoContent.innerHTML = `
                            <div style="font-weight: 600; margin-bottom: var(--spacing-sm);">${Utils.escapeHtml(selectedTugas.namaTugas)}</div>
                            ${selectedTugas.deskripsi ? `<p style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: var(--spacing-sm);">${Utils.escapeHtml(selectedTugas.deskripsi)}</p>` : ''}
                            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--spacing-xs); font-size: 0.8rem;">
                                ${rm ? `<div><span class="text-muted">Minggu:</span> ke-${rm.mingguKe}</div>` : ''}
                                ${selectedTugas.prioritas ? `<div><span class="text-muted">Prioritas:</span> ${selectedTugas.prioritas == 3 ? '🔴 Tinggi' : selectedTugas.prioritas == 2 ? '🟡 Normal' : '🟢 Rendah'}</div>` : ''}
                                ${surveyor ? `<div><span class="text-muted">🔍 Surveyor:</span> ${surveyor.nama}</div>` : ''}
                                ${estimator ? `<div><span class="text-muted">📊 Estimator:</span> ${estimator.nama}</div>` : ''}
                                ${drafter ? `<div><span class="text-muted">✏️ Drafter:</span> ${drafter.nama}</div>` : ''}
                                ${wasdalPerson ? `<div><span class="text-muted">👁️ Wasdal:</span> ${wasdalPerson.nama}</div>` : ''}
                            </div>
                        `;
                        tugasInfo.style.display = 'block';

                        // Auto-fill workers from tugas if available
                        if (selectedTugas.surveyorId) {
                            const surveyorSelect = document.querySelector('select[name="surveyorId"]');
                            if (surveyorSelect) surveyorSelect.value = selectedTugas.surveyorId;
                        }
                        if (selectedTugas.estimatorId) {
                            const estimatorSelect = document.querySelector('select[name="estimatorId"]');
                            if (estimatorSelect) estimatorSelect.value = selectedTugas.estimatorId;
                        }
                        if (selectedTugas.drafterId) {
                            const drafterSelect = document.querySelector('select[name="drafterId"]');
                            if (drafterSelect) drafterSelect.value = selectedTugas.drafterId;
                        }
                        if (selectedTugas.wasdalId) {
                            const wasdalSelect = document.querySelector('select[name="wasdalId"]');
                            if (wasdalSelect) wasdalSelect.value = selectedTugas.wasdalId;
                        }
                    }
                });

                // Trigger initial filter if editing
                if (item?.rencanaMingguan) {
                    selectRencana.dispatchEvent(new Event('change'));
                }
                if (item?.tugasId) {
                    selectTugas.dispatchEvent(new Event('change'));
                }
            },
            onSave: (data) => {
                if (!data.tanggal || !data.kategori) {
                    Toast.show('Tanggal dan kategori harus diisi', 'error');
                    return false;
                }

                if (!data.tugasId && !data.namaTugas.trim()) {
                    Toast.show('Pilih tugas atau isi nama pekerjaan', 'error');
                    return false;
                }

                // Convert progress to number
                data.progress = parseInt(data.progress) || 0;

                if (isEdit) {
                    Storage.update(Storage.KEYS.LAPORAN_HARIAN, id, data);
                    Toast.show('Laporan berhasil diperbarui', 'success');
                } else {
                    Storage.add(Storage.KEYS.LAPORAN_HARIAN, data);
                    Toast.show('Laporan berhasil ditambahkan', 'success');
                }

                this.render();
                Dashboard.refresh();
                return true;
            }
        });
    },

    /**
     * View report detail
     * @param {string} id - Report ID
     */
    viewDetail(id) {
        const item = Storage.findById(Storage.KEYS.LAPORAN_HARIAN, id);
        if (!item) return;

        const pekerja = Storage.get(Storage.KEYS.PEKERJA);
        const tugas = Storage.get(Storage.KEYS.TUGAS);

        const task = tugas.find(t => t.id === item.tugasId);
        const surveyor = pekerja.find(p => p.id === item.surveyorId);
        const estimator = pekerja.find(p => p.id === item.estimatorId);
        const drafter = pekerja.find(p => p.id === item.drafterId);
        const wasdal = pekerja.find(p => p.id === item.wasdalId);

        const content = `
            <div style="display: grid; gap: var(--spacing-lg);">
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--spacing-md);">
                    <div>
                        <span class="text-muted" style="font-size: 0.75rem;">Tanggal</span>
                        <p style="font-weight: 500;">${Utils.formatDate(item.tanggal)}</p>
                    </div>
                    <div>
                        <span class="text-muted" style="font-size: 0.75rem;">Kategori</span>
                        <p><span class="category-badge ${item.kategori}">${Utils.getCategoryDisplay(item.kategori)}</span></p>
                    </div>
                </div>

                <div>
                    <span class="text-muted" style="font-size: 0.75rem;">Pekerjaan</span>
                    <p style="font-weight: 500;">${Utils.escapeHtml(task?.namaTugas || item.namaTugas || '-')}</p>
                </div>

                <div style="background: var(--bg-tertiary); padding: var(--spacing-md); border-radius: var(--radius-md);">
                    <h4 style="margin-bottom: var(--spacing-md); font-size: 0.875rem;">👥 Tim Pelaksana</h4>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--spacing-md);">
                        <div>
                            <span class="text-muted" style="font-size: 0.75rem;">🔍 Surveyor</span>
                            <p style="font-weight: 500;">${surveyor?.nama || '-'}</p>
                        </div>
                        <div>
                            <span class="text-muted" style="font-size: 0.75rem;">📊 Estimator</span>
                            <p style="font-weight: 500;">${estimator?.nama || '-'}</p>
                        </div>
                        <div>
                            <span class="text-muted" style="font-size: 0.75rem;">✏️ Drafter</span>
                            <p style="font-weight: 500;">${drafter?.nama || '-'}</p>
                        </div>
                        <div>
                            <span class="text-muted" style="font-size: 0.75rem;">👁️ Wasdal</span>
                            <p style="font-weight: 500;">${wasdal?.nama || '-'}</p>
                        </div>
                    </div>
                </div>

                <div>
                    <span class="text-muted" style="font-size: 0.75rem;">Progress</span>
                    <div class="d-flex align-center gap-2 mt-1">
                        <div class="progress-bar-container" style="flex: 1; height: 10px;">
                            <div class="progress-bar" style="width: ${item.progress}%"></div>
                        </div>
                        <span style="font-weight: 600; font-size: 1.25rem;">${item.progress}%</span>
                    </div>
                </div>

                ${item.catatan ? `
                    <div>
                        <span class="text-muted" style="font-size: 0.75rem;">Catatan</span>
                        <p style="white-space: pre-wrap;">${Utils.escapeHtml(item.catatan)}</p>
                    </div>
                ` : ''}
            </div>
        `;

        Modal.open({
            title: 'Detail Laporan',
            content,
            showFooter: false
        });
    },

    /**
     * Delete a report
     * @param {string} id - Item ID
     */
    async delete(id) {
        const confirmed = await Modal.confirm({
            title: 'Hapus Laporan',
            message: 'Apakah Anda yakin ingin menghapus laporan ini?',
            type: 'danger'
        });

        if (confirmed) {
            Storage.delete(Storage.KEYS.LAPORAN_HARIAN, id);
            Toast.show('Laporan berhasil dihapus', 'success');
            this.render();
            Dashboard.refresh();
        }
    }
};
