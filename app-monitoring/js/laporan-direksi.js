/**
 * Laporan Direksi Module - Generates weekly reports for the board of directors
 */

const LaporanDireksi = {
    /**
     * Show the weekly report modal
     */
    show() {
        const today = new Date();
        const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

        const startDate = Utils.formatDateInput(lastWeek);
        const endDate = Utils.formatDateInput(today);

        this.renderModal(startDate, endDate);
    },

    /**
     * Render the report modal with date filters
     * @param {string} startDate 
     * @param {string} endDate 
     */
    renderModal(startDate, endDate) {
        const content = `
            <div class="report-filters" style="display: flex; gap: var(--spacing-md); margin-bottom: var(--spacing-lg); background: var(--bg-tertiary); padding: var(--spacing-md); border-radius: var(--radius-md);">
                <div class="form-group" style="margin-bottom: 0; flex: 1;">
                    <label class="form-label" style="font-size: 0.75rem;">Tanggal Mulai</label>
                    <input type="date" id="reportStartDate" class="form-input" value="${startDate}">
                </div>
                <div class="form-group" style="margin-bottom: 0; flex: 1;">
                    <label class="form-label" style="font-size: 0.75rem;">Tanggal Selesai</label>
                    <input type="date" id="reportEndDate" class="form-input" value="${endDate}">
                </div>
                <div style="display: flex; align-items: flex-end;">
                    <button class="btn btn-primary" onclick="LaporanDireksi.updateReport()">🔄 Update</button>
                </div>
            </div>

            <div id="reportContent" class="printable-report" style="background: white; color: #1e293b; padding: var(--spacing-md); border-radius: var(--radius-md); border: 1px solid var(--border-color); min-height: 500px; overflow-x: hidden;">
                ${this.generateReportHtml(startDate, endDate)}
            </div>
        `;

        Modal.open({
            title: '📊 Laporan Mingguan Direksi',
            content,
            size: 'full',
            showFooter: true,
            onSave: () => {
                this.printReport();
                return false; // Don't close modal
            }
        });

        // Change "Simpan" button text to "Cetak"
        const saveBtn = document.getElementById('modalSave');
        if (saveBtn) {
            saveBtn.innerHTML = '🖨️ Cetak Laporan';
            saveBtn.className = 'btn btn-primary';
        }
    },

    /**
     * Update report based on selected dates
     */
    updateReport() {
        const startDate = document.getElementById('reportStartDate').value;
        const endDate = document.getElementById('reportEndDate').value;

        document.getElementById('reportContent').innerHTML = this.generateReportHtml(startDate, endDate);
    },

    /**
     * Generate HTML for the report
     */
    generateReportHtml(startDate, endDate) {
        const pekerjaan = Storage.get(Storage.KEYS.PEKERJAAN);
        const pekerja = Storage.get(Storage.KEYS.PEKERJA);

        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        // Filter pekerjaan that had activity in this range
        const reportData = pekerjaan.filter(item => {
            return item.tahapan.some(t => {
                const tStart = new Date(t.tanggalMulai);
                const tEnd = t.tanggalSelesai ? new Date(t.tanggalSelesai) : new Date();
                return (tStart <= end && tEnd >= start);
            });
        });

        if (reportData.length === 0) {
            return `
                <div style="text-align: center; padding: 3rem; color: #64748b;">
                    <span style="font-size: 3rem; display: block; margin-bottom: 1rem;">📋</span>
                    <p>Tidak ada aktivitas pekerjaan pada periode ini.</p>
                </div>
            `;
        }

        // Group by category
        const categories = {
            sipil: reportData.filter(p => p.kategori === 'sipil'),
            perpipaan: reportData.filter(p => p.kategori === 'perpipaan')
        };

        let html = `
            <div style="text-align: center; margin-bottom: 2rem; border-bottom: 2px solid #334155; padding-bottom: 1rem;">
                <h1 style="font-size: 1.5rem; margin-bottom: 0.5rem; color: #0f172a;">LAPORAN MINGGUAN KEGIATAN TEKNIK</h1>
                <p style="color: #64748b; font-size: 0.875rem;">Periode: ${Utils.formatDateShort(startDate)} s/d ${Utils.formatDateShort(endDate)}</p>
            </div>
        `;

        for (const [key, items] of Object.entries(categories)) {
            if (items.length === 0) continue;

            html += `
                <div style="margin-bottom: 2rem;">
                    <h2 style="font-size: 1.125rem; background: #f1f5f9; padding: 0.5rem 1rem; border-left: 4px solid #3b82f6; margin-bottom: 1rem; color: #1e293b;">
                        ${key === 'sipil' ? '🏗️ BANGUNAN SIPIL' : '🔧 PERPIPAAN'}
                    </h2>
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.875rem;">
                        <thead>
                            <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                                <th style="padding: 0.75rem; text-align: left; width: 30%;">NAMA PEKERJAAN / LOKASI</th>
                                <th style="padding: 0.75rem; text-align: left; width: 15%;">STATUS</th>
                                <th style="padding: 0.75rem; text-align: left; width: 30%;">INDIVIDU / PERSONEL</th>
                                <th style="padding: 0.75rem; text-align: left; width: 25%;">PROGRESS & CATATAN</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            items.forEach(item => {
                const currentTahap = item.tahapan[item.tahapan.length - 1];
                const activeTahapan = item.tahapan.filter(t => {
                    const tStart = new Date(t.tanggalMulai);
                    const tEnd = t.tanggalSelesai ? new Date(t.tanggalSelesai) : new Date();
                    return (tStart <= end && tEnd >= start);
                });

                const personnel = activeTahapan.flatMap(t => {
                    return t.pelaksana.map(id => {
                        const p = pekerja.find(pk => pk.id === id);
                        return p ? `${p.nama} (${Utils.getStatusDisplay(t.status)})` : null;
                    });
                }).filter((v, i, a) => v && a.indexOf(v) === i); // Unique

                const progress = this.calculateProgress(item.status);

                html += `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 0.75rem; vertical-align: top;">
                            <div style="font-weight: 600; color: #0f172a;">${Utils.escapeHtml(item.namaPekerjaan)}</div>
                            <div style="font-size: 0.75rem; color: #64748b;">📍 ${Utils.escapeHtml(item.lokasi || '-')}</div>
                        </td>
                        <td style="padding: 0.75rem; vertical-align: top;">
                            <span style="display: inline-block; padding: 0.25rem 0.5rem; border-radius: 9999px; font-size: 0.7rem; font-weight: 600; background: ${this.getStatusBgColor(item.status)}; color: white;">
                                ${Utils.getStatusDisplay(item.status)}
                            </span>
                        </td>
                        <td style="padding: 0.75rem; vertical-align: top; font-size: 0.75rem; line-height: 1.5;">
                            ${personnel.map(p => `• ${p}`).join('<br>')}
                        </td>
                        <td style="padding: 0.75rem; vertical-align: top;">
                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                <div style="flex: 1; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden;">
                                    <div style="width: ${progress}%; height: 100%; background: #3b82f6;"></div>
                                </div>
                                <span style="font-weight: 600; font-size: 0.75rem;">${progress}%</span>
                            </div>
                            <div style="font-size: 0.75rem; color: #475569; font-style: italic; margin-bottom: 0.5rem;">
                                ${Utils.escapeHtml(currentTahap?.catatan || 'Tidak ada catatan terbaru')}
                            </div>
                            ${item.dokumen && item.dokumen.length > 0 ? `
                                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 5px; margin-top: 5px;">
                                    ${item.dokumen.filter(d => d.type.startsWith('image/')).slice(0, 4).map(img => `
                                        <div style="height: 60px; border-radius: 4px; overflow: hidden; border: 1px solid #e2e8f0;">
                                            <img src="${img.data}" style="width: 100%; height: 100%; object-fit: cover;">
                                        </div>
                                    `).join('')}
                                </div>
                                <div style="font-size: 0.65rem; color: #94a3b8; margin-top: 2px;">
                                    ${item.dokumen.length} dokumen terlampir
                                </div>
                            ` : ''}
                        </td>
                    </tr>
                `;
            });

            html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }

        // Add Approval Section
        html += `
            <div style="display: flex; flex-wrap: wrap; justify-content: space-between; margin-top: 3rem; padding: 0 1rem; gap: 2rem;">
                <div style="text-align: center; flex: 1; min-width: 150px;">
                    <p style="margin-bottom: 3rem; font-size: 0.875rem;">Dibuat Oleh,</p>
                    <div style="border-top: 1px solid #000; padding-top: 0.5rem; margin: 0 auto; width: 80%;">
                        <strong style="font-size: 0.875rem;">Staff Perencanaan</strong>
                    </div>
                </div>
                <div style="text-align: center; flex: 1; min-width: 150px;">
                    <p style="margin-bottom: 3rem; font-size: 0.875rem;">Mengetahui,</p>
                    <div style="border-top: 1px solid #000; padding-top: 0.5rem; margin: 0 auto; width: 80%;">
                        <strong style="font-size: 0.875rem;">Asman / Manager</strong>
                    </div>
                </div>
                <div style="text-align: center; flex: 1; min-width: 150px;">
                    <p style="margin-bottom: 3rem; font-size: 0.875rem;">Menyetujui,</p>
                    <div style="border-top: 1px solid #000; padding-top: 0.5rem; margin: 0 auto; width: 80%;">
                        <strong style="font-size: 0.875rem;">Direksi</strong>
                    </div>
                </div>
            </div>
        `;

        return html;
    },

    /**
     * Get CSS color for status in report
     */
    getStatusBgColor(status) {
        const colors = {
            survey: '#3b82f6',
            drafting: '#f59e0b',
            estimasi: '#8b5cf6',
            review_asman: '#ec4899',
            approval: '#10b981',
            wasdal: '#06b6d4',
            selesai: '#10b981'
        };
        return colors[status] || '#64748b';
    },

    /**
     * Calculate progress (simplified from Pekerjaan module)
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
     * Print the report
     */
    printReport() {
        const content = document.getElementById('reportContent').innerHTML;
        const printWindow = window.open('', '_blank');

        printWindow.document.write(`
            <html>
                <head>
                    <title>Laporan Mingguan Direksi</title>
                    <style>
                        body { font-family: 'Inter', sans-serif; padding: 20px; color: #1e293b; }
                        @media print {
                            body { padding: 0; }
                            .no-print { display: none; }
                        }
                        table { border-collapse: collapse; }
                        th, td { border: 1px solid #e2e8f0; }
                    </style>
                </head>
                <body onload="window.print(); window.close();">
                    ${content}
                </body>
            </html>
        `);
        printWindow.document.close();
    }
};
