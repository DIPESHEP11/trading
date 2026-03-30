"""
Merge tenant overrides for built-in lead fields + validation helpers.
"""
import copy
import re

from apps.crm.constants import DEFAULT_LEAD_FIELDS, DISPLAY_ONLY_KEYS

# Sensible default: E.164-style or common local formats (10–15 digits, optional +, spaces, dashes)
DEFAULT_PHONE_REGEX = r'^\+?[0-9][0-9\s\-().]{6,22}[0-9]$|^[0-9]{8,15}$'


def merge_default_fields(schema, tenant=None):
    """Return default field definitions with per-tenant order, required, label, pattern (from preset or legacy override)."""
    overrides = getattr(schema, 'default_field_overrides', None) or {}
    merged = []
    for base in DEFAULT_LEAD_FIELDS:
        f = copy.deepcopy(base)
        ovr = overrides.get(f['key'])
        if ovr is None:
            ovr = {}
        if 'order' in ovr and ovr['order'] is not None:
            try:
                f['order'] = int(ovr['order'])
            except (TypeError, ValueError):
                pass
        if 'required' in ovr:
            f['required'] = bool(ovr['required'])
        label = ovr.get('label')
        if label and str(label).strip():
            f['label'] = str(label).strip()[:200]

        if f['key'] == 'phone':
            f.pop('pattern', None)
            f.pop('phone_preset_id', None)
            pid = ovr.get('phone_preset_id')
            resolved = False
            if pid is not None and str(pid).strip() and tenant:
                for p in (getattr(tenant, 'crm_phone_regex_presets', None) or []):
                    if str(p.get('id')) == str(pid).strip():
                        pat = (p.get('pattern') or '').strip()
                        if pat:
                            f['pattern'] = pat
                        f['phone_preset_id'] = str(pid).strip()
                        resolved = True
                        break
            if not resolved and ('pattern' in ovr or 'phone_pattern' in ovr):
                pat = ovr.get('pattern') or ovr.get('phone_pattern')
                if pat and str(pat).strip():
                    f['pattern'] = str(pat).strip()

        merged.append(f)

    merged.sort(key=lambda x: x.get('order', 999))
    return merged


def effective_form_fields(schema, exclude_display_only=True, tenant=None):
    """Default (merged) + custom fields, sorted by order."""
    defaults = merge_default_fields(schema, tenant=tenant)
    if exclude_display_only:
        defaults = [f for f in defaults if f['key'] not in DISPLAY_ONLY_KEYS]
    custom = schema.fields or []
    combined = list(defaults) + list(custom)
    combined.sort(key=lambda x: x.get('order', 999))
    return combined


def validate_phone_value(phone: str, pattern: str | None) -> tuple[bool, str]:
    raw = (phone or '').strip()
    if not raw:
        return True, ''
    regex = (pattern or '').strip() or DEFAULT_PHONE_REGEX
    try:
        if not re.fullmatch(regex, raw):
            return False, 'Enter a valid phone number.'
    except re.error:
        try:
            if not re.fullmatch(DEFAULT_PHONE_REGEX, raw):
                return False, 'Enter a valid phone number.'
        except re.error:
            return False, 'Invalid phone validation pattern configured.'
    return True, ''


def validate_phone_for_schema(phone: str, schema, tenant=None) -> tuple[bool, str]:
    defs = merge_default_fields(schema, tenant=tenant)
    phone_field = next((f for f in defs if f['key'] == 'phone'), None)
    if not (phone or '').strip():
        if phone_field and phone_field.get('required'):
            return False, 'Phone is required.'
        return True, ''
    return validate_phone_value(phone, (phone_field or {}).get('pattern'))


def validate_required_from_schema(schema, data: dict, tenant=None) -> tuple[bool, str, str | None]:
    """
    Validate required flags on merged default + custom fields (for public submit).
    data: flat key -> string value
    Returns (ok, error_message, field_key).
    """
    for field_def in effective_form_fields(schema, exclude_display_only=True, tenant=tenant):
        key = field_def.get('key')
        if not key or key in DISPLAY_ONLY_KEYS:
            continue
        if not field_def.get('required'):
            continue
        val = data.get(key, '')
        if isinstance(val, (list, tuple)):
            val = val[0] if val else ''
        val = str(val).strip() if val else ''
        if not val:
            return False, f'"{field_def.get("label", key)}" is required.', key
        if field_def.get('type') == 'phone':
            ok, err = validate_phone_value(val, field_def.get('pattern'))
            if not ok:
                return False, err, key
    return True, '', None
