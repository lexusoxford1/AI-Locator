/* ============================================
   AI LOCATOR PRO - GOOGLE ADDRESS AUTOCOMPLETE
   Focused only on address autocomplete logic
   ============================================ */

'use strict';

// DOM Elements
const form = document.getElementById('location-form');
const input = document.getElementById('address-input');
const submitBtn = document.getElementById('submit-btn');
const modeGoogle = document.getElementById('mode-google');
const modeAI = document.getElementById('mode-ai');
const activeModeBadge = document.getElementById('active-mode-badge');
const parsingMethod = document.getElementById('parsing_method');

let currentMode = 'google';
let autocomplete = null;

/* ========== GOOGLE AUTOCOMPLETE INITIALIZATION ========== */
function initGoogleAutocomplete() {
    if (!input) return console.error('Input not found');

    autocomplete = new google.maps.places.Autocomplete(input, {
        types: ['address'],
        componentRestrictions: { country: 'ph' }
    });

    autocomplete.setFields(['address_components', 'geometry', 'formatted_address']);

    autocomplete.addListener('place_changed', function () {
        const place = autocomplete.getPlace();
        handleGooglePlaceSelection(place);
    });
}

/* ========== HANDLE GOOGLE PLACE SELECTION ========== */
function handleGooglePlaceSelection(place) {
    if (!place || !place.geometry) return console.error('No place details available');

    const latField = document.getElementById('latitude');
    const lngField = document.getElementById('longitude');
    const streetField = document.getElementById('street');
    const cityField = document.getElementById('city');
    const provinceField = document.getElementById('province');
    const countryField = document.getElementById('country');
    const zipField = document.getElementById('zip_code');
    const methodField = document.getElementById('parsing_method');

    // Coordinates
    latField.value = place.geometry.location.lat();
    lngField.value = place.geometry.location.lng();

    // Address components
    const components = {};
    if (place.address_components) {
        place.address_components.forEach(c => {
            if (c.types && c.types[0]) components[c.types[0]] = c.long_name;
        });
    }

    // Hidden fields
    streetField.value = [components.street_number, components.route].filter(Boolean).join(' ').trim();
    cityField.value = components.locality || components.administrative_area_level_2 || '';
    provinceField.value = components.administrative_area_level_1 || '';
    countryField.value = components.country || '';
    zipField.value = components.postal_code || '';
    methodField.value = 'google';

    // Update input
    if (place.formatted_address) input.value = place.formatted_address;
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
        : '🤖 AI Mode (Disabled in this version)';

    input.placeholder = mode === 'google'
        ? 'Enter address (e.g., 123 Rizal Ave, Manila)'
        : 'AI Mode Disabled';

    input.value = '';
    parsingMethod.value = mode;

    if (window.google) initGoogleAutocomplete();
}

/* ========== FORM SUBMISSION ========== */
if (form) {
    form.addEventListener('submit', function (e) {
        e.preventDefault();

        const address = input.value.trim();
        if (!address) {
            alert('Please enter an address');
            return;
        }

        setLoadingState(true, 'Validating address...');

        if (currentMode === 'google') {
            if (typeof google === 'undefined') {
                setLoadingState(false);
                alert('Google Maps API is not loaded.');
                return;
            }

            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ address: address + ', Philippines', region: 'ph' }, (results, status) => {
                if (status === 'OK' && results[0]) {
                    handleGooglePlaceSelection(results[0]);
                    setLoadingState(false);
                    form.submit();
                } else {
                    setLoadingState(false);
                    alert('Could not validate the address. Please refine your input.');
                }
            });
        } else {
            alert('AI mode is disabled in this version.');
            setLoadingState(false);
        }
    });
}

/* ========== LOADING STATE ========== */
function setLoadingState(isLoading, text = 'Validating...') {
    if (isLoading) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="btn-spinner"></span> ${text}`;
    } else {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="btn-text">Validate Address</span>';
    }
}

/* ========== INITIALIZATION ========== */
document.addEventListener('DOMContentLoaded', function () {
    initModeToggle();
    setMode('google');
    if (window.google) initGoogleAutocomplete();
});