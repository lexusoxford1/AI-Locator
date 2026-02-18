// ===========================================
// AI SUGGESTIONS - COMPLETE WORKING VERSION
// ===========================================

console.log("🚀 AI Suggestions loading...");

class AISuggestions {
    constructor() {
        this.input = document.getElementById('address-input');
        this.container = document.getElementById('suggestions-container');
        this.searchHistory = this.loadHistory();
        this.currentSuggestions = [];
        this.selectedIndex = -1;
        this.debounceTimer = null;
        
        this.init();
    }

    init() {
        if (!this.input || !this.container) {
            console.error("❌ Elements not found!");
            return;
        }

        console.log("✅ AI Suggestions ready!");

        // Event listeners
        this.input.addEventListener('input', () => this.handleInput());
        this.input.addEventListener('keydown', (e) => this.handleKeydown(e));
        this.input.addEventListener('focus', () => this.showPopular());
        document.addEventListener('click', (e) => this.handleClickOutside(e));
    }

    loadHistory() {
        try {
            return JSON.parse(localStorage.getItem('ai_search_history') || '[]');
        } catch {
            return [];
        }
    }

    saveToHistory(address) {
        try {
            let history = [address, ...this.searchHistory.filter(a => a !== address)].slice(0, 5);
            localStorage.setItem('ai_search_history', JSON.stringify(history));
            this.searchHistory = history;
        } catch(e) {}
    }

    handleInput() {
        clearTimeout(this.debounceTimer);
        const query = this.input.value.trim();
        
        if (query.length === 0) {
            this.showPopular();
            return;
        }

        this.showLoading();
        
        this.debounceTimer = setTimeout(() => {
            this.fetchSuggestions(query);
        }, 300);
    }

    async fetchSuggestions(query) {
        try {
            const response = await fetch(`/api/ai-suggestions/?q=${encodeURIComponent(query)}`);
            const data = await response.json();
            
            if (data.suggestions && data.suggestions.length > 0) {
                this.displaySuggestions(data.suggestions, query);
            } else {
                this.showNoResults(query);
            }
        } catch (error) {
            console.error('Error fetching suggestions:', error);
            this.showError();
        }
    }

    displaySuggestions(suggestions, query) {
        this.currentSuggestions = suggestions;
        let html = `
            <div class="ai-header">
                <i class="fas fa-robot"></i>
                <span>AI Suggestions</span>
                <span class="ai-badge">${suggestions.length} found</span>
            </div>
        `;

        suggestions.forEach((sugg, index) => {
            const highlighted = sugg.text.replace(
                new RegExp(`(${query})`, 'gi'),
                '<span class="highlight">$1</span>'
            );

            const scoreColor = sugg.ai_score >= 80 ? '#4caf50' : 
                              sugg.ai_score >= 60 ? '#2196f3' : '#ff9800';

            html += `
                <div class="suggestion-item ${index === this.selectedIndex ? 'selected' : ''}" 
                     data-index="${index}"
                     onclick="window.aiSuggestions.select(${index})">
                    <span class="suggestion-icon">${this.getIcon(sugg.address_type)}</span>
                    <div class="suggestion-content">
                        <div class="suggestion-main">
                            ${highlighted}
                            ${sugg.is_popular ? '<span class="popular-badge">Popular</span>' : ''}
                        </div>
                        <div class="suggestion-secondary">
                            <i class="fas fa-map-marker-alt"></i> ${sugg.secondary_text || ''}
                        </div>
                        <div class="ai-confidence">
                            <div class="confidence-bar">
                                <div class="confidence-bar-fill" style="width: ${sugg.ai_score}%; background: ${scoreColor};"></div>
                            </div>
                            <span class="confidence-text">${sugg.ai_confidence}</span>
                        </div>
                    </div>
                </div>
            `;
        });

        this.container.innerHTML = html;
        this.container.style.display = 'block';
    }

    showPopular() {
        const popular = [
            "SM Mall of Asia, Pasay City",
            "Bonifacio Global City, Taguig",
            "Ayala Center, Makati City",
            "Eastwood City, Quezon City",
            "Ortigas Center, Pasig City"
        ];

        let html = `
            <div class="ai-header">
                <i class="fas fa-fire" style="color: #ff6b6b;"></i>
                <span>Popular Destinations</span>
                <span class="ai-badge">Trending</span>
            </div>
        `;

        popular.forEach(place => {
            html += `
                <div class="suggestion-item" onclick="window.aiSuggestions.selectText('${place}')">
                    <span class="suggestion-icon">🔥</span>
                    <div class="suggestion-content">
                        <div class="suggestion-main">${place}</div>
                        <div class="suggestion-secondary">Trending now</div>
                    </div>
                </div>
            `;
        });

        if (this.searchHistory.length > 0) {
            html += `<div style="border-top: 1px solid #eee; margin-top: 5px;"></div>`;
            this.searchHistory.slice(0, 3).forEach(addr => {
                html += `
                    <div class="suggestion-item" onclick="window.aiSuggestions.selectText('${addr.replace(/'/g, "\\'")}')">
                        <span class="suggestion-icon">🕒</span>
                        <div class="suggestion-content">
                            <div class="suggestion-main">${addr}</div>
                            <div class="suggestion-secondary">Recent search</div>
                        </div>
                    </div>
                `;
            });
        }

        this.container.innerHTML = html;
        this.container.style.display = 'block';
    }

    showLoading() {
        this.container.innerHTML = `
            <div class="ai-typing">
                <div class="ai-typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
                <span class="ai-typing-text">AI is thinking...</span>
            </div>
        `;
        this.container.style.display = 'block';
    }

    showNoResults(query) {
        this.container.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search"></i>
                <p>No matches found for "${query}"</p>
                <small>Try different keywords</small>
            </div>
        `;
        this.container.style.display = 'block';
    }

    showError() {
        this.container.innerHTML = `
            <div class="no-results">
                <i class="fas fa-exclamation-circle"></i>
                <p>Unable to fetch suggestions</p>
                <small>Please try again</small>
            </div>
        `;
        this.container.style.display = 'block';
    }

    getIcon(type) {
        const icons = {
            building: '🏢',
            commercial: '🛍️',
            street: '🛣️',
            barangay: '🏘️',
            city: '🌆',
            general: '📍'
        };
        return icons[type] || '📍';
    }

    select(index) {
        const suggestion = this.currentSuggestions[index];
        if (suggestion) {
            this.selectText(suggestion.text);
        }
    }

    selectText(text) {
        this.input.value = text;
        this.container.style.display = 'none';
        this.saveToHistory(text);
        this.selectedIndex = -1;
    }

    handleKeydown(e) {
        const items = document.querySelectorAll('.suggestion-item');
        if (items.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.selectedIndex = (this.selectedIndex + 1) % items.length;
            this.updateSelection(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.selectedIndex = this.selectedIndex <= 0 ? items.length - 1 : this.selectedIndex - 1;
            this.updateSelection(items);
        } else if (e.key === 'Enter' && this.selectedIndex >= 0) {
            e.preventDefault();
            this.select(this.selectedIndex);
        } else if (e.key === 'Escape') {
            this.container.style.display = 'none';
            this.selectedIndex = -1;
        }
    }

    updateSelection(items) {
        items.forEach((item, i) => {
            if (i === this.selectedIndex) {
                item.classList.add('selected');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('selected');
            }
        });
    }

    handleClickOutside(e) {
        if (!this.input.contains(e.target) && !this.container.contains(e.target)) {
            this.container.style.display = 'none';
            this.selectedIndex = -1;
        }
    }
}

// Google Maps Autocomplete
function initAutocomplete() {
    console.log("🗺️ Google Maps loaded");
    
    const input = document.getElementById('address-input');
    const submitBtn = document.getElementById('submit-btn');
    
    if (!input) return;
    
    const autocomplete = new google.maps.places.Autocomplete(input, {
        types: ['address'],
        componentRestrictions: { country: 'ph' }
    });

    autocomplete.setFields(['address_components', 'geometry', 'formatted_address']);

    autocomplete.addListener('place_changed', function() {
        const place = autocomplete.getPlace();
        if (!place.geometry) return;

        submitBtn.innerHTML = '<span class="loading"></span> Processing...';
        submitBtn.disabled = true;

        document.getElementById('latitude').value = place.geometry.location.lat();
        document.getElementById('longitude').value = place.geometry.location.lng();

        const components = {};
        place.address_components.forEach(c => components[c.types[0]] = c.long_name);

        const streetNumber = components.street_number || '';
        const route = components.route || '';
        document.getElementById('street').value = (streetNumber + ' ' + route).trim();
        document.getElementById('city').value = components.locality || components.administrative_area_level_2 || '';
        document.getElementById('province').value = components.administrative_area_level_1 || '';
        document.getElementById('country').value = components.country || '';
        document.getElementById('zip_code').value = components.postal_code || '';

        if (window.aiSuggestions) {
            window.aiSuggestions.saveToHistory(place.formatted_address);
        }

        submitBtn.innerHTML = '<span class="btn-text">Locate Address</span>';
        submitBtn.disabled = false;
        
        document.getElementById('suggestions-container').style.display = 'none';
    });
}

// Initialize everything
document.addEventListener('DOMContentLoaded', function() {
    window.aiSuggestions = new AISuggestions();
    
    const form = document.getElementById('location-form');
    form.addEventListener('submit', function(e) {
        const address = document.getElementById('address-input').value;
        const lat = document.getElementById('latitude').value;
        
        if (!address) {
            e.preventDefault();
            alert('Please enter an address');
            return;
        }
        
        if (!lat) {
            e.preventDefault();
            alert('Please select a valid address from the suggestions');
            return;
        }
    });
});