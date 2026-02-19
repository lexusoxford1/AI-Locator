/* ============================================
   AI LOCATOR PRO - FREE ADDRESS COMPLETION
   Using Geoapify API (3,000 requests/day free)
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

// State
let currentMode = 'google';
let currentSuggestions = [];
let selectedIndex = -1;
let searchTimeout = null;
let autocomplete = null;

/* ========== FREE AI ADDRESS COMPLETION ========== */
class FreeAIAddressCompleter {
    constructor() {
        this.cache = new Map();
        this.requestCount = 0;
    }
    
    async getSuggestions(query) {
        console.log('🔍 FreeAIAddressCompleter.getSuggestions for:', query);
        
        // Check cache first
        if (this.cache.has(query)) {
            console.log('🔄 Using cached results for:', query);
            return this.cache.get(query);
        }
        
        try {
            const csrftoken = this.getCookie('csrftoken');
            console.log('CSRF Token found:', !!csrftoken);
            
            const response = await fetch('/api/ai-suggestions/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken
                },
                body: JSON.stringify({ address: query })
            });
            
            console.log('📡 Response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ API error response:', errorText);
                throw new Error(`API request failed: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('📦 API response data:', data);
            
            if (data.suggestions) {
                console.log(`✅ Found ${data.suggestions.length} suggestions`);
                this.cache.set(query, data.suggestions);
                this.requestCount++;
                console.log(`📊 API requests made: ${this.requestCount}/3000 daily limit`);
            } else {
                console.log('❌ No suggestions in response:', data);
            }
            
            return data.suggestions || [];
            
        } catch (error) {
            console.error('❌ Error fetching suggestions:', error);
            return [];
        }
    }
    
    async completeAddress(query) {
        try {
            const csrftoken = this.getCookie('csrftoken');
            
            const response = await fetch('/api/ai-complete/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken
                },
                body: JSON.stringify({ address: query })
            });
            
            if (!response.ok) {
                return null;
            }
            
            const result = await response.json();
            
            // Update confidence badge
            this.updateConfidenceBadge(result.confidence || 0);
            
            return result;
            
        } catch (error) {
            console.error('Error completing address:', error);
            return null;
        }
    }
    
    updateConfidenceBadge(confidence) {
        if (!aiConfidenceBadge) return;
        
        aiConfidenceBadge.style.display = 'flex';
        confidenceFill.style.width = `${confidence}%`;
        confidenceText.textContent = `Match: ${Math.round(confidence)}%`;
        
        if (confidence > 80) {
            confidenceFill.style.background = 'linear-gradient(90deg, #10B981, #34D399)';
            confidenceText.style.color = '#10B981';
        } else if (confidence > 50) {
            confidenceFill.style.background = 'linear-gradient(90deg, #F59E0B, #FBBF24)';
            confidenceText.style.color = '#F59E0B';
        } else {
            confidenceFill.style.background = 'linear-gradient(90deg, #EF4444, #F87171)';
            confidenceText.style.color = '#EF4444';
        }
    }
    
    getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
}

/* ========== ENHANCED SUGGESTIONS CLASS ========== */
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
            if (currentMode === 'ai' && input.value.length < 3) {
                this.showExamples();
            }
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
            if (query.length < 3) {
                this.showExamples();
                return;
            }
            
            this.showLoading();
            
            searchTimeout = setTimeout(() => {
                this.fetchSuggestions(query);
            }, 500);
        } else {
            suggestionsContainer.style.display = 'none';
        }
    }
    
   async fetchSuggestions(query) {
    console.log('🔍 Fetching suggestions for:', query);
    console.log('Current mode:', currentMode);
    
    try {
        const suggestions = await this.aiCompleter.getSuggestions(query);
        console.log('📦 Raw suggestions:', suggestions);
        
        if (suggestions && suggestions.length > 0) {
            console.log('✅ Found', suggestions.length, 'suggestions');
            this.displaySuggestions(suggestions, query);
        } else {
            console.log('❌ No suggestions found');
            this.showNoResults(query);
        }
    } catch (error) {
        console.error('❌ Error fetching suggestions:', error);
        this.showError();
    }
}
    
    displaySuggestions(suggestions, query) {
        currentSuggestions = suggestions;
        
        let html = `
            <div class="suggestions-header">
                <i class="fas fa-map-marker-alt" style="color: #2563EB;"></i>
                Address Suggestions
            </div>
        `;
        
        suggestions.forEach((sugg, index) => {
            const isSelected = index === selectedIndex ? 'selected' : '';
            const confidenceClass = sugg.confidence > 80 ? 'high' : 
                                   sugg.confidence > 50 ? 'medium' : 'low';
            
            // Highlight matching text
            const regex = new RegExp(`(${query})`, 'gi');
            const highlighted = sugg.text.replace(regex, '<strong style="color: #2563EB;">$1</strong>');
            
            html += `
                <div class="suggestion-item ${isSelected}" onclick="window.selectSuggestion(${index})">
                    <div class="suggestion-main">
                        <i class="fas fa-map-pin" style="color: #64748B; margin-right: 8px;"></i>
                        ${highlighted}
                    </div>
                    <div class="suggestion-secondary">
                        ${sugg.city ? sugg.city : ''} ${sugg.province ? ', ' + sugg.province : ''}
                    </div>
                    <div class="suggestion-confidence ${confidenceClass}">
                        <span class="confidence-dot"></span>
                        ${Math.round(sugg.confidence)}% match
                    </div>
                </div>
            `;
        });
        
        html += `
            <div class="suggestion-footer">
                <i class="fas fa-leaf"></i>
                Powered by Geoapify (Free)
            </div>
        `;
        
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
            html += `
                <div class="suggestion-item example" onclick="window.setInputValue('${ex.text.replace(/[🏠🏢📍🏛️]/g, '').trim()}')">
                    <div class="suggestion-main">
                        ${ex.text}
                    </div>
                    <div class="suggestion-secondary">${ex.desc}</div>
                </div>
            `;
        });
        
        suggestionsContainer.innerHTML = html;
        suggestionsContainer.style.display = 'block';
    }
    
    showLoading() {
        suggestionsContainer.innerHTML = `
            <div class="suggestion-loading">
                <i class="fas fa-spinner fa-spin"></i>
                Searching addresses...
            </div>
        `;
        suggestionsContainer.style.display = 'block';
    }
    
    showNoResults(query) {
        suggestionsContainer.innerHTML = `
            <div class="suggestion-loading">
                <i class="fas fa-search"></i>
                No results found for "${query}"
            </div>
        `;
        suggestionsContainer.style.display = 'block';
    }
    
    showError() {
        suggestionsContainer.innerHTML = `
            <div class="suggestion-loading error">
                <i class="fas fa-exclamation-triangle"></i>
                Service temporarily unavailable
            </div>
        `;
        suggestionsContainer.style.display = 'block';
    }
    
    async selectSuggestion(index) {
        const suggestion = currentSuggestions[index];
        if (!suggestion) return;
        
        // Set the input value
        input.value = suggestion.text;
        
        // If we have coordinates, populate the fields
        if (suggestion.lat && suggestion.lng) {
            document.getElementById('latitude').value = suggestion.lat;
            document.getElementById('longitude').value = suggestion.lng;
        }
        
        if (suggestion.street) {
            document.getElementById('street').value = suggestion.street;
        }
        
        if (suggestion.city) {
            document.getElementById('city').value = suggestion.city;
        }
        
        if (suggestion.province) {
            document.getElementById('province').value = suggestion.province;
        }
        
        document.getElementById('country').value = 'Philippines';
        
        if (suggestion.zip) {
            document.getElementById('zip_code').value = suggestion.zip;
        }
        
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
}


/* ========== GOOGLE MAPS AUTOCOMPLETE WITH LOAD CHECK ========== */
let googleMapsLoaded = false;
let googleMapsLoading = false;

function initGoogleAutocomplete() {
    // Check if Google Maps is available
    if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
        console.log('⏳ Google Maps not ready yet, waiting...');
        
        // If not loaded and not already loading, try to load it
        if (!googleMapsLoading) {
            loadGoogleMapsAPI();
        }
        
        // Try again in 500ms
        setTimeout(initGoogleAutocomplete, 500);
        return;
    }
    
    if (!input) {
        console.error('Input element not found');
        return;
    }
    
    console.log('✅ Google Maps loaded, initializing autocomplete');
    googleMapsLoaded = true;
    
    // Destroy existing autocomplete if any
    if (autocomplete) {
        google.maps.event.clearInstanceListeners(autocomplete);
    }
    
    try {
        // Create new autocomplete
        autocomplete = new google.maps.places.Autocomplete(input, {
            types: ['address'],
            componentRestrictions: { country: 'ph' }
        });
        
        autocomplete.setFields(['address_components', 'geometry', 'formatted_address', 'place_id']);
        
        autocomplete.addListener('place_changed', function() {
            const place = autocomplete.getPlace();
            if (!place || !place.geometry) {
                console.log('No place details available');
                return;
            }
            handleGooglePlaceSelection(place);
        });
        
        console.log('✅ Autocomplete initialized successfully');
    } catch (error) {
        console.error('Error initializing autocomplete:', error);
    }
}

function loadGoogleMapsAPI() {
    if (googleMapsLoading) return;
    
    googleMapsLoading = true;
    console.log('🔄 Loading Google Maps API...');
    
    // Check if script is already in the document
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
        console.log('Google Maps script already exists, waiting for load...');
        return;
    }
    
    // Get your API key from the existing script or from a data attribute
    const apiKey = '{{ GOOGLE_GEOCODING_API_KEY }}'; // This will be replaced by Django
    
    // Create and load the script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=Function.prototype`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
        console.log('✅ Google Maps script loaded');
        googleMapsLoading = false;
        initGoogleAutocomplete();
    };
    script.onerror = () => {
        console.error('❌ Failed to load Google Maps');
        googleMapsLoading = false;
    };
    
    document.head.appendChild(script);
}

/* ========== SAFE GOOGLE PLACE SELECTION ========== */
function handleGooglePlaceSelection(place) {
    setLoadingState(true, 'Processing...');
    
    // Safely get elements
    const latField = document.getElementById('latitude');
    const lngField = document.getElementById('longitude');
    const streetField = document.getElementById('street');
    const cityField = document.getElementById('city');
    const provinceField = document.getElementById('province');
    const countryField = document.getElementById('country');
    const zipField = document.getElementById('zip_code');
    const methodField = document.getElementById('parsing_method');
    
    if (!latField || !lngField) {
        console.error('Hidden fields not found');
        setLoadingState(false);
        return;
    }
    
    if (place.geometry) {
        latField.value = place.geometry.location.lat();
        lngField.value = place.geometry.location.lng();
    }
    
    // Parse address components
    const components = {};
    if (place.address_components) {
        place.address_components.forEach(c => {
            if (c.types && c.types[0]) {
                components[c.types[0]] = c.long_name;
            }
        });
    }
    
    // Set values with null checks
    if (streetField) {
        const streetNumber = components.street_number || '';
        const route = components.route || '';
        streetField.value = [streetNumber, route].filter(Boolean).join(' ').trim();
    }
    
    if (cityField) {
        cityField.value = components.locality || components.administrative_area_level_2 || '';
    }
    
    if (provinceField) {
        provinceField.value = components.administrative_area_level_1 || '';
    }
    
    if (countryField) {
        countryField.value = components.country || '';
    }
    
    if (zipField) {
        zipField.value = components.postal_code || '';
    }
    
    if (methodField) {
        methodField.value = 'google';
    }
    
    // Clear any AI confidence
    const aiConfidenceField = document.getElementById('ai_confidence');
    if (aiConfidenceField) {
        aiConfidenceField.value = '';
    }
    
    // Submit the form
    setTimeout(() => {
        setLoadingState(false);
        if (form) {
            form.submit();
        }
    }, 500);
}

function handleGooglePlaceSelection(place) {
    setLoadingState(true, 'Processing...');
    
    document.getElementById('latitude').value = place.geometry.location.lat();
    document.getElementById('longitude').value = place.geometry.location.lng();
    
    const components = {};
    place.address_components.forEach(c => {
        components[c.types[0]] = c.long_name;
    });
    
    const streetNumber = components.street_number || '';
    const route = components.route || '';
    document.getElementById('street').value = [streetNumber, route].filter(Boolean).join(' ').trim();
    document.getElementById('city').value = components.locality || components.administrative_area_level_2 || '';
    document.getElementById('province').value = components.administrative_area_level_1 || '';
    document.getElementById('country').value = components.country || '';
    document.getElementById('zip_code').value = components.postal_code || '';
    document.getElementById('parsing_method').value = 'google';
    
    setTimeout(() => {
        setLoadingState(false);
        form.submit();
    }, 500);
}

/* ========== MODE TOGGLE ========== */
function initModeToggle() {
    if (!modeGoogle || !modeAI) return;
    
    modeGoogle.addEventListener('click', () => setMode('google'));
    modeAI.addEventListener('click', () => setMode('ai'));
}

function setMode(mode) {
    currentMode = mode;
    
    modeGoogle.classList.toggle('active', mode === 'google');
    modeAI.classList.toggle('active', mode === 'ai');
    
    activeModeBadge.className = `mode-badge ${mode}`;
    activeModeBadge.innerHTML = mode === 'google' 
        ? '🌍 Google Maps' 
        : '🤖 AI Address Completion (Free)';
    
    // Show/hide AI confidence badge
    aiConfidenceBadge.style.display = mode === 'ai' ? 'flex' : 'none';
    
    // Update placeholder
    input.placeholder = mode === 'google'
        ? 'Enter address (e.g., 123 Rizal Ave, Manila)'
        : 'Type any place - AI completes it (e.g., "bahay ni rizal")';
    
    input.value = '';
    suggestionsContainer.style.display = 'none';
    parsingMethod.value = mode;
    
    if (window.google) {
        initGoogleAutocomplete();
    }
    
    console.log(`Mode switched to: ${mode}`);
}

/* ========== FORM SUBMISSION ========== */
if (form) {
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const address = input.value.trim();
        if (!address) {
            alert('Please enter an address');
            return;
        }
        
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
                    
                    // Update input with full address
                    input.value = result.full_address;
                    
                    setLoadingState(false);
                    form.submit();
                } else {
                    fallbackToGoogleGeocoding(address);
                }
            } catch (error) {
                console.error('AI failed, falling back to Google:', error);
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
            handleGooglePlaceSelection(results[0]);
        } else {
            setLoadingState(false);
            alert('Could not validate the address. Please refine your input.');
        }
    });
}

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

window.setInputValue = (value) => {
    input.value = value;
    input.focus();
    input.dispatchEvent(new Event('input'));
};

/* ========== INITIALIZATION ========== */
document.addEventListener('DOMContentLoaded', function() {
    initModeToggle();
    window.suggestions = new AddressSuggestions();
    
    if (typeof google !== 'undefined') {
        initGoogleAutocomplete();
    }
    
    setMode('google');
});