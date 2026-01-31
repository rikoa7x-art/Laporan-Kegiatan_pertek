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
        LAPORAN_DIREKSI: 'pertek_laporan_direksi'
    },

    /**
     * Get data from localStorage
     * @param {string} key - Storage key
     * @returns {Array} - Parsed data array or empty array
     */
    get(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Error reading from storage:', error);
            return [];
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
                this.push();
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
    async push() {
        if (!this.initCloud()) return { success: false, message: 'Firebase not configured' };

        try {
            const keys = Object.values(this.KEYS);
            const uploadData = {};

            for (const key of keys) {
                uploadData[key] = this.get(key);
            }

            await this.db.ref('pertek_data').set(uploadData);

            return { success: true, message: 'Data pushed to cloud' };
        } catch (error) {
            console.error('Firebase push error:', error);
            return { success: false, message: error.message };
        }
    },

    /**
     * Initialize sample data if empty
     */
    initSampleData() {
        // Only init if no data exists
        if (this.get(this.KEYS.PEKERJA).length === 0) {
            // Add workers based on organizational structure
            const samplePekerja = [
                // Manajemen
                { nama: 'Dadi Riswadi', role: 'manager', departemen: 'Divisi' },
                { nama: 'Riko Komara', role: 'asman_sipil', departemen: 'Bangunan Sipil' },
                { nama: 'M. Sulaeman', role: 'asman_perpipaan', departemen: 'Perpipaan' },

                // Staff Teknis
                { nama: 'Yunia', role: 'staf', departemen: 'Teknik' },
                { nama: 'Andit', role: 'staf', departemen: 'Perencanaan' },
                { nama: 'Fahry', role: 'staf', departemen: 'Desain' },
                { nama: 'Aldy', role: 'staf', departemen: 'Teknik' },

                // Pengawas dan Pengendalian
                { nama: 'Dian Suhendrik', role: 'wasdal', departemen: 'Pengawasan' }
            ];

            samplePekerja.forEach(pekerja => {
                this.add(this.KEYS.PEKERJA, pekerja);
            });
        }
    }
};

// Initialize sample data and cloud on load
document.addEventListener('DOMContentLoaded', async () => {
    Storage.initDefaultConfig(); // Load default Firebase config first
    Storage.initSampleData();
    if (Storage.initCloud() && Storage.config.autoSync) {
        // Automatic pull on startup to get latest data from other devices
        await Storage.pull();
    }
});
