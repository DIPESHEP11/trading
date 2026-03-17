# Tenant schema migrations

When you add or change models in **tenant apps** (e.g. `apps.config`, `apps.crm`, `apps.invoices`), run:

```bash
# From backend directory, with your venv activated:
python manage.py migrate_schemas
```

This applies pending migrations to **all tenant schemas** (each client has its own DB schema). If you only run `python manage.py migrate`, the **public** schema is updated but tenant schemas are not.

**If the Settings page shows** “column config_tenantconfig.company_rules does not exist” or “Settings database schema is outdated”, run the command above and reload the page.
