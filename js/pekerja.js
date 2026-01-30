/**
 * Pekerja Module - Handles worker data management
 */

const Pekerja = {
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
        document.getElementById('btnAddPekerja').addEventListener('click', () => {
            this.showForm();
        });

        document.getElementById('filterRole').addEventListener('change', () => this.render());
    },

    /**
     * Render the table
     */
    render() {
        const tbody = document.getElementById('tablePekerja');
        let data = Storage.get(Storage.KEYS.PEKERJA);

        // Apply filter
        const filterRole = document.getElementById('filterRole').value;
        if (filterRole) {
            data = data.filter(item => item.role === filterRole);
        }

        if (data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted" style="padding: 2rem;">
                        Belum ada data pekerja. Klik "Tambah Pekerja" untuk menambahkan.
                    </td>
                </tr>
            `;
            return;
        }

        const tugas = Storage.get(Storage.KEYS.TUGAS);
        const laporan = Storage.get(Storage.KEYS.LAPORAN_HARIAN);

        tbody.innerHTML = data.map((item, index) => {
            // Count tasks assigned to this worker
            let taskCount = 0;
            if (item.role === 'surveyor') {
                taskCount = tugas.filter(t => t.surveyorId === item.id).length +
                    laporan.filter(l => l.surveyorId === item.id).length;
            } else if (item.role === 'estimator') {
                taskCount = tugas.filter(t => t.estimatorId === item.id).length +
                    laporan.filter(l => l.estimatorId === item.id).length;
            } else if (item.role === 'drafter') {
                taskCount = tugas.filter(t => t.drafterId === item.id).length +
                    laporan.filter(l => l.drafterId === item.id).length;
            } else if (item.role === 'wasdal') {
                taskCount = tugas.filter(t => t.wasdalId === item.id).length +
                    laporan.filter(l => l.wasdalId === item.id).length;
            }

            return `
                <tr>
                    <td>${index + 1}</td>
                    <td>${Utils.escapeHtml(item.nama)}</td>
                    <td><span class="category-badge">${Utils.getRoleDisplay(item.role)}</span></td>
                    <td>${Utils.escapeHtml(item.departemen || '-')}</td>
                    <td>${taskCount}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-secondary btn-sm" onclick="Pekerja.showForm('${item.id}')" title="Edit">✏️</button>
                            <button class="btn btn-secondary btn-sm" onclick="Pekerja.viewHistory('${item.id}')" title="Riwayat">📋</button>
                            <button class="btn btn-danger btn-sm" onclick="Pekerja.delete('${item.id}')" title="Hapus">🗑️</button>
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
        const item = id ? Storage.findById(Storage.KEYS.PEKERJA, id) : null;
        const isEdit = !!item;

        const content = `
            <form id="formPekerja">
                <div class="form-group">
                    <label class="form-label">Nama Lengkap</label>
                    <input type="text" name="nama" class="form-input" value="${item?.nama || ''}" required placeholder="Nama pekerja...">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Role</label>
                        <select name="role" class="form-select" required>
                            <option value="">Pilih Role</option>
                            <option value="manager" ${item?.role === 'manager' ? 'selected' : ''}>👔 Manager Divisi</option>
                            <option value="asman_sipil" ${item?.role === 'asman_sipil' ? 'selected' : ''}>🏗️ Asman Bangunan Sipil</option>
                            <option value="asman_perpipaan" ${item?.role === 'asman_perpipaan' ? 'selected' : ''}>🔧 Asman Perpipaan</option>
                            <option value="surveyor" ${item?.role === 'surveyor' ? 'selected' : ''}>🔍 Surveyor</option>
                            <option value="estimator" ${item?.role === 'estimator' ? 'selected' : ''}>📊 Estimator</option>
                            <option value="drafter" ${item?.role === 'drafter' ? 'selected' : ''}>✏️ Drafter</option>
                            <option value="wasdal" ${item?.role === 'wasdal' ? 'selected' : ''}>👁️ Wasdal</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Departemen</label>
                        <input type="text" name="departemen" class="form-input" value="${item?.departemen || ''}" placeholder="Nama departemen...">
                    </div>
                </div>
            </form>
        `;

        Modal.open({
            title: isEdit ? 'Edit Pekerja' : 'Tambah Pekerja',
            content,
            onSave: (data) => {
                if (!data.nama.trim()) {
                    Toast.show('Nama harus diisi', 'error');
                    return false;
                }

                if (!data.role) {
                    Toast.show('Role harus dipilih', 'error');
                    return false;
                }

                if (isEdit) {
                    Storage.update(Storage.KEYS.PEKERJA, id, data);
                    Toast.show('Data pekerja berhasil diperbarui', 'success');
                } else {
                    Storage.add(Storage.KEYS.PEKERJA, data);
                    Toast.show('Pekerja berhasil ditambahkan', 'success');
                }

                this.render();
                Dashboard.refresh();
                return true;
            }
        });
    },

    /**
     * View worker history
     * @param {string} id - Worker ID
     */
    viewHistory(id) {
        const pekerja = Storage.findById(Storage.KEYS.PEKERJA, id);
        if (!pekerja) return;

        const laporan = Storage.get(Storage.KEYS.LAPORAN_HARIAN);
        const tugas = Storage.get(Storage.KEYS.TUGAS);

        // Filter based on role
        let workerLaporan = [];
        let assignedTugas = [];

        if (pekerja.role === 'surveyor') {
            workerLaporan = laporan.filter(l => l.surveyorId === id);
            assignedTugas = tugas.filter(t => t.surveyorId === id);
        } else if (pekerja.role === 'estimator') {
            workerLaporan = laporan.filter(l => l.estimatorId === id);
            assignedTugas = tugas.filter(t => t.estimatorId === id);
        } else if (pekerja.role === 'drafter') {
            workerLaporan = laporan.filter(l => l.drafterId === id);
            assignedTugas = tugas.filter(t => t.drafterId === id);
        } else if (pekerja.role === 'wasdal') {
            workerLaporan = laporan.filter(l => l.wasdalId === id);
            assignedTugas = tugas.filter(t => t.wasdalId === id);
        }

        const laporanRows = workerLaporan.length > 0 ? workerLaporan.slice(-10).reverse().map(l => `
            <tr>
                <td>${Utils.formatDateShort(l.tanggal)}</td>
                <td>${Utils.escapeHtml(Utils.truncate(l.namaTugas || '-', 30))}</td>
                <td>${l.progress}%</td>
            </tr>
        `).join('') : '<tr><td colspan="3" class="text-center text-muted">Belum ada laporan</td></tr>';

        const content = `
            <div style="display: grid; gap: var(--spacing-lg);">
                <div style="display: flex; align-items: center; gap: var(--spacing-md);">
                    <div class="user-avatar" style="width: 60px; height: 60px; font-size: 2rem;">👤</div>
                    <div>
                        <h3>${Utils.escapeHtml(pekerja.nama)}</h3>
                        <span class="category-badge">${Utils.getRoleDisplay(pekerja.role)}</span>
                        <span class="text-muted" style="margin-left: var(--spacing-sm);">${pekerja.departemen || '-'}</span>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--spacing-md);">
                    <div style="padding: var(--spacing-md); background: var(--bg-tertiary); border-radius: var(--radius-md); text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${assignedTugas.length}</div>
                        <span class="text-muted">Tugas Ditugaskan</span>
                    </div>
                    <div style="padding: var(--spacing-md); background: var(--bg-tertiary); border-radius: var(--radius-md); text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${workerLaporan.length}</div>
                        <span class="text-muted">Laporan Dibuat</span>
                    </div>
                </div>

                <div>
                    <h4 style="margin-bottom: var(--spacing-sm);">Riwayat Laporan Terbaru</h4>
                    <table class="data-table" style="margin: 0;">
                        <thead>
                            <tr>
                                <th>Tanggal</th>
                                <th>Pekerjaan</th>
                                <th>Progress</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${laporanRows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        Modal.open({
            title: 'Profil Pekerja',
            content,
            size: 'large',
            showFooter: false
        });
    },

    /**
     * Delete a worker
     * @param {string} id - Item ID
     */
    async delete(id) {
        const pekerja = Storage.findById(Storage.KEYS.PEKERJA, id);
        if (!pekerja) return;

        const confirmed = await Modal.confirm({
            title: 'Hapus Pekerja',
            message: `Apakah Anda yakin ingin menghapus ${pekerja.nama}?`,
            type: 'danger'
        });

        if (confirmed) {
            Storage.delete(Storage.KEYS.PEKERJA, id);
            Toast.show('Pekerja berhasil dihapus', 'success');
            this.render();
            Dashboard.refresh();
        }
    }
};
