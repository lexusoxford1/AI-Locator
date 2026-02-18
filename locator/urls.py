from django.urls import path
from . import views

urlpatterns = [
    path('', views.locator_view, name='locator'),
    path('api/ai-suggestions/', views.ai_address_suggestions, name='ai-suggestions'),
]