from django.db import models

class Address(models.Model):
    address_line = models.CharField(max_length=500)
    street = models.CharField(max_length=200, blank=True, default="")
    city = models.CharField(max_length=100, blank=True, default="")
    province = models.CharField(max_length=100, blank=True, default="")
    country = models.CharField(max_length=100, blank=True, default="")
    zip_code = models.CharField(max_length=20, blank=True, default="")
    latitude = models.FloatField(blank=True, null=True)
    longitude = models.FloatField(blank=True, null=True)

    def __str__(self):
        return self.address_line

    class Meta:
        verbose_name = "Address"
        verbose_name_plural = "Addresses"