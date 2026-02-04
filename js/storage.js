/**
 * Storage Module - localStorage wrapper with JSON support
 * Handles all data persistence for the application
 */

const Storage = {
    // Keys for different data types
    KEYS: {
        RENCANA_BULANAN: 'pertek_rencana_bulanan',
        RENCANA_MINGGUAN: 'pertek_rencana_mingguan',
        TUGAS: 'pertek_tugas',
        PEKERJAAN: 'pertek_pekerjaan',
        LAPORAN_HARIAN: 'pertek_laporan_harian',
        PEKERJA: 'pertek_pekerja',
        EVALUASI: 'pertek_evaluasi',
        LAPORAN_DIREKSI: 'pertek_laporan_direksi',
        RKAP: 'pertek_rkap'
    },

    /**
     * Get data from localStorage
     * @param {string} key - Storage key
     * @param {boolean} raw - If true, return object as is without array conversion
     * @returns {Array|Object} - Parsed data
     */
    get(key, raw = false) {
        try {
            const data = localStorage.getItem(key);
            if (!data) return raw ? {} : [];

            const parsed = JSON.parse(data);

            if (raw) return parsed;

            // If it's already an array, return it
            if (Array.isArray(parsed)) return parsed;

            // If it's an object (possible from Firebase RTDB array handling), convert to array
            if (parsed && typeof parsed === 'object') {
                return Object.values(parsed);
            }

            return [];
        } catch (error) {
            console.error('Error reading from storage:', error);
            return raw ? {} : [];
        }
    },

    /**
     * Save data to localStorage
     * @param {string} key - Storage key
     * @param {Array} data - Data to save
     * @param {boolean} skipSync - Whether to skip cloud sync
     */
    set(key, data, skipSync = false) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            if (this.config.autoSync && !skipSync) {
                this.push(key);
            }
        } catch (error) {
            console.error('Error saving to storage:', error);
        }
    },

    /**
     * Add a new item to a collection
     * @param {string} key - Storage key
     * @param {Object} item - Item to add
     * @returns {Object} - Added item with generated ID
     */
    add(key, item) {
        const data = this.get(key);
        const newItem = {
            ...item,
            id: this.generateId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        data.push(newItem);
        this.set(key, data);
        return newItem;
    },

    /**
     * Update an existing item
     * @param {string} key - Storage key
     * @param {string} id - Item ID
     * @param {Object} updates - Fields to update
     * @returns {Object|null} - Updated item or null if not found
     */
    update(key, id, updates) {
        const data = this.get(key);
        const index = data.findIndex(item => item.id === id);
        if (index !== -1) {
            data[index] = {
                ...data[index],
                ...updates,
                updatedAt: new Date().toISOString()
            };
            this.set(key, data);
            return data[index];
        }
        return null;
    },

    /**
     * Delete an item by ID
     * @param {string} key - Storage key
     * @param {string} id - Item ID
     * @returns {boolean} - True if deleted, false if not found
     */
    delete(key, id) {
        const data = this.get(key);
        const index = data.findIndex(item => item.id === id);
        if (index !== -1) {
            data.splice(index, 1);
            this.set(key, data);
            return true;
        }
        return false;
    },

    /**
     * Find an item by ID
     * @param {string} key - Storage key
     * @param {string} id - Item ID
     * @returns {Object|null} - Found item or null
     */
    findById(key, id) {
        const data = this.get(key);
        return data.find(item => item.id === id) || null;
    },

    /**
     * Filter items by criteria
     * @param {string} key - Storage key
     * @param {Function} predicate - Filter function
     * @returns {Array} - Filtered items
     */
    filter(key, predicate) {
        const data = this.get(key);
        return data.filter(predicate);
    },

    /**
     * Generate a unique ID
     * @returns {string} - Unique ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    /**
     * Clear all application data
     */
    clearAll() {
        Object.values(this.KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
    },

    // --- CLOUD SYNC (FIREBASE) ---

    // Default Firebase Configuration
    DEFAULT_CONFIG: {
        apiKey: 'AIzaSyC_Cf-Sp3DJHXIC88158-FrYdyotoUJfQE',
        databaseURL: 'https://laporan-kegiatan-pertek-default-rtdb.asia-southeast1.firebasedatabase.app',
        projectId: 'laporan-kegiatan-pertek',
        autoSync: true
    },

    config: {
        apiKey: localStorage.getItem('pertek_firebase_apiKey') || '',
        databaseURL: localStorage.getItem('pertek_firebase_databaseURL') || '',
        projectId: localStorage.getItem('pertek_firebase_projectId') || '',
        autoSync: localStorage.getItem('pertek_auto_sync') === 'true'
    },

    /**
     * Initialize config with defaults if not set
     */
    initDefaultConfig() {
        // Jika belum ada config di localStorage, gunakan default
        if (!this.config.apiKey && this.DEFAULT_CONFIG.apiKey !== 'YOUR_FIREBASE_API_KEY') {
            this.config.apiKey = this.DEFAULT_CONFIG.apiKey;
            this.config.databaseURL = this.DEFAULT_CONFIG.databaseURL;
            this.config.projectId = this.DEFAULT_CONFIG.projectId;
            this.config.autoSync = this.DEFAULT_CONFIG.autoSync;

            // Simpan ke localStorage
            localStorage.setItem('pertek_firebase_apiKey', this.config.apiKey);
            localStorage.setItem('pertek_firebase_databaseURL', this.config.databaseURL);
            localStorage.setItem('pertek_firebase_projectId', this.config.projectId);
            localStorage.setItem('pertek_auto_sync', this.config.autoSync);
        }
    },

    db: null,
    onSyncCallback: null,
    managedListener: false,
    _resolveInit: null,
    isInitialized: null, // Initialized below

    /**
     * Initialize Firebase client
     */
    initCloud() {
        if (this.config.apiKey && this.config.databaseURL && window.firebase) {
            try {
                // Only initialize if not already initialized
                if (!firebase.apps.length) {
                    const firebaseConfig = {
                        apiKey: this.config.apiKey,
                        databaseURL: this.config.databaseURL,
                        projectId: this.config.projectId
                    };
                    firebase.initializeApp(firebaseConfig);
                }
                this.db = firebase.database();

                // Setup real-time listener if autoSync is enabled
                if (this.config.autoSync && !this.managedListener) {
                    this.db.ref('pertek_data').on('value', (snapshot) => {
                        const data = snapshot.val();
                        if (data) {
                            Object.keys(data).forEach(key => {
                                // Use skipSync=true to avoid recursive push()
                                this.set(key, data[key], true);
                            });
                            // Fix for missing names: migrate incoming data IDs immediately
                            this.migratePekerjaIds();
                            // Notify UI to refresh
                            if (this.onSyncCallback) {
                                this.onSyncCallback();
                            }
                        }
                    });
                    this.managedListener = true;
                }

                return true;
            } catch (error) {
                console.error('Firebase init error:', error);
                return false;
            }
        }
        return false;
    },

    /**
     * Save cloud configuration
     */
    saveConfig(config) {
        this.config.apiKey = config.apiKey;
        this.config.databaseURL = config.databaseURL;
        this.config.projectId = config.projectId;
        this.config.autoSync = config.autoSync;

        localStorage.setItem('pertek_firebase_apiKey', config.apiKey);
        localStorage.setItem('pertek_firebase_databaseURL', config.databaseURL);
        localStorage.setItem('pertek_firebase_projectId', config.projectId);
        localStorage.setItem('pertek_auto_sync', config.autoSync);

        this.initCloud();
    },

    /**
     * Pull data from cloud and merge with local
     */
    async pull() {
        if (!this.initCloud()) return { success: false, message: 'Firebase not configured' };

        try {
            const snapshot = await this.db.ref('pertek_data').once('value');
            const data = snapshot.val();

            if (!data) return { success: true, message: 'No data found in cloud' };

            let updatedCount = 0;
            Object.keys(data).forEach(key => {
                // Simplified: use the remote data as source of truth for now
                this.set(key, data[key], true); // true to skip recursion
                updatedCount++;
            });

            // Fix for missing names: migrate incoming data IDs immediately
            this.migratePekerjaIds();

            if (this.onSyncCallback) {
                this.onSyncCallback();
            }

            return { success: true, message: `${updatedCount} collections updated` };
        } catch (error) {
            console.error('Firebase pull error:', error);
            return { success: false, message: error.message };
        }
    },

    /**
     * Push current local data to cloud
     */
    async push(specificKey = null) {
        if (!this.initCloud()) return { success: false, message: 'Firebase not configured' };

        try {
            if (specificKey) {
                // Push only one specific key
                await this.db.ref(`pertek_data/${specificKey}`).set(this.get(specificKey));
                return { success: true, message: `Key ${specificKey} pushed to cloud` };
            } else {
                // Push everything
                const keys = Object.values(this.KEYS);
                const uploadData = {};

                for (const key of keys) {
                    uploadData[key] = this.get(key);
                }

                await this.db.ref('pertek_data').set(uploadData);
                return { success: true, message: 'Full data pushed to cloud' };
            }
        } catch (error) {
            console.error('Firebase push error:', error);
            return { success: false, message: error.message };
        }
    },

    /**
     * Initialize sample data if empty
     * Uses fixed IDs to ensure consistency across all devices during Firebase sync
     */
    initSampleData() {
        // Add workers based on organizational structure with FIXED IDs
        // This ensures all devices have the same worker IDs
        const samplePekerja = [
            // Manajemen
            { id: 'dadi', nama: 'Dadi Riswadi', role: 'manager', departemen: 'Divisi' },
            { id: 'riko', nama: 'Riko Komara', role: 'asman_sipil', departemen: 'Bangunan Sipil' },
            { id: 'sulaeman', nama: 'M. Sulaeman', role: 'asman_perpipaan', departemen: 'Perpipaan' },

            // Staff Teknis
            { id: 'yunia', nama: 'Yunia', role: 'staf', departemen: 'Teknik' },
            { id: 'andit', nama: 'Andit', role: 'staf', departemen: 'Perencanaan' },
            { id: 'fahry', nama: 'Fahry', role: 'staf', departemen: 'Desain' },
            { id: 'aldy', nama: 'Aldy', role: 'staf', departemen: 'Teknik' },

            // Pengawas dan Pengendalian
            { id: 'dian', nama: 'Dian Suhendrik', role: 'staf', departemen: 'Pengawasan' }
        ];

        const existingPekerja = this.get(this.KEYS.PEKERJA);
        const existingIds = existingPekerja.map(p => p.id);

        let needsUpdate = false;

        samplePekerja.forEach(pekerja => {
            // Only add if this fixed ID doesn't exist yet
            if (!existingIds.includes(pekerja.id)) {
                existingPekerja.push({
                    ...pekerja,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
                needsUpdate = true;
            }
        });

        if (needsUpdate) {
            this.set(this.KEYS.PEKERJA, existingPekerja, true);
        }
    },

    /**
     * Migrate old random worker IDs to fixed IDs in all pekerjaan data
     * This fixes existing data where pelaksana IDs don't match current pekerja IDs
     */
    migratePekerjaIds() {
        const pekerja = this.get(this.KEYS.PEKERJA);
        const pekerjaan = this.get(this.KEYS.PEKERJAAN);

        if (pekerjaan.length === 0) return;

        // Create mapping from old random IDs to fixed IDs based on nama
        const namaToFixedId = {
            'Dadi Riswadi': 'dadi',
            'Riko Komara': 'riko',
            'M. Sulaeman': 'sulaeman',
            'Yunia': 'yunia',
            'Andit': 'andit',
            'Fahry': 'fahry',
            'Aldy': 'aldy',
            'Dian Suhendrik': 'dian'
        };

        // Build mapping from any old ID to fixed ID
        const oldIdToFixedId = {};
        pekerja.forEach(p => {
            const fixedId = namaToFixedId[p.nama];
            if (fixedId && p.id !== fixedId) {
                oldIdToFixedId[p.id] = fixedId;
            }
        });

        // Also map by looking at existing pekerjaan pelaksana
        // that might have old IDs not in current pekerja list
        let migrated = false;

        pekerjaan.forEach(item => {
            if (!item.tahapan) return;

            item.tahapan.forEach(tahap => {
                if (!tahap.pelaksana || !Array.isArray(tahap.pelaksana)) return;

                tahap.pelaksana = tahap.pelaksana.map(id => {
                    // Normalize ID: if it's already a correct short ID from our map, keep it
                    if (Object.values(namaToFixedId).includes(id)) return id;

                    // Try mapping from known old IDs
                    if (oldIdToFixedId[id]) {
                        migrated = true;
                        return oldIdToFixedId[id];
                    }

                    // Try to find pekerja with this ID and get their name
                    const worker = pekerja.find(p => p.id === id);
                    if (worker && namaToFixedId[worker.nama]) {
                        migrated = true;
                        return namaToFixedId[worker.nama];
                    }

                    // Keep original ID if no mapping found
                    return id;
                });
            });
        });

        if (migrated) {
            this.set(this.KEYS.PEKERJAAN, pekerjaan, true);
            console.log('Migration completed: Updated pelaksana IDs to fixed IDs');
        }

        // Also clean up duplicate pekerja with old random IDs
        const fixedIds = Object.values(namaToFixedId);
        const cleanedPekerja = pekerja.filter(p =>
            fixedIds.includes(p.id) || !Object.keys(namaToFixedId).includes(p.nama)
        );

        if (cleanedPekerja.length !== pekerja.length) {
            this.set(this.KEYS.PEKERJA, cleanedPekerja, true);
            console.log('Cleaned up duplicate pekerja entries');
        }
    },
};

// Initialize sample data and cloud on load
document.addEventListener('DOMContentLoaded', async () => {
    Storage.initDefaultConfig(); // Load default Firebase config first

    // Initialize cloud and pull first if autoSync is on
    if (Storage.initCloud() && Storage.config.autoSync) {
        // Automatic pull on startup to get latest data from other devices
        await Storage.pull();
    }

    // Run maintenance tasks AFTER pull
    Storage.initSampleData();
    Storage.migratePekerjaIds();

    // Signal that storage is ready
    if (Storage._resolveInit) {
        Storage._resolveInit();
        console.log('Storage initialized and synced');
    }
});
