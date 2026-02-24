/* ============================================
   AI LOCATOR PRO - GOOGLE ADDRESS AUTOCOMPLETE + AI
   Full JS: Google auto-correct + Free AI untouched
   ============================================ */

'use strict';

// DOM Elements
const form = document.getElementById('location-form');
const input = document.getElementById('address-input');
const submitBtn = document.getElementById('submit-btn');
const suggestionsContainer = document.getElementById('suggestions-container');
const modeGoogle = document.getElementById('mode-google');
const modeAI = document.getElementById('mode-ai');
const activeModeBadge = document.getElementById('active-mode-badge');
const aiConfidenceBadge = document.getElementById('ai-confidence-badge');
const confidenceFill = document.getElementById('confidence-fill');
const confidenceText = document.getElementById('confidence-text');
const parsingMethod = document.getElementById('parsing_method');

let currentMode = 'ai';
let currentSuggestions = [];
let selectedIndex = -1;
let searchTimeout = null;
let autocomplete = null;

// ===================== FREE AI ADDRESS COMPLETION =====================
class FreeAIAddressCompleter {
    constructor() { 
        this.cache = new Map(); 
        this.requestCount = 0; 
    }

    async getSuggestions(query) {
        if (this.cache.has(query)) return this.cache.get(query);

        try {
            const csrftoken = this.getCookie('csrftoken');
            const response = await fetch('/api/ai-suggestions/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
                body: JSON.stringify({ address: query })
            });

            if (!response.ok) throw new Error(`API request failed: ${response.status}`);

            const data = await response.json();
            if (data.suggestions) this.cache.set(query, data.suggestions);

            return data.suggestions || [];
        } catch (error) { console.error('AI Suggestions error:', error); return []; }
    }

    async completeAddress(query) {
        try {
            const csrftoken = this.getCookie('csrftoken');
            const response = await fetch('/api/ai-complete/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
                body: JSON.stringify({ address: query })
            });
            if (!response.ok) return null;
            const result = await response.json();
            this.updateConfidenceBadge(result.confidence || 0);
            return result;
        } catch (error) { console.error('AI Complete error:', error); return null; }
    }

    updateConfidenceBadge(confidence) {
        if (!aiConfidenceBadge) return;
        aiConfidenceBadge.style.display = 'flex';
        confidenceFill.style.width = `${confidence}%`;
        confidenceText.textContent = `Match: ${Math.round(confidence)}%`;

        if (confidence > 80) { 
            confidenceFill.style.background = 'linear-gradient(90deg, #10B981, #34D399)'; 
            confidenceText.style.color = '#10B981'; 
        }
        else if (confidence > 50) { 
            confidenceFill.style.background = 'linear-gradient(90deg, #F59E0B, #FBBF24)'; 
            confidenceText.style.color = '#F59E0B'; 
        }
        else { 
            confidenceFill.style.background = 'linear-gradient(90deg, #EF4444, #F87171)'; 
            confidenceText.style.color = '#EF4444'; 
        }
    }

    getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let cookie of cookies) {
                cookie = cookie.trim();
                if (cookie.startsWith(name + '=')) { 
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1)); 
                    break; 
                }
            }
        }
        return cookieValue;
    }
}

// ===================== ADDRESS SUGGESTIONS =====================
class AddressSuggestions {
    constructor() { 
        this.aiCompleter = new FreeAIAddressCompleter(); 
        this.initEventListeners(); 
    }

    initEventListeners() {
        if (!input || !suggestionsContainer) return;

        input.addEventListener('input', () => this.handleInput());
        input.addEventListener('keydown', (e) => this.handleKeydown(e));
        input.addEventListener('focus', () => { 
            if (currentMode === 'ai' && input.value.length < 3) this.showExamples(); 
        });

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

        if (currentMode === 'ai') {
            if (query.length < 3) { this.showExamples(); return; }
            this.showLoading();
            searchTimeout = setTimeout(() => this.fetchSuggestions(query), 500);
        } else {
            suggestionsContainer.style.display = 'none';
        }
    }

    async fetchSuggestions(query) {
        try {
            const suggestions = await this.aiCompleter.getSuggestions(query);
            if (suggestions && suggestions.length > 0) this.displaySuggestions(suggestions, query);
            else this.showNoResults(query);
        } catch { 
            this.showError(); 
        }
    }

    displaySuggestions(suggestions, query) {
        currentSuggestions = suggestions;
        let html = `<div class="suggestions-header"><i class="fas fa-map-marker-alt" style="color: #2563EB;"></i> Address Suggestions</div>`;

        suggestions.forEach((sugg, index) => {
            const isSelected = index === selectedIndex ? 'selected' : '';
            const confidenceClass = sugg.confidence > 80 ? 'high' : sugg.confidence > 50 ? 'medium' : 'low';
            const regex = new RegExp(`(${query})`, 'gi');
            const highlighted = sugg.text.replace(regex, '<strong style="color: #2563EB;">$1</strong>');

            html += `
                <div class="suggestion-item ${isSelected}" onclick="window.selectSuggestion(${index})">
                    <div class="suggestion-main"><i class="fas fa-map-pin" style="color: #64748B; margin-right: 8px;"></i>${highlighted}</div>
                    <div class="suggestion-secondary">${sugg.city ? sugg.city : ''}${sugg.province ? ', ' + sugg.province : ''}</div>
                    <div class="suggestion-confidence ${confidenceClass}"><span class="confidence-dot"></span>${Math.round(sugg.confidence)}% match</div>
                </div>
            `;
        });

        html += `<div class="suggestion-footer"><i class="fas fa-leaf"></i> Powered by Geoapify (Free)</div>`;
        suggestionsContainer.innerHTML = html; 
        suggestionsContainer.style.display = 'block';
    }

    showExamples() {
        const examples = [
            { text: '🏠 bahay ni rizal', desc: 'Rizal Shrine, Calamba' },
            { text: '🏢 sm moa', desc: 'SM Mall of Asia, Pasay' },
            { text: '📍 bgc', desc: 'Bonifacio Global City, Taguig' },
            { text: '🏛️ intramuros', desc: 'Intramuros, Manila' }
        ];

        let html = '<div class="suggestions-header">Try these examples:</div>';
        examples.forEach(ex => {
            html += `<div class="suggestion-item example" onclick="window.setInputValue('${ex.text.replace(/[🏠🏢📍🏛️]/g,'').trim()}')">
                        <div class="suggestion-main">${ex.text}</div>
                        <div class="suggestion-secondary">${ex.desc}</div>
                    </div>`;
        });

        suggestionsContainer.innerHTML = html; 
        suggestionsContainer.style.display = 'block';
    }

    showLoading() { 
        suggestionsContainer.innerHTML = `<div class="suggestion-loading"><i class="fas fa-spinner fa-spin"></i> Searching addresses...</div>`; 
        suggestionsContainer.style.display = 'block'; 
    }
    
    showNoResults(query) { 
        suggestionsContainer.innerHTML = `<div class="suggestion-loading"><i class="fas fa-search"></i> No results found for "${query}"</div>`; 
        suggestionsContainer.style.display = 'block'; 
    }
    
    showError() { 
        suggestionsContainer.innerHTML = `<div class="suggestion-loading error"><i class="fas fa-exclamation-triangle"></i> Service temporarily unavailable</div>`; 
        suggestionsContainer.style.display = 'block'; 
    }

    async selectSuggestion(index) {
        const suggestion = currentSuggestions[index]; 
        if (!suggestion) return;
        
        input.value = suggestion.text;
        if (suggestion.lat && suggestion.lng) { 
            document.getElementById('latitude').value = suggestion.lat; 
            document.getElementById('longitude').value = suggestion.lng; 
        }
        if (suggestion.street) document.getElementById('street').value = suggestion.street;
        if (suggestion.city) document.getElementById('city').value = suggestion.city;
        if (suggestion.province) document.getElementById('province').value = suggestion.province;
        document.getElementById('country').value = 'Philippines';
        if (suggestion.zip) document.getElementById('zip_code').value = suggestion.zip;
        document.getElementById('parsing_method').value = 'ai';
        suggestionsContainer.style.display = 'none'; 
        selectedIndex = -1;
    }

    handleKeydown(e) {
        const items = document.querySelectorAll('.suggestion-item:not(.example)'); 
        if (!items.length) return;
        
        if (e.key === 'ArrowDown') { 
            e.preventDefault(); 
            selectedIndex = (selectedIndex + 1) % items.length; 
            this.updateSelection(items); 
        }
        else if (e.key === 'ArrowUp') { 
            e.preventDefault(); 
            selectedIndex = selectedIndex <= 0 ? items.length - 1 : selectedIndex - 1; 
            this.updateSelection(items); 
        }
        else if (e.key === 'Enter' && selectedIndex >= 0) { 
            e.preventDefault(); 
            this.selectSuggestion(selectedIndex); 
        }
        else if (e.key === 'Escape') { 
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
}

// ===================== GOOGLE MAPS AUTOCOMPLETE =====================
let googleMapsLoaded = false;
let googleMapsLoading = false;

function initGoogleAutocomplete() {
    if (typeof google === 'undefined' || !google.maps || !google.maps.places) { 
        if (!googleMapsLoading) loadGoogleMapsAPI(); 
        setTimeout(initGoogleAutocomplete, 500); 
        return; 
    }
    
    if (!input) { console.error('Input not found'); return; }
    
    googleMapsLoaded = true;
    if (autocomplete) google.maps.event.clearInstanceListeners(autocomplete);

    autocomplete = new google.maps.places.Autocomplete(input, { 
        types: ['address'], 
        componentRestrictions: { country: 'ph' } 
    });
    
    autocomplete.setFields(['address_components', 'geometry', 'formatted_address', 'place_id']);
    autocomplete.addListener('place_changed', () => { 
        const place = autocomplete.getPlace(); 
        if (!place || !place.geometry) return; 
        fillGoogleFields(place); 
    });
}

function loadGoogleMapsAPI() {
    if (googleMapsLoading) return;
    googleMapsLoading = true;

    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) return;

    const apiKey = '{{ GOOGLE_GEOCODING_API_KEY }}';
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=Function.prototype`;
    script.async = true; 
    script.defer = true;
    script.onload = () => { 
        googleMapsLoading = false; 
        initGoogleAutocomplete(); 
    };
    script.onerror = () => { 
        console.error('Failed to load Google Maps'); 
        googleMapsLoading = false; 
    };
    document.head.appendChild(script);
}

function fillGoogleFields(place) {
    const components = {}; 
    place.address_components.forEach(c => { 
        if(c.types[0]) components[c.types[0]] = c.long_name; 
    });
    
    document.getElementById('latitude').value = place.geometry.location.lat();
    document.getElementById('longitude').value = place.geometry.location.lng();
    document.getElementById('street').value = [components.street_number, components.route].filter(Boolean).join(' ');
    document.getElementById('city').value = components.locality || components.administrative_area_level_2 || '';
    document.getElementById('province').value = components.administrative_area_level_1 || '';
    document.getElementById('country').value = components.country || '';
    document.getElementById('zip_code').value = components.postal_code || '';
    document.getElementById('parsing_method').value = 'google';
    if (place.formatted_address) input.value = place.formatted_address;
}

// ===================== MODE TOGGLE =====================
function initModeToggle() {
    if (!modeGoogle || !modeAI) return;
    modeGoogle.addEventListener('click', () => setMode('google'));
    modeAI.addEventListener('click', () => setMode('ai'));
}

function setMode(mode) {
    currentMode = mode;
    modeGoogle.classList.toggle('active', mode === 'google');
    modeAI.classList.toggle('active', mode === 'ai');
    
    // Update badge
    activeModeBadge.className = `mode-badge ${mode}`;
    activeModeBadge.innerHTML = mode === 'google' ? 
        '<i class="fas fa-map-marked-alt"></i> Google Maps Mode Active' : 
        '<i class="fas fa-robot"></i> AI Mode Active';
    
    // Show/hide confidence badge
    aiConfidenceBadge.style.display = mode === 'ai' ? 'flex' : 'none';
    
    // Update placeholder
    input.placeholder = mode === 'google' ? 
        'Enter address (e.g., 123 Rizal Ave, Manila)' : 
        'Type any place - AI completes it (e.g., "bahay ni rizal")';
    
    // Clear input and hide suggestions
    input.value = ''; 
    suggestionsContainer.style.display = 'none'; 
    parsingMethod.value = mode;
    
    // Reinitialize Google autocomplete if needed
    if (mode === 'google' && typeof google !== 'undefined' && google.maps && google.maps.places) {
        setTimeout(initGoogleAutocomplete, 100);
    }
}

// ===================== FORM SUBMISSION =====================
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const address = input.value.trim();
        if (!address) { alert('Please enter an address'); return; }

        setLoadingState(true, currentMode === 'ai' ? 'Finding address...' : 'Validating...');
        
        if (currentMode === 'ai') {
            try {
                const completer = new FreeAIAddressCompleter();
                const result = await completer.completeAddress(address);
                if (result) {
                    document.getElementById('street').value = result.street || '';
                    document.getElementById('city').value = result.city || '';
                    document.getElementById('province').value = result.province || '';
                    document.getElementById('country').value = 'Philippines';
                    document.getElementById('zip_code').value = result.zip_code || '';
                    document.getElementById('latitude').value = result.latitude || '';
                    document.getElementById('longitude').value = result.longitude || '';
                    document.getElementById('parsing_method').value = 'ai';
                    input.value = result.full_address;
                    setLoadingState(false); 
                    form.submit();
                } else { 
                    fallbackToGoogleGeocoding(address); 
                }
            } catch { 
                fallbackToGoogleGeocoding(address); 
            }
        } else { 
            fallbackToGoogleGeocoding(address); 
        }
    });
}

function fallbackToGoogleGeocoding(address) {
    if (typeof google === 'undefined') { 
        setLoadingState(false); 
        alert('Google Maps API is not loaded.'); 
        return; 
    }
    
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ 
        address: address + ', Philippines', 
        region: 'ph' 
    }, (results, status) => {
        if (status === 'OK' && results[0]) { 
            fillGoogleFields(results[0]); 
            setLoadingState(false); 
            form.submit(); 
        }
        else { 
            setLoadingState(false); 
            alert('Could not validate the address. Please refine your input.'); 
        }
    });
}

function setLoadingState(isLoading, text = 'Validating...') {
    if (isLoading) { 
        submitBtn.disabled = true; 
        submitBtn.innerHTML = `<span class="btn-spinner"></span>${text}`; 
    }
    else { 
        submitBtn.disabled = false; 
        submitBtn.innerHTML = '<span class="btn-text">Validate Address</span>'; 
    }
}

// ===================== GLOBAL FUNCTIONS =====================
window.selectSuggestion = (index) => { 
    if(window.suggestions) window.suggestions.selectSuggestion(index); 
};

window.setInputValue = (value) => { 
    input.value = value; 
    input.focus(); 
    input.dispatchEvent(new Event('input')); 
};

// ===================== INITIALIZATION =====================
document.addEventListener('DOMContentLoaded', function() {
    initModeToggle();
    window.suggestions = new AddressSuggestions();
    
    // Get initial mode from hidden field
    const storedMode = document.getElementById('current-mode-storage');
    if (storedMode && storedMode.value) {
        setMode(storedMode.value);
    } else {
        setMode('ai');
    }
    
    // Initialize Google Maps if available
    if (typeof google !== 'undefined') {
        initGoogleAutocomplete();
    }
});