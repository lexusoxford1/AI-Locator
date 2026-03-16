from groq import Groq
from django.conf import settings
import os
import json
import re
from .datasets import TOURIST_SPOTS_DATA

PH_ZIP_MAP = {
    "Calamba": "4027",
    "Manila": "1000",
    "Cebu City": "6000",
    "Pasay": "1300",
    "Quezon City": "1100",
    "Santa Rosa City": "4026",
    "Mandaluyong" : "1555",
    "Taguig" : "1634",
}

class GroqAddressCompleter:
    """
    AI-driven Philippine Address Completion using Groq ONLY.

    REQUIRED OUTPUT FORMAT:
    {
        "full_address": "...",
        "street": "...",
        "city": "...",
        "province": "...",
        "country": "Philippines",
        "zip_code": "####",
        "latitude": null,
        "longitude": null,
        "confidence": 0-100,
        "address_type": "street_address|landmark|area"
    }
    """

    def __init__(self):
        self._client = None
        self.model = "llama-3.1-8b-instant"

    def _get_client(self):
        if self._client is None:
            api_key = getattr(settings, "GROQ_API_KEY", None) or os.environ.get("GROQ_API_KEY")
            if not api_key:
                return None
            self._client = Groq(api_key=api_key)
        return self._client

    def complete_address(self, query: str):
        client = self._get_client()

        if not query:
            return self._empty_response()

        if client:
            try:
                system_prompt = """
You are a HIGHLY ACCURATE Philippine address normalization engine.
STRICT RULES:
- Return ONLY valid JSON
- Do NOT explain, no markdown
- All fields must exist
- country must ALWAYS be "Philippines"
- zip_code must be 4-digit string
- confidence must be 0-100
- address_type must be "street_address", "landmark", or "area"
Infer missing ZIP from city if possible
Lower confidence if uncertain
Required JSON:
{
"full_address": "...",
"street": "...",
"city": "...",
"province": "...",
"country": "Philippines",
"zip_code": "####",
"latitude": null,
"longitude": null,
"confidence": 0,
"address_type": "street_address"
}
"""
                response = client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"Normalize this Philippine address query: {query}"}
                    ],
                    temperature=0.05,
                    max_tokens=400,
                )

                content = response.choices[0].message.content.strip()

                json_match = re.search(r"\{.*\}", content, re.DOTALL)
                if json_match:
                    parsed = json.loads(json_match.group())
                    return self._validate_response(parsed)

            except Exception:
                pass

        return self._fallback_from_dataset(query)

    def _validate_response(self, data: dict):
        required_keys = [
            "full_address",
            "street",
            "city",
            "province",
            "country",
            "zip_code",
            "latitude",
            "longitude",
            "confidence",
            "address_type",
        ]

        for key in required_keys:
            if key not in data:
                data[key] = None

        data["country"] = "Philippines"

        if not data.get("zip_code") or not re.match(r"^\d{4}$", str(data["zip_code"])):
            city = data.get("city")
            data["zip_code"] = PH_ZIP_MAP.get(city, "")

        try:
            data["confidence"] = int(data["confidence"])
        except:
            data["confidence"] = 50
        data["confidence"] = max(0, min(100, data["confidence"]))

        if data["address_type"] not in ["street_address", "landmark", "area"]:
            data["address_type"] = "street_address"

        for field in ["full_address", "street", "city", "province", "zip_code"]:
            if data[field] is None:
                data[field] = ""

        return data

    def _fallback_from_dataset(self, query: str):
        query_lower = query.lower()
        for spot in TOURIST_SPOTS_DATA:
            if any(keyword.lower() in query_lower for keyword in spot.get("keywords", [])):
                city = spot.get("city")
                return {
                    "full_address": spot.get("text"),
                    "street": spot.get("street"),
                    "city": city,
                    "province": spot.get("province"),
                    "country": "Philippines",
                    "zip_code": PH_ZIP_MAP.get(city, spot.get("zip_code", "")),
                    "latitude": spot.get("lat"),
                    "longitude": spot.get("lng"),
                    "confidence": spot.get("confidence", 80),
                    "address_type": "landmark",
                }
        return self._generic_fallback(query)

    def _generic_fallback(self, query: str):
        return {
            "full_address": query,
            "street": "",
            "city": "",
            "province": "",
            "country": "Philippines",
            "zip_code": "",
            "latitude": None,
            "longitude": None,
            "confidence": 40,
            "address_type": "area",
        }

    def _empty_response(self):
        return {
            "full_address": "",
            "street": "",
            "city": "",
            "province": "",
            "country": "Philippines",
            "zip_code": "Not Provided",
            "latitude": None,
            "longitude": None,
            "confidence": 0,
            "address_type": "area",
        }