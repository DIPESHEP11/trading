DEFAULT_MFG_FIELDS = [
    {'key': 'mfg_number',    'label': 'MFG ID',         'type': 'text',   'required': True,  'order': 0, 'readonly': True},
    {'key': 'source_type',   'label': 'Source',          'type': 'select', 'required': True,  'order': 1,
     'options': ['manual', 'order', 'lead']},
    {'key': 'order_ref',     'label': 'Order No',        'type': 'text',   'required': False, 'order': 2},
    {'key': 'lead_ref',      'label': 'Lead Ref',        'type': 'text',   'required': False, 'order': 3},
    {'key': 'product_name',  'label': 'Product Name',    'type': 'text',   'required': True,  'order': 4},
    {'key': 'product_count', 'label': 'Product Count',   'type': 'number', 'required': True,  'order': 5},
    {'key': 'assigned_to',   'label': 'Assigned To',     'type': 'text',   'required': False, 'order': 6},
    {'key': 'notes',         'label': 'Notes',           'type': 'textarea','required': False, 'order': 7},
]

DEFAULT_STATUSES = [
    {'key': 'not_started', 'label': 'Not Yet Started', 'color': '#64748b', 'order': 0},
    {'key': 'processing',  'label': 'Processing',      'color': '#3b82f6', 'order': 1},
    {'key': 'completed',   'label': 'Completed',       'color': '#10b981', 'order': 2},
]

MFG_CORE_KEYS = {
    'mfg_number', 'source_type', 'order_ref', 'lead_ref',
    'product_name', 'product_count', 'assigned_to', 'notes', 'status',
}

STATUS_SORT_ORDER = {'processing': 0, 'not_started': 1, 'completed': 2}
