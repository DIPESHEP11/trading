"""Utility to log module history for client admin audit trail."""
from apps.config.models import ModuleHistory


def log_module_history(request, module, action, title, entity_type='', entity_id='', details=None):
    """
    Log an activity to ModuleHistory. Call from views after create/update/delete/settings_change.
    """
    user = getattr(request, 'user', None)
    performed_by = user if user and user.is_authenticated else None
    performed_by_email = (user.email if user and user.is_authenticated else '') or ''

    ModuleHistory.objects.create(
        module=module,
        action=action,
        entity_type=entity_type or '',
        entity_id=str(entity_id) if entity_id else '',
        title=title[:255],
        details=details or {},
        performed_by=performed_by,
        performed_by_email=performed_by_email,
    )
