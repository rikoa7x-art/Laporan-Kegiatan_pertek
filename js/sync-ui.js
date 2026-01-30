/**
 * SyncUI - Shared UI logic for Cloud Synchronization (Firebase)
 */
const SyncUI = {
    showSettings() {
        const content = `
            <div style="display: flex; flex-direction: column; gap: var(--spacing-md);">
                <div style="background: rgba(245, 158, 11, 0.1); padding: var(--spacing-md); border-radius: var(--radius-md); border-left: 4px solid var(--warning);">
                    <p style="font-size: 0.875rem; margin: 0;">
                        <strong>Cloud Sync (Firebase)</strong><br>
                        Gunakan untuk menghubungkan data antara HP dan Laptop.
                    </p>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Firebase API Key</label>
                    <input type="password" id="fbApiKey" class="form-input" placeholder="AIza..." value="${Storage.config.apiKey}">
                </div>
                
                <div class="form-group">
                    <label class="form-label">Firebase Database URL</label>
                    <input type="text" id="fbDbUrl" class="form-input" placeholder="https://project-id.firebaseio.com" value="${Storage.config.databaseURL}">
                </div>

                <div class="form-group">
                    <label class="form-label">Firebase Project ID</label>
                    <input type="text" id="fbProjectId" class="form-input" placeholder="project-id-123" value="${Storage.config.projectId}">
                </div>
                
                <div style="display: flex; align-items: center; gap: var(--spacing-sm); margin-top: var(--spacing-sm);">
                    <input type="checkbox" id="autoSync" ${Storage.config.autoSync ? 'checked' : ''} style="width: 18px; height: 18px;">
                    <label for="autoSync" style="cursor: pointer; font-size: 0.875rem;">Aktifkan Sinkronisasi Otomatis</label>
                </div>

                <hr style="border: 0; border-top: 1px solid var(--border-color); margin: var(--spacing-sm) 0;">

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-md);">
                    <button onclick="SyncUI.handlePush()" class="btn btn-secondary" style="width: 100%; border: 1px solid var(--border-color);">⬆️ Upload ke Cloud</button>
                    <button onclick="SyncUI.handlePull()" class="btn btn-secondary" style="width: 100%; border: 1px solid var(--border-color);">⬇️ Download dari Cloud</button>
                </div>
            </div>
        `;

        Modal.open({
            title: '⚙️ Pengaturan Cloud (Firebase)',
            content,
            size: 'medium',
            onSave: () => {
                const config = {
                    apiKey: document.getElementById('fbApiKey').value.trim(),
                    databaseURL: document.getElementById('fbDbUrl').value.trim(),
                    projectId: document.getElementById('fbProjectId').value.trim(),
                    autoSync: document.getElementById('autoSync').checked
                };

                if (!config.apiKey || !config.databaseURL) {
                    Toast.show('API Key dan Database URL wajib diisi', 'warning');
                    return false;
                }

                Storage.saveConfig(config);
                Toast.show('Pengaturan disimpan', 'success');
                return true;
            }
        });
    },

    async handlePush() {
        if (!Storage.config.apiKey || !Storage.config.databaseURL) {
            Toast.show('Konfigurasi Cloud belum lengkap', 'warning');
            return;
        }
        Toast.show('Sedang mengunggah...', 'info');
        const result = await Storage.push();
        if (result.success) {
            Toast.show('Data berhasil diunggah ke Cloud!', 'success');
        } else {
            Toast.show('Gagal: ' + result.message, 'error');
        }
    },

    async handlePull() {
        if (!Storage.config.apiKey || !Storage.config.databaseURL) {
            Toast.show('Konfigurasi Cloud belum lengkap', 'warning');
            return;
        }
        if (!confirm('Data lokal Anda akan diganti dengan data dari Cloud. Lanjutkan?')) return;

        Toast.show('Sedang mengunduh...', 'info');
        const result = await Storage.pull();
        if (result.success) {
            Toast.show('Data berhasil disinkronkan!', 'success');
            setTimeout(() => window.location.reload(), 1000);
        } else {
            Toast.show('Gagal: ' + result.message, 'error');
        }
    }
};
