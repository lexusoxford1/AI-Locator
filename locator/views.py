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
import logging
import requests

# Import ONLY the Groq address completer
from .groq_address import GroqAddressCompleter

logger = logging.getLogger(__name__)

# Initialize the address completer (only Groq, no Geoapify)
address_completer = GroqAddressCompleter()

def locator_view(request):
    result = {}
    suggestion = None

    if request.method == "POST":
        try:
            address = request.POST.get("address", "").strip()
            parsing_method = request.POST.get("parsing_method", "ai")  # Default to AI

            print(f"📝 Form submitted - Address: {address}, Method: {parsing_method}")

            if not address:
                print("⚠️ No address provided")
                return render(request, "locator/locator.html", {"result": {}, "suggestion": None})

            # ---  Check if user selected autocomplete (lat/lng present) ---
            lat = request.POST.get("latitude")
            lng = request.POST.get("longitude")
            if lat and lng:
                result = {
                    "address_line": address,
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
                print(f"✅ Using user-selected autocomplete data: {result}")

            # ===============================
            # ✅ STRICT AI MODE (NO GOOGLE PARSING)
            # ===============================
            elif parsing_method == "ai":
                print(f"🤖 STRICT AI MODE for: {address}")

                ai_result = address_completer.complete_address(address)
                formatted_address = ai_result.get("full_address", address)

                # 🔹 OPTIONAL: Only use Google for coordinates (NOT parsing)
                geo_data = geocode_address(formatted_address, settings.GOOGLE_GEOCODING_API_KEY)

                latitude = None
                longitude = None

                if geo_data:
                    latitude = geo_data.get("latitude")
                    longitude = geo_data.get("longitude")
                    print("📍 Coordinates added via geocoding only")

                # 🚨 DO NOT extract Google address components
                result = {
                    "address_line": formatted_address,
                    "street": ai_result.get("street", ""),
                    "city": ai_result.get("city", ""),
                    "province": ai_result.get("province", ""),
                    "country": "Philippines",
                    "zip_code": ai_result.get("zip_code", ""),
                    "latitude": latitude,
                    "longitude": longitude,
                    "parsing_method": "ai",
                    "confidence_score": ai_result.get("confidence", 0)
                }

                print(f"✅ AI result (no Google parsing applied): {result}")

            # ===============================
            # ✅ STRICT GOOGLE MODE
            # ===============================
            else:
                print(f"🔍 STRICT GOOGLE MODE for: {address}")

                geo_data = geocode_address(address, settings.GOOGLE_GEOCODING_API_KEY)
                if geo_data:
                    result = extract_fields(geo_data["address_components"])
                    result["address_line"] = geo_data.get("formatted_address", address)
                    result["latitude"] = geo_data["latitude"]
                    result["longitude"] = geo_data["longitude"]
                    result["parsing_method"] = "google"
                    suggestion = geo_data.get("formatted_address")
                    print(f"✅ Google geocoding successful: {result}")
                else:
                    fallback = get_local_address_info(address)
                    if fallback:
                        result.update(fallback)
                        result["address_line"] = address
                        result["parsing_method"] = "local"
                        print(f"⚠️ Using local fallback: {result}")

            # --- Save to database only if lat/lng exists ---
            if result.get("latitude") and result.get("longitude"):
                try:
                    address_obj = Address.objects.create(
                        address_line=result.get("address_line") or "Unknown Location",
                        street=result.get("street", ""),
                        city=result.get("city", ""),
                        province=result.get("province", ""),
                        country=result.get("country", "Philippines"),
                        zip_code=result.get("zip_code", ""),
                        latitude=result.get("latitude"),
                        longitude=result.get("longitude")
                    )
                    print(f"✅ Address saved to DB with ID: {address_obj.id}")
                except Exception as e:
                    print(f"❌ DB error: {e}")

        except Exception as e:
            print(f"❌ Error in locator_view POST: {e}")
            import traceback
            traceback.print_exc()

    return render(request, "locator/locator.html", {
        "result": result,
        "suggestion": suggestion,
        "GOOGLE_GEOCODING_API_KEY": settings.GOOGLE_GEOCODING_API_KEY
    })
@require_GET
def google_places_autocomplete(request):
    """
    Google Places autocomplete endpoint (for Google Maps mode)
    """
    query = request.GET.get('q', '').strip()
    
    if len(query) < 2:
        return JsonResponse({'suggestions': []})
    
    try:
        gmaps = googlemaps.Client(key=settings.GOOGLE_GEOCODING_API_KEY)
        
        predictions = gmaps.places_autocomplete(
            input_text=query,
            components={'country': 'ph'},
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

@csrf_exempt
@require_POST
def ai_address_suggestions(request):
    """
    AI-powered address suggestions endpoint using Groq
    """
    try:
        data = json.loads(request.body)
        query = data.get('address', '').strip()
        
        print(f"🔍 AI suggestions requested for: '{query}'")
        
        if not query or len(query) < 2:
            return JsonResponse({'suggestions': []})
        
        # Get suggestions from Groq
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
    Complete a single address with full details using Groq
    """
    try:
        data = json.loads(request.body)
        query = data.get('address', '').strip()
        
        print(f"🔍 AI complete requested for: '{query}'")
        
        if not query:
            return JsonResponse({'error': 'No address provided'}, status=400)
        
        # Complete the address using Groq
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
# Add this to your locator/views.py

@csrf_exempt
@require_POST
def groq_location_from_coordinates(request):
    """
    Use Groq AI to understand a location from coordinates (for map clicks in AI mode)
    """
    try:
        data = json.loads(request.body)
        lat = data.get('latitude')
        lng = data.get('longitude')
        is_coordinates = data.get('is_coordinates', False)
        
        print(f"🗺️ Groq location from coordinates: {lat}, {lng}")
        
        if not lat or not lng:
            return JsonResponse({'error': 'Missing coordinates'}, status=400)
        
        # Format as a query for the address completer
        query = f"{lat}, {lng}"
        
        # Get location understanding from Groq
        result = address_completer.complete_address(query)
        
        if result and result.get('results') and len(result['results']) > 0:
            best = result['results'][0]
            
            # Add AI-generated insights
            # You can enhance this with more context from Groq
            response_data = {
                'street': best.get('street', ''),
                'city': best.get('city', ''),
                'province': best.get('state', ''),
                'country': best.get('country', 'Philippines'),
                'zip_code': best.get('postcode', ''),
                'full_address': best.get('formatted', f"{lat}, {lng}"),
                'confidence': best.get('rank', {}).get('confidence', 0.85) * 100,
                'landmarks': [],  # Can be populated if your Groq completer returns this
                'description': best.get('description', f"Location at coordinates {lat}, {lng}")
            }
            
            print(f"✅ Groq location result: {response_data}")
            return JsonResponse(response_data)
        else:
            # Return basic coordinate info if Groq fails
            return JsonResponse({
                'street': '',
                'city': '',
                'province': '',
                'country': 'Philippines',
                'zip_code': '',
                'full_address': f"{lat}, {lng}",
                'confidence': 50,
                'landmarks': [],
                'description': f"Coordinates: {lat}, {lng}"
            })
            
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        print(f"❌ Error in groq_location_from_coordinates: {e}")
        import traceback
        traceback.print_exc()
        return JsonResponse({'error': str(e)}, status=500)