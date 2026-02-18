/* ============================================
   AI LOCATOR PRO - PROFESSIONAL JAVASCRIPT
   ============================================ */

'use strict';

console.log('🚀 AI Locator Pro initialized');

// DOM Elements
const form = document.getElementById('location-form');
const input = document.getElementById('address-input');
const submitBtn = document.getElementById('submit-btn');
const suggestionsContainer = document.getElementById('suggestions-container');

// State
let currentSuggestions = [];
let selectedIndex = -1;
let searchTimeout = null;

/* ========== GOOGLE MAPS AUTOCOMPLETE ========== */
function initGoogleAutocomplete() {
    if (!window.google || !input) return;

    const autocomplete = new google.maps.places.Autocomplete(input, {
        types: ['address'],
        componentRestrictions: { country: 'ph' }
    });

    autocomplete.setFields(['address_components', 'geometry', 'formatted_address']);

    autocomplete.addListener('place_changed', function() {
        const place = autocomplete.getPlace();
        if (!place.geometry) return;

        // Show loading state
        setLoadingState(true, 'Processing...');

        // Set coordinates
        document.getElementById('latitude').value = place.geometry.location.lat();
        document.getElementById('longitude').value = place.geometry.location.lng();

        // Parse address components
        const components = {};
        place.address_components.forEach(c => {
            components[c.types[0]] = c.long_name;
        });

        // Build street address
        const streetNumber = components.street_number || '';
        const route = components.route || '';
        document.getElementById('street').value = [streetNumber, route].filter(Boolean).join(' ').trim();
        
        // Set other fields
        document.getElementById('city').value = components.locality || components.administrative_area_level_2 || '';
        document.getElementById('province').value = components.administrative_area_level_1 || '';
        document.getElementById('country').value = components.country || '';
        document.getElementById('zip_code').value = components.postal_code || '';

        // Save to history if suggestions exist
        if (window.suggestions) {
            window.suggestions.saveToHistory(place.formatted_address);
        }

        // Submit form after brief delay
        setTimeout(() => {
            setLoadingState(false);
            form.submit();
        }, 500);
    });
}

/* ========== AI SUGGESTIONS CLASS ========== */
class AddressSuggestions {
    constructor() {
        this.initEventListeners();
    }

    initEventListeners() {
        if (!input || !suggestionsContainer) return;

        input.addEventListener('input', () => this.handleInput());
        input.addEventListener('keydown', (e) => this.handleKeydown(e));
        input.addEventListener('focus', () => this.showPopular());

        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !suggestionsContainer.contains(e.target)) {
                suggestionsContainer.style.display = 'none';
                selectedIndex = -1;
            }
        });
    }

    handleInput() {
        clearTimeout(searchTimeout);
        const query = input.value.trim();

        if (query.length < 2) {
            this.showPopular();
            return;
        }

        this.showLoading();
        
        searchTimeout = setTimeout(() => {
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
            console.error('Suggestion error:', error);
            suggestionsContainer.style.display = 'none';
        }
    }

    displaySuggestions(suggestions, query) {
        currentSuggestions = suggestions;
        
        let html = '';
        suggestions.forEach((sugg, index) => {
            const text = sugg.text;
            const regex = new RegExp(`(${query})`, 'gi');
            const highlighted = text.replace(regex, '<strong style="color: #2563EB;">$1</strong>');

            html += `
                <div class="suggestion-item ${index === selectedIndex ? 'selected' : ''}" 
                     onclick="window.selectSuggestion(${index})">
                    <div class="suggestion-main">
                        ${highlighted}
                        ${sugg.is_popular ? '<span class="popular-badge">Popular</span>' : ''}
                    </div>
                    ${sugg.secondary_text ? `<div class="suggestion-secondary">${sugg.secondary_text}</div>` : ''}
                </div>
            `;
        });

        suggestionsContainer.innerHTML = html;
        suggestionsContainer.style.display = 'block';
    }

    showPopular() {
        const popular = [
            { text: 'SM Mall of Asia, Pasay City' },
            { text: 'Bonifacio Global City, Taguig' },
            { text: 'Ayala Center, Makati City' },
            { text: 'Eastwood City, Quezon City' },
            { text: 'Ortigas Center, Pasig City' }
        ];

        let html = '';
        popular.forEach(place => {
            html += `
                <div class="suggestion-item" onclick="window.selectSuggestionText('${place.text.replace(/'/g, "\\'")}')">
                    <div class="suggestion-main">
                        <i class="fas fa-fire" style="color: #F59E0B;"></i> ${place.text}
                        <span class="popular-badge">Trending</span>
                    </div>
                    <div class="suggestion-secondary">Popular destination</div>
                </div>
            `;
        });

        suggestionsContainer.innerHTML = html;
        suggestionsContainer.style.display = 'block';
    }

    showLoading() {
        suggestionsContainer.innerHTML = `
            <div class="suggestion-loading">
                <i class="fas fa-spinner fa-spin"></i> Searching addresses...
            </div>
        `;
        suggestionsContainer.style.display = 'block';
    }

    showNoResults(query) {
        suggestionsContainer.innerHTML = `
            <div class="suggestion-loading">
                No results found for "${query}"
            </div>
        `;
        suggestionsContainer.style.display = 'block';
    }

    handleKeydown(e) {
        const items = document.querySelectorAll('.suggestion-item');
        if (!items.length) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = (selectedIndex + 1) % items.length;
            this.updateSelection(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = selectedIndex <= 0 ? items.length - 1 : selectedIndex - 1;
            this.updateSelection(items);
        } else if (e.key === 'Enter' && selectedIndex >= 0) {
            e.preventDefault();
            this.selectSuggestion(selectedIndex);
        } else if (e.key === 'Escape') {
            suggestionsContainer.style.display = 'none';
            selectedIndex = -1;
        }
    }

    updateSelection(items) {
        items.forEach((item, i) => {
            if (i === selectedIndex) {
                item.classList.add('selected');
                item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            } else {
                item.classList.remove('selected');
            }
        });
    }

    selectSuggestion(index) {
        const suggestion = currentSuggestions[index];
        if (suggestion) {
            this.selectSuggestionText(suggestion.text);
        }
    }

    selectSuggestionText(text) {
        input.value = text;
        suggestionsContainer.style.display = 'none';
        selectedIndex = -1;
    }

    saveToHistory(address) {
        // Implementation for saving to localStorage if needed
        try {
            let history = JSON.parse(localStorage.getItem('ai_search_history') || '[]');
            history = [address, ...history.filter(a => a !== address)].slice(0, 5);
            localStorage.setItem('ai_search_history', JSON.stringify(history));
        } catch (e) {
            console.warn('Could not save to history:', e);
        }
    }
}

/* ========== UTILITY FUNCTIONS ========== */
function setLoadingState(isLoading, text = 'Validating...') {
    if (isLoading) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="btn-spinner"></span>${text}`;
    } else {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="btn-text">Validate Address</span>';
    }
}

/* ========== GLOBAL FUNCTIONS ========== */
window.selectSuggestion = (index) => {
    if (window.suggestions) {
        window.suggestions.selectSuggestion(index);
    }
};

window.selectSuggestionText = (text) => {
    if (window.suggestions) {
        window.suggestions.selectSuggestionText(text);
    }
};

/* ========== ACCURATE GEOCODE ON VALIDATE BUTTON ========== */
if (form) {
    form.addEventListener('submit', function(e) {
        e.preventDefault(); // prevent default submission first

        const inputEl = document.getElementById('address-input');
        const submitBtnEl = document.getElementById('submit-btn');
        const address = inputEl.value.trim();

        if (!address) {
            alert('Please enter an address');
            return;
        }

        setLoadingState(true, 'Validating address...');

        // Use Google Maps Geocoding
        if (typeof google !== 'undefined') {
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ address: address, componentRestrictions: { country: 'PH' } }, (results, status) => {
                if (status === 'OK' && results[0]) {
                    const place = results[0];
                    
                    document.getElementById('latitude').value = place.geometry.location.lat();
                    document.getElementById('longitude').value = place.geometry.location.lng();

                    const components = {};
                    place.address_components.forEach(c => {
                        components[c.types[0]] = c.long_name;
                    });

                    document.getElementById('street').value = [components.street_number || '', components.route || ''].filter(Boolean).join(' ').trim();
                    document.getElementById('city').value = components.locality || components.administrative_area_level_2 || '';
                    document.getElementById('province').value = components.administrative_area_level_1 || '';
                    document.getElementById('country').value = components.country || '';
                    document.getElementById('zip_code').value = components.postal_code || '';

                    setLoadingState(false);
                    form.submit(); // now submit the form with accurate data
                } else {
                    console.warn('Geocode failed:', status);
                    setLoadingState(false);
                    alert('Could not validate the address. Please refine your input.');
                }
            });
        } else {
            setLoadingState(false);
            alert('Google Maps API is not loaded.');
        }
    });
}


/* ========== INITIALIZATION ========== */
document.addEventListener('DOMContentLoaded', function() {
    // Initialize AI Suggestions
    window.suggestions = new AddressSuggestions();

    // Initialize Google Maps
    if (typeof google !== 'undefined') {
        initGoogleAutocomplete();
    } else {
        window.addEventListener('load', function() {
            if (typeof google !== 'undefined') {
                initGoogleAutocomplete();
            }
        });
    }

    // Add fade-in animation to results if they exist
    const results = document.querySelector('.results-grid');
    if (results) {
        results.classList.add('fade-in');
    }
});