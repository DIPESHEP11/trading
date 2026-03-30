import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

# Connect to the default 'postgres' database
try:
    conn = psycopg2.connect(
        dbname='postgres',
        user='postgres',
        password='12345678',  # Matches .env
        host='localhost',
        port='5432'
    )
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cursor = conn.cursor()

    # Check if database exists
    cursor.execute("SELECT 1 FROM pg_catalog.pg_database WHERE datname = 'trading_db'")
    exists = cursor.fetchone()
    if not exists:
        cursor.execute('CREATE DATABASE trading_db')
        print("Database 'trading_db' created successfully.")
    else:
        print("Database 'trading_db' already exists.")

    cursor.close()
    conn.close()
except Exception as e:
    print(f"Error creating database: {e}")
