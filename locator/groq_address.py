# locator/groq_address.py

from groq import Groq
from django.conf import settings
import os
import json
import re
from .datasets import TOURIST_SPOTS_DATA


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

    # =============================
    # CLIENT INITIALIZATION
    # =============================

    def _get_client(self):
        if self._client is None:
            api_key = getattr(settings, "GROQ_API_KEY", None) or os.environ.get("GROQ_API_KEY")
            if not api_key:
                return None
            self._client = Groq(api_key=api_key)
        return self._client

    # =============================
    # PUBLIC METHOD
    # =============================

    def complete_address(self, query: str):
        client = self._get_client()

        if not query:
            return self._empty_response()

        if client:
            try:
                system_prompt = """
You are a HIGHLY ACCURATE Philippine address normalization engine.

STRICT RULES:
- Return ONLY valid JSON.
- Do NOT explain anything.
- No markdown.
- No extra text.
- All fields must exist.
- country must ALWAYS be "Philippines".
- zip_code must be 4-digit string.
- confidence must be integer 0-100.
- address_type must be one of:
  "street_address", "landmark", "area"

If exact street is unknown, infer best possible.
If postal code unknown, intelligently infer from city.
If uncertain, lower confidence.

Required JSON structure:

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

                # Extract JSON safely
                json_match = re.search(r"\{.*\}", content, re.DOTALL)
                if json_match:
                    parsed = json.loads(json_match.group())

                    return self._validate_response(parsed)

            except Exception:
                pass

        # Fallback if AI fails
        return self._fallback_from_dataset(query)

    # =============================
    # VALIDATION LAYER
    # =============================

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

        # Force country
        data["country"] = "Philippines"

        # Validate ZIP
        if not isinstance(data["zip_code"], str) or not re.match(r"^\d{4}$", str(data["zip_code"])):
            data["zip_code"] = "0000"

        # Confidence range
        try:
            data["confidence"] = int(data["confidence"])
        except:
            data["confidence"] = 50

        data["confidence"] = max(0, min(100, data["confidence"]))

        # Address type validation
        if data["address_type"] not in ["street_address", "landmark", "area"]:
            data["address_type"] = "street_address"

        return data

    # =============================
    # DATASET FALLBACK
    # =============================

    def _fallback_from_dataset(self, query: str):
        query_lower = query.lower()

        for spot in TOURIST_SPOTS_DATA:
            if any(keyword.lower() in query_lower for keyword in spot.get("keywords", [])):
                return {
                    "full_address": spot.get("text"),
                    "street": spot.get("street"),
                    "city": spot.get("city"),
                    "province": spot.get("province"),
                    "country": "Philippines",
                    "zip_code": spot.get("zip_code", "0000"),
                    "latitude": spot.get("lat"),
                    "longitude": spot.get("lng"),
                    "confidence": spot.get("confidence", 80),
                    "address_type": "landmark",
                }

        return self._generic_fallback(query)

    # =============================
    # GENERIC FALLBACK
    # =============================

    def _generic_fallback(self, query: str):
        return {
            "full_address": query,
            "street": "",
            "city": "",
            "province": "",
            "country": "Philippines",
            "zip_code": "0000",
            "latitude": None,
            "longitude": None,
            "confidence": 40,
            "address_type": "area",
        }

    # =============================
    # EMPTY RESPONSE
    # =============================

    def _empty_response(self):
        return {
            "full_address": "",
            "street": "",
            "city": "",
            "province": "",
            "country": "Philippines",
            "zip_code": "0000",
            "latitude": None,
            "longitude": None,
            "confidence": 0,
            "address_type": "area",
        }