# locator/views.py
from django.shortcuts import render
from django.conf import settings
from .models import Address
from .utils import geocode_address, extract_fields, get_local_address_info

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
