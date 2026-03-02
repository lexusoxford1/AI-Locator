/* ============================================
   AI LOCATOR PRO - GOOGLE ADDRESS AUTOCOMPLETE + AI + CLICKABLE MAP
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
const parsingMethod = document.getElementById('parsing_method');

let currentMode = 'ai';
let currentSuggestions = [];
let selectedIndex = -1;
let searchTimeout = null;
let autocomplete = null;

// ===================== CLICKABLE RESULTS MAP =====================
let resultsMap = null;
let resultsMarker = null;
let geocoder = null;

function initClickableResultsMap() {
    console.log('Initializing clickable results map...');
    
    // Check if Google Maps is loaded
    if (typeof google === 'undefined' || !google.maps) {
        console.log('Google Maps not loaded yet');
        return;
    }
    
    // Check if we have coordinates
    const lat = parseFloat(document.getElementById('latitude').value);
    const lng = parseFloat(document.getElementById('longitude').value);
    
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
        console.log('No valid coordinates available for map');
        
        // Hide map container and show placeholder
        const mapContainer = document.getElementById('clickable-map');
        const mapPlaceholder = document.getElementById('map-placeholder');
        
        if (mapContainer) mapContainer.style.display = 'none';
        if (mapPlaceholder) mapPlaceholder.style.display = 'flex';
        
        return;
    }
    
    // Get the map container
    const mapContainer = document.getElementById('clickable-map');
    if (!mapContainer) {
        console.log('Map container #clickable-map not found');
        return;
    }
    
    console.log('Map container found, creating map with coordinates:', lat, lng);
    
    // Hide placeholder
    const mapPlaceholder = document.getElementById('map-placeholder');
    if (mapPlaceholder) {
        mapPlaceholder.style.display = 'none';
    }
    
    // Show map container
    mapContainer.style.display = 'block';
    
    // Clear the container
    mapContainer.innerHTML = '';
    
    // Initialize geocoder
    geocoder = new google.maps.Geocoder();
    
    // Create the map
    const position = { lat, lng };
    resultsMap = new google.maps.Map(mapContainer, {
        center: position,
        zoom: 16,
        mapTypeId: 'roadmap',
        mapTypeControl: true,
        fullscreenControl: true,
        streetViewControl: true,
        zoomControl: true,
    });
    
    // Add a marker
    resultsMarker = new google.maps.Marker({
        position: position,
        map: resultsMap,
        title: 'Current location - Click map to change',
        draggable: true,
        animation: google.maps.Animation.DROP,
        icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#2563EB',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 3,
        }
    });
    
    // Make the map clickable
    resultsMap.addListener('click', function(e) {
        console.log('Map clicked at:', e.latLng.lat(), e.latLng.lng());
        updateLocationFromClick(e.latLng);
    });
    
    // Handle marker drag
    resultsMarker.addListener('dragend', function(e) {
        console.log('Marker dragged to:', e.latLng.lat(), e.latLng.lng());
        updateLocationFromClick(e.latLng);
    });
    
    console.log('Clickable map initialized successfully');
}

function updateLocationFromClick(latLng) {
    // Update marker position
    if (resultsMarker) {
        resultsMarker.setPosition(latLng);
    }
    
    // Update coordinates display
    document.getElementById('latitude').value = latLng.lat();
    document.getElementById('longitude').value = latLng.lng();
    
    // Show loading on button
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="btn-spinner"></span>Getting address...';
    submitBtn.disabled = true;
    
    // Reverse geocode
    geocoder.geocode({ location: latLng }, function(results, status) {
        if (status === 'OK' && results && results[0]) {
            console.log('Address found:', results[0].formatted_address);
            
            // Fill the form with the new address
            fillGoogleFields(results[0]);
            
            // Update input field
            document.getElementById('address-input').value = results[0].formatted_address;
            
            // Set parsing method
            document.getElementById('parsing_method').value = 'pinpoint';
            
            // Update the visible address details in the results section
            updateAddressDetailsDisplay(results[0]);
            
            // Show success message
            showNotification('Location updated successfully!', 'success');
        } else {
            console.error('Geocoding failed:', status);
            
            // Even if geocoding fails, we keep the coordinates
            showNotification('Address not found, but coordinates saved', 'warning');
        }
        
        // Restore button
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    });
}

// Function to update the visible address details
function updateAddressDetailsDisplay(place) {
    console.log('Updating address details display');
    
    // Check if we're on a results page
    const detailsCard = document.querySelector('.details-card');
    if (!detailsCard) {
        console.log('No details card found - not on results page');
        return;
    }
    
    // Extract components
    const components = {};
    if (place.address_components) {
        place.address_components.forEach(c => {
            if(c.types && c.types[0]) components[c.types[0]] = c.long_name;
        });
    }
    
    // Format full address
    const street = [components.street_number, components.route].filter(Boolean).join(' ');
    const city = components.locality || components.administrative_area_level_2 || '';
    const province = components.administrative_area_level_1 || '';
    const country = components.country || 'Philippines';
    const zip = components.postal_code || '';
    
    // Build full address line
    const addressParts = [street, city, province, country, zip].filter(Boolean);
    const fullAddress = addressParts.join(', ');
    
    // Update all detail items
    updateDetailItem('Full Address:', fullAddress || place.formatted_address);
    updateDetailItem('Street:', street || 'Not provided');
    updateDetailItem('City:', city || 'Not provided');
    updateDetailItem('Province:', province || 'Not provided');
    updateDetailItem('Country:', country || 'Not provided');
    updateDetailItem('Postal Code:', zip || 'Not provided');
    
    // Update coordinates
    const coordsSpan = document.querySelector('.coordinates-badge');
    if (coordsSpan) {
        const lat = document.getElementById('latitude').value;
        const lng = document.getElementById('longitude').value;
        coordsSpan.innerHTML = `<i class="fas fa-location-dot"></i> ${parseFloat(lat).toFixed(6)}, ${parseFloat(lng).toFixed(6)}`;
    }
    
    // Update method badge
    const methodBadge = document.querySelector('.method-badge');
    if (methodBadge) {
        methodBadge.className = 'method-badge pinpoint';
        methodBadge.innerHTML = '<i class="fas fa-map-marker-alt"></i> Pinpoint Selected';
    }
}

// Helper function to update a specific detail item
function updateDetailItem(label, value) {
    const detailItems = document.querySelectorAll('.detail-item');
    detailItems.forEach(item => {
        const labelSpan = item.querySelector('.detail-label');
        if (labelSpan && labelSpan.textContent.includes(label)) {
            const valueSpan = item.querySelector('.detail-value');
            if (valueSpan) {
                valueSpan.textContent = value;
            }
        }
    });
}

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
        } catch (error) { 
            console.error('AI Suggestions error:', error); 
            return []; 
        }
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
            return result;
        } catch (error) { 
            console.error('AI Complete error:', error); 
            return null; 
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

        html += `<div class="suggestion-footer"><i class="fas fa-leaf"></i> Powered by AI</div>`;
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

    selectSuggestion(index) {
        const suggestion = currentSuggestions[index]; 
        if (!suggestion) return;
        
        input.value = suggestion.text;
        if (suggestion.lat && suggestion.lng) { 
            document.getElementById('latitude').value = suggestion.lat; 
            document.getElementById('longitude').value = suggestion.lng; 
            
            // Update the map if it exists
            if (resultsMap) {
                const newPos = { lat: suggestion.lat, lng: suggestion.lng };
                resultsMap.setCenter(newPos);
                if (resultsMarker) {
                    resultsMarker.setPosition(newPos);
                }
            } else {
                // Try to initialize the map if it doesn't exist
                setTimeout(() => {
                    initClickableResultsMap();
                }, 500);
            }
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
    if (typeof google === 'undefined' || !google.maps || !google.maps.importLibrary) { 
        console.log('Google Maps not loaded yet');
        return; 
    }
    
    if (!input) { console.error('Input not found'); return; }
    
    console.log('Initializing Google Place Autocomplete');
    
    // Use the new PlaceAutocompleteElement
    google.maps.importLibrary("places").then(({ PlaceAutocompleteElement }) => {
        // Create autocomplete element
        const autocompleteElement = new PlaceAutocompleteElement({
            inputElement: input,
            componentRestrictions: { country: 'ph' }
        });
        
        // Listen for place selection
        autocompleteElement.addEventListener('gmp-select', async ({ place }) => {
            if (!place) return;
            
            // Get place details
            await place.fetchFields({
                fields: ['displayName', 'formattedAddress', 'location', 'addressComponents', 'plusCode']
            });
            
            // Fill form fields
            fillGoogleFieldsFromPlace(place);
        });
    }).catch(error => {
        console.error('Error loading Places library:', error);
        // Fallback to old method if needed
        fallbackInitGoogleAutocomplete();
    });
}

// Fallback to old method
function fallbackInitGoogleAutocomplete() {
    if (typeof google === 'undefined' || !google.maps || !google.maps.places) return;
    
    if (autocomplete) {
        google.maps.event.clearInstanceListeners(autocomplete);
    }

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

// Handle Place object
function fillGoogleFieldsFromPlace(place) {
    console.log('Filling fields from Place:', place.displayName);
    
    document.getElementById('latitude').value = place.location.lat();
    document.getElementById('longitude').value = place.location.lng();
    
    // Extract address components
    let streetNumber = '', route = '', locality = '', areaLevel1 = '', country = '', postalCode = '';
    
    if (place.addressComponents) {
        place.addressComponents.forEach(component => {
            const types = component.types;
            if (types.includes('street_number')) streetNumber = component.longText;
            if (types.includes('route')) route = component.longText;
            if (types.includes('locality')) locality = component.longText;
            if (types.includes('administrative_area_level_1')) areaLevel1 = component.longText;
            if (types.includes('country')) country = component.longText;
            if (types.includes('postal_code')) postalCode = component.longText;
        });
    }
    
    document.getElementById('street').value = [streetNumber, route].filter(Boolean).join(' ');
    document.getElementById('city').value = locality || '';
    document.getElementById('province').value = areaLevel1 || '';
    document.getElementById('country').value = country || 'Philippines';
    document.getElementById('zip_code').value = postalCode || '';
    
    if (parsingMethod.value !== 'pinpoint') {
        document.getElementById('parsing_method').value = 'google';
    }
    
    if (place.formattedAddress) input.value = place.formattedAddress;
    
    // Update map if it exists
    if (resultsMap && place.location) {
        const newPos = { lat: place.location.lat(), lng: place.location.lng() };
        resultsMap.setCenter(newPos);
        if (resultsMarker) {
            resultsMarker.setPosition(newPos);
        }
    } else {
        // Try to initialize the map
        setTimeout(() => {
            initClickableResultsMap();
        }, 500);
    }
}

function fillGoogleFields(place) {
    console.log('Filling Google fields for:', place.formatted_address);
    
    const components = {}; 
    if (place.address_components) {
        place.address_components.forEach(c => { 
            if(c.types && c.types[0]) components[c.types[0]] = c.long_name; 
        });
    }
    
    document.getElementById('latitude').value = place.geometry.location.lat();
    document.getElementById('longitude').value = place.geometry.location.lng();
    document.getElementById('street').value = [components.street_number, components.route].filter(Boolean).join(' ');
    document.getElementById('city').value = components.locality || components.administrative_area_level_2 || '';
    document.getElementById('province').value = components.administrative_area_level_1 || '';
    document.getElementById('country').value = components.country || 'Philippines';
    document.getElementById('zip_code').value = components.postal_code || '';
    
    // Set parsing method
    if (parsingMethod.value !== 'pinpoint') {
        document.getElementById('parsing_method').value = 'google';
    }
    
    if (place.formatted_address) input.value = place.formatted_address;
    
    // Update map if it exists
    if (resultsMap && place.geometry && place.geometry.location) {
        const newPos = { 
            lat: place.geometry.location.lat(), 
            lng: place.geometry.location.lng() 
        };
        resultsMap.setCenter(newPos);
        if (resultsMarker) {
            resultsMarker.setPosition(newPos);
        }
    } else {
        // Try to initialize the map
        setTimeout(() => {
            initClickableResultsMap();
        }, 500);
    }
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
    
    // Update placeholder
    input.placeholder = mode === 'google' ? 
        'Enter address (e.g., 123 Rizal Ave, Manila)' : 
        'Type any place (e.g., "bahay ni rizal")';
    
    // Clear input and hide suggestions
    input.value = ''; 
    suggestionsContainer.style.display = 'none'; 
    parsingMethod.value = mode;
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
    if (typeof google === 'undefined' || !google.maps) { 
        setLoadingState(false); 
        alert('Google Maps API is not loaded.'); 
        return; 
    }
    
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ 
        address: address + ', Philippines', 
        region: 'ph' 
    }, (results, status) => {
        if (status === 'OK' && results && results[0]) { 
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

// Notification function
function showNotification(message, type = 'success') {
    // Remove existing notification
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    let icon = 'check-circle';
    if (type === 'warning') icon = 'exclamation-triangle';
    if (type === 'error') icon = 'exclamation-circle';
    
    notification.innerHTML = `
        <i class="fas fa-${icon}"></i>
        ${message}
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add notification styles
function addNotificationStyles() {
    if (document.getElementById('notification-styles')) return;
    
    const styles = `
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px 24px;
            border-radius: 8px;
            background: white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            animation: slideIn 0.3s ease;
            display: flex;
            align-items: center;
            gap: 12px;
            font-weight: 500;
            max-width: 400px;
        }
        .notification.success {
            border-left: 4px solid #10B981;
            color: #10B981;
        }
        .notification.warning {
            border-left: 4px solid #F59E0B;
            color: #F59E0B;
        }
        .notification.error {
            border-left: 4px solid #EF4444;
            color: #EF4444;
        }
        .notification.fade-out {
            animation: fadeOut 0.3s ease forwards;
        }
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes fadeOut {
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    
    const styleSheet = document.createElement('style');
    styleSheet.id = 'notification-styles';
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
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
    console.log('DOM loaded, initializing...');
    
    addNotificationStyles();
    initModeToggle();
    window.suggestions = new AddressSuggestions();
    
    // Get initial mode from hidden field
    const storedMode = document.getElementById('current-mode-storage');
    if (storedMode && storedMode.value) {
        setMode(storedMode.value);
    } else {
        setMode('ai');
    }
    
    // Initialize Google Maps features
    if (typeof google !== 'undefined' && google.maps) {
        console.log('Google Maps already loaded');
        initGoogleAutocomplete();
        
        // Initialize the map immediately
        initClickableResultsMap();
    } else {
        console.log('Waiting for Google Maps to load...');
        // Check every second for Google Maps
        const checkGoogleMaps = setInterval(function() {
            if (typeof google !== 'undefined' && google.maps) {
                console.log('Google Maps now loaded');
                clearInterval(checkGoogleMaps);
                initGoogleAutocomplete();
                initClickableResultsMap();
            }
        }, 500);
    }
});

// Also try to initialize when results are loaded
window.addEventListener('load', function() {
    console.log('Window loaded');
    if (typeof google !== 'undefined' && google.maps) {
        initClickableResultsMap();
    }
});

// Re-initialize map when results are updated via AJAX
document.addEventListener('results-updated', function() {
    console.log('Results updated, reinitializing map');
    if (typeof google !== 'undefined' && google.maps) {
        setTimeout(() => {
            initClickableResultsMap();
        }, 500);
    }
});