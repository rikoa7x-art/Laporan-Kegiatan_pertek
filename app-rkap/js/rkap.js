/**
 * RKAP Application
 * Handles logic for Rencana Kerja & Anggaran
 */

const RkapApp = {
    state: {
        weeklyPlans: {},
        dailyPlans: {},
        manualPrograms: [],
        selectedItems: new Set(),
        filters: {
            search: '',
            branch: '',
            month: '',
            dailyWeek: 'W1'
        },
        personnel: {
            manager: ["Dadi Riswadi"],
            asman: ["M. Sulaeman", "Riko Komara"],
            staff: ["Dian Suhendrik", "Yunia", "Anditya", "Fahry", "Aldy"]
        },
        viewMode: 'list', // 'list' or 'table'
        displayLimit: 50
    },

    // Helper: Add business days (skip Saturday & Sunday)
    addBusinessDays(startDate, days) {
        const result = new Date(startDate);
        let added = 0;
        while (added < days) {
            result.setDate(result.getDate() + 1);
            const dayOfWeek = result.getDay();
            // Skip Saturday (6) and Sunday (0)
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                added++;
            }
        }
        return result;
    },

    init() {
        console.log('🚀 Initializing RKAP App...');

        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const currentMonthName = months[new Date().getMonth()];

        // Initialize default month if not already in state
        if (!this.state.filters.month) {
            this.state.filters.month = currentMonthName;
        }

        this.setupNavigation();

        // Setup Firebase sync callback for real-time updates
        Storage.onSyncCallback = () => {
            console.log('🔄 Data synced from Firebase, reloading...');
            this.loadData();
        };

        // Load master data
        this.loadMasterData();

        // Wait for storage to be ready if needed
        if (Storage.isInitialized) {
            Storage.isInitialized.then(() => this.loadData());
        } else {
            this.loadData();
        }

        // Check for hash to load correct view
        const hash = window.location.hash.slice(1) || 'dashboard';
        this.navigateTo(hash);
    },

    setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const view = item.dataset.view;
                // Allow default behavior to update hash
                setTimeout(() => this.navigateTo(view), 0);
            });
        });

        // Handle Back/Forward browser buttons
        window.addEventListener('hashchange', () => {
            const hash = window.location.hash.slice(1) || 'dashboard';
            this.navigateTo(hash);
        });
    },

    navigateTo(viewId) {
        // Update Nav State
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.toggle('active', el.dataset.view === viewId);
            el.classList.toggle('bg-slate-700', el.dataset.view === viewId);
            el.classList.toggle('text-white', el.dataset.view === viewId);
            el.classList.toggle('text-slate-400', el.dataset.view !== viewId);
        });

        // Update View Visibility
        document.querySelectorAll('.view-section').forEach(el => {
            el.classList.add('hidden');
        });

        const targetView = document.getElementById(`view-${viewId}`);
        if (targetView) {
            targetView.classList.remove('hidden');
        }

        // Update Header Title
        const titles = {
            'dashboard': 'Program Kerja',
            'monthly': 'Rencana Bulanan',
            'weekly': 'Rencana Mingguan',
            'daily': 'Monitoring Harian'
        };
        const titleEl = document.getElementById('pageTitle');
        if (titleEl) titleEl.textContent = titles[viewId] || 'RKAP';

        // Render appropriate content
        this.currentView = viewId;
        this.render();

        // Ensure icons are created after view switch
        if (window.lucide) {
            lucide.createIcons();
        }
    },

    async loadMasterData() {
        try {
            console.log('📂 Loading master data...');

            // 1. Try Global Variable PROGRAM_DATA (Best for local file:// protocol)
            if (window.PROGRAM_DATA) {
                this.masterData = window.PROGRAM_DATA
                    .filter(row => {
                        // Filter out "Total Investasi" entries (case insensitive)
                        const desc = (row.description || '').toLowerCase();
                        return !desc.includes('total investasi');
                    })
                    .map(row => ({
                        id: row.id || Math.random().toString(36).substr(2, 9),
                        code: row.code || '',
                        description: row.description || '',
                        branch: row.branch || 'KANTOR PUSAT',
                        category: row.category || 'Umum',
                        pagu: row.total || row.pagu || 0,
                        monthly: row.monthly || {}
                    }));
                console.log(`📚 Loaded ${this.masterData.length} programs from program_data.js`);
                this.render();
                return;
            }

            // 2. Try JSON Master Data (CORS-sensitive)
            try {
                const jsonResponse = await fetch('program_data.json');
                if (jsonResponse.ok) {
                    const rawData = await jsonResponse.json();
                    this.masterData = rawData
                        .filter(row => {
                            // Filter out "Total Investasi" entries
                            const desc = (row.description || '').toLowerCase();
                            return !desc.includes('total investasi');
                        })
                        .map(row => ({
                            id: row.id || Math.random().toString(36).substr(2, 9),
                            code: row.code || '',
                            description: row.description || '',
                            branch: row.branch || 'KANTOR PUSAT',
                            category: row.category || 'Umum',
                            pagu: row.total || row.pagu || 0,
                            monthly: row.monthly || {}
                        }));
                    console.log(`📚 Loaded ${this.masterData.length} programs from program_data.json`);
                    this.render();
                    return;
                }
            } catch (e) {
                console.warn('program_data.json not found/blocked');
            }

            // 3. Try Global Variable RKAP_MASTER_DATA (Fallback)
            if (window.RKAP_MASTER_DATA) {
                this.masterData = window.RKAP_MASTER_DATA;
                console.log(`📚 Loaded ${this.masterData.length} programs from rkap_data.js`);
                this.render();
                return;
            }

            // 4. Fallback to Excel if all fails
            console.log('🔄 Falling back to Excel parsing...');
            if (typeof XLSX !== 'undefined') {
                const response = await fetch('rkap_2026.xlsx');
                if (!response.ok) throw new Error(`Gagal mengunduh file: ${response.status}`);

                const arrayBuffer = await response.arrayBuffer();
                const workbook = XLSX.read(arrayBuffer);
                const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

                this.masterData = rawData
                    .map(row => ({
                        id: row.id || row.ID || '',
                        code: row.Kode || row.KODE || row.kode || row['No'] || '',
                        description: row.Program || row.PROGRAM || row.Deskripsi || row['Nama Program'] || '',
                        branch: row.Cabang || row.CABANG || '',
                        category: row.Kategori || row.KATEGORI || 'Umum',
                        pagu: row.Pagu || row.PAGU || row['Anggaran'] || 0
                    }))
                    .filter(item => {
                        // Filter out empty descriptions and "Total Investasi" entries
                        if (!item.description) return false;
                        const desc = item.description.toLowerCase();
                        return !desc.includes('total investasi');
                    });

                console.log(`📚 Loaded ${this.masterData.length} programs from Excel`);
                this.render();
            } else {
                throw new Error('Library XLSX belum dimuat.');
            }
        } catch (e) {
            console.error('❌ Data Load Error:', e);
            Toast.show(`Gagal memuat: ${e.message}`, 'error');
        }
    },

    loadData() {
        // 1. Load from Shared Storage (Single Source of Truth)
        const savedData = Storage.get(Storage.KEYS.RKAP, true);

        if (savedData && Object.keys(savedData).length > 0) {
            this.state = { ...this.state, ...savedData };
            // Convert array back to Set for selectedItems
            if (this.state.selectedItems && Array.isArray(this.state.selectedItems)) {
                this.state.selectedItems = new Set(this.state.selectedItems);
            }

            // Merge manual programs back into masterData
            if (this.state.manualPrograms && Array.isArray(this.state.manualPrograms)) {
                this.state.manualPrograms.forEach(mp => {
                    // Check if not already in masterData
                    if (!this.masterData.some(m => m.description === mp.description)) {
                        this.masterData.push(mp);
                    }
                });
                console.log(`📋 Merged ${this.state.manualPrograms.length} manual programs into master data`);
            }

            // Restore viewMode from saved state if exists (it might be in ...savedData, but ensure defaults)
            if (!this.state.viewMode) this.state.viewMode = 'list';
            this.state.displayLimit = 50; // Reset limit on reload

        } else {
            console.log('ℹ️ No existing RKAP data found in Storage');
        }

        // Update sync time
        const syncTimeEl = document.getElementById('lastSyncTime');
        if (syncTimeEl) {
            const now = new Date();
            syncTimeEl.textContent = `Last synced: ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        }

        console.log('📊 RKAP State loaded:', this.state);
        this.render();
    },

    saveData() {
        // Prepare state for storage (convert Set to Array)
        const dataToSave = {
            ...this.state,
            selectedItems: Array.from(this.state.selectedItems)
        };

        Storage.set(Storage.KEYS.RKAP, dataToSave);
        console.log('💾 Data saved to Storage');
    },

    // Save and sync to cloud explicitly
    async saveAndSync() {
        Toast.show('Menyimpan data...', 'info');

        // Save locally first
        this.saveData();

        // Force push to cloud
        try {
            const result = await Storage.push(Storage.KEYS.RKAP);
            if (result && result.success !== false) {
                const now = new Date();
                const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
                const syncTimeEl = document.getElementById('lastSyncTime');
                if (syncTimeEl) {
                    syncTimeEl.textContent = `Synced: ${timeStr}`;
                }
                Toast.show('✅ Data berhasil disimpan & disinkronkan!', 'success');
            } else {
                Toast.show('Data disimpan lokal. Cloud sync tidak aktif.', 'info');
            }
        } catch (error) {
            console.error('Sync error:', error);
            Toast.show('Data disimpan lokal. Gagal sync ke cloud.', 'warning');
        }
    },

    render() {
        const syncIndicator = document.getElementById('syncStatusIndicator');
        if (syncIndicator) {
            syncIndicator.className = `w-2 h-2 rounded-full ${Storage.config?.autoSync ? 'bg-green-500' : 'bg-slate-500'}`;
        }

        switch (this.currentView) {
            case 'dashboard': this.renderDashboard(); break;
            case 'monthly': this.renderMonthly(); break;
            case 'weekly': this.renderWeekly(); break;
            case 'daily': this.renderDaily(); break;
            case 'direksi': this.renderDireksi(); break;
            default: this.renderDashboard();
        }
    },

    renderDashboard() {
        const container = document.getElementById('view-dashboard');
        if (!container) return;

        // Get unique branches for filter
        const branches = [...new Set((this.masterData || []).map(p => p.branch).filter(Boolean))].sort();
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

        // Validate filters against current data
        if (this.state.filters.branch && !branches.includes(this.state.filters.branch)) {
            console.warn(`Filter branch "${this.state.filters.branch}" is invalid, resetting...`);
            this.state.filters.branch = '';
        }

        // Get filtered data for stats
        const { search, branch, month } = this.state.filters;
        const query = (search || '').toLowerCase();

        const filtered = (this.masterData || []).filter(p => {
            const matchesSearch = !query ||
                p.description.toLowerCase().includes(query) ||
                p.code.toLowerCase().includes(query) ||
                (p.category && p.category.toLowerCase().includes(query));
            const matchesBranch = !branch || p.branch === branch;
            let matchesMonth = true;
            if (month) {
                let searchMonth = month.toUpperCase();
                if (searchMonth === 'NOVEMBER') searchMonth = 'NOPEMBER';
                if (p.monthly && Object.keys(p.monthly).length > 0) {
                    matchesMonth = (p.monthly[searchMonth] || 0) > 0;
                }
            }
            return matchesSearch && matchesBranch && matchesMonth;
        });

        const totalMaster = this.masterData ? this.masterData.length : 0;
        const totalFiltered = filtered.length;
        const totalPaguFiltered = filtered.reduce((acc, p) => acc + (p.pagu || 0), 0);
        const totalSelected = this.state.selectedItems.size;

        container.innerHTML = `
            <!-- Full Width: Database Program Kerja -->
            <div class="card-premium h-[calc(100vh-200px)] flex flex-col overflow-hidden animate-fade-in">
                <div class="p-6 border-b border-slate-700/50 bg-white/5 space-y-4">
                    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h3 class="font-bold text-xl text-white">📋 Database Program Kerja</h3>
                            <p id="items-count-label" class="text-sm text-slate-400 mt-1">Menampilkan ${totalFiltered.toLocaleString()} dari ${totalMaster.toLocaleString()} program</p>
                        </div>
                        
                        <div class="flex items-center gap-2 flex-wrap">
                            <!-- View Toggle -->
                            <div class="bg-slate-800/50 p-1 rounded-xl border border-slate-700/50 flex items-center">
                                <button onclick="RkapApp.setViewMode('list')" 
                                    class="p-2 rounded-lg transition-all ${this.state.viewMode === 'list' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}"
                                    title="Tampilan Kartu">
                                    <i data-lucide="layout-list" class="w-4 h-4"></i>
                                </button>
                                <button onclick="RkapApp.setViewMode('table')" 
                                    class="p-2 rounded-lg transition-all ${this.state.viewMode === 'table' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}"
                                    title="Tampilan Tabel (Padat)">
                                    <i data-lucide="table-2" class="w-4 h-4"></i>
                                </button>
                            </div>
                            <div class="w-px h-8 bg-slate-700/50 mx-1"></div>

                            <button onclick="RkapApp.openAddProgramModal()" 
                                class="flex items-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-4 py-2 rounded-xl transition-all text-sm font-medium">
                                <i data-lucide="plus-circle" class="w-4 h-4"></i>
                                <span class="hidden md:inline">Tambah Program</span>
                            </button>
                             <div class="relative group">
                                <i data-lucide="map-pin" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"></i>
                                <select onchange="RkapApp.handleFilterUpdate('branch', this.value)" 
                                    class="bg-slate-900/50 border border-slate-700/50 rounded-xl pl-9 pr-8 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 appearance-none min-w-[140px]">
                                    <option value="">Semua Cabang</option>
                                    ${branches.map(b => `<option value="${b}" ${this.state.filters.branch === b ? 'selected' : ''}>${b}</option>`).join('')}
                                </select>
                            </div>

                             <div class="relative group">
                                <i data-lucide="calendar-days" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"></i>
                                <select onchange="RkapApp.handleFilterUpdate('month', this.value)" 
                                    class="bg-slate-900/50 border border-slate-700/50 rounded-xl pl-9 pr-8 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 appearance-none min-w-[140px]">
                                    <option value="">Semua Bulan</option>
                                    ${months.map(m => `<option value="${m}" ${this.state.filters.month === m ? 'selected' : ''}>${m}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div class="relative group">
                        <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-400 transition-colors"></i>
                        <input type="text" placeholder="Cari kode program, deskripsi, atau kategori..." 
                            class="w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:bg-slate-900 transition-all text-white placeholder:text-slate-600 shadow-inner"
                            oninput="RkapApp.handleFilterUpdate('search', this.value)" value="${this.state.filters.search || ''}">
                    </div>
                </div>

                <div id="dashboard-content" class="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-900/20">
                    ${totalMaster === 0 ? `
                        <div class="flex flex-col items-center justify-center py-20 text-slate-500">
                            <div class="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 animate-pulse">
                                <i data-lucide="loader-2" class="w-8 h-8 animate-spin"></i>
                            </div>
                            <p>Memuat database program...</p>
                        </div>
                    ` : this.renderProgramList()}
                </div>
            </div>
        `;

        // Update sidebar stats
        this.updateSidebarStats();

        lucide.createIcons();
    },

    updateSidebarStats() {
        // Update sidebar rekap numbers
        const totalMaster = this.masterData ? this.masterData.length : 0;
        const totalSelected = this.state.selectedItems.size;
        const currentMonth = this.state.filters.month || 'Tahun 2026';

        const { month } = this.state.filters;
        const filtered = (this.masterData || []).filter(p => {
            const matchesBranch = !this.state.filters.branch || p.branch === this.state.filters.branch;
            let matchesMonth = true;
            if (month) {
                let searchMonth = month.toUpperCase();
                if (searchMonth === 'NOVEMBER') searchMonth = 'NOPEMBER';
                if (p.monthly && Object.keys(p.monthly).length > 0) {
                    matchesMonth = (p.monthly[searchMonth] || 0) > 0;
                }
            }
            return matchesBranch && matchesMonth;
        });
        const totalPaguFiltered = filtered.reduce((acc, p) => acc + (p.pagu || 0), 0);

        const masterEl = document.getElementById('sidebar-master-count');
        const selectedEl = document.getElementById('sidebar-selected-count');
        const periodeEl = document.getElementById('sidebar-periode');
        const paguEl = document.getElementById('sidebar-pagu');

        if (masterEl) masterEl.textContent = totalMaster.toLocaleString();
        if (selectedEl) selectedEl.textContent = totalSelected.toLocaleString();
        if (periodeEl) periodeEl.textContent = currentMonth;
        if (paguEl) {
            paguEl.textContent = `Rp ${(totalPaguFiltered / 1000000000).toFixed(1)}M`;
            paguEl.classList.toggle('text-emerald-400', totalPaguFiltered > 0);
            paguEl.classList.toggle('font-semibold', totalPaguFiltered > 0);
        }
    },

    handleFilterUpdate(type, value) {
        this.state.filters[type] = value;
        this.state.displayLimit = 50; // Reset limit on filter change
        const listContainer = document.getElementById('dashboard-content');
        if (listContainer) {
            listContainer.innerHTML = this.renderProgramList();
            lucide.createIcons();
            // Scroll to top of list
            listContainer.scrollTop = 0;
        }

        // Partial update for stats without re-rendering everything (preserves input focus)
        this.updateStatsLabels();

        // Save filter state
        this.saveData();
    },

    setViewMode(mode) {
        this.state.viewMode = mode;
        this.renderDashboard();
        this.saveData();
    },

    loadMore() {
        this.state.displayLimit += 50;
        const listContainer = document.getElementById('dashboard-content');
        if (listContainer) {
            // Re-render list with new limit
            listContainer.innerHTML = this.renderProgramList();
            lucide.createIcons();
        }
    },

    getFilteredData() {
        if (!this.masterData) return [];
        const { search, branch, month } = this.state.filters;
        const query = (search || '').toLowerCase();

        return this.masterData.filter(p => {
            const matchesSearch = !query ||
                p.description.toLowerCase().includes(query) ||
                p.code.toLowerCase().includes(query) ||
                (p.category && p.category.toLowerCase().includes(query));
            const matchesBranch = !branch || p.branch === branch;
            let matchesMonth = true;
            if (month) {
                let searchMonth = month.toUpperCase();
                if (searchMonth === 'NOVEMBER') searchMonth = 'NOPEMBER';

                if (p.monthly && Object.keys(p.monthly).length > 0) {
                    matchesMonth = (p.monthly[searchMonth] || 0) > 0;
                }
            }
            return matchesSearch && matchesBranch && matchesMonth;
        });
    },

    updateStatsLabels() {
        if (!this.masterData) return;

        const filtered = this.getFilteredData();
        const totalFiltered = filtered.length;
        const totalPaguFiltered = filtered.reduce((acc, p) => acc + (p.pagu || 0), 0);

        const itemsLabel = document.getElementById('items-count-label');
        if (itemsLabel) {
            itemsLabel.textContent = `Menampilkan ${totalFiltered.toLocaleString()} dari ${this.masterData.length.toLocaleString()} item`;
        }

        const paguLabel = document.getElementById('total-pagu-label');
        if (paguLabel) {
            paguLabel.textContent = `Total Pagu: Rp ${totalPaguFiltered.toLocaleString('id-ID')}`;
            paguLabel.className = `mt-4 text-xs ${totalPaguFiltered > 0 ? 'text-emerald-400 font-semibold' : 'text-slate-500'}`;
        }

        const periodeLabel = document.getElementById('periode-label');
        if (periodeLabel) {
            periodeLabel.textContent = this.state.filters.month || 'Tahun 2026';
        }

        // Also update sidebar stats
        this.updateSidebarStats();
    },

    renderProgramList() {
        if (!this.masterData) return '';
        const filtered = this.getFilteredData();

        if (filtered.length === 0) {
            return `
                <div class="flex flex-col items-center justify-center py-20 text-slate-500">
                    <div class="w-20 h-20 bg-slate-800/50 rounded-3xl flex items-center justify-center mb-6 border border-slate-700/30">
                        <i data-lucide="search-x" class="w-10 h-10 text-slate-600"></i>
                    </div>
                    <h4 class="text-white font-semibold">Tidak ada hasil ditemukan</h4>
                    <p class="text-sm mt-2 text-center max-w-xs">Coba ubah filter atau gunakan kata kunci lain.</p>
                </div>
            `;
        }

        const limit = this.state.displayLimit || 50;
        const itemsToShow = filtered.slice(0, limit);
        const hasMore = filtered.length > limit;

        let listHtml = '';

        if (this.state.viewMode === 'table') {
            listHtml = this.renderTableView(itemsToShow);
        } else {
            listHtml = `
            <div class="grid grid-cols-1 gap-3">
                ${itemsToShow.map((prog, idx) => {
                const isSelected = this.state.selectedItems.has(prog.description);
                return `
                        <div class="program-item flex items-center justify-between p-4 ${isSelected ? 'selected' : ''} group animate-fade-in" style="animation-delay: ${idx * 0.01}s">
                            <div class="flex items-center gap-5 flex-1 min-w-0">
                                <div class="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center font-mono font-bold text-xs ${isSelected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'} border border-white/5 shadow-lg">
                                    ${prog.code ? prog.code.split('.').pop() : '#'}
                                </div>
                                <div class="min-w-0 pr-4">
                                    <div class="flex items-center gap-2">
                                        <div class="font-semibold truncate ${isSelected ? 'text-emerald-400' : 'text-slate-200 group-hover:text-white'} transition-colors">${prog.description}</div>
                                        ${prog.isManual ? `<span class="px-2 py-0.5 text-[9px] font-bold rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">TAMBAHAN</span>` : ''}
                                    </div>
                                    <div class="text-xs text-slate-500 flex items-center gap-3 mt-2">
                                        <span class="flex items-center gap-1 font-mono uppercase tracking-widest"><i data-lucide="hash" class="w-3 h-3"></i> ${prog.code || '-'}</span>
                                        ${prog.branch ? `<span class="flex items-center gap-1"><i data-lucide="map-pin" class="w-3 h-3"></i> ${prog.branch}</span>` : ''}
                                        <span class="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 border border-white/5"><i data-lucide="tag" class="w-3 h-3"></i> ${prog.category || 'Umum'}</span>
                                        ${prog.isManual ? '' : `<span class="flex items-center gap-1 text-blue-400 font-semibold"><i data-lucide="banknote" class="w-3 h-3"></i> Rp ${prog.pagu.toLocaleString('id-ID')}</span>`}
                                    </div>
                                </div>
                            </div>
                            <div class="flex items-center gap-2">
                                ${prog.isManual ? `
                                    <button data-action="delete" data-program="${btoa(encodeURIComponent(prog.description))}" onclick="event.stopPropagation(); RkapApp.deleteManualProgram(decodeURIComponent(atob(this.dataset.program)))" 
                                        class="flex-shrink-0 p-2 rounded-lg text-rose-400 hover:bg-rose-500/20 transition-all" title="Hapus Program">
                                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                                    </button>
                                ` : ''}
                                <button data-action="toggle" data-program="${btoa(encodeURIComponent(prog.description))}" onclick="RkapApp.toggleProgram(decodeURIComponent(atob(this.dataset.program)))" 
                                    class="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg ${isSelected ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20' : 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 border border-indigo-500/20'}">
                                    <i data-lucide="${isSelected ? 'x' : 'plus'}" class="w-4 h-4"></i>
                                    <span>${isSelected ? 'Batal' : 'Pilih'}</span>
                                </button>
                            </div>
                        </div>
                    `;
            }).join('')}
            </div>`;
        }

        if (hasMore) {
            listHtml += `
                <div class="mt-6 text-center">
                    <button onclick="RkapApp.loadMore()" 
                        class="px-6 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 font-medium transition-all shadow-lg">
                        Load More (${(filtered.length - limit).toLocaleString()} items left)
                    </button>
                    <div class="text-xs text-slate-500 mt-2">Showing ${limit.toLocaleString()} of ${filtered.length.toLocaleString()} items</div>
                </div>
            `;
        } else {
            listHtml += `<div class="text-center py-6 text-slate-500 text-sm border-t border-slate-800 mt-4">--- End of Data ---</div>`;
        }

        return listHtml;
    },

    renderTableView(items) {
        return `
        <div class="overflow-x-auto rounded-xl border border-slate-700/50">
            <table class="w-full text-left border-collapse">
                <thead class="bg-slate-800 text-xs uppercase tracking-wider text-slate-400 font-bold sticky top-0 z-10">
                    <tr>
                        <th class="p-3 border-b border-slate-700">Kode</th>
                        <th class="p-3 border-b border-slate-700">Program Kerja</th>
                        <th class="p-3 border-b border-slate-700">Cabang</th>
                        <th class="p-3 border-b border-slate-700 text-right">Pagu</th>
                        <th class="p-3 border-b border-slate-700 text-center">Aksi</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-800 bg-slate-900/40 text-sm text-slate-300">
                    ${items.map((prog, idx) => {
            const isSelected = this.state.selectedItems.has(prog.description);
            return `
                        <tr class="hover:bg-indigo-500/5 transition-colors ${isSelected ? 'bg-indigo-500/10' : ''}">
                            <td class="p-3 font-mono text-xs text-slate-500">${prog.code || '-'}</td>
                            <td class="p-3">
                                <div class="font-medium ${isSelected ? 'text-emerald-400' : 'text-slate-200'}">${prog.description}</div>
                                <div class="text-[10px] text-slate-500 mt-0.5">${prog.category || 'Umum'} ${prog.isManual ? '<span class="text-amber-500 ml-1">(Manual)</span>' : ''}</div>
                            </td>
                            <td class="p-3 text-xs whitespace-nowrap">${prog.branch || '-'}</td>
                            <td class="p-3 text-right font-mono text-xs ${prog.pagu > 0 ? 'text-blue-400' : 'text-slate-600'}">
                                ${prog.pagu ? prog.pagu.toLocaleString('id-ID') : '-'}
                            </td>
                            <td class="p-3 text-center w-24">
                                <button data-action="toggle" data-program="${btoa(encodeURIComponent(prog.description))}" onclick="RkapApp.toggleProgram(decodeURIComponent(atob(this.dataset.program)))" 
                                    class="p-1.5 rounded-lg transition-all ${isSelected ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30' : 'bg-slate-700 text-slate-400 hover:bg-indigo-500 hover:text-white'}"
                                    title="${isSelected ? 'Batalkan Pilihan' : 'Pilih Program'}">
                                    <i data-lucide="${isSelected ? 'minus' : 'plus'}" class="w-4 h-4"></i>
                                </button>
                                ${prog.isManual ? `
                                    <button data-action="delete" data-program="${btoa(encodeURIComponent(prog.description))}" onclick="RkapApp.deleteManualProgram(decodeURIComponent(atob(this.dataset.program)))" 
                                        class="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/20 transition-all ml-1" title="Hapus">
                                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                                    </button>
                                ` : ''}
                            </td>
                        </tr>
                        `;
        }).join('')}
                </tbody>
            </table>
        </div>
        `;
    },

    toggleProgram(progId) {
        if (this.state.selectedItems.has(progId)) {
            this.state.selectedItems.delete(progId);
            Toast.show('Program dihapus dari daftar aktif', 'info');
        } else {
            this.state.selectedItems.add(progId);
            Toast.show('Program ditambahkan ke daftar aktif', 'success');
        }

        this.saveData();

        // Efficient re-render: just update dashboard if we are there
        if (this.currentView === 'dashboard') {
            this.renderDashboard(); // Full re-render needed to update stats and list styles
        } else {
            this.render(); // Generic render
        }
    },

    openAddProgramModal() {
        // Get unique branches from masterData
        const branches = [...new Set((this.masterData || []).map(p => p.branch).filter(Boolean))].sort();
        const branchOptions = branches.map(b => `<option value="${b}">${b}</option>`).join('');

        // Month options for scheduling
        const months = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOPEMBER', 'DESEMBER'];
        const currentMonthIndex = new Date().getMonth();
        const monthOptions = months.map((m, i) => `<option value="${m}" ${i === currentMonthIndex ? 'selected' : ''}>${m}</option>`).join('');

        const content = `
            <div class="space-y-5">
                <div class="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                    <div class="flex items-center gap-2 text-amber-400 text-sm font-medium">
                        <i data-lucide="alert-triangle" class="w-4 h-4"></i>
                        Program Tambahan (Di Luar RKAP 2026)
                    </div>
                    <p class="text-xs text-slate-400 mt-1">Program ini tidak termasuk dalam anggaran RKAP 2026</p>
                </div>

                <div class="space-y-4">
                    <div>
                        <label class="text-sm font-bold text-white mb-2 block">Nama Program Kerja *</label>
                        <input type="text" id="new-prog-name" placeholder="Contoh: Survey Tanah Sisa Tambahan"
                            class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500">
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="text-sm font-bold text-white mb-2 block">Cabang *</label>
                            <select id="new-prog-branch" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500">
                                <option value="">-- Pilih Cabang --</option>
                                ${branchOptions}
                            </select>
                        </div>
                        <div>
                            <label class="text-sm font-bold text-white mb-2 block">Bulan Rencana *</label>
                            <select id="new-prog-month" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500">
                                ${monthOptions}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label class="text-sm font-bold text-white mb-2 block">Kategori</label>
                        <select id="new-prog-category" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500">
                            <option value="Pertek">Pertek</option>
                            <option value="Pengadaan Tanah">Pengadaan Tanah</option>
                            <option value="Lainnya">Lainnya</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-sm font-bold text-white mb-2 block">Keterangan (Opsional)</label>
                        <textarea id="new-prog-notes" rows="2" placeholder="Catatan tambahan..."
                            class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 resize-none"></textarea>
                    </div>
                </div>

                <div class="flex gap-3 pt-4 border-t border-slate-700/50">
                    <button onclick="Modal.close()" class="flex-1 px-4 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium transition-all">
                        Batal
                    </button>
                    <button onclick="RkapApp.saveNewProgram()" 
                        class="flex-1 px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-all shadow-lg shadow-emerald-500/20">
                        <i data-lucide="plus" class="w-4 h-4 inline mr-1"></i> Tambah Program
                    </button>
                </div>
            </div>
        `;

        Modal.show('Tambah Program Kerja Baru', content, 'info');
        lucide.createIcons();
    },

    saveNewProgram() {
        const name = document.getElementById('new-prog-name').value.trim();
        const branch = document.getElementById('new-prog-branch').value;
        const category = document.getElementById('new-prog-category').value;
        const month = document.getElementById('new-prog-month').value;
        const notes = document.getElementById('new-prog-notes').value.trim();

        if (!name) {
            Toast.show('Nama program harus diisi', 'warning');
            return;
        }
        if (!branch) {
            Toast.show('Cabang harus dipilih', 'warning');
            return;
        }

        // Check duplicates
        const allPrograms = [...(this.masterData || []), ...(this.state.manualPrograms || [])];
        if (allPrograms.some(p => p.description.toLowerCase() === name.toLowerCase())) {
            Toast.show('Program dengan nama yang sama sudah ada', 'warning');
            return;
        }

        // Create monthly allocation object with selected month
        const monthly = {};
        if (month) {
            monthly[month] = 1; // Set to 1 to mark as having allocation for this month
        }

        const newProgram = {
            code: `MANUAL-${Date.now()}`,
            description: name,
            branch: branch,
            category: category,
            pagu: 0,
            monthly: monthly,
            notes: notes,
            isManual: true,
            createdAt: new Date().toISOString()
        };

        if (!this.state.manualPrograms) this.state.manualPrograms = [];
        this.state.manualPrograms.push(newProgram);

        // Also add to masterData for display
        this.masterData.push(newProgram);

        // Auto-select the new program
        this.state.selectedItems.add(name);

        this.saveData();
        Modal.close();
        this.renderDashboard();
        Toast.show('Program berhasil ditambahkan', 'success');
    },

    deleteManualProgram(progName) {
        if (!confirm(`Hapus program "${progName}"?`)) return;

        this.state.manualPrograms = (this.state.manualPrograms || []).filter(p => p.description !== progName);
        this.masterData = (this.masterData || []).filter(p => p.description !== progName);
        this.state.selectedItems.delete(progName);

        this.saveData();
        this.renderDashboard();
        Toast.show('Program berhasil dihapus', 'success');
    },

    renderMonthly() {
        const container = document.getElementById('view-monthly');
        if (!container) return;

        // Get selected programs
        const selected = (this.masterData || []).filter(p => this.state.selectedItems.has(p.description));

        if (selected.length === 0) {
            container.innerHTML = `
                <div class="flex items-center justify-between mb-6">
                    <h3 class="text-lg font-semibold">Alokasi Bulanan</h3>
                    <select id="monthly-filter-year" class="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500">
                        <option value="2026">2026</option>
                    </select>
                </div>
                <div class="card-premium p-12 text-center text-slate-500">
                    <div class="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5">
                        <i data-lucide="clipboard-list" class="w-8 h-8 text-slate-600"></i>
                    </div>
                    <h4 class="text-white font-semibold">Belum ada program dipilih</h4>
                    <p class="text-sm mt-2">Silakan pilih program kerja di menu <b>Program Kerja</b> terlebih dahulu.</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        const months = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOPEMBER', 'DESEMBER'];

        container.innerHTML = `
            <div class="flex items-center justify-between mb-6">
                <div>
                    <h3 class="text-xl font-bold text-white">Rencana Alokasi Bulanan</h3>
                    <p class="text-sm text-slate-500 mt-1">Total ${selected.length} program kerja terpilih</p>
                </div>
                <div class="flex items-center gap-3">
                    <button onclick="RkapApp.exportMonthlyExcel()" class="flex items-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-4 py-2 rounded-xl transition-all text-sm font-medium">
                        <i data-lucide="download" class="w-4 h-4"></i>
                        Export Excel
                    </button>
                    <select id="monthly-filter-year" class="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500 text-sm">
                        <option value="2026">2026</option>
                    </select>
                </div>
            </div>

            <div class="card-premium overflow-hidden">
                <div class="overflow-x-auto custom-scrollbar">
                    <table class="w-full text-left border-collapse min-w-[1200px]">
                        <thead>
                            <tr class="bg-slate-800/50 border-b border-slate-700">
                                <th class="p-4 text-xs font-bold uppercase tracking-wider text-slate-400 border-r border-slate-700/50 w-12">No</th>
                                <th class="p-4 text-xs font-bold uppercase tracking-wider text-slate-400 border-r border-slate-700/50 min-w-[300px]">Program Kerja</th>
                                ${months.map(m => `<th class="p-4 text-xs font-bold uppercase tracking-wider text-slate-400 text-right min-w-[120px]">${m.substring(0, 3)}</th>`).join('')}
                                <th class="p-4 text-xs font-bold uppercase tracking-wider text-white text-right bg-indigo-500/10 min-w-[140px]">Total Pagu</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-800">
                            ${selected.map((prog, idx) => `
                                <tr class="hover:bg-white/5 transition-colors group">
                                    <td class="p-4 text-sm text-slate-500 border-r border-slate-700/50 text-center">${idx + 1}</td>
                                    <td class="p-4 border-r border-slate-700/50">
                                        <div class="font-semibold text-slate-100">${prog.description}</div>
                                        <div class="text-[10px] text-slate-500 mt-1 font-mono uppercase tracking-tighter">${prog.code || '-'} | ${prog.branch}</div>
                                    </td>
                                    ${months.map(m => {
            const value = (prog.monthly && prog.monthly[m]) || 0;
            return `<td class="p-4 text-sm text-right ${value > 0 ? 'text-indigo-400 font-medium' : 'text-slate-600'}">
                                            ${value > 0 ? value.toLocaleString('id-ID') : '-'}
                                        </td>`;
        }).join('')}
                                    <td class="p-4 text-sm text-right font-bold text-emerald-400 bg-emerald-500/5">
                                        ${(prog.pagu || 0).toLocaleString('id-ID')}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot class="bg-slate-800/30 border-t border-slate-700">
                            <tr class="font-bold">
                                <td colspan="2" class="p-4 text-right text-slate-300 uppercase tracking-widest text-xs">Total Keseluruhan</td>
                                ${months.map(m => {
            const monthTotal = selected.reduce((sum, p) => sum + ((p.monthly && p.monthly[m]) || 0), 0);
            return `<td class="p-4 text-right text-sm text-white">
                                        ${monthTotal > 0 ? monthTotal.toLocaleString('id-ID') : '-'}
                                    </td>`;
        }).join('')}
                                <td class="p-4 text-right text-lg text-emerald-400 bg-emerald-400/10">
                                    ${selected.reduce((sum, p) => sum + (p.pagu || 0), 0).toLocaleString('id-ID')}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        `;
        lucide.createIcons();
    },

    exportMonthlyExcel() {
        const selected = (this.masterData || []).filter(p => this.state.selectedItems.has(p.description));
        if (selected.length === 0) return;

        const months = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOPEMBER', 'DESEMBER'];

        const exportData = selected.map((p, idx) => {
            const row = {
                'No': idx + 1,
                'Kode': p.code || '-',
                'Program Kerja': p.description,
                'Cabang': p.branch,
                'Kategori': p.category || 'Umum'
            };
            months.forEach(m => {
                row[m] = (p.monthly && p.monthly[m]) || 0;
            });
            row['Total Pagu'] = p.pagu || 0;
            return row;
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws, "Rencana Bulanan 2026");
        XLSX.writeFile(wb, "RKAP_Rencana_Bulanan_2026.xlsx");
        Toast.show('Excel berhasil diunduh', 'success');
    },

    renderWeekly() {
        const container = document.getElementById('view-weekly');
        if (!container) return;

        if (!this.state.weeklyPlans) this.state.weeklyPlans = {};

        const currentMonth = this.state.filters.month || 'Januari';
        const branch = this.state.filters.branch;
        const year = '2026';
        const monthKey = `${currentMonth.toUpperCase() === 'NOVEMBER' ? 'NOPEMBER' : currentMonth.toUpperCase()}_${year}`;

        const selected = (this.masterData || []).filter(p => {
            const isSelected = this.state.selectedItems.has(p.description);
            const hasMonthAllocation = (p.monthly && (p.monthly[currentMonth.toUpperCase() === 'NOVEMBER' ? 'NOPEMBER' : currentMonth.toUpperCase()] || 0) > 0);
            const matchesBranch = !branch || p.branch === branch;
            return isSelected && hasMonthAllocation && matchesBranch;
        });

        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

        const personnelGroups = [
            { label: 'Manager', items: this.state.personnel.manager },
            { label: 'Asman', items: this.state.personnel.asman },
            { label: 'Staff', items: this.state.personnel.staff }
        ];

        const personnelOptions = `<option value="">- Pilih Pekerja -</option>` +
            personnelGroups.map(group => `
                <optgroup label="${group.label}">
                    ${group.items.map(p => `<option value="${p}">${p}</option>`).join('')}
                </optgroup>
            `).join('');

        container.innerHTML = `
            <div class="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
                <div>
                    <h3 class="text-xl font-bold text-white">Breakdown Mingguan</h3>
                    <p class="text-sm text-slate-500 mt-1">Penjadwalan Tanggal & Personel (Surveyor, Drafter, Estimator)</p>
                </div>
                <div class="flex items-center gap-3">
                    <div class="relative">
                        <i data-lucide="calendar" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"></i>
                        <select onchange="RkapApp.handleWeeklyMonthFilter(this.value)" 
                            class="bg-slate-800 border border-slate-700/50 rounded-xl pl-9 pr-8 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 appearance-none min-w-[140px]">
                            ${months.map(m => `<option value="${m}" ${currentMonth === m ? 'selected' : ''}>${m}</option>`).join('')}
                        </select>
                    </div>
                    <button onclick="RkapApp.exportWeeklyExcel()" class="flex items-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-4 py-2 rounded-xl transition-all text-sm font-medium">
                        <i data-lucide="download" class="w-4 h-4"></i>
                        Export
                    </button>
                </div>
            </div>

            ${selected.length === 0 ? `
                <div class="card-premium p-12 text-center text-slate-500">
                    <div class="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5">
                        <i data-lucide="calendar-x" class="w-8 h-8 text-slate-600"></i>
                    </div>
                    <h4 class="text-white font-semibold">Tidak ada program untuk bulan ini</h4>
                    <p class="text-sm mt-2">Pastikan program sudah dipilih dan memiliki pagu di bulan <b>${currentMonth}</b>.</p>
                </div>
            ` : `
                <div class="card-premium overflow-hidden">
                    <div class="overflow-x-auto custom-scrollbar">
                        <table class="w-full text-left border-collapse min-w-[1200px]">
                            <thead>
                                <tr class="bg-slate-800/50 border-b border-slate-700">
                                    <th class="p-4 text-xs font-bold uppercase tracking-wider text-slate-400 w-12 border-r border-slate-700/50">No</th>
                                    <th class="p-4 text-xs font-bold uppercase tracking-wider text-slate-400 min-w-[250px] border-r border-slate-700/50">Program Kerja</th>
                                    ${[1, 2, 3, 4].map(w => `
                                        <th class="p-4 border-r border-slate-700/50 min-w-[220px]">
                                            <div class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 text-center">Minggu ${w}</div>
                                        </th>
                                    `).join('')}
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-800">
                                ${(() => {
                // Group programs by branch
                const grouped = {};
                selected.forEach(prog => {
                    const branchName = prog.branch || 'TANPA CABANG';
                    if (!grouped[branchName]) grouped[branchName] = [];
                    grouped[branchName].push(prog);
                });

                // Sort branches alphabetically
                const sortedBranches = Object.keys(grouped).sort();

                let globalIndex = 0;
                return sortedBranches.map((branchName) => {
                    const programs = grouped[branchName];
                    return `
                                            <!-- Branch Header -->
                                            <tr class="bg-slate-800/70 border-t-2 border-slate-600">
                                                <td colspan="6" class="p-3">
                                                    <div class="flex items-center gap-2">
                                                        <i data-lucide="map-pin" class="w-4 h-4 text-indigo-400"></i>
                                                        <span class="text-sm font-bold text-indigo-300 uppercase tracking-wider">${branchName}</span>
                                                        <span class="text-xs text-slate-500 ml-2">(${programs.length} program)</span>
                                                    </div>
                                                </td>
                                            </tr>
                                            <!-- Programs in this branch -->
                                            ${programs.map((prog) => {
                        globalIndex++;
                        return `
                                                <tr class="hover:bg-white/5 transition-colors">
                                                    <td class="p-4 text-sm text-slate-500 border-r border-slate-700/50 text-center">${globalIndex}</td>
                                                    <td class="p-4 border-r border-slate-700/50">
                                                        <div class="font-semibold text-slate-100 mb-1 text-sm">${prog.description}</div>
                                                        <div class="flex items-center gap-2">
                                                            <span class="text-[10px] text-slate-500 font-mono">${prog.code || '-'}</span>
                                                            <div class="text-[10px] text-indigo-400 font-bold">
                                                                Rp ${(prog.monthly[currentMonth.toUpperCase() === 'NOVEMBER' ? 'NOPEMBER' : currentMonth.toUpperCase()] || 0).toLocaleString('id-ID')}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    ${[1, 2, 3, 4].map(week => {
                            const weekData = this.state.weeklyPlans[monthKey]?.[prog.description]?.[`W${week}`] || {};
                            const hasData = weekData.SURVEY_DATE || weekData.SURVEYOR_1 || weekData.DRAFTER;
                            const surveyDate = weekData.SURVEY_DATE ? new Date(weekData.SURVEY_DATE).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : '-';
                            // Secure escape for inline JS: quotes, double quotes, backslashes, and newlines
                            const escapedDesc = prog.description
                                .replace(/\\/g, '\\\\')
                                .replace(/'/g, "\\'")
                                .replace(/"/g, '&quot;')
                                .replace(/\n/g, ' ')
                                .replace(/\r/g, '');
                            return `
                                                            <td class="p-2 border-r border-slate-700/50 bg-slate-900/30 align-top">
                                                                <button onclick="RkapApp.openWeeklyModal('${monthKey}', '${escapedDesc}', 'W${week}')"
                                                                    class="w-full p-2 rounded-lg border transition-all text-left ${hasData ? 'bg-indigo-500/10 border-indigo-500/30 hover:bg-indigo-500/20' : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-700/50'}">
                                                                    ${hasData ? `
                                                                        <div class="text-[10px] text-amber-400 font-bold mb-1">📅 ${surveyDate}</div>
                                                                        <div class="space-y-0.5 text-[9px]">
                                                                            ${weekData.SURVEYOR_1 ? `<div class="text-rose-400">▸ ${weekData.SURVEYOR_1}</div>` : ''}
                                                                            ${weekData.SURVEYOR_2 ? `<div class="text-rose-400">▸ ${weekData.SURVEYOR_2}</div>` : ''}
                                                                            ${weekData.DRAFTER ? `<div class="text-indigo-400">▸ ${weekData.DRAFTER}</div>` : ''}
                                                                            ${weekData.ESTIMATOR ? `<div class="text-emerald-400">▸ ${weekData.ESTIMATOR}</div>` : ''}
                                                                            ${weekData.MONEV ? `<div class="text-purple-400">▸ ${weekData.MONEV}</div>` : ''}
                                                                        </div>
                                                                    ` : `
                                                                        <div class="flex flex-col items-center justify-center py-3 text-slate-500">
                                                                            <i data-lucide="plus-circle" class="w-5 h-5 mb-1"></i>
                                                                            <span class="text-[9px] font-medium">Atur Jadwal</span>
                                                                        </div>
                                                                    `}
                                                                </button>
                                                            </td>
                                                        `;
                        }).join('')}
                                                </tr>
                                            `}).join('')}
                                        `;
                }).join('');
            })()}
                            </tbody>
                        </table>
                    </div>
                </div>
            `}
        `;
        lucide.createIcons();
    },

    handleWeeklyMonthFilter(val) {
        this.state.filters.month = val;
        this.renderWeekly();
        this.saveData();
    },

    updateWeeklyData(monthKey, progDesc, weekKey, field, value) {
        if (!this.state.weeklyPlans) this.state.weeklyPlans = {};
        if (!this.state.weeklyPlans[monthKey]) this.state.weeklyPlans[monthKey] = {};
        if (!this.state.weeklyPlans[monthKey][progDesc]) this.state.weeklyPlans[monthKey][progDesc] = {};
        if (!this.state.weeklyPlans[monthKey][progDesc][weekKey]) this.state.weeklyPlans[monthKey][progDesc][weekKey] = {};

        this.state.weeklyPlans[monthKey][progDesc][weekKey][field] = value;
        this.saveData();
    },

    openWeeklyModal(monthKey, progDesc, weekKey) {
        const weekData = this.state.weeklyPlans?.[monthKey]?.[progDesc]?.[weekKey] || {};

        // Build personnel options
        const allPersonnel = [
            ...this.state.personnel.manager,
            ...this.state.personnel.asman,
            ...this.state.personnel.staff
        ];
        const buildOptions = (selected) => {
            return `<option value="">-- Pilih --</option>` +
                allPersonnel.map(p => `<option value="${p}" ${p === selected ? 'selected' : ''}>${p}</option>`).join('');
        };

        const content = `
            <div class="space-y-5">
                <div class="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                    <div class="text-xs text-slate-400 mb-2">Program Kerja</div>
                    <div class="text-white font-bold">${progDesc}</div>
                    <div class="text-[10px] text-indigo-400 mt-1">${monthKey} • ${weekKey.replace('W', 'Minggu ')}</div>
                </div>

                <div class="space-y-4">
                    <div>
                        <label class="text-sm font-bold text-amber-400 mb-2 block flex items-center gap-2">
                            <i data-lucide="calendar" class="w-4 h-4"></i> Tanggal Survey
                        </label>
                        <input type="date" id="modal-survey-date" value="${weekData.SURVEY_DATE || ''}"
                            class="w-full bg-slate-800 border border-amber-500/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500 text-sm">
                        <p class="text-[10px] text-slate-500 mt-1">Drafter & Estimator +1 hari dari tanggal survey</p>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="text-sm font-bold text-rose-400 mb-2 block">Surveyor 1</label>
                            <select id="modal-surveyor1" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-rose-500">
                                ${buildOptions(weekData.SURVEYOR_1)}
                            </select>
                        </div>
                        <div>
                            <label class="text-sm font-bold text-rose-400 mb-2 block">Surveyor 2</label>
                            <select id="modal-surveyor2" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-rose-500">
                                ${buildOptions(weekData.SURVEYOR_2)}
                            </select>
                        </div>
                        <div>
                            <label class="text-sm font-bold text-indigo-400 mb-2 block">Drafter <span class="text-slate-500 text-xs">(+1)</span></label>
                            <select id="modal-drafter" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500">
                                ${buildOptions(weekData.DRAFTER)}
                            </select>
                        </div>
                        <div>
                            <label class="text-sm font-bold text-emerald-400 mb-2 block">Estimator <span class="text-slate-500 text-xs">(+1)</span></label>
                            <select id="modal-estimator" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500">
                                ${buildOptions(weekData.ESTIMATOR)}
                            </select>
                        </div>
                        <div class="col-span-2">
                            <label class="text-sm font-bold text-purple-400 mb-2 block">Monitoring & Evaluation <span class="text-slate-500 text-xs">(+2)</span></label>
                            <select id="modal-monev" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500">
                                ${buildOptions(weekData.MONEV)}
                            </select>
                        </div>
                    </div>
                </div>

                <div class="flex gap-3 pt-4 border-t border-slate-700/50">
                    <button onclick="RkapApp.clearWeeklySchedule('${monthKey}', '${progDesc}', '${weekKey}')" 
                        class="px-4 py-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium transition-all border border-red-500/30">
                        <i data-lucide="trash-2" class="w-4 h-4 inline"></i> Hapus
                    </button>
                    <button onclick="Modal.close()" class="flex-1 px-4 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium transition-all">
                        Batal
                    </button>
                    <button onclick="RkapApp.saveWeeklyModal('${monthKey}', '${progDesc}', '${weekKey}')" 
                        class="flex-1 px-4 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold transition-all shadow-lg shadow-indigo-500/20">
                        Simpan
                    </button>
                </div>
            </div>
        `;

        Modal.show('Atur Jadwal Mingguan', content, 'info');
        lucide.createIcons();
    },

    saveWeeklyModal(monthKey, progDesc, weekKey) {
        const surveyDate = document.getElementById('modal-survey-date').value;
        const surveyor1 = document.getElementById('modal-surveyor1').value;
        const surveyor2 = document.getElementById('modal-surveyor2').value;
        const drafter = document.getElementById('modal-drafter').value;
        const estimator = document.getElementById('modal-estimator').value;
        const monev = document.getElementById('modal-monev').value;

        // Initialize structure
        if (!this.state.weeklyPlans) this.state.weeklyPlans = {};
        if (!this.state.weeklyPlans[monthKey]) this.state.weeklyPlans[monthKey] = {};
        if (!this.state.weeklyPlans[monthKey][progDesc]) this.state.weeklyPlans[monthKey][progDesc] = {};
        if (!this.state.weeklyPlans[monthKey][progDesc][weekKey]) this.state.weeklyPlans[monthKey][progDesc][weekKey] = {};

        const weekData = this.state.weeklyPlans[monthKey][progDesc][weekKey];

        // Save personnel
        weekData.SURVEYOR_1 = surveyor1;
        weekData.SURVEYOR_2 = surveyor2;
        weekData.DRAFTER = drafter;
        weekData.ESTIMATOR = estimator;
        weekData.MONEV = monev;

        // Save dates with auto-calculation (skip weekends)
        if (surveyDate) {
            weekData.SURVEY_DATE = surveyDate;
            weekData.date = surveyDate;
            weekData.SURVEYOR_1_DATE = surveyDate;
            weekData.SURVEYOR_2_DATE = surveyDate;

            const baseDate = new Date(surveyDate);

            // Drafter & Estimator: +1 business day from survey
            const drafterDate = this.addBusinessDays(baseDate, 1);
            weekData.DRAFTER_DATE = drafterDate.toISOString().split('T')[0];
            weekData.ESTIMATOR_DATE = drafterDate.toISOString().split('T')[0];

            // M&E: +2 business days from survey
            const monevDate = this.addBusinessDays(baseDate, 2);
            weekData.MONEV_DATE = monevDate.toISOString().split('T')[0];
        }

        this.saveData();

        // Push to cloud immediately so Dashboard Monitoring gets updated
        Storage.push(Storage.KEYS.RKAP).then(() => {
            console.log('✅ RKAP weekly data pushed to cloud');
        }).catch(err => {
            console.log('⚠️ Cloud sync skipped:', err.message);
        });

        Modal.close();
        this.renderWeekly();
        Toast.show('Jadwal berhasil disimpan & disinkronkan', 'success');
    },

    // Clear/delete a weekly schedule
    clearWeeklySchedule(monthKey, progDesc, weekKey) {
        if (!this.state.weeklyPlans?.[monthKey]?.[progDesc]?.[weekKey]) {
            Toast.show('Tidak ada jadwal untuk dihapus', 'warning');
            Modal.close();
            return;
        }

        // Delete the week data
        delete this.state.weeklyPlans[monthKey][progDesc][weekKey];

        // Clean up empty objects
        if (Object.keys(this.state.weeklyPlans[monthKey][progDesc]).length === 0) {
            delete this.state.weeklyPlans[monthKey][progDesc];
        }
        if (Object.keys(this.state.weeklyPlans[monthKey]).length === 0) {
            delete this.state.weeklyPlans[monthKey];
        }

        this.saveData();

        // Push to cloud immediately so Dashboard gets updated
        Storage.push(Storage.KEYS.RKAP).then(() => {
            console.log('✅ RKAP weekly schedule deleted and synced to cloud');
        }).catch(err => {
            console.log('⚠️ Cloud sync skipped:', err.message);
        });

        Modal.close();
        this.renderWeekly();
        Toast.show('Jadwal berhasil dihapus & disinkronkan', 'success');
    },

    updateSurveyDate(monthKey, progDesc, weekKey, surveyDate) {
        if (!this.state.weeklyPlans) this.state.weeklyPlans = {};
        if (!this.state.weeklyPlans[monthKey]) this.state.weeklyPlans[monthKey] = {};
        if (!this.state.weeklyPlans[monthKey][progDesc]) this.state.weeklyPlans[monthKey][progDesc] = {};
        if (!this.state.weeklyPlans[monthKey][progDesc][weekKey]) this.state.weeklyPlans[monthKey][progDesc][weekKey] = {};

        const weekData = this.state.weeklyPlans[monthKey][progDesc][weekKey];

        // Store survey date
        weekData.SURVEY_DATE = surveyDate;
        weekData.date = surveyDate; // Legacy compatibility

        // Auto-calculate all role dates (skip weekends)
        if (surveyDate) {
            const baseDate = new Date(surveyDate);

            // Surveyor 1 & 2: Same day as survey
            weekData.SURVEYOR_1_DATE = surveyDate;
            weekData.SURVEYOR_2_DATE = surveyDate;

            // Drafter & Estimator: +1 business day from survey
            const drafterDate = this.addBusinessDays(baseDate, 1);
            weekData.DRAFTER_DATE = drafterDate.toISOString().split('T')[0];
            weekData.ESTIMATOR_DATE = drafterDate.toISOString().split('T')[0];

            // M&E: +2 business days from survey
            const monevDate = this.addBusinessDays(baseDate, 2);
            weekData.MONEV_DATE = monevDate.toISOString().split('T')[0];
        }

        this.saveData();

        // Push to cloud immediately
        Storage.push(Storage.KEYS.RKAP).catch(err => console.log('Cloud sync skipped:', err.message));

        Toast.show('Tanggal berhasil diatur otomatis', 'success');
    },

    openDailyBreakdown(monthKey, progDesc, weekKey) {
        const weekData = this.state.weeklyPlans[monthKey]?.[progDesc]?.[weekKey] || {};
        const surveyDate = weekData.SURVEY_DATE || weekData.date;
        if (!surveyDate) {
            Toast.show('Mohon atur Tanggal Survey terlebih dahulu', 'warning');
            return;
        }

        const roles = [
            { key: 'SURVEYOR_1', label: 'Surveyor 1', color: 'rose' },
            { key: 'SURVEYOR_2', label: 'Surveyor 2', color: 'rose' },
            { key: 'DRAFTER', label: 'Drafter', color: 'indigo' },
            { key: 'ESTIMATOR', label: 'Estimator', color: 'emerald' }
        ];

        const dayNames = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
        const startDate = new Date(surveyDate);

        let content = `
            <div class="space-y-6 max-h-[70vh] overflow-y-auto px-1 custom-scrollbar">
                <div class="bg-slate-800/50 p-4 rounded-xl border border-white/5">
                    <h4 class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Program Kerja</h4>
                    <p class="text-sm font-semibold text-white leading-relaxed">${progDesc}</p>
                    <p class="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-tighter">MINGGU ${weekKey.substring(1)} • MULAI ${startDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>
                
                <div class="space-y-8">
        `;

        let activeStaff = 0;
        roles.forEach(role => {
            const name = weekData[role.key];
            if (!name) return;
            activeStaff++;

            content += `
                <div class="role-breakdown-group">
                    <div class="flex items-center gap-2 mb-3">
                        <span class="w-2 h-2 rounded-full bg-${role.color}-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]"></span>
                        <h5 class="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">${role.label}: <span class="text-slate-100">${name}</span></h5>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-5 gap-3">
            `;

            for (let i = 0; i < 5; i++) {
                const d = new Date(startDate);
                d.setDate(d.getDate() + i);
                const dateStr = d.toISOString().split('T')[0];
                const dayName = d.toLocaleDateString('id-ID', { weekday: 'long' });
                const dateLabel = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });

                const taskKey = `${role.key}_TASKS`;
                if (!weekData[taskKey]) weekData[taskKey] = {};
                const savedTask = weekData[taskKey][dateStr] || '';

                content += `
                    <div class="flex flex-col gap-1.5">
                        <label class="text-[9px] font-bold text-slate-500 uppercase tracking-tighter ml-1">${dayName} (${dateLabel})</label>
                        <textarea 
                            onchange="RkapApp.updateWeeklyTask('${monthKey}', '${progDesc.replace(/'/g, "\\'")}', '${weekKey}', '${role.key}', '${dateStr}', this.value)"
                            placeholder="..."
                            class="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-${role.color}-500 transition-colors min-h-[60px] resize-none">${savedTask}</textarea>
                    </div>
                `;
            }

            content += `
                    </div>
                </div>
            `;
        });

        if (activeStaff === 0) {
            content = `
                <div class="py-20 text-center space-y-4">
                    <div class="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto border border-white/5">
                        <i data-lucide="users" class="w-8 h-8 text-slate-600"></i>
                    </div>
                    <p class="text-slate-400 text-sm">Pilih personel terlebih dahulu di tabel rencana mingguan.</p>
                </div>
            `;
        }

        content += `
            </div>
            <div class="flex justify-between items-center pt-6 border-t border-slate-700/50 mt-6">
                <div class="text-[10px] text-slate-500 uppercase font-bold tracking-widest">
                    <i data-lucide="info" class="w-3 h-3 inline mr-1"></i> Data disimpan otomatis saat isian berubah
                </div>
                <button onclick="Modal.close(); RkapApp.render();" class="px-8 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-500/20">
                    Selesai & Simpan
                </button>
            </div>
        `;

        Modal.show('Breakdown Kegiatan Harian', content, 'info');
        lucide.createIcons();
    },

    updateWeeklyTask(monthKey, progDesc, weekKey, roleKey, dateStr, activity) {
        if (!this.state.weeklyPlans) this.state.weeklyPlans = {};
        if (!this.state.weeklyPlans[monthKey]) this.state.weeklyPlans[monthKey] = {};
        if (!this.state.weeklyPlans[monthKey][progDesc]) this.state.weeklyPlans[monthKey][progDesc] = {};
        if (!this.state.weeklyPlans[monthKey][progDesc][weekKey]) this.state.weeklyPlans[monthKey][progDesc][weekKey] = {};

        const taskKey = `${roleKey}_TASKS`;
        if (!this.state.weeklyPlans[monthKey][progDesc][weekKey][taskKey]) {
            this.state.weeklyPlans[monthKey][progDesc][weekKey][taskKey] = {};
        }

        this.state.weeklyPlans[monthKey][progDesc][weekKey][taskKey][dateStr] = activity;
        this.saveData();

        if (this.currentView === 'daily') {
            this.renderDaily();
        }
    },

    exportWeeklyExcel() {
        const currentMonth = this.state.filters.month || 'Januari';
        const year = '2026';
        const monthKey = `${currentMonth.toUpperCase() === 'NOVEMBER' ? 'NOPEMBER' : currentMonth.toUpperCase()}_${year}`;

        const selected = (this.masterData || []).filter(p => {
            return this.state.selectedItems.has(p.description) &&
                (p.monthly && (p.monthly[currentMonth.toUpperCase() === 'NOVEMBER' ? 'NOPEMBER' : currentMonth.toUpperCase()] || 0) > 0);
        });

        if (selected.length === 0) {
            Toast.show('Tidak ada data untuk diekspor', 'warning');
            return;
        }

        const data = selected.map((p, idx) => {
            const row = {
                'No': idx + 1,
                'Program Kerja': p.description,
                'Kode': p.code || '-',
                'Cabang': p.branch,
                'Pagu Bulan': p.monthly[currentMonth.toUpperCase() === 'NOVEMBER' ? 'NOPEMBER' : currentMonth.toUpperCase()] || 0
            };

            [1, 2, 3, 4].forEach(w => {
                const weekKey = `W${w}`;
                const weekPlan = this.state.weeklyPlans[monthKey]?.[p.description]?.[weekKey] || {};
                row[`M${w} - Tanggal`] = weekPlan.date || '-';
                row[`M${w} - Surveyor 1`] = weekPlan.SURVEYOR_1 || '-';
                row[`M${w} - Surveyor 2`] = weekPlan.SURVEYOR_2 || '-';
                row[`M${w} - Drafter`] = weekPlan.DRAFTER || '-';
                row[`M${w} - Estimator`] = weekPlan.ESTIMATOR || '-';
            });

            return row;
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, `Mingguan ${currentMonth}`);
        XLSX.writeFile(wb, `RKAP_Mingguan_Detail_${currentMonth}_2026.xlsx`);
        Toast.show('Excel Mingguan Detail berhasil diunduh', 'success');
    },

    handleDailyFilterChange(type, val) {
        this.state.filters[type] = val;
        this.renderDaily();
        this.saveData();
    },

    renderDaily() {
        // Refactored for read-only personnel grid
        const container = document.getElementById('view-daily');
        if (!container) return;

        const currentMonth = this.state.filters.month || 'Januari';
        const currentWeek = this.state.filters.dailyWeek || 'W1';
        const branch = this.state.filters.branch;
        const year = '2026';
        const monthKey = `${currentMonth.toUpperCase() === 'NOVEMBER' ? 'NOPEMBER' : currentMonth.toUpperCase()}_${year}`;
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const branches = [...new Set((this.masterData || []).map(p => p.branch).filter(Boolean))].sort();

        // Consolidate activities by Personnel
        const personnelActivities = {};
        const programs = (this.masterData || []).filter(p => {
            const isSelected = this.state.selectedItems.has(p.description);
            const matchesBranch = !branch || p.branch === branch;
            return isSelected && matchesBranch;
        });

        let startDate = null;
        const dayNames = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];

        programs.forEach(prog => {
            const weekData = this.state.weeklyPlans?.[monthKey]?.[prog.description]?.[currentWeek];
            if (!weekData) {
                return;
            }

            // Find the earliest date among all role dates for startDate
            const roleDates = [
                weekData.SURVEYOR_1_DATE,
                weekData.SURVEYOR_2_DATE,
                weekData.DRAFTER_DATE,
                weekData.ESTIMATOR_DATE,
                weekData.MONEV_DATE,
                weekData.date // Legacy fallback
            ].filter(d => d);

            if (!startDate && roleDates.length > 0) {
                const earliestDate = roleDates.sort()[0];
                startDate = new Date(earliestDate);
            }

            const roles = [
                { key: 'SURVEYOR_1', label: 'Survey', dateKey: 'SURVEYOR_1_DATE' },
                { key: 'SURVEYOR_2', label: 'Survey', dateKey: 'SURVEYOR_2_DATE' },
                { key: 'DRAFTER', label: 'Drafter', dateKey: 'DRAFTER_DATE' },
                { key: 'ESTIMATOR', label: 'Estimator', dateKey: 'ESTIMATOR_DATE' },
                { key: 'MONEV', label: 'M&E', dateKey: 'MONEV_DATE' }
            ];

            roles.forEach(role => {
                const name = weekData[role.key];
                if (!name) return;

                // Get the role-specific date, fallback to legacy date
                const roleDate = weekData[role.dateKey] || weekData.date;
                if (!roleDate) return; // Skip if no date assigned

                if (!personnelActivities[name]) {
                    // Determine Rank for Sorting
                    let rank = 99;
                    if (this.state.personnel.manager.includes(name)) rank = 1;
                    else if (this.state.personnel.asman.includes(name)) rank = 2;
                    else if (this.state.personnel.staff.includes(name)) rank = 3;

                    personnelActivities[name] = {
                        name: name,
                        rank: rank,
                        days: {}
                    };
                }

                // Check for manual tasks first
                const taskKeyStandard = `${role.key}_TASKS`;
                const taskKeyLegacy = `${role.key} _TASKS`;
                let tasks = weekData[taskKeyStandard] || weekData[taskKeyLegacy];

                const hasManualTasks = tasks && typeof tasks === 'object' && Object.keys(tasks).length > 0 &&
                    Object.values(tasks).some(t => t && t.trim && t.trim() !== '');

                if (hasManualTasks) {
                    // Use manual tasks if they exist
                    Object.entries(tasks).forEach(([date, task]) => {
                        if (!task || !task.trim()) return;
                        if (!personnelActivities[name].days[date]) personnelActivities[name].days[date] = [];
                        personnelActivities[name].days[date].push(task);
                    });
                } else {
                    // Auto-generate task from program name and role on the role-specific date
                    const autoTask = `${role.label} - ${prog.description}`;

                    if (!personnelActivities[name].days[roleDate]) {
                        personnelActivities[name].days[roleDate] = [];
                    }
                    // Avoid duplicates
                    if (!personnelActivities[name].days[roleDate].includes(autoTask)) {
                        personnelActivities[name].days[roleDate].push(autoTask);
                    }
                }
            });
        });

        console.log(`📊 Personnel Grid: ${Object.keys(personnelActivities).length} workers found.`);
        if (Object.keys(personnelActivities).length > 0) {
            console.log('Sample Worker:', Object.values(personnelActivities)[0]);
        }

        const workers = Object.values(personnelActivities).sort((a, b) => {
            if (a.rank !== b.rank) return a.rank - b.rank;
            return a.name.localeCompare(b.name);
        });
        const dates = [];
        if (startDate) {
            for (let i = 0; i < 5; i++) {
                const d = new Date(startDate);
                d.setDate(d.getDate() + i);
                dates.push(d.toISOString().split('T')[0]);
            }
        }

        container.innerHTML = `
            <div class="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
                <div>
                    <h3 class="text-xl font-bold text-white">Monitoring Kegiatan Harian</h3>
                    <p class="text-sm text-slate-500 mt-1">Breakdown kegiatan pekerja dari Rencana Mingguan</p>
                </div>
                <div class="flex items-center gap-3">
                    <button onclick="RkapApp.showDebugData()" class="w-8 h-8 flex items-center justify-center text-slate-800 hover:text-slate-700 transition-colors" title="Debug State">
                        <i data-lucide="bug" class="w-4 h-4"></i>
                    </button>
                    <button onclick="RkapApp.loadData(); RkapApp.renderDaily();" class="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/50 px-3 py-2 rounded-xl transition-all text-sm font-medium" title="Refresh Data">
                        <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                    </button>
                    <div class="relative">
                        <i data-lucide="map-pin" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"></i>
                        <select onchange="RkapApp.handleDailyFilterChange('branch', this.value)" 
                            class="bg-slate-800 border border-slate-700/50 rounded-xl pl-9 pr-8 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 appearance-none min-w-[140px]">
                            <option value="">Semua Cabang</option>
                            ${branches.map(b => `<option value="${b}" ${branch === b ? 'selected' : ''}>${b}</option>`).join('')}
                        </select>
                    </div>
                    <div class="relative">
                        <i data-lucide="calendar" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"></i>
                        <select onchange="RkapApp.handleDailyFilterChange('month', this.value)" 
                            class="bg-slate-800 border border-slate-700/50 rounded-xl pl-9 pr-8 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 appearance-none min-w-[140px]">
                            ${months.map(m => `<option value="${m}" ${currentMonth === m ? 'selected' : ''}>${m}</option>`).join('')}
                        </select>
                    </div>
                    <div class="relative">
                        <i data-lucide="layers" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"></i>
                        <select onchange="RkapApp.handleDailyFilterChange('dailyWeek', this.value)" 
                            class="bg-slate-800 border border-slate-700/50 rounded-xl pl-9 pr-8 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 appearance-none">
                            <option value="W1" ${currentWeek === 'W1' ? 'selected' : ''}>Minggu 1</option>
                            <option value="W2" ${currentWeek === 'W2' ? 'selected' : ''}>Minggu 2</option>
                            <option value="W3" ${currentWeek === 'W3' ? 'selected' : ''}>Minggu 3</option>
                            <option value="W4" ${currentWeek === 'W4' ? 'selected' : ''}>Minggu 4</option>
                        </select>
                    </div>
                    <button onclick="RkapApp.exportDailyExcel()" class="flex items-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-4 py-2 rounded-xl transition-all text-sm font-medium">
                        <i data-lucide="download" class="w-4 h-4"></i>
                        Export
                    </button>
                </div>
            </div>

    <div class="card-premium overflow-hidden">
        <div class="overflow-x-auto custom-scrollbar">
            <table class="w-full text-left border-collapse min-w-[1200px]">
                <thead>
                    <tr class="bg-slate-800/50 border-b border-slate-700">
                        <th class="p-4 text-xs font-bold uppercase tracking-wider text-slate-400 w-12 border-r border-slate-700/50">No</th>
                        <th class="p-4 text-xs font-bold uppercase tracking-wider text-slate-400 border-r border-slate-700/50 w-64">Nama Pekerja</th>
                        ${dates.length === 0 ? dayNames.map(d => `<th class="p-4 text-xs font-bold uppercase tracking-wider text-slate-300 text-center border-r border-slate-700/50 bg-slate-800/20">${d}</th>`).join('') : dates.map((dateStr) => {
            const d = new Date(dateStr);
            const dayName = d.toLocaleDateString('id-ID', { weekday: 'long' });
            const dateLabel = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
            return `<th class="p-4 text-xs font-bold uppercase tracking-wider text-slate-300 text-center border-r border-slate-700/50 bg-slate-800/20">
                                        ${dayName}<br><span class="text-[9px] text-slate-500">${dateLabel}</span>
                                    </th>`;
        }).join('')}
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-800">
                    ${workers.length === 0 ? `
                                <tr>
                                    <td colspan="7" class="p-16 text-center text-slate-500 italic">
                                        <div class="flex flex-col items-center gap-4">
                                            <div class="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center border border-white/5">
                                                <i data-lucide="calendar-off" class="w-8 h-8 text-slate-600"></i>
                                            </div>
                                            <div>
                                                <h4 class="text-white font-semibold not-italic">Data tidak tersedia</h4>
                                                <p class="text-sm mt-2 font-medium">Lakukan <b class="text-indigo-400">Breakdown Harian</b> pada menu <b class="text-indigo-400">Rencana Mingguan</b>.</p>
                                                <p class="text-[10px] text-slate-600 mt-2 uppercase tracking-widest">(Bulan: ${currentMonth}, ${currentWeek})</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ` : workers.map((worker, idx) => `
                                <tr class="hover:bg-white/5 transition-colors">
                                    <td class="p-4 text-sm text-slate-500 border-r border-slate-700/50 text-center">${idx + 1}</td>
                                    <td class="p-4 border-r border-slate-700/50">
                                        <div class="font-bold text-slate-100 text-sm tracking-tight">${worker.name}</div>
                                    </td>
                                    ${dates.map(dateStr => {
            const tasks = worker.days[dateStr] || [];
            return `
                                            <td class="p-4 border-r border-slate-700/50 bg-slate-900/10">
                                                <div class="text-xs text-slate-400 leading-relaxed">
                                                    ${tasks.length > 0 ? tasks.join('<hr class="my-1.5 border-slate-700/50">') : '<span class="text-slate-700 italic">-</span>'}
                                                </div>
                                            </td>
                                        `;
        }).join('')}
                                </tr>
                            `).join('')}
                </tbody>
            </table>
        </div>
    </div>
`;
        lucide.createIcons();
    },

    handleDailyFilterChange(type, value) {
        this.state.filters[type] = value;
        this.saveData();
        this.renderDaily();
    },

    showDebugData() {
        const data = JSON.stringify({
            filters: this.state.filters,
            weeklyPlans: this.state.weeklyPlans
        }, null, 2);

        Modal.show('Debug Data State', `
            <div class="space-y-4">
                <p class="text-xs text-slate-400">Salin data di bawah ini untuk bantuan teknis:</p>
                <textarea readonly class="w-full h-[50vh] bg-black/30 p-4 rounded text-[10px] font-mono text-slate-300 border border-slate-700 focus:outline-none">${data}</textarea>
                <div class="flex justify-end">
                    <button onclick="navigator.clipboard.writeText(this.previousElementSibling.value); Toast.show('Data disalin ke clipboard', 'success')" class="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold">Salin Data</button>
                </div>
            </div>
    `, 'info');
    },

    exportDailyExcel() {
        const currentMonth = this.state.filters.month || 'Januari';
        const currentWeek = this.state.filters.dailyWeek || 'W1';
        const branch = this.state.filters.branch;
        const year = '2026';
        const monthKey = `${currentMonth.toUpperCase() === 'NOVEMBER' ? 'NOPEMBER' : currentMonth.toUpperCase()}_${year}`;

        const personnelActivities = {};
        const programs = (this.masterData || []).filter(p => {
            const isSelected = this.state.selectedItems.has(p.description);
            const matchesBranch = !branch || p.branch === branch;
            return isSelected && matchesBranch;
        });

        let startDate = null;
        programs.forEach(prog => {
            const weekData = this.state.weeklyPlans?.[monthKey]?.[prog.description]?.[currentWeek];
            if (!weekData) return;

            // Find the earliest date among all role dates for startDate
            const roleDates = [
                weekData.SURVEYOR_1_DATE,
                weekData.SURVEYOR_2_DATE,
                weekData.DRAFTER_DATE,
                weekData.ESTIMATOR_DATE,
                weekData.MONEV_DATE,
                weekData.date
            ].filter(d => d);

            if (!startDate && roleDates.length > 0) {
                const earliestDate = roleDates.sort()[0];
                startDate = new Date(earliestDate);
            }

            const roles = [
                { key: 'SURVEYOR_1', label: 'Survey', dateKey: 'SURVEYOR_1_DATE' },
                { key: 'SURVEYOR_2', label: 'Survey', dateKey: 'SURVEYOR_2_DATE' },
                { key: 'DRAFTER', label: 'Drafter', dateKey: 'DRAFTER_DATE' },
                { key: 'ESTIMATOR', label: 'Estimator', dateKey: 'ESTIMATOR_DATE' },
                { key: 'MONEV', label: 'M&E', dateKey: 'MONEV_DATE' }
            ];

            roles.forEach(role => {
                const name = weekData[role.key];
                if (!name) return;

                const roleDate = weekData[role.dateKey] || weekData.date;
                if (!roleDate) return;

                if (!personnelActivities[name]) {
                    let rank = 99;
                    if (this.state.personnel.manager.includes(name)) rank = 1;
                    else if (this.state.personnel.asman.includes(name)) rank = 2;
                    else if (this.state.personnel.staff.includes(name)) rank = 3;

                    personnelActivities[name] = { name: name, rank: rank, days: {} };
                }

                const taskKey = `${role.key}_TASKS`;
                const tasks = weekData[taskKey] || {};
                const hasManualTasks = Object.keys(tasks).length > 0 &&
                    Object.values(tasks).some(t => t && t.trim && t.trim() !== '');

                if (hasManualTasks) {
                    Object.entries(tasks).forEach(([date, task]) => {
                        if (!task || !task.trim()) return;
                        if (!personnelActivities[name].days[date]) personnelActivities[name].days[date] = [];
                        personnelActivities[name].days[date].push(task);
                    });
                } else {
                    // Auto-generate task from program name and role on role-specific date
                    const autoTask = `${role.label} - ${prog.description}`;
                    if (!personnelActivities[name].days[roleDate]) {
                        personnelActivities[name].days[roleDate] = [];
                    }
                    if (!personnelActivities[name].days[roleDate].includes(autoTask)) {
                        personnelActivities[name].days[roleDate].push(autoTask);
                    }
                }
            });
        });

        if (!startDate || Object.keys(personnelActivities).length === 0) {
            Toast.show('Tidak ada data penugasan untuk diekspor', 'warning');
            return;
        }

        const data = Object.values(personnelActivities).sort((a, b) => {
            if (a.rank !== b.rank) return a.rank - b.rank;
            return a.name.localeCompare(b.name);
        }).map(worker => {
            const row = { 'Nama Pekerja': worker.name };
            for (let i = 0; i < 5; i++) {
                const d = new Date(startDate);
                d.setDate(d.getDate() + i);
                const dateStr = d.toISOString().split('T')[0];
                const dayName = new Date(dateStr).toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'short' });
                row[dayName] = (worker.days[dateStr] || []).join(', ') || '-';
            }
            return row;
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, "Monitoring Harian");
        XLSX.writeFile(wb, `RKAP_Monitoring_Harian_${currentMonth}_${currentWeek}.xlsx`);
        Toast.show('Excel Monitoring Harian berhasil diunduh', 'success');
    },

    // ========== LAPORAN DIREKSI ==========
    renderDireksi() {
        const container = document.getElementById('view-direksi');
        if (!container) return;

        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const currentMonth = this.state.filters.month || months[new Date().getMonth()];
        const year = '2026';
        const monthKey = `${currentMonth.toUpperCase() === 'NOVEMBER' ? 'NOPEMBER' : currentMonth.toUpperCase()}_${year}`;

        // Get all programs with weekly data
        const programs = (this.masterData || []).filter(p => this.state.selectedItems.has(p.description));

        // Prepare report data
        const reportData = [];
        programs.forEach(prog => {
            const weeklyData = this.state.weeklyPlans?.[monthKey]?.[prog.description] || {};

            ['W1', 'W2', 'W3', 'W4'].forEach(weekKey => {
                const week = weeklyData[weekKey];
                if (week && (week.SURVEY_DATE || week.SURVEYOR_1 || week.DRAFTER)) {
                    reportData.push({
                        program: prog.description,
                        branch: prog.branch,
                        category: prog.category,
                        isManual: prog.isManual,
                        weekKey: weekKey,
                        weekData: week,
                        reviewStatus: week.reviewStatus || 'pending'
                    });
                }
            });
        });

        // Stats
        const totalScheduled = reportData.length;
        const approved = reportData.filter(r => r.reviewStatus === 'approved').length;
        const rejected = reportData.filter(r => r.reviewStatus === 'rejected').length;
        const pending = reportData.filter(r => r.reviewStatus === 'pending').length;

        container.innerHTML = `
            <div class="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
                <div>
                    <h3 class="text-xl font-bold text-white flex items-center gap-2">
                        <i data-lucide="briefcase" class="w-6 h-6 text-indigo-400"></i>
                        Laporan untuk Direksi
                    </h3>
                    <p class="text-sm text-slate-500 mt-1">Ringkasan Rencana Kerja & Penugasan Personel</p>
                </div>
                <div class="flex items-center gap-3">
                    <div class="relative">
                        <i data-lucide="calendar" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"></i>
                        <select onchange="RkapApp.handleFilterUpdate('month', this.value); RkapApp.renderDireksi();" 
                            class="bg-slate-800 border border-slate-700/50 rounded-xl pl-9 pr-8 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 appearance-none min-w-[140px]">
                            ${months.map(m => `<option value="${m}" ${currentMonth === m ? 'selected' : ''}>${m}</option>`).join('')}
                        </select>
                    </div>
                    <button onclick="RkapApp.exportDireksiExcel()" class="flex items-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-4 py-2 rounded-xl transition-all text-sm font-medium">
                        <i data-lucide="download" class="w-4 h-4"></i>
                        Export Excel
                    </button>
                    <button onclick="window.print()" class="flex items-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 px-4 py-2 rounded-xl transition-all text-sm font-medium">
                        <i data-lucide="printer" class="w-4 h-4"></i>
                        Cetak
                    </button>
                </div>
            </div>

            <!-- Stats Cards -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div class="card-premium p-4">
                    <div class="text-xs text-slate-500 uppercase font-bold tracking-wider">Total Jadwal</div>
                    <div class="text-2xl font-bold text-white mt-1">${totalScheduled}</div>
                </div>
                <div class="card-premium p-4 border-l-2 border-emerald-500">
                    <div class="text-xs text-emerald-400 uppercase font-bold tracking-wider">Disetujui</div>
                    <div class="text-2xl font-bold text-emerald-400 mt-1">${approved}</div>
                </div>
                <div class="card-premium p-4 border-l-2 border-rose-500">
                    <div class="text-xs text-rose-400 uppercase font-bold tracking-wider">Ditolak</div>
                    <div class="text-2xl font-bold text-rose-400 mt-1">${rejected}</div>
                </div>
                <div class="card-premium p-4 border-l-2 border-amber-500">
                    <div class="text-xs text-amber-400 uppercase font-bold tracking-wider">Menunggu</div>
                    <div class="text-2xl font-bold text-amber-400 mt-1">${pending}</div>
                </div>
            </div>

            <!-- Report Table -->
            <div class="card-premium overflow-hidden">
                <div class="p-4 bg-slate-800/50 border-b border-slate-700/50">
                    <h4 class="font-bold text-white">Jadwal Pekerjaan - ${currentMonth} ${year}</h4>
                </div>
                <div class="overflow-x-auto custom-scrollbar">
                    <table class="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                            <tr class="bg-slate-800/30 border-b border-slate-700">
                                <th class="p-3 text-xs font-bold uppercase tracking-wider text-slate-400 w-12">No</th>
                                <th class="p-3 text-xs font-bold uppercase tracking-wider text-slate-400">Program Kerja</th>
                                <th class="p-3 text-xs font-bold uppercase tracking-wider text-slate-400 w-24">Cabang</th>
                                <th class="p-3 text-xs font-bold uppercase tracking-wider text-slate-400 w-20">Minggu</th>
                                <th class="p-3 text-xs font-bold uppercase tracking-wider text-slate-400 w-28">Tgl Survey</th>
                                <th class="p-3 text-xs font-bold uppercase tracking-wider text-slate-400">Tim Pelaksana</th>
                                <th class="p-3 text-xs font-bold uppercase tracking-wider text-slate-400 w-32 text-center">Status</th>
                                <th class="p-3 text-xs font-bold uppercase tracking-wider text-slate-400 w-28 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-800">
                            ${reportData.length === 0 ? `
                                <tr>
                                    <td colspan="8" class="p-12 text-center text-slate-500 italic">
                                        <div class="flex flex-col items-center gap-3">
                                            <i data-lucide="inbox" class="w-12 h-12 text-slate-600"></i>
                                            <p>Belum ada jadwal untuk bulan ini</p>
                                        </div>
                                    </td>
                                </tr>
                            ` : reportData.map((item, idx) => {
            const w = item.weekData;
            const surveyDate = w.SURVEY_DATE ? new Date(w.SURVEY_DATE).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
            const team = [w.SURVEYOR_1, w.SURVEYOR_2, w.DRAFTER, w.ESTIMATOR, w.MONEV].filter(Boolean);

            let statusBadge = '';
            if (item.reviewStatus === 'approved') {
                statusBadge = `<span class="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">✓ Disetujui</span>`;
            } else if (item.reviewStatus === 'rejected') {
                statusBadge = `<span class="px-3 py-1 rounded-full bg-rose-500/20 text-rose-400 text-xs font-bold">✗ Ditolak</span>`;
            } else {
                statusBadge = `<span class="px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">⏳ Menunggu</span>`;
            }

            return `
                                    <tr class="hover:bg-slate-800/30 transition-colors">
                                        <td class="p-3 text-slate-400 font-mono text-sm">${idx + 1}</td>
                                        <td class="p-3">
                                            <div class="font-medium text-white">${item.program}</div>
                                            ${item.isManual ? `<span class="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">TAMBAHAN</span>` : ''}
                                        </td>
                                        <td class="p-3 text-slate-400 text-sm">${item.branch || '-'}</td>
                                        <td class="p-3 text-indigo-400 font-bold text-sm">${item.weekKey.replace('W', 'M')}</td>
                                        <td class="p-3 text-amber-400 font-medium text-sm">${surveyDate}</td>
                                        <td class="p-3">
                                            <div class="flex flex-wrap gap-1">
                                                ${team.map(t => `<span class="px-2 py-0.5 rounded bg-slate-700 text-slate-300 text-[10px]">${t}</span>`).join('')}
                                            </div>
                                        </td>
                                        <td class="p-3 text-center">${statusBadge}</td>
                                        <td class="p-3 text-center">
                                            <div class="flex items-center justify-center gap-1">
                                                <button onclick="RkapApp.setReviewStatus('${monthKey}', '${item.program.replace(/'/g, "\\'")}', '${item.weekKey}', 'approved')" 
                                                    class="p-2 rounded-lg ${item.reviewStatus === 'approved' ? 'bg-emerald-500 text-white' : 'text-emerald-400 hover:bg-emerald-500/20'} transition-all" title="Setujui">
                                                    <i data-lucide="check" class="w-4 h-4"></i>
                                                </button>
                                                <button onclick="RkapApp.setReviewStatus('${monthKey}', '${item.program.replace(/'/g, "\\'")}', '${item.weekKey}', 'rejected')" 
                                                    class="p-2 rounded-lg ${item.reviewStatus === 'rejected' ? 'bg-rose-500 text-white' : 'text-rose-400 hover:bg-rose-500/20'} transition-all" title="Tolak">
                                                    <i data-lucide="x" class="w-4 h-4"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                `;
        }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        lucide.createIcons();
    },

    setReviewStatus(monthKey, progDesc, weekKey, status) {
        if (!this.state.weeklyPlans?.[monthKey]?.[progDesc]?.[weekKey]) return;

        this.state.weeklyPlans[monthKey][progDesc][weekKey].reviewStatus = status;
        this.saveData();
        this.renderDireksi();

        const statusText = status === 'approved' ? 'disetujui' : 'ditolak';
        Toast.show(`Jadwal ${statusText}`, status === 'approved' ? 'success' : 'info');
    },

    exportDireksiExcel() {
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const currentMonth = this.state.filters.month || months[new Date().getMonth()];
        const year = '2026';
        const monthKey = `${currentMonth.toUpperCase() === 'NOVEMBER' ? 'NOPEMBER' : currentMonth.toUpperCase()}_${year}`;

        const programs = (this.masterData || []).filter(p => this.state.selectedItems.has(p.description));
        const data = [];

        programs.forEach(prog => {
            const weeklyData = this.state.weeklyPlans?.[monthKey]?.[prog.description] || {};

            ['W1', 'W2', 'W3', 'W4'].forEach(weekKey => {
                const week = weeklyData[weekKey];
                if (week && (week.SURVEY_DATE || week.SURVEYOR_1)) {
                    data.push({
                        'Program Kerja': prog.description,
                        'Cabang': prog.branch || '-',
                        'Kategori': prog.category || '-',
                        'Minggu': weekKey.replace('W', 'Minggu '),
                        'Tgl Survey': week.SURVEY_DATE || '-',
                        'Surveyor 1': week.SURVEYOR_1 || '-',
                        'Surveyor 2': week.SURVEYOR_2 || '-',
                        'Drafter': week.DRAFTER || '-',
                        'Estimator': week.ESTIMATOR || '-',
                        'M&E': week.MONEV || '-',
                        'Status': week.reviewStatus === 'approved' ? 'Disetujui' : week.reviewStatus === 'rejected' ? 'Ditolak' : 'Menunggu'
                    });
                }
            });
        });

        if (data.length === 0) {
            Toast.show('Tidak ada data untuk diekspor', 'warning');
            return;
        }

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, "Laporan Direksi");
        XLSX.writeFile(wb, `Laporan_Direksi_${currentMonth}_${year}.xlsx`);
        Toast.show('Excel Laporan Direksi berhasil diunduh', 'success');
    }
};

// Modern Toast for RKAP
const Toast = {
    show(message, type = 'info') {
        const container = document.querySelector('.toast-container') || this.createContainer();
        const toast = document.createElement('div');
        toast.className = 'toast-modern p-4 mb-3 flex items-center gap-4 animate-fade-in text-sm font-medium pr-6 min-w-[300px] border-l-4';

        const types = {
            error: { icon: 'alert-circle', color: 'text-rose-400', border: 'border-rose-500' },
            success: { icon: 'check-circle', color: 'text-emerald-400', border: 'border-emerald-500' },
            warning: { icon: 'alert-triangle', color: 'text-amber-400', border: 'border-amber-500' },
            info: { icon: 'info', color: 'text-indigo-400', border: 'border-indigo-500' }
        };

        const config = types[type] || types.info;
        toast.classList.add(config.border);

        toast.innerHTML = `
            <div class="${config.color}"><i data-lucide="${config.icon}" class="w-5 h-5"></i></div>
            <div class="text-slate-200">${message}</div>
            <button class="ml-auto text-slate-500 hover:text-white transition-colors" onclick="this.parentElement.remove()">
                <i data-lucide="x" class="w-4 h-4"></i>
            </button>
        `;

        container.appendChild(toast);
        lucide.createIcons();

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(20px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    },
    createContainer() {
        const div = document.createElement('div');
        div.className = 'toast-container fixed bottom-8 right-8 z-[100] flex flex-col items-end';
        document.body.appendChild(div);
        return div;
    }
};

// Initialize modal when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Expose App to Global Scope for onclick handlers
    window.RkapApp = RkapApp;
    RkapApp.init();
});