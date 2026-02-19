
import requests
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

class FreeAddressCompleter:
    """
    Free address completion using Geoapify API (3,000 requests/day free)
    """
    
    def __init__(self):
        self.api_key = settings.GEOAPIFY_API_KEY
        self.base_url = "https://api.geoapify.com/v1/geocode/search"
    
    def complete_address(self, query):
        """
        Complete a partial address using Geoapify
        Example: "bahay ni rizal" -> Full address with coordinates
        """
        try:
            # Prepare the search query with Philippines context
            search_query = f"{query}, Philippines"
            
            # API parameters
            params = {
                'text': search_query,
                'apiKey': self.api_key,
                'format': 'json',
                'limit': 3,  # Get top 3 results
                'filter': 'countrycode:ph',  # Only Philippines
                'bias': 'countrycode:ph',  # Bias towards Philippines
                'lang': 'en'
            }
            
            # Make the API request
            response = requests.get(self.base_url, params=params, timeout=5)
            response.raise_for_status()
            
            data = response.json()
            
            if not data.get('results'):
                logger.warning(f"No results found for: {query}")
                return None
            
            # Process the best result
            best_result = data['results'][0]
            
            # Extract address components
            address = self._extract_components(best_result)
            
            # Add confidence score
            address['confidence'] = best_result.get('rank', {}).get('confidence', 0) * 100
            
            return address
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Geoapify API error: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            return None
    
    def get_suggestions(self, query):
        """
        Get multiple address suggestions for autocomplete
        """
        try:
            params = {
                'text': f"{query}, Philippines",
                'apiKey': self.api_key,
                'format': 'json',
                'limit': 5,
                'filter': 'countrycode:ph',
                'lang': 'en'
            }
            
            response = requests.get(self.base_url, params=params, timeout=5)
            response.raise_for_status()
            
            data = response.json()
            suggestions = []
            
            for result in data.get('results', []):
                addr = self._extract_components(result)
                suggestions.append({
                    'text': addr['full_address'],
                    'street': addr['street'],
                    'city': addr['city'],
                    'province': addr['province'],
                    'zip': addr['zip_code'],
                    'lat': addr['latitude'],
                    'lng': addr['longitude'],
                    'confidence': result.get('rank', {}).get('confidence', 0) * 100
                })
            
            return suggestions
            
        except Exception as e:
            logger.error(f"Error getting suggestions: {e}")
            return []
    
    def _extract_components(self, result):
        """Extract and format address components"""
        
        # Get individual components
        street = result.get('street', '')
        housenumber = result.get('housenumber', '')
        city = result.get('city', result.get('town', result.get('village', '')))
        state = result.get('state', '')
        postcode = result.get('postcode', '')
        
        # Build full street address
        if housenumber and street:
            full_street = f"{housenumber} {street}"
        else:
            full_street = street or housenumber or ''
        
        # Build complete formatted address
        address_parts = []
        if full_street:
            address_parts.append(full_street)
        if city:
            address_parts.append(city)
        if state:
            address_parts.append(state)
        address_parts.append('Philippines')
        if postcode:
            address_parts.append(postcode)
        
        full_address = ', '.join(address_parts)
        
        return {
            'full_address': full_address,
            'street': full_street,
            'city': city,
            'province': state,
            'country': 'Philippines',
            'zip_code': postcode,
            'latitude': result.get('lat'),
            'longitude': result.get('lon'),
            'place_id': result.get('place_id', '')
        }
    