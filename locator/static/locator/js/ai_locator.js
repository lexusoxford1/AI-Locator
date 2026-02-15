function initAutocomplete() {
    var input = document.getElementById('address-input');
    var submitBtn = document.getElementById('submit-btn');
    
    var autocomplete = new google.maps.places.Autocomplete(input, {
        types: ['address'],
        componentRestrictions: {country: 'ph'}
    });

    autocomplete.setFields(['address_components', 'geometry', 'formatted_address']);

    autocomplete.addListener('place_changed', function () {
        var place = autocomplete.getPlace();
        if (!place.geometry) {
            // User entered a place that doesn't exist
            alert("Please select a valid address from the suggestions");
            return;
        }

        // Show loading state on button
        submitBtn.innerHTML = '<span class="loading"></span> Processing...';
        submitBtn.disabled = true;

        // Fill in the hidden fields
        document.getElementById('latitude').value = place.geometry.location.lat();
        document.getElementById('longitude').value = place.geometry.location.lng();

        var components = {};
        place.address_components.forEach(function(c) {
            components[c.types[0]] = c.long_name;
        });

        // Street: combine street_number and route
        var streetNumber = components.street_number || '';
        var route = components.route || '';
        document.getElementById('street').value = (streetNumber + ' ' + route).trim();

        document.getElementById('city').value = components.locality || 
                                                components.administrative_area_level_2 || 
                                                components.sublocality_level_1 || '';
        
        document.getElementById('province').value = components.administrative_area_level_1 || '';
        document.getElementById('country').value = components.country || '';
        document.getElementById('zip_code').value = components.postal_code || '';

        // Reset button state
        submitBtn.innerHTML = '<span class="btn-text">Locate Address</span>';
        submitBtn.disabled = false;
    });

    // Add input validation
    input.addEventListener('invalid', function(e) {
        e.preventDefault();
        this.setCustomValidity('Please enter an address to locate');
    });

    input.addEventListener('input', function() {
        this.setCustomValidity('');
    });
}

// Handle form submission with validation
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('location-form');
    
    form.addEventListener('submit', function(e) {
        const addressInput = document.getElementById('address-input');
        const latitude = document.getElementById('latitude').value;
        const longitude = document.getElementById('longitude').value;
        
        if (!addressInput.value.trim()) {
            e.preventDefault();
            alert('Please enter an address');
            return;
        }
        
        // If we don't have coordinates, try to validate
        if (!latitude || !longitude) {
            e.preventDefault();
            alert('Please select a valid address from the dropdown suggestions');
            return;
        }
    });
});