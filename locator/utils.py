# locator/utils.py
import requests

def geocode_address(address, api_key):
    url = "https://maps.googleapis.com/maps/api/geocode/json"
    params = {
        "address": address,
        "key": api_key
    }
    response = requests.get(url, params=params).json()
    if response['status'] == 'OK':
        result = response['results'][0]
        components = result['address_components']
        location = result['geometry']['location']
        return {
            "address_components": components,
            "latitude": location['lat'],
            "longitude": location['lng'],
            "formatted_address": result.get('formatted_address', '')
        }
    return None

def extract_fields(components):
    data = {"address_line": "", "street": "", "city": "", "province": "", "country": "", "zip_code": ""}
    for c in components:
        types = c["types"]
        if "route" in types:
            data["street"] = c["long_name"]
        if "locality" in types:
            data["city"] = c["long_name"]
        if "administrative_area_level_1" in types:
            data["province"] = c["long_name"]
        if "country" in types:
            data["country"] = c["long_name"]
        if "postal_code" in types:
            data["zip_code"] = c["long_name"]
    data["address_line"] = ", ".join([data[k] for k in ["street","city","province","country"] if data[k]])
    return data

# Optional fallback function for local dataset (simplified)
LOCAL_ADDRESSES = [
    {"address_line": "Brgy Caingin, Santa Rosa, Laguna, Philippines", 
     "street": "Brgy Caingin", "city": "Santa Rosa", "province": "Laguna", "country": "Philippines", "zip_code": "4026"}
]

def get_local_address_info(query):
    for addr in LOCAL_ADDRESSES:
        if query.lower() in addr["address_line"].lower():
            return addr
    return None
