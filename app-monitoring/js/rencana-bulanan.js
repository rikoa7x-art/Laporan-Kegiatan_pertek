/**
 * Rencana Bulanan Module - Handles monthly work plans
 */

const RencanaBulanan = {
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
        document.getElementById('btnAddRencanaBulanan').addEventListener('click', () => {
            this.showForm();
        });
    },

    /**
     * Render the table
     */
    render() {
        const tbody = document.getElementById('tableRencanaBulanan');
        const data = Storage.get(Storage.KEYS.RENCANA_BULANAN);

        if (data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted" style="padding: 2rem;">
                        Belum ada rencana bulanan. Klik "Tambah Rencana" untuk membuat.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = data.map((item, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${Utils.getMonthName(parseInt(item.bulan))} ${item.tahun}</td>
                <td>${Utils.escapeHtml(Utils.truncate(item.targetUtama, 40))}</td>
                <td><span class="category-badge ${item.kategori}">${Utils.getCategoryDisplay(item.kategori)}</span></td>
                <td><span class="status-badge ${item.status}">${Utils.getStatusDisplay(item.status)}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-secondary btn-sm" onclick="RencanaBulanan.showForm('${item.id}')" title="Edit">✏️</button>
                        <button class="btn btn-secondary btn-sm" onclick="RencanaBulanan.breakdown('${item.id}')" title="Breakdown">📋</button>
                        <button class="btn btn-danger btn-sm" onclick="RencanaBulanan.delete('${item.id}')" title="Hapus">🗑️</button>
                    </div>
                </td>
            </tr>
        `).join('');
    },

    /**
     * Show add/edit form
     * @param {string} id - Item ID for editing (optional)
     */
    showForm(id = null) {
        const item = id ? Storage.findById(Storage.KEYS.RENCANA_BULANAN, id) : null;
        const isEdit = !!item;

        const currentDate = new Date();
        const currentMonth = item?.bulan || currentDate.getMonth();
        const currentYear = item?.tahun || currentDate.getFullYear();

        const monthOptions = Array.from({ length: 12 }, (_, i) =>
            `<option value="${i}" ${i == currentMonth ? 'selected' : ''}>${Utils.getMonthName(i)}</option>`
        ).join('');

        const yearOptions = Array.from({ length: 5 }, (_, i) => {
            const year = currentYear - 2 + i;
            return `<option value="${year}" ${year == currentYear ? 'selected' : ''}>${year}</option>`;
        }).join('');

        const content = `
            <form id="formRencanaBulanan">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Bulan</label>
                        <select name="bulan" class="form-select" required>
                            ${monthOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Tahun</label>
                        <select name="tahun" class="form-select" required>
                            ${yearOptions}
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Kategori Pekerjaan</label>
                    <select name="kategori" class="form-select" required>
                        <option value="">Pilih Kategori</option>
                        <option value="sipil" ${item?.kategori === 'sipil' ? 'selected' : ''}>🏗️ Bangunan Sipil</option>
                        <option value="perpipaan" ${item?.kategori === 'perpipaan' ? 'selected' : ''}>🔧 Perpipaan</option>
                        <option value="pengawasan" ${item?.kategori === 'pengawasan' ? 'selected' : ''}>👁️ Pengawasan</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Target Utama</label>
                    <textarea name="targetUtama" class="form-textarea" rows="3" required placeholder="Jelaskan target utama bulan ini...">${item?.targetUtama || ''}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Daftar Pekerjaan</label>
                    <textarea name="daftarPekerjaan" class="form-textarea" rows="4" placeholder="Daftar pekerjaan yang akan dilakukan (satu per baris)...">${item?.daftarPekerjaan || ''}</textarea>
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
            title: isEdit ? 'Edit Rencana Bulanan' : 'Tambah Rencana Bulanan',
            content,
            onSave: (data) => {
                if (!Modal.validateForm(['bulan', 'tahun', 'kategori', 'targetUtama', 'status'])) {
                    Toast.show('Mohon lengkapi semua field yang diperlukan', 'error');
                    return false;
                }

                if (isEdit) {
                    Storage.update(Storage.KEYS.RENCANA_BULANAN, id, data);
                    Toast.show('Rencana bulanan berhasil diperbarui', 'success');
                } else {
                    Storage.add(Storage.KEYS.RENCANA_BULANAN, data);
                    Toast.show('Rencana bulanan berhasil ditambahkan', 'success');
                }

                this.render();
                Dashboard.refresh();
                return true;
            }
        });
    },

    /**
     * Breakdown monthly plan to weekly
     * @param {string} id - Monthly plan ID
     */
    async breakdown(id) {
        const item = Storage.findById(Storage.KEYS.RENCANA_BULANAN, id);
        if (!item) return;

        const confirmed = await Modal.confirm({
            title: 'Breakdown ke Mingguan',
            message: `Buat breakdown mingguan untuk ${Utils.getMonthName(parseInt(item.bulan))} ${item.tahun}?`,
            type: 'info'
        });

        if (!confirmed) return;

        // Create 4 weeks
        for (let week = 1; week <= 4; week++) {
            const weekDates = Utils.getWeekDates(parseInt(item.tahun), parseInt(item.bulan), week);

            Storage.add(Storage.KEYS.RENCANA_MINGGUAN, {
                rencanaBulanan: id,
                mingguKe: week,
                tanggalMulai: Utils.formatDateInput(weekDates.start),
                tanggalSelesai: Utils.formatDateInput(weekDates.end),
                kategori: item.kategori,
                status: 'draft'
            });
        }

        Toast.show(`4 rencana mingguan berhasil dibuat untuk ${Utils.getMonthName(parseInt(item.bulan))}`, 'success');
        RencanaMingguan.render();
        Dashboard.refresh();
    },

    /**
     * Delete a monthly plan
     * @param {string} id - Item ID
     */
    async delete(id) {
        const confirmed = await Modal.confirm({
            title: 'Hapus Rencana Bulanan',
            message: 'Apakah Anda yakin ingin menghapus rencana ini? Semua data terkait juga akan dihapus.',
            type: 'danger',
            confirmText: 'Hapus'
        });

        if (confirmed) {
            // Delete related weekly plans
            const weeklyPlans = Storage.filter(Storage.KEYS.RENCANA_MINGGUAN,
                item => item.rencanaBulanan === id);
            weeklyPlans.forEach(plan => {
                Storage.delete(Storage.KEYS.RENCANA_MINGGUAN, plan.id);
            });

            Storage.delete(Storage.KEYS.RENCANA_BULANAN, id);
            Toast.show('Rencana bulanan berhasil dihapus', 'success');
            this.render();
            Dashboard.refresh();
        }
    },

    /**
     * Get options for dropdowns
     */
    getOptions() {
        return Storage.get(Storage.KEYS.RENCANA_BULANAN).map(item => ({
            value: item.id,
            label: `${Utils.getMonthName(parseInt(item.bulan))} ${item.tahun} - ${Utils.getCategoryDisplay(item.kategori)}`
        }));
    }
};
