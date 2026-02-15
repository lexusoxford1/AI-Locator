function initAutocomplete() {
    var input = document.getElementById('address-input');
    var autocomplete = new google.maps.places.Autocomplete(input, {
        types: ['address'],
        componentRestrictions: {country: 'ph'}
    });

    autocomplete.setFields(['address_components', 'geometry', 'formatted_address']);

    autocomplete.addListener('place_changed', function () {
        var place = autocomplete.getPlace();
        if (!place.geometry) return;

        document.getElementById('latitude').value = place.geometry.location.lat();
        document.getElementById('longitude').value = place.geometry.location.lng();

        var components = {};
        place.address_components.forEach(function(c) {
            components[c.types[0]] = c.long_name;
        });

        document.getElementById('street').value = (components.street_number || '') + ' ' + (components.route || '');
        document.getElementById('city').value = components.locality || '';
        document.getElementById('province').value = components.administrative_area_level_1 || '';
        document.getElementById('country').value = components.country || '';
        document.getElementById('zip_code').value = components.postal_code || '';
    });

    window.onload = function () {
    initAutocomplete();
};

}
