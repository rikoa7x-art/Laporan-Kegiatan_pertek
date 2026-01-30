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
     */
    set(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
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

    /**
     * Initialize with sample data if empty
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

// Initialize sample data on load
document.addEventListener('DOMContentLoaded', () => {
    Storage.initSampleData();
});
