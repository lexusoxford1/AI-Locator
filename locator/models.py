from django.db import models

class Address(models.Model):
    address_line = models.CharField(max_length=255, blank=True, null=True, default="Unknown Address")
    street = models.CharField(max_length=255, blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    province = models.CharField(max_length=100, blank=True, null=True)
    country = models.CharField(max_length=100, default='Philippines')
    zip_code = models.CharField(max_length=20, blank=True, null=True)
    latitude = models.FloatField()
    longitude = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.address_line or "Unknown Address"