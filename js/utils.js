/**
 * Utility Functions Module
 */

const Utils = {
    /**
     * Format date to Indonesian locale
     * @param {string|Date} date - Date to format
     * @param {Object} options - Intl.DateTimeFormat options
     * @returns {string} - Formatted date string
     */
    formatDate(date, options = {}) {
        const defaultOptions = {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        };
        return new Date(date).toLocaleDateString('id-ID', { ...defaultOptions, ...options });
    },

    /**
     * Format date to short format (DD/MM/YYYY)
     * @param {string|Date} date - Date to format
     * @returns {string} - Formatted date string
     */
    formatDateShort(date) {
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    },

    /**
     * Format date to input value format (YYYY-MM-DD)
     * @param {string|Date} date - Date to format
     * @returns {string} - Formatted date string
     */
    formatDateInput(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    /**
     * Get month name in Indonesian
     * @param {number} month - Month number (0-11)
     * @returns {string} - Month name
     */
    getMonthName(month) {
        const months = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];
        return months[month];
    },

    /**
     * Get week number of the month
     * @param {Date} date - Date object
     * @returns {number} - Week number (1-5)
     */
    getWeekOfMonth(date) {
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
        return Math.ceil((date.getDate() + firstDay.getDay()) / 7);
    },

    /**
     * Get start and end dates of a week
     * @param {number} year - Year
     * @param {number} month - Month (0-11)
     * @param {number} weekNumber - Week number (1-5)
     * @returns {Object} - {start: Date, end: Date}
     */
    getWeekDates(year, month, weekNumber) {
        const firstDay = new Date(year, month, 1);
        const firstDayOfWeek = firstDay.getDay();
        const startDate = new Date(year, month, (weekNumber - 1) * 7 - firstDayOfWeek + 1);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);

        // Clamp to month boundaries
        if (startDate.getMonth() !== month) {
            startDate.setDate(1);
            startDate.setMonth(month);
        }
        if (endDate.getMonth() !== month) {
            // Set to last day of the target month: day=0 of month+1 = last day of month
            endDate.setFullYear(parseInt(year));
            endDate.setMonth(month + 1);
            endDate.setDate(0);
        }

        return { start: startDate, end: endDate };
    },

    /**
     * Calculate percentage
     * @param {number} value - Current value
     * @param {number} total - Total value
     * @returns {number} - Percentage (0-100)
     */
    calculatePercentage(value, total) {
        if (total === 0) return 0;
        return Math.round((value / total) * 100);
    },

    /**
     * Get progress bar color class based on percentage
     * @param {number} percentage - Progress percentage
     * @returns {string} - Color class
     */
    getProgressColor(percentage) {
        if (percentage >= 90) return 'high';
        if (percentage >= 70) return 'medium';
        return 'low';
    },

    /**
     * Get role display name with icon
     * @param {string} role - Role key
     * @returns {string} - Display name with icon
     */
    getRoleDisplay(role) {
        const roles = {
            manager: '👔 Manager Divisi',
            asman_sipil: '🏗️ Asman Bangunan Sipil',
            asman_perpipaan: '🔧 Asman Perpipaan',
            surveyor: '🔍 Surveyor',
            estimator: '📊 Estimator',
            drafter: '✏️ Drafter',
            wasdal: '👁️ Wasdal',
            supervisor: '👔 Supervisor',
            staf: '👷 Staf'
        };
        return roles[role] || role;
    },

    /**
     * Get category display name with icon
     * @param {string} category - Category key
     * @returns {string} - Display name with icon
     */
    getCategoryDisplay(category) {
        const categories = {
            sipil: '🏗️ Bangunan Sipil',
            perpipaan: '🔧 Perpipaan',
            pengawasan: '👁️ Pengawasan'
        };
        return categories[category] || category;
    },

    /**
     * Get status display name
     * @param {string} status - Status key
     * @returns {string} - Display name
     */
    getStatusDisplay(status) {
        const statuses = {
            draft: 'Draft',
            aktif: 'Aktif',
            selesai: 'Selesai',
            pending: 'Pending',
            // Workflow statuses
            survey: '📍 Survey',
            drafting: '✏️ Gambar',
            estimasi: '📊 RAB',
            review_asman: '📋 Review Asman',
            approval: '✅ Approval',
            revisi: '🔄 Revisi',
            wasdal: '👁️ Pengawasan'
        };
        return statuses[status] || status;
    },

    /**
     * Get workflow status color class
     * @param {string} status - Status key
     * @returns {string} - Color class
     */
    getWorkflowStatusColor(status) {
        const colors = {
            survey: 'status-info',
            drafting: 'status-warning',
            estimasi: 'status-primary',
            review_asman: 'status-secondary',
            approval: 'status-success',
            revisi: 'status-danger',
            wasdal: 'status-info',
            selesai: 'status-success'
        };
        return colors[status] || 'status-default';
    },

    /**
     * Get next workflow status
     * @param {string} currentStatus - Current status
     * @returns {string|null} - Next status or null if final
     */
    getNextWorkflowStatus(currentStatus) {
        const flow = {
            survey: 'drafting',
            drafting: 'estimasi',
            estimasi: 'review_asman',
            review_asman: 'approval',
            approval: 'wasdal',
            wasdal: 'selesai',
            revisi: 'review_asman'
        };
        return flow[currentStatus] || null;
    },

    /**
     * Get required role for workflow status
     * @param {string} status - Workflow status
     * @returns {string} - Required role
     */
    getRequiredRoleForStatus(status) {
        const roles = {
            survey: 'surveyor',
            drafting: 'drafter',
            estimasi: 'estimator',
            review_asman: 'asman_sipil',
            approval: 'manager',
            wasdal: 'wasdal'
        };
        return roles[status] || null;
    },

    /**
     * Debounce function
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} - Debounced function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Generate unique filename
     * @param {string} prefix - Filename prefix
     * @param {string} extension - File extension
     * @returns {string} - Unique filename
     */
    generateFilename(prefix, extension) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        return `${prefix}_${timestamp}.${extension}`;
    },

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} - Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Truncate text with ellipsis
     * @param {string} text - Text to truncate
     * @param {number} maxLength - Maximum length
     * @returns {string} - Truncated text
     */
    truncate(text, maxLength = 50) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    },

    /**
     * Calculate difference in days between two dates
     * @param {string|Date} startDate - Start date
     * @param {string|Date} endDate - End date (defaults to now)
     * @returns {number} - Number of days
     */
    getDaysDifference(startDate, endDate = new Date()) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end - start);
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }
};

// Export for module usage (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}
