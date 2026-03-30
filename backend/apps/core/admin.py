from django.contrib import admin
from django.apps import apps
from django.db import models

# List of all apps configured in the project
target_apps = [app.name for app in apps.get_app_configs() if app.name.startswith('apps.')]

for app_name in target_apps:
    app_label = app_name.split('.')[-1]
    app_config = apps.get_app_config(app_label)
    
    for model in app_config.get_models():
        try:
            admin_class_name = f"{model.__name__}Admin"
            
            # Collect simple fields for list display to make the admin useful
            list_display_fields = []
            for field in model._meta.fields:
                # TextField can be too huge for list view
                if not isinstance(field, (models.TextField, models.JSONField)):
                    list_display_fields.append(field.name)
            
            # If no fields found, fallback to just id
            if not list_display_fields:
                list_display_fields = ['id']
                
            admin_class = type(
                admin_class_name,
                (admin.ModelAdmin,),
                {
                    'list_display': tuple(list_display_fields),
                }
            )
            admin.site.register(model, admin_class)
        except admin.sites.AlreadyRegistered:
            pass
