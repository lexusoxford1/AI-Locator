# locator/views.py
from django.shortcuts import render
from django.conf import settings
from .models import Address
from .utils import geocode_address, extract_fields, get_local_address_info
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST
from django.views.decorators.csrf import csrf_exempt
import googlemaps
import json
from difflib import SequenceMatcher
import logging

# Import your AI address completer
from .address_api import FreeAddressCompleter

logger = logging.getLogger(__name__)

# Initialize the address completer
address_completer = FreeAddressCompleter()

# locator/views.py - updated locator_view function

def locator_view(request):
    result = {}
    suggestion = None

    if request.method == "POST":
        try:
            address = request.POST.get("address", "")
            lat = request.POST.get("latitude")
            lng = request.POST.get("longitude")
            parsing_method = request.POST.get("parsing_method", "google")

            print(f"📝 Form submitted - Address: {address}, Method: {parsing_method}")
            print(f"📍 Lat: {lat}, Lng: {lng}")

            if lat and lng:
                # User selected autocomplete
                result = {
                    "address_line": address or "Unknown Address",
                    "street": request.POST.get("street", ""),
                    "city": request.POST.get("city", ""),
                    "province": request.POST.get("province", ""),
                    "country": request.POST.get("country", "Philippines"),
                    "zip_code": request.POST.get("zip_code", ""),
                    "latitude": lat,
                    "longitude": lng,
                    "parsing_method": parsing_method,
                    "confidence_score": request.POST.get("ai_confidence", 0)
                }
                print(f"✅ Using autocomplete data: {result}")
            else:
                # Google geocoding
                print(f"🔍 Geocoding address: {address}")
                geo_data = geocode_address(address, settings.GOOGLE_GEOCODING_API_KEY)
                if geo_data:
                    result = extract_fields(geo_data["address_components"])
                    result["address_line"] = geo_data.get("formatted_address", address)
                    result["latitude"] = geo_data["latitude"]
                    result["longitude"] = geo_data["longitude"]
                    result["parsing_method"] = "google"
                    suggestion = geo_data.get("formatted_address")
                    print(f"✅ Geocoding successful: {result}")
                else:
                    # Fallback to local
                    print("⚠️ Geocoding failed, trying local fallback")
                    fallback = get_local_address_info(address)
                    if fallback:
                        result.update(fallback)
                        result["address_line"] = address
                        result["parsing_method"] = "local"

            # Save to DB - with proper error handling
            if result.get("latitude") and result.get("longitude"):
                try:
                    # Ensure address_line is not empty
                    address_line = result.get("address_line") or result.get("street") or "Unknown Location"
                    
                    # Create the address record
                    address_obj = Address.objects.create(
                        address_line=address_line,
                        street=result.get("street", ""),
                        city=result.get("city", ""),
                        province=result.get("province", ""),
                        country=result.get("country", "Philippines"),
                        zip_code=result.get("zip_code", ""),
                        latitude=result.get("latitude"),
                        longitude=result.get("longitude")
                    )
                    print(f"✅ Address saved to database with ID: {address_obj.id}")
                except Exception as e:
                    print(f"❌ Database error: {e}")
                    # Don't let database error stop the response
                    pass

        except Exception as e:
            print(f"❌ Error in locator_view POST: {e}")
            import traceback
            traceback.print_exc()

    return render(request, "locator/locator.html", {
        "result": result,
        "suggestion": suggestion,
        "GOOGLE_GEOCODING_API_KEY": settings.GOOGLE_GEOCODING_API_KEY
    })
# locator/views.py - Add this function

@require_GET
def google_places_autocomplete(request):
    """
    Google Places autocomplete endpoint (for Google Maps mode)
    """
    query = request.GET.get('q', '').strip()
    
    if len(query) < 2:
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
        
        suggestions = []
        for pred in predictions[:5]:
            suggestion = {
                'text': pred['description'],
                'main_text': pred['structured_formatting']['main_text'],
                'secondary_text': pred['structured_formatting']['secondary_text']
            }
            suggestions.append(suggestion)
        
        return JsonResponse({
            'suggestions': suggestions
        })
        
    except Exception as e:
        print(f"Google Places error: {e}")
        return JsonResponse({'error': str(e), 'suggestions': []}, status=500)
    
    # locator/views.py - Add these functions at the end of the file

@csrf_exempt
@require_POST
def ai_address_suggestions(request):
    """
    AI-powered address suggestions endpoint using Geoapify
    """
    try:
        data = json.loads(request.body)
        query = data.get('address', '').strip()
        
        print(f"🔍 AI suggestions requested for: '{query}'")
        
        if not query or len(query) < 2:
            return JsonResponse({'suggestions': []})
        
        # Get suggestions from Geoapify
        suggestions = address_completer.get_suggestions(query)
        print(f"📦 Found {len(suggestions)} suggestions")
        
        return JsonResponse({
            'suggestions': suggestions,
            'count': len(suggestions)
        })
        
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        print(f"❌ Error in ai_address_suggestions: {e}")
        import traceback
        traceback.print_exc()
        return JsonResponse({'error': str(e), 'suggestions': []}, status=500)


@csrf_exempt
@require_POST
def ai_complete_address(request):
    """
    Complete a single address with full details using AI
    """
    try:
        data = json.loads(request.body)
        query = data.get('address', '').strip()
        
        print(f"🔍 AI complete requested for: '{query}'")
        
        if not query:
            return JsonResponse({'error': 'No address provided'}, status=400)
        
        # Complete the address
        result = address_completer.complete_address(query)
        
        if result:
            print(f"✅ AI complete result: {result}")
            return JsonResponse(result)
        else:
            return JsonResponse({
                'error': 'Address not found',
                'query': query,
                'full_address': query,
                'confidence': 0
            }, status=404)
            
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        print(f"❌ Error in ai_complete_address: {e}")
        import traceback
        traceback.print_exc()
        return JsonResponse({'error': str(e)}, status=500)