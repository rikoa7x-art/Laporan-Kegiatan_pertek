/**
 * Rencana Mingguan Module - Handles weekly work plans
 */

const RencanaMingguan = {
    /**
     * Initialize module
     */
    init() {
        this.render();
        this.bindEvents();
        this.populateFilters();
    },

    /**
     * Bind event listeners
     */
    bindEvents() {
        document.getElementById('btnAddRencanaMingguan').addEventListener('click', () => {
            this.showForm();
        });

        document.getElementById('filterBulan').addEventListener('change', () => this.render());
        document.getElementById('filterKategori').addEventListener('change', () => this.render());
    },

    /**
     * Populate filter dropdowns
     */
    populateFilters() {
        const filterBulan = document.getElementById('filterBulan');
        const rencanaBulanan = Storage.get(Storage.KEYS.RENCANA_BULANAN);

        const options = rencanaBulanan.map(item =>
            `<option value="${item.id}">${Utils.getMonthName(parseInt(item.bulan))} ${item.tahun}</option>`
        ).join('');

        filterBulan.innerHTML = `<option value="">Semua Bulan</option>${options}`;
    },

    /**
     * Render the table
     */
    render() {
        const tbody = document.getElementById('tableRencanaMingguan');
        let data = Storage.get(Storage.KEYS.RENCANA_MINGGUAN);

        // Apply filters
        const filterBulan = document.getElementById('filterBulan').value;
        const filterKategori = document.getElementById('filterKategori').value;

        if (filterBulan) {
            data = data.filter(item => item.rencanaBulanan === filterBulan);
        }
        if (filterKategori) {
            data = data.filter(item => item.kategori === filterKategori);
        }

        if (data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-muted" style="padding: 2rem;">
                        Belum ada rencana mingguan. Buat dari breakdown bulanan atau klik "Tambah Rencana".
                    </td>
                </tr>
            `;
            return;
        }

        const tugas = Storage.get(Storage.KEYS.TUGAS);

        tbody.innerHTML = data.map((item, index) => {
            const itemTugas = tugas.filter(t => t.rencanaMingguan === item.id);
            const completedTugas = itemTugas.filter(t => t.status === 'selesai').length;
            const totalTugas = itemTugas.length;
            const progress = Utils.calculatePercentage(completedTugas, totalTugas);
            const progressColor = Utils.getProgressColor(progress);

            return `
                <tr>
                    <td>${index + 1}</td>
                    <td>Minggu ke-${item.mingguKe}</td>
                    <td>${Utils.formatDateShort(item.tanggalMulai)} - ${Utils.formatDateShort(item.tanggalSelesai)}</td>
                    <td><span class="category-badge ${item.kategori}">${Utils.getCategoryDisplay(item.kategori)}</span></td>
                    <td>${totalTugas} tugas</td>
                    <td>
                        <div class="d-flex align-center gap-1">
                            <div class="progress-bar-container" style="flex: 1; height: 6px;">
                                <div class="progress-bar" style="width: ${progress}%"></div>
                            </div>
                            <span class="text-${progressColor}" style="min-width: 40px; text-align: right;">${progress}%</span>
                        </div>
                    </td>
                    <td><span class="status-badge ${item.status}">${Utils.getStatusDisplay(item.status)}</span></td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-secondary btn-sm" onclick="RencanaMingguan.showForm('${item.id}')" title="Edit">✏️</button>
                            <button class="btn btn-secondary btn-sm" onclick="RencanaMingguan.manageTugas('${item.id}')" title="Kelola Tugas">📝</button>
                            <button class="btn btn-danger btn-sm" onclick="RencanaMingguan.delete('${item.id}')" title="Hapus">🗑️</button>
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
        const item = id ? Storage.findById(Storage.KEYS.RENCANA_MINGGUAN, id) : null;
        const isEdit = !!item;

        const rencanaBulananOptions = RencanaBulanan.getOptions().map(opt =>
            `<option value="${opt.value}" ${item?.rencanaBulanan === opt.value ? 'selected' : ''}>${opt.label}</option>`
        ).join('');

        const weekOptions = [1, 2, 3, 4, 5].map(week =>
            `<option value="${week}" ${item?.mingguKe == week ? 'selected' : ''}>Minggu ke-${week}</option>`
        ).join('');

        const content = `
            <form id="formRencanaMingguan">
                <div class="form-group">
                    <label class="form-label">Rencana Bulanan</label>
                    <select name="rencanaBulanan" class="form-select" required>
                        <option value="">Pilih Rencana Bulanan</option>
                        ${rencanaBulananOptions}
                    </select>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Minggu Ke</label>
                        <select name="mingguKe" class="form-select" required>
                            ${weekOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Kategori</label>
                        <select name="kategori" class="form-select" required>
                            <option value="">Pilih Kategori</option>
                            <option value="sipil" ${item?.kategori === 'sipil' ? 'selected' : ''}>🏗️ Bangunan Sipil</option>
                            <option value="perpipaan" ${item?.kategori === 'perpipaan' ? 'selected' : ''}>🔧 Perpipaan</option>
                            <option value="pengawasan" ${item?.kategori === 'pengawasan' ? 'selected' : ''}>👁️ Pengawasan</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Tanggal Mulai</label>
                        <input type="date" name="tanggalMulai" class="form-input" value="${item?.tanggalMulai || ''}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Tanggal Selesai</label>
                        <input type="date" name="tanggalSelesai" class="form-input" value="${item?.tanggalSelesai || ''}" required>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Status</label>
                    <select name="status" class="form-select" required>
                        <option value="draft" ${item?.status === 'draft' ? 'selected' : ''}>Draft</option>
                        <option value="aktif" ${item?.status === 'aktif' ? 'selected' : ''}>Aktif</option>
                        <option value="selesai" ${item?.status === 'selesai' ? 'selected' : ''}>Selesai</option>
                    </select>
                </div>
            </form>
        `;

        Modal.open({
            title: isEdit ? 'Edit Rencana Mingguan' : 'Tambah Rencana Mingguan',
            content,
            onSave: (data) => {
                if (!Modal.validateForm(['rencanaBulanan', 'mingguKe', 'kategori', 'tanggalMulai', 'tanggalSelesai', 'status'])) {
                    Toast.show('Mohon lengkapi semua field yang diperlukan', 'error');
                    return false;
                }

                if (isEdit) {
                    Storage.update(Storage.KEYS.RENCANA_MINGGUAN, id, data);
                    Toast.show('Rencana mingguan berhasil diperbarui', 'success');
                } else {
                    Storage.add(Storage.KEYS.RENCANA_MINGGUAN, data);
                    Toast.show('Rencana mingguan berhasil ditambahkan', 'success');
                }

                this.render();
                this.populateFilters();
                Dashboard.refresh();
                return true;
            }
        });
    },

    /**
     * Manage tasks for a weekly plan
     * @param {string} id - Weekly plan ID
     */
    manageTugas(id) {
        const item = Storage.findById(Storage.KEYS.RENCANA_MINGGUAN, id);
        if (!item) return;

        const tugas = Storage.filter(Storage.KEYS.TUGAS, t => t.rencanaMingguan === id);
        const pekerja = Storage.get(Storage.KEYS.PEKERJA);

        const getPekerjaOptions = (role, selectedId = '') => {
            const filtered = pekerja.filter(p => p.role === role);
            return filtered.map(p =>
                `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${p.nama}</option>`
            ).join('');
        };

        const tugasRows = tugas.length > 0 ? tugas.map((t, index) => `
            <tr data-id="${t.id}">
                <td>${index + 1}</td>
                <td>${Utils.escapeHtml(t.namaTugas)}</td>
                <td><span class="status-badge ${t.status}">${Utils.getStatusDisplay(t.status)}</span></td>
                <td>
                    <div class="action-buttons">
                        <button type="button" class="btn btn-secondary btn-sm" onclick="RencanaMingguan.editTugas('${t.id}')">✏️</button>
                        <button type="button" class="btn btn-danger btn-sm" onclick="RencanaMingguan.deleteTugas('${t.id}', '${id}')">🗑️</button>
                    </div>
                </td>
            </tr>
        `).join('') : `
            <tr>
                <td colspan="4" class="text-center text-muted">Belum ada tugas</td>
            </tr>
        `;

        const content = `
            <div class="mb-3">
                <h4 style="margin-bottom: var(--spacing-sm);">Minggu ke-${item.mingguKe}</h4>
                <p class="text-muted" style="font-size: 0.875rem;">
                    ${Utils.formatDateShort(item.tanggalMulai)} - ${Utils.formatDateShort(item.tanggalSelesai)} • 
                    ${Utils.getCategoryDisplay(item.kategori)}
                </p>
            </div>
            
            <div class="mb-3">
                <button type="button" class="btn btn-primary btn-sm" onclick="RencanaMingguan.addTugas('${id}')">
                    + Tambah Tugas
                </button>
            </div>

            <table class="data-table" style="margin: 0;">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Nama Tugas</th>
                        <th>Status</th>
                        <th>Aksi</th>
                    </tr>
                </thead>
                <tbody id="tugasListModal">
                    ${tugasRows}
                </tbody>
            </table>
        `;

        Modal.open({
            title: 'Kelola Tugas',
            content,
            showFooter: false,
            size: 'large'
        });
    },

    /**
     * Add task to weekly plan
     * @param {string} rencanaMingguan - Weekly plan ID
     */
    addTugas(rencanaMingguan) {
        Modal.close();

        const item = Storage.findById(Storage.KEYS.RENCANA_MINGGUAN, rencanaMingguan);
        const pekerja = Storage.get(Storage.KEYS.PEKERJA);

        const getPekerjaOptions = (role) => {
            const filtered = pekerja.filter(p => p.role === role);
            return filtered.map(p => `<option value="${p.id}">${p.nama}</option>`).join('');
        };

        const content = `
            <form id="formTugas">
                <div class="form-group">
                    <label class="form-label">Nama Tugas</label>
                    <input type="text" name="namaTugas" class="form-input" required placeholder="Nama pekerjaan...">
                </div>
                <div class="form-group">
                    <label class="form-label">Deskripsi</label>
                    <textarea name="deskripsi" class="form-textarea" rows="2" placeholder="Deskripsi pekerjaan..."></textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">🔍 Surveyor</label>
                        <select name="surveyorId" class="form-select">
                            <option value="">Pilih Surveyor</option>
                            ${getPekerjaOptions('surveyor')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">📊 Estimator</label>
                        <select name="estimatorId" class="form-select">
                            <option value="">Pilih Estimator</option>
                            ${getPekerjaOptions('estimator')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">✏️ Drafter</label>
                        <select name="drafterId" class="form-select">
                            <option value="">Pilih Drafter</option>
                            ${getPekerjaOptions('drafter')}
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Prioritas</label>
                        <select name="prioritas" class="form-select">
                            <option value="1">Rendah</option>
                            <option value="2" selected>Normal</option>
                            <option value="3">Tinggi</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Deadline</label>
                        <input type="date" name="deadline" class="form-input" value="${item?.tanggalSelesai || ''}">
                    </div>
                </div>
            </form>
        `;

        Modal.open({
            title: 'Tambah Tugas',
            content,
            onSave: (data) => {
                if (!data.namaTugas.trim()) {
                    Toast.show('Nama tugas harus diisi', 'error');
                    return false;
                }

                Storage.add(Storage.KEYS.TUGAS, {
                    ...data,
                    rencanaMingguan,
                    kategori: item.kategori,
                    status: 'draft'
                });

                Toast.show('Tugas berhasil ditambahkan', 'success');
                this.render();
                Dashboard.refresh();

                // Reopen manage tugas modal
                setTimeout(() => this.manageTugas(rencanaMingguan), 300);
                return true;
            }
        });
    },

    /**
     * Edit a task
     * @param {string} tugasId - Task ID
     */
    editTugas(tugasId) {
        const tugas = Storage.findById(Storage.KEYS.TUGAS, tugasId);
        if (!tugas) return;

        Modal.close();

        const pekerja = Storage.get(Storage.KEYS.PEKERJA);

        const getPekerjaOptions = (role, selectedId = '') => {
            const filtered = pekerja.filter(p => p.role === role);
            return filtered.map(p =>
                `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${p.nama}</option>`
            ).join('');
        };

        const content = `
            <form id="formTugas">
                <div class="form-group">
                    <label class="form-label">Nama Tugas</label>
                    <input type="text" name="namaTugas" class="form-input" value="${Utils.escapeHtml(tugas.namaTugas)}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Deskripsi</label>
                    <textarea name="deskripsi" class="form-textarea" rows="2">${tugas.deskripsi || ''}</textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">🔍 Surveyor</label>
                        <select name="surveyorId" class="form-select">
                            <option value="">Pilih Surveyor</option>
                            ${getPekerjaOptions('surveyor', tugas.surveyorId)}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">📊 Estimator</label>
                        <select name="estimatorId" class="form-select">
                            <option value="">Pilih Estimator</option>
                            ${getPekerjaOptions('estimator', tugas.estimatorId)}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">✏️ Drafter</label>
                        <select name="drafterId" class="form-select">
                            <option value="">Pilih Drafter</option>
                            ${getPekerjaOptions('drafter', tugas.drafterId)}
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Status</label>
                        <select name="status" class="form-select">
                            <option value="draft" ${tugas.status === 'draft' ? 'selected' : ''}>Draft</option>
                            <option value="aktif" ${tugas.status === 'aktif' ? 'selected' : ''}>Aktif</option>
                            <option value="selesai" ${tugas.status === 'selesai' ? 'selected' : ''}>Selesai</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Deadline</label>
                        <input type="date" name="deadline" class="form-input" value="${tugas.deadline || ''}">
                    </div>
                </div>
            </form>
        `;

        Modal.open({
            title: 'Edit Tugas',
            content,
            onSave: (data) => {
                if (!data.namaTugas.trim()) {
                    Toast.show('Nama tugas harus diisi', 'error');
                    return false;
                }

                Storage.update(Storage.KEYS.TUGAS, tugasId, data);
                Toast.show('Tugas berhasil diperbarui', 'success');
                this.render();
                Dashboard.refresh();

                setTimeout(() => this.manageTugas(tugas.rencanaMingguan), 300);
                return true;
            }
        });
    },

    /**
     * Delete a task
     * @param {string} tugasId - Task ID
     * @param {string} rencanaMingguan - Weekly plan ID
     */
    async deleteTugas(tugasId, rencanaMingguan) {
        const confirmed = await Modal.confirm({
            title: 'Hapus Tugas',
            message: 'Apakah Anda yakin ingin menghapus tugas ini?',
            type: 'danger'
        });

        if (confirmed) {
            Storage.delete(Storage.KEYS.TUGAS, tugasId);
            Toast.show('Tugas berhasil dihapus', 'success');
            this.render();
            Dashboard.refresh();
            this.manageTugas(rencanaMingguan);
        }
    },

    /**
     * Delete a weekly plan
     * @param {string} id - Item ID
     */
    async delete(id) {
        const confirmed = await Modal.confirm({
            title: 'Hapus Rencana Mingguan',
            message: 'Apakah Anda yakin ingin menghapus rencana ini? Semua tugas terkait juga akan dihapus.',
            type: 'danger'
        });

        if (confirmed) {
            // Delete related tasks
            const tugas = Storage.filter(Storage.KEYS.TUGAS, t => t.rencanaMingguan === id);
            tugas.forEach(t => Storage.delete(Storage.KEYS.TUGAS, t.id));

            Storage.delete(Storage.KEYS.RENCANA_MINGGUAN, id);
            Toast.show('Rencana mingguan berhasil dihapus', 'success');
            this.render();
            this.populateFilters();
            Dashboard.refresh();
        }
    },

    /**
     * Get options for dropdowns
     */
    getOptions() {
        return Storage.get(Storage.KEYS.RENCANA_MINGGUAN).map(item => ({
            value: item.id,
            label: `Minggu ke-${item.mingguKe} (${Utils.formatDateShort(item.tanggalMulai)}) - ${Utils.getCategoryDisplay(item.kategori)}`
        }));
    }
};
