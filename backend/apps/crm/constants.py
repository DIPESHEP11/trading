"""
CRM constants. Default lead fields are always available; clients add custom fields via schema.
"""
# Default fields: key -> (label, type). Always shown in form, table, Excel.
# Keys must match backend mapping in form submit and import.
DEFAULT_LEAD_FIELDS = [
    {'key': 'name', 'label': 'Name', 'type': 'text', 'required': True, 'order': 0},
    {'key': 'phone', 'label': 'Contact', 'type': 'phone', 'required': False, 'order': 1},
    {'key': 'email', 'label': 'Email', 'type': 'email', 'required': False, 'order': 2},
    {'key': 'address', 'label': 'Address', 'type': 'textarea', 'required': False, 'order': 3},
    {'key': 'product_name', 'label': 'Product name', 'type': 'text', 'required': False, 'order': 4},
    {'key': 'product_count', 'label': 'Product count', 'type': 'number', 'required': False, 'order': 5},
    {'key': 'company', 'label': 'Company', 'type': 'text', 'required': False, 'order': 6},
    {'key': 'source', 'label': 'Source', 'type': 'text', 'required': False, 'order': 7},
    {'key': 'status', 'label': 'Status', 'type': 'text', 'required': False, 'order': 8},
    {'key': 'date', 'label': 'Date', 'type': 'text', 'required': False, 'order': 9},  # Display only; created_at
]
# Keys that map to Lead model (not custom_data)
LEAD_CORE_KEYS = {'name', 'phone', 'email', 'company', 'source', 'status'}
# Keys stored in custom_data (address, product_name, product_count, plus any user-defined)
CUSTOM_DATA_KEYS = {'address', 'product_name', 'product_count'}
# Keys that are display-only (not editable in add form)
DISPLAY_ONLY_KEYS = {'date'}
