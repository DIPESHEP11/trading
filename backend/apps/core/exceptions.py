from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status


def custom_exception_handler(exc, context):
    """
    Custom DRF exception handler — returns a consistent JSON error shape:
    {
        "success": false,
        "message": "...",
        "errors": { ... }   (optional)
    }
    """
    response = exception_handler(exc, context)

    if response is not None:
        custom_data = {
            'success': False,
            'message': _get_message(response.data),
            'errors': response.data if isinstance(response.data, dict) else {},
        }
        response.data = custom_data

    return response


def _get_message(data):
    if isinstance(data, dict):
        if 'detail' in data:
            return str(data['detail'])
        first_key = next(iter(data), None)
        if first_key:
            val = data[first_key]
            return f"{first_key}: {val[0]}" if isinstance(val, list) else str(val)
    if isinstance(data, list) and data:
        return str(data[0])
    return 'An error occurred.'
