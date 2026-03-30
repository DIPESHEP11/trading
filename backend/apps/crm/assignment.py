"""
Unified automatic lead assignment.

Source of truth: TenantConfig.crm_bulk_assign_defaults (from CRM Bulk Assign tab).
"""
from django.db import connection
from apps.config.models import TenantConfig
from apps.users.models import User


def _to_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _extract_employees(raw_rows):
    """Return [(User, count)] using saved rows: [{"user_id": 5, "count": 10}, ...]."""
    if not isinstance(raw_rows, list):
        return []
    ids = []
    by_count = {}
    for row in raw_rows:
        if not isinstance(row, dict):
            continue
        uid = _to_int(row.get('user_id'), 0)
        if uid <= 0:
            continue
        if uid not in by_count:
            ids.append(uid)
        by_count[uid] = max(0, _to_int(row.get('count'), 0))
    users = {u.id: u for u in User.objects.filter(id__in=ids, is_active=True)}
    return [(users[uid], by_count.get(uid, 0)) for uid in ids if uid in users]


def _pick_round_robin(prefs, employees):
    pointer = _to_int(prefs.get('auto_rr_pointer'), 0)
    idx = pointer % len(employees)
    prefs['auto_rr_pointer'] = (idx + 1) % len(employees)
    return employees[idx][0]


def _pick_pool(prefs, employees, batch_size):
    idx = _to_int(prefs.get('auto_pool_index'), 0) % len(employees)
    remaining = _to_int(prefs.get('auto_pool_remaining'), batch_size)
    if remaining <= 0:
        remaining = batch_size
    user = employees[idx][0]
    remaining -= 1
    if remaining <= 0:
        idx = (idx + 1) % len(employees)
        remaining = batch_size
    prefs['auto_pool_index'] = idx
    prefs['auto_pool_remaining'] = remaining
    return user


def _pick_custom(prefs, employees):
    weighted = [(u, c) for u, c in employees if c > 0]
    if not weighted:
        return None
    idx = _to_int(prefs.get('auto_custom_index'), 0) % len(weighted)
    remaining = _to_int(prefs.get('auto_custom_remaining'), 0)
    if remaining <= 0:
        remaining = weighted[idx][1]
    user = weighted[idx][0]
    remaining -= 1
    if remaining <= 0:
        idx = (idx + 1) % len(weighted)
        remaining = weighted[idx][1]
    prefs['auto_custom_index'] = idx
    prefs['auto_custom_remaining'] = remaining
    return user


def auto_assign_lead_from_bulk_defaults(lead):
    """
    Assign a newly created lead using CRM Bulk Assign defaults.
    Returns assigned User or None (if no valid config/users).
    """
    tenant = getattr(connection, 'tenant', None)
    if tenant is None:
        return None
    config, _ = TenantConfig.objects.get_or_create(tenant=tenant)
    prefs = dict(config.crm_bulk_assign_defaults or {})
    employees = _extract_employees(prefs.get('employees'))
    if not employees:
        return None
    assignment_type = prefs.get('assignment_type') or 'round_robin'
    batch_size = max(1, _to_int(prefs.get('pool_batch_size'), 4))

    if assignment_type == 'pool':
        user = _pick_pool(prefs, employees, batch_size)
    elif assignment_type == 'custom':
        user = _pick_custom(prefs, employees)
    else:
        # Default fallback and preferred strategy for ongoing auto-assignment.
        user = _pick_round_robin(prefs, employees)

    if user is None:
        return None
    if lead.assigned_to_id != user.id:
        lead.assigned_to = user
        lead.save(update_fields=['assigned_to'])
    config.crm_bulk_assign_defaults = prefs
    config.save(update_fields=['crm_bulk_assign_defaults', 'updated_at'])
    return user


def auto_assign_lead_by_source(lead):
    """
    Deprecated compatibility wrapper.
    Previous source-based mapping is now unified to Bulk Assign defaults.
    """
    return auto_assign_lead_from_bulk_defaults(lead)
