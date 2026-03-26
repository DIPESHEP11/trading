"""
Invoice PDF generator — renders a Tax Invoice / Bill of Supply matching
the BrandLabz-style design: logo + header, bill-to, items table, totals,
bank notes, authorized signature. Also dispatch sticker PDF with optional QR.
"""
import base64
import os
from io import BytesIO
from decimal import Decimal
from xhtml2pdf import pisa
from django.conf import settings

from .models import INDIAN_STATES


def _qrcode_data_uri(text, size=2, box_size=6):
    """Return a data URI for a QR code image, or empty string if qrcode not available."""
    try:
        import qrcode
        qr = qrcode.QRCode(version=1, box_size=box_size, border=2)
        qr.add_data(text)
        qr.make(fit=True)
        img = qr.make_image(fill_color='black', back_color='white')
        buf = BytesIO()
        img.save(buf, format='PNG')
        return f'data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}'
    except Exception:
        return ''


def qrcode_png_bytes(text, box_size=4):
    """Return QR code as PNG bytes for the given text, or None if qrcode not available."""
    try:
        import qrcode
        qr = qrcode.QRCode(version=1, box_size=box_size, border=2)
        qr.add_data(text)
        qr.make(fit=True)
        img = qr.make_image(fill_color='black', back_color='white')
        buf = BytesIO()
        img.save(buf, format='PNG')
        return buf.getvalue()
    except Exception:
        return None


def _state_name(code):
    for c, n in INDIAN_STATES:
        if c == code:
            return f'{n} ({c})'
    return code


def _logo_as_data_uri(settings_obj):
    """Return logo as base64 data URI or empty string."""
    if not settings_obj.company_logo:
        return ''
    try:
        logo_path = os.path.join(settings.MEDIA_ROOT, str(settings_obj.company_logo))
        if not os.path.exists(logo_path):
            return ''
        with open(logo_path, 'rb') as f:
            data = f.read()
        ext = logo_path.rsplit('.', 1)[-1].lower()
        mime = {'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
                'gif': 'image/gif', 'svg': 'image/svg+xml', 'webp': 'image/webp'}.get(ext, 'image/png')
        return f'data:{mime};base64,{base64.b64encode(data).decode()}'
    except Exception:
        return ''


def _fmt(val):
    """Format a Decimal / float for display with commas (Indian style)."""
    try:
        n = float(val)
    except (TypeError, ValueError):
        return '0.00'
    if n == 0:
        return '0.00'
    sign = '-' if n < 0 else ''
    n = abs(n)
    whole = int(n)
    decimal_part = f'{n - whole:.2f}'[1:]  # .XX
    s = str(whole)
    if len(s) <= 3:
        return f'{sign}{s}{decimal_part}'
    result = s[-3:]
    s = s[:-3]
    while s:
        result = s[-2:] + ',' + result
        s = s[:-2]
    return f'{sign}{result}{decimal_part}'


def generate_invoice_pdf(invoice, inv_settings):
    """Generate a PDF for the given invoice, returns bytes."""

    is_gst = invoice.is_gst
    is_intra = invoice.is_intra_state
    logo_uri = _logo_as_data_uri(inv_settings)
    items = invoice.line_items.all()
    cur = getattr(inv_settings, 'currency_symbol', '₹') or '₹'

    # Determine heading
    type_map = {
        'tax_invoice': 'TAX INVOICE',
        'bill_of_supply': 'BILL OF SUPPLY',
        'proforma': 'PROFORMA INVOICE',
        'cash_memo': 'CASH MEMO',
    }
    heading = type_map.get(invoice.invoice_type, 'INVOICE')

    # Supplier info block
    supplier_lines = []
    if inv_settings.supplier_name:
        supplier_lines.append(f'<b>{inv_settings.supplier_name}</b>')
    if inv_settings.supplier_address:
        supplier_lines.append(inv_settings.supplier_address)
    city_state_pin = ', '.join(filter(None, [
        inv_settings.supplier_city,
        _state_name(inv_settings.supplier_state) if inv_settings.supplier_state else '',
        inv_settings.supplier_pincode
    ]))
    if city_state_pin:
        supplier_lines.append(city_state_pin)
    if is_gst and inv_settings.supplier_gstin:
        supplier_lines.append(f'GSTIN {inv_settings.supplier_gstin}')
    if inv_settings.msme_type:
        supplier_lines.append(f'MSME/UDYAM Type : {inv_settings.msme_type}')
    if inv_settings.msme_number:
        supplier_lines.append(f'MSME/UDYAM No : {inv_settings.msme_number}')

    supplier_html = '<br/>'.join(supplier_lines)

    # Recipient info
    recipient_lines = []
    recipient_lines.append(f'<b>{invoice.recipient_name}</b>')
    if invoice.recipient_address:
        recipient_lines.append(invoice.recipient_address)
    r_city_state = ', '.join(filter(None, [
        invoice.recipient_city,
        _state_name(invoice.recipient_state) if invoice.recipient_state else '',
        invoice.recipient_pincode
    ]))
    if r_city_state:
        recipient_lines.append(r_city_state)
    if is_gst and invoice.recipient_gstin:
        recipient_lines.append(f'{invoice.recipient_gstin}')
        recipient_lines.append('GSTIN')

    recipient_html = '<br/>'.join(recipient_lines)

    # Place of supply
    pos = _state_name(invoice.place_of_supply) if invoice.place_of_supply else ''

    # Date formatting
    inv_date = invoice.created_at.strftime('%d/%m/%Y') if invoice.created_at else ''
    due_date = invoice.due_date.strftime('%d/%m/%Y') if invoice.due_date else inv_date

    # Build items rows
    items_html = ''
    for idx, item in enumerate(items, 1):
        cgst_display = ''
        sgst_display = ''
        igst_display = ''
        if is_gst:
            if is_intra:
                cgst_display = f'''
                    <td class="num">{_fmt(item.cgst_amount)}<br/><span class="small">{item.cgst_rate}%</span></td>
                    <td class="num">{_fmt(item.sgst_amount)}<br/><span class="small">{item.sgst_rate}%</span></td>
                '''
            else:
                igst_display = f'''
                    <td class="num">{_fmt(item.igst_amount)}<br/><span class="small">{item.igst_rate}%</span></td>
                '''

        if is_gst and is_intra:
            items_html += f'''
            <tr>
                <td class="center">{idx}</td>
                <td>{item.description}</td>
                <td class="center">{item.hsn_sac}</td>
                <td class="num">{item.quantity}</td>
                <td class="num">{_fmt(item.rate)}</td>
                {cgst_display}
                {sgst_display}
                <td class="num">{_fmt(item.taxable_value)}</td>
            </tr>'''
        elif is_gst and not is_intra:
            items_html += f'''
            <tr>
                <td class="center">{idx}</td>
                <td>{item.description}</td>
                <td class="center">{item.hsn_sac}</td>
                <td class="num">{item.quantity}</td>
                <td class="num">{_fmt(item.rate)}</td>
                {igst_display}
                <td class="num">{_fmt(item.taxable_value)}</td>
            </tr>'''
        else:
            items_html += f'''
            <tr>
                <td class="center">{idx}</td>
                <td>{item.description}</td>
                <td class="num">{item.quantity}</td>
                <td class="num">{_fmt(item.rate)}</td>
                <td class="num">{_fmt(item.taxable_value)}</td>
            </tr>'''

    # Table headers
    if is_gst and is_intra:
        cols = 8
        table_header = '''
            <th class="center" style="width:30px">#</th>
            <th>Item &amp; Description</th>
            <th class="center" style="width:70px">HSN/SAC</th>
            <th class="num" style="width:40px">Qty</th>
            <th class="num" style="width:80px">Rate</th>
            <th class="num" style="width:75px">CGST</th>
            <th class="num" style="width:75px">SGST</th>
            <th class="num" style="width:85px">Amount</th>'''
    elif is_gst and not is_intra:
        cols = 7
        table_header = '''
            <th class="center" style="width:30px">#</th>
            <th>Item &amp; Description</th>
            <th class="center" style="width:70px">HSN/SAC</th>
            <th class="num" style="width:40px">Qty</th>
            <th class="num" style="width:80px">Rate</th>
            <th class="num" style="width:85px">IGST</th>
            <th class="num" style="width:85px">Amount</th>'''
    else:
        cols = 5
        table_header = '''
            <th class="center" style="width:30px">#</th>
            <th>Item &amp; Description</th>
            <th class="num" style="width:40px">Qty</th>
            <th class="num" style="width:80px">Rate</th>
            <th class="num" style="width:85px">Amount</th>'''

    # Totals section
    totals_rows = f'''
        <tr><td colspan="{cols - 1}" class="totals-label">Sub Total</td>
            <td class="num">{_fmt(invoice.total_taxable_value)}</td></tr>'''

    if is_gst:
        if is_intra:
            cgst_rate = items[0].cgst_rate if items else Decimal('0')
            sgst_rate = items[0].sgst_rate if items else Decimal('0')
            totals_rows += f'''
        <tr><td colspan="{cols - 1}" class="totals-label">CGST ({cgst_rate}%)</td>
            <td class="num">{_fmt(invoice.total_cgst)}</td></tr>
        <tr><td colspan="{cols - 1}" class="totals-label">SGST ({sgst_rate}%)</td>
            <td class="num">{_fmt(invoice.total_sgst)}</td></tr>'''
        else:
            igst_rate = items[0].igst_rate if items else Decimal('0')
            totals_rows += f'''
        <tr><td colspan="{cols - 1}" class="totals-label">IGST ({igst_rate}%)</td>
            <td class="num">{_fmt(invoice.total_igst)}</td></tr>'''

    if invoice.total_cess > 0:
        totals_rows += f'''
        <tr><td colspan="{cols - 1}" class="totals-label">Cess</td>
            <td class="num">{_fmt(invoice.total_cess)}</td></tr>'''

    if invoice.round_off and invoice.round_off != 0:
        totals_rows += f'''
        <tr><td colspan="{cols - 1}" class="totals-label">Round Off</td>
            <td class="num">{_fmt(invoice.round_off)}</td></tr>'''

    totals_rows += f'''
        <tr class="grand-total"><td colspan="{cols - 1}" class="totals-label"><b>Total</b></td>
            <td class="num"><b>{cur}{_fmt(invoice.grand_total)}</b></td></tr>
        <tr class="balance-due"><td colspan="{cols - 1}" class="totals-label"><b>Balance Due</b></td>
            <td class="num"><b>{cur}{_fmt(invoice.grand_total)}</b></td></tr>'''

    # Total in words
    words_html = ''
    if invoice.grand_total_words:
        words_html = f'''
        <tr><td colspan="{cols - 1}" class="totals-label" style="font-size:8px;">Total In Words:</td>
            <td class="num" style="font-size:8px; color:#d97706; font-style:italic; font-weight:600;">
                <i>{invoice.grand_total_words}</i>
            </td></tr>'''

    # Reverse charge
    rc_html = ''
    if invoice.is_reverse_charge:
        rc_html = '<p style="font-size:8px; color:#dc2626; margin-top:4px;"><b>Reverse Charge Applicable</b></p>'

    # Bank notes
    bank_lines = []
    if inv_settings.bank_name or inv_settings.bank_account_number:
        bank_lines.append(f'Account Details: {inv_settings.supplier_name}')
        if inv_settings.bank_account_number:
            bank_lines.append(f'Account no:{inv_settings.bank_account_number}')
        if inv_settings.bank_name and inv_settings.bank_branch:
            bank_lines.append(f'{inv_settings.bank_name} {inv_settings.bank_branch}')
        elif inv_settings.bank_name:
            bank_lines.append(inv_settings.bank_name)
        if inv_settings.bank_ifsc:
            bank_lines.append(f'IFsc code:{inv_settings.bank_ifsc}')
    if inv_settings.supplier_gstin:
        bank_lines.append(f'GSTIN :{inv_settings.supplier_gstin}')
    if inv_settings.supplier_pan:
        bank_lines.append(f'PAN : {inv_settings.supplier_pan}')
    if inv_settings.supplier_phone:
        bank_lines.append(f'PH:{inv_settings.supplier_phone}')

    notes_html = '<br/>'.join(bank_lines) if bank_lines else ''
    if invoice.notes:
        notes_html = invoice.notes + '<br/>' + notes_html if notes_html else invoice.notes

    # Logo HTML
    logo_html = ''
    if logo_uri:
        logo_html = f'<img src="{logo_uri}" style="max-height:60px; max-width:200px;" />'

    # IRN / E-invoice
    irn_html = ''
    if invoice.irn:
        irn_html = f'<p style="font-size:7px; color:#64748b; margin-top:4px;">IRN: {invoice.irn}</p>'

    # Authorized signatory
    sig_name = inv_settings.authorized_signatory or ''

    # Full HTML
    html = f'''<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
    @page {{
        size: A4;
        margin: 15mm 12mm 15mm 12mm;
    }}
    body {{
        font-family: Helvetica, Arial, sans-serif;
        font-size: 9px;
        color: #1e293b;
        line-height: 1.4;
    }}
    .header-table {{ width: 100%; margin-bottom: 10px; }}
    .header-table td {{ vertical-align: top; }}
    .heading {{ font-size: 26px; font-weight: 700; color: #d97706; text-align: right; letter-spacing: 1px; }}
    .inv-number {{ font-size: 10px; color: #475569; text-align: right; margin-top: 2px; }}
    .balance-box {{ text-align: right; margin-top: 6px; }}
    .balance-label {{ font-size: 9px; color: #64748b; }}
    .balance-amount {{ font-size: 16px; font-weight: 700; color: #1e293b; }}

    .info-table {{ width: 100%; margin-bottom: 8px; }}
    .info-table td {{ vertical-align: top; font-size: 9px; }}
    .bill-to-label {{ font-size: 9px; color: #64748b; margin-bottom: 2px; }}
    .bill-to-name {{ font-size: 11px; font-weight: 700; }}

    .meta-row {{ text-align: right; font-size: 9px; }}
    .meta-label {{ color: #64748b; font-weight: 600; }}

    .pos {{ font-size: 9px; margin-bottom: 8px; }}

    .items-table {{ width: 100%; border-collapse: collapse; margin-bottom: 2px; }}
    .items-table th {{
        background: #1e293b; color: #fff; font-size: 8px; font-weight: 600;
        padding: 6px 5px; text-transform: uppercase; letter-spacing: 0.3px;
    }}
    .items-table td {{ padding: 6px 5px; border-bottom: 1px solid #e2e8f0; font-size: 9px; }}
    .items-table .center {{ text-align: center; }}
    .items-table .num {{ text-align: right; }}
    .items-table .small {{ font-size: 7px; color: #94a3b8; }}

    .totals-label {{ text-align: right; padding-right: 10px; font-size: 9px; }}
    .grand-total td {{ border-top: 1.5px solid #1e293b; padding-top: 6px; font-size: 10px; }}
    .balance-due td {{
        background: #fef3c7; padding: 6px 5px; font-size: 10px;
    }}

    .notes-section {{ margin-top: 20px; }}
    .notes-label {{ font-size: 9px; font-weight: 700; margin-bottom: 4px; }}
    .notes-text {{ font-size: 8px; color: #475569; line-height: 1.5; }}

    .signature-section {{ margin-top: 30px; text-align: right; }}
    .sig-label {{ font-size: 9px; color: #64748b; }}
    .sig-line {{ border-top: 1px solid #1e293b; display: inline-block; width: 200px; margin-top: 30px; }}

    .footer {{ margin-top: 10px; font-size: 7px; color: #94a3b8; text-align: center; }}
</style>
</head>
<body>

<!-- ═══ HEADER ═══ -->
<table class="header-table">
<tr>
    <td style="width:55%;">
        {logo_html}
        <div style="font-size:9px; margin-top:6px;">
            {supplier_html}
        </div>
    </td>
    <td style="width:45%;">
        <div class="heading">{heading}</div>
        <div class="inv-number"># {invoice.invoice_number}</div>
        <div class="balance-box">
            <div class="balance-label">Balance Due</div>
            <div class="balance-amount">&#8377;{_fmt(invoice.grand_total)}</div>
        </div>
    </td>
</tr>
</table>

{rc_html}

<!-- ═══ BILL TO + META ═══ -->
<table class="info-table">
<tr>
    <td style="width:55%;">
        <div class="bill-to-label">Bill To</div>
        <div style="font-size:9px;">{recipient_html}</div>
    </td>
    <td style="width:45%;">
        <table style="width:100%;">
            <tr><td class="meta-row"><span class="meta-label">Invoice Date :</span></td>
                <td class="meta-row">{inv_date}</td></tr>
            <tr><td class="meta-row"><span class="meta-label">Terms :</span></td>
                <td class="meta-row">Due on Receipt</td></tr>
            <tr><td class="meta-row"><span class="meta-label">Due Date :</span></td>
                <td class="meta-row">{due_date}</td></tr>
        </table>
    </td>
</tr>
</table>

{f'<div class="pos"><b>Place Of Supply:</b> {pos}</div>' if pos else ''}

<!-- ═══ LINE ITEMS TABLE ═══ -->
<table class="items-table">
<thead><tr>{table_header}</tr></thead>
<tbody>
{items_html}
{totals_rows}
{words_html}
</tbody>
</table>

{irn_html}

<!-- ═══ NOTES ═══ -->
<div class="notes-section">
    <div class="notes-label">Notes</div>
    <div class="notes-text">{notes_html}</div>
</div>

<!-- ═══ TERMS ═══ -->
{f'<div style="margin-top:10px; font-size:8px; color:#64748b;"><b>Terms & Conditions:</b><br/>{invoice.terms}</div>' if invoice.terms else ''}

<!-- ═══ AUTHORIZED SIGNATURE ═══ -->
<div class="signature-section">
    <div class="sig-label">Authorized Signature</div>
    <div class="sig-line"></div>
    {f'<div style="font-size:8px; margin-top:4px; color:#475569;">{sig_name}</div>' if sig_name else ''}
</div>

<div class="footer">
    This is a computer generated invoice.
</div>

</body>
</html>'''

    buffer = BytesIO()
    pisa_status = pisa.CreatePDF(html, dest=buffer, encoding='utf-8')
    if pisa_status.err:
        raise Exception(f'PDF generation failed: {pisa_status.err}')
    return buffer.getvalue()


def generate_dispatch_sticker_pdf(sticker, inv_settings):
    """Generate a shipping label / dispatch sticker PDF. Returns bytes."""
    invoice = sticker.invoice
    items = list(invoice.line_items.all())
    cur = getattr(inv_settings, 'currency_symbol', '₹') or '₹'

    from_lines = []
    if getattr(sticker, 'from_name_override', ''):
        from_lines.append(sticker.from_name_override or '—')
    else:
        from_lines.append(invoice.supplier_name or '—')

    if getattr(sticker, 'from_address_override', ''):
        from_lines.append(sticker.from_address_override)
    else:
        from_lines.extend([
            invoice.supplier_address or '',
            ', '.join(filter(None, [
                getattr(invoice, 'supplier_city', '') or '',
                _state_name(invoice.supplier_state) if invoice.supplier_state else '',
                getattr(invoice, 'supplier_pincode', '') or '',
            ])),
        ])
    from_html = '<br/>'.join(p for p in from_lines if p)

    to_lines = [
        invoice.recipient_name or '—',
        invoice.recipient_address or '',
        ', '.join(filter(None, [invoice.recipient_city, _state_name(invoice.recipient_state) if invoice.recipient_state else '', invoice.recipient_pincode or ''])),
        invoice.recipient_phone or '',
    ]
    to_html = '<br/>'.join(p for p in to_lines if p)

    product_rows = ''.join(
        f'<tr><td>{i.description}</td><td class="num">{i.quantity}</td><td class="num">{_fmt(i.rate)}</td><td class="num">{cur}{_fmt(i.total)}</td></tr>'
        for i in items
    )

    courier_label = sticker.get_courier_display() if hasattr(sticker, 'get_courier_display') else sticker.courier
    if sticker.courier == 'custom' and sticker.courier_name_custom:
        courier_label = sticker.courier_name_custom
    awb = sticker.awb_number or '—'
    dispatch_code = f'DISP-{sticker.id}-{invoice.invoice_number}-{sticker.awb_number or "NA"}'
    qr_uri = _qrcode_data_uri(dispatch_code)
    qr_img = f'<img src="{qr_uri}" style="width:80px; height:80px;" alt="QR" />' if qr_uri else ''

    html = f'''<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
    @page {{ size: A4; margin: 12mm; }}
    body {{ font-family: Helvetica, Arial, sans-serif; font-size: 10px; color: #1e293b; line-height: 1.4; }}
    .sticker-header {{ font-size: 18px; font-weight: 700; color: #1e293b; margin-bottom: 12px; border-bottom: 2px solid #1e293b; padding-bottom: 8px; }}
    .two-col {{ width: 100%; border-collapse: collapse; margin-bottom: 14px; }}
    .two-col td {{ vertical-align: top; width: 50%; padding: 10px; border: 1px solid #e2e8f0; }}
    .label {{ font-size: 8px; text-transform: uppercase; color: #64748b; margin-bottom: 4px; font-weight: 700; }}
    .products-table {{ width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 9px; }}
    .products-table th {{ background: #1e293b; color: #fff; padding: 6px 8px; text-align: left; }}
    .products-table td {{ padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }}
    .products-table .num {{ text-align: right; }}
    .totals {{ text-align: right; font-size: 14px; font-weight: 700; margin: 10px 0; }}
    .code-box {{ font-family: monospace; font-size: 11px; background: #f1f5f9; padding: 10px; margin: 10px 0; word-break: break-all; border: 1px dashed #94a3b8; }}
    .footer {{ margin-top: 12px; font-size: 8px; color: #94a3b8; }}
</style>
</head>
<body>
<div class="sticker-header">DISPATCH STICKER</div>
<table class="two-col">
<tr>
    <td><div class="label">From</div><div>{from_html}</div></td>
    <td><div class="label">To</div><div>{to_html}</div></td>
</tr>
</table>
<table class="products-table">
<thead><tr><th>Product</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead>
<tbody>{product_rows}</tbody>
</table>
<div class="totals">Total: {cur}{_fmt(invoice.grand_total)}</div>
<div class="label">Courier</div><div>{courier_label}</div>
<div class="label">AWB / Tracking</div><div style="font-weight:700;">{awb}</div>
<div class="label">Product / Dispatch ID (scan QR or quote code)</div>
<div style="display:flex; align-items: center; gap: 12px; margin: 8px 0;">
    {qr_img}
    <div class="code-box" style="flex:1;">{dispatch_code}</div>
</div>
<div class="footer">Invoice: {invoice.invoice_number} | Dispatched: {sticker.dispatched_at.strftime("%d/%m/%Y %H:%M") if sticker.dispatched_at else "—"}</div>
</body>
</html>'''

    buffer = BytesIO()
    pisa_status = pisa.CreatePDF(html, dest=buffer, encoding='utf-8')
    if pisa_status.err:
        raise Exception(f'PDF generation failed: {pisa_status.err}')
    return buffer.getvalue()
