# locator/views.py
from django.shortcuts import render
from django.conf import settings
from .models import Address
from .utils import geocode_address, extract_fields, get_local_address_info
from django.http import JsonResponse
from django.views.decorators.http import require_GET
import googlemaps
from difflib import SequenceMatcher

def locator_view(request):
    result = {}
    suggestion = None

    if request.method == "POST":
        address = request.POST.get("address")
        lat = request.POST.get("latitude")
        lng = request.POST.get("longitude")

        if lat and lng:
            # User selected autocomplete
            result = {
                "address_line": address,
                "street": request.POST.get("street",""),
                "city": request.POST.get("city",""),
                "province": request.POST.get("province",""),
                "country": request.POST.get("country",""),
                "zip_code": request.POST.get("zip_code",""),
                "latitude": lat,
                "longitude": lng
            }
        else:
            # Google geocoding
            geo_data = geocode_address(address, settings.GOOGLE_GEOCODING_API_KEY)
            if geo_data:
                result = extract_fields(geo_data["address_components"])
                result["latitude"] = geo_data["latitude"]
                result["longitude"] = geo_data["longitude"]
                suggestion = geo_data.get("formatted_address")
            else:
                # Fallback to local
                fallback = get_local_address_info(address)
                if fallback:
                    result.update(fallback)

        # Save to DB
        if result.get("latitude") and result.get("longitude"):
            Address.objects.create(
                address_line=result.get("address_line",""),
                street=result.get("street",""),
                city=result.get("city",""),
                province=result.get("province",""),
                country=result.get("country",""),
                zip_code=result.get("zip_code",""),
                latitude=result.get("latitude"),
                longitude=result.get("longitude")
            )

    return render(request, "locator/locator.html", {
        "result": result,
        "suggestion": suggestion,
        "GOOGLE_GEOCODING_API_KEY": settings.GOOGLE_GEOCODING_API_KEY
    })

@require_GET
def ai_address_suggestions(request):
    """
    AI-powered address suggestions endpoint
    """
    query = request.GET.get('q', '').strip()
    
    # Show suggestions even with 1 letter
    if len(query) < 1:
        return JsonResponse({'suggestions': []})
    
    try:
        # Initialize Google Maps client
        gmaps = googlemaps.Client(key=settings.GOOGLE_GEOCODING_API_KEY)
        
        # Get predictions from Google Places API
        predictions = gmaps.places_autocomplete(
            input_text=query,
            components={'country': 'ph'},  # Restrict to Philippines
            types='address'
        )
        
        # Enhance predictions with AI scoring
        enhanced_suggestions = []
        for pred in predictions[:8]:  # Limit to 8 suggestions
            # AI scoring based on multiple factors
            score = calculate_ai_score(query, pred)
            
            suggestion = {
                'text': pred['description'],
                'main_text': pred['structured_formatting']['main_text'],
                'secondary_text': pred['structured_formatting']['secondary_text'],
                'ai_score': score,
                'ai_confidence': get_confidence_label(score),
                'address_type': detect_address_type(pred['description']),
                'is_popular': check_popularity(pred['description'])
            }
            enhanced_suggestions.append(suggestion)
        
        # Sort by AI score
        enhanced_suggestions.sort(key=lambda x: x['ai_score'], reverse=True)
        
        return JsonResponse({
            'suggestions': enhanced_suggestions
        })
        
    except Exception as e:
        return JsonResponse({'error': str(e), 'suggestions': []}, status=500)

def calculate_ai_score(query, prediction):
    """
    Calculate AI relevance score for a suggestion
    """
    score = 0
    description = prediction['description'].lower()
    query_lower = query.lower()
    
    # 1. Exact match at start gets highest score
    if description.startswith(query_lower):
        score += 50
    # 2. Word match (after space)
    elif f" {query_lower}" in description:
        score += 40
    # 3. Contains match
    elif query_lower in description:
        score += 30
    else:
        score += 10
    
    # 4. Popularity boost
    if check_popularity(description):
        score += 20
    
    # 5. Length boost (more complete addresses)
    if len(description) > 20:
        score += 10
    
    return min(100, score)

def get_confidence_label(score):
    """Convert AI score to confidence label"""
    if score >= 80:
        return 'Excellent Match'
    elif score >= 60:
        return 'Good Match'
    elif score >= 40:
        return 'Possible Match'
    else:
        return 'Try Refining'

def detect_address_type(address):
    """Detect the type of address"""
    address_lower = address.lower()
    if any(word in address_lower for word in ['building', 'tower', 'plaza']):
        return 'building'
    elif any(word in address_lower for word in ['mall', 'market', 'store']):
        return 'commercial'
    elif any(word in address_lower for word in ['street', 'st.', 'avenue', 'ave.', 'road']):
        return 'street'
    elif any(word in address_lower for word in ['barangay', 'brgy']):
        return 'barangay'
    elif any(word in address_lower for word in ['city', 'manila', 'quezon', 'makati']):
        return 'city'
    else:
        return 'general'

def check_popularity(address):
    """Check if an address is popular"""
    popular_keywords = ['ayala', 'bgc', 'ortigas', 'moa', 'eastwood', 'makati', 'tagaytay', 'sm', 'mall']
    return any(keyword in address.lower() for keyword in popular_keywords)