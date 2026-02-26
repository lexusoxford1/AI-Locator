from django.urls import path
from . import views

urlpatterns = [
    path('', views.locator_view, name='locator'),
    path('api/google-autocomplete/', views.google_places_autocomplete, name='google_autocomplete'),
    path('api/ai-suggestions/', views.ai_address_suggestions, name='ai-suggestions'),
    path('api/ai-complete/', views.ai_complete_address, name='ai_complete'),
    path('api/groq-location/', views.groq_location_from_coordinates, name='groq_location'),
]