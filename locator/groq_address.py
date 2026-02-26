# locator/groq_address.py
from groq import Groq
from django.conf import settings
import json
import logging
import os

logger = logging.getLogger(__name__)

class GroqAddressCompleter:
    """
    Address completion using Groq AI
    """
    
    def __init__(self):
        self._client = None
        self.model = "llama-3.1-8b-instant"  
        
        print("="*50)
        print("🔧 GROQ ADDRESS COMPLETER INITIALIZED (lazy mode)")
        print(f"📊 Using model: {self.model}")
        print("="*50)
    
    def _get_client(self):
        """Lazy initialization of the Groq client"""
        if self._client is None:
            api_key = getattr(settings, 'GROQ_API_KEY', None)
            
            if not api_key:
                print("⚠️ GROQ_API_KEY not found in settings")
                api_key = os.environ.get('GROQ_API_KEY')
            
            if not api_key:
                print("❌ No Groq API key found. Please set GROQ_API_KEY in .env")
                return None
            
            try:
                self._client = Groq(api_key=api_key)
                print(f"✅ Groq client initialized with key: {api_key[:8]}...")
            except Exception as e:
                print(f"❌ Failed to initialize Groq client: {e}")
                return None
        
        return self._client
    
    def complete_address(self, query):
        """
        Use Groq AI to complete an address - returns EXACT street address
        """
        try:
            print(f"🔍 Groq completing address: '{query}'")
            
            client = self._get_client()
            if not client:
                print("❌ No Groq client available")
                return None
            
            system_prompt = """You are an AI address assistant for the Philippines. Your task is to convert any query into a COMPLETE, SPECIFIC, EXACT address with house number and street name.

CRITICAL RULES:
1. Return the FULL STREET ADDRESS with house number when available
2. Do NOT just return the landmark name - return WHERE IT IS LOCATED
3. For "bahay ni rizal", the exact address is: Mercado Street, Calamba, Laguna (house number may vary)
4. For "nlsp" or "nslp" (National Library), the exact address is: T.M. Kalaw Street, Ermita, Manila
5. Always prioritize the specific street address over the landmark name

Examples of CORRECT responses:
- "bahay ni rizal" →F. Mercado Street, Calamba, 4027 Laguna, Philippines ( 14.213692, 121.166740)
- "sm moa" → Seaside Boulevard, Pasay, 1300 Metro Manila, Philippines (14.5356, 120.9824)
- "bgc" → 11th Avenue, Bonifacio Global City, Taguig, 1630 Metro Manila, Philippines (14.5525, 121.0459)
- "intramuros" → General Luna Street, Intramuros, Manila, 1002 Metro Manila, Philippines (14.5896, 120.9749)
- "nlsp" → T.M. Kalaw Street, Ermita, Manila, 1000 Metro Manila, Philippines (14.5813, 120.9788)

Return ONLY a valid JSON object with these exact fields:
{
  "full_address": "Complete formatted address with street name",
  "street": "Street name only (include house number if known)",
  "city": "City",
  "province": "Province",
  "country": "Philippines",
  "zip_code": "Postal code if known",
  "latitude": float or null,
  "longitude": float or null,
  "confidence": 0-100,
  "address_type": "street_address|landmark|etc"
}"""
            
            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Find the exact street address for: {query}"}
                ],
                temperature=0.1,
                max_tokens=500
            )
            
            content = response.choices[0].message.content
            print(f"📦 Raw Groq response: {content[:200]}...")
            
            # Try to extract JSON from the response
            try:
                start_idx = content.find('{')
                end_idx = content.rfind('}') + 1
                if start_idx != -1 and end_idx > start_idx:
                    json_str = content[start_idx:end_idx]
                    result = json.loads(json_str)
                else:
                    result = json.loads(content)
                
                # Ensure street field has the street name
                if result.get('street') and not result.get('full_address'):
                    # Build full address from components
                    parts = []
                    if result.get('street'):
                        parts.append(result['street'])
                    if result.get('city'):
                        parts.append(result['city'])
                    if result.get('province'):
                        parts.append(result['province'])
                    parts.append('Philippines')
                    if result.get('zip_code'):
                        parts.append(result['zip_code'])
                    result['full_address'] = ', '.join(parts)
                
                print(f"✅ Groq result: {result}")
                return result
            except json.JSONDecodeError as e:
                print(f"❌ Failed to parse JSON response: {e}")
                print(f"Response was: {content}")
                return None
            
        except Exception as e:
            print(f"❌ Groq API error: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def get_suggestions(self, query):
        """
        Get multiple address suggestions for autocomplete - returns street addresses
        """
        try:
            print(f"🔍 Groq getting suggestions for: '{query}'")
            
            client = self._get_client()
            if not client:
                return []
            
            prompt = f"""You are an AI address assistant for the Philippines. 
Given the partial address: "{query}"
Provide 3-5 possible COMPLETE STREET ADDRESSES as a JSON array.

IMPORTANT: Return the actual street addresses, not just the landmark names.
For example:
- For "bahay ni rizal", return " F. Mercado Street, Calamba, Laguna"
- For "nlsp", return "T.M. Kalaw Street, Ermita, Manila"
- For "sm moa", return "Seaside Boulevard, Pasay, Metro Manila"

Each item should have this format:
{{
  "text": "Complete street address",
  "street": "Street name only",
  "city": "City name",
  "province": "Province name",
  "confidence": 0-100
}}

Return ONLY the JSON array, no other text."""
            
            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a helpful address completion assistant. Always return exact street addresses."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.2,
                max_tokens=500
            )
            
            content = response.choices[0].message.content
            print(f"📦 Suggestions raw: {content[:200]}...")
            
            # Try to parse JSON array from response
            try:
                start_idx = content.find('[')
                end_idx = content.rfind(']') + 1
                if start_idx != -1 and end_idx > start_idx:
                    json_str = content[start_idx:end_idx]
                    suggestions_data = json.loads(json_str)
                    
                    suggestions = []
                    for i, item in enumerate(suggestions_data[:5]):
                        if isinstance(item, dict):
                            text = item.get('text', item.get('address', f"{query} (suggestion {i+1})"))
                            confidence = item.get('confidence', 80 - (i * 15))
                            street = item.get('street', '')
                            city = item.get('city', '')
                            province = item.get('province', '')
                        else:
                            text = str(item)
                            confidence = 80 - (i * 15)
                            street = ''
                            city = ''
                            province = ''
                        
                        suggestions.append({
                            'text': text,
                            'street': street,
                            'city': city,
                            'province': province,
                            'confidence': confidence
                        })
                    
                    print(f"✅ Found {len(suggestions)} suggestions")
                    return suggestions
                else:
                    return self._get_fallback_suggestions(query)
                    
            except (json.JSONDecodeError, ValueError) as e:
                print(f"⚠️ Failed to parse suggestions JSON: {e}")
                return self._get_fallback_suggestions(query)
            
        except Exception as e:
            print(f"❌ Groq suggestions error: {e}")
            return self._get_fallback_suggestions(query)
    
    def _get_fallback_suggestions(self, query):
        """Provide fallback suggestions when AI fails - with street addresses"""
        query_lower = query.lower()
        
        if "bahay ni rizal" in query_lower or "rizal" in query_lower:
            return [{
                'text': 'Mercado Street, Calamba, 4027 Laguna, Philippines',
                'street': 'Mercado Street',
                'city': 'Calamba',
                'province': 'Laguna',
                'confidence': 90
            }]
        
        elif "nlsp" in query_lower or "nslp" in query_lower or "national library" in query_lower:
            return [{
                'text': 'T.M. Kalaw Street, Ermita, Manila, 1000 Metro Manila, Philippines',
                'street': 'T.M. Kalaw Street',
                'city': 'Manila',
                'province': 'Metro Manila',
                'confidence': 95
            }]
        
        elif "sm moa" in query_lower or "mall of asia" in query_lower:
            return [{
                'text': 'Seaside Boulevard, Pasay, 1300 Metro Manila, Philippines',
                'street': 'Seaside Boulevard',
                'city': 'Pasay',
                'province': 'Metro Manila',
                'confidence': 95
            }]
        
        elif "bgc" in query_lower or "bonifacio" in query_lower:
            return [{
                'text': '11th Avenue, Bonifacio Global City, Taguig, 1630 Metro Manila, Philippines',
                'street': '11th Avenue',
                'city': 'Taguig',
                'province': 'Metro Manila',
                'confidence': 90
            }]
        
        # Generic fallbacks
        return [
            {'text': f"{query}, Metro Manila, Philippines", 'street': '', 'city': '', 'province': 'Metro Manila', 'confidence': 70},
            {'text': f"{query}, Philippines", 'street': '', 'city': '', 'province': '', 'confidence': 50},
        ]